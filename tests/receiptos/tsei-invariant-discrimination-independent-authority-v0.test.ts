/**
 * TSEI independent-authority scaffold v0 (PR #201).
 *
 * Proves the internal comparison/provenance scaffold mechanically.
 * Production independent grounding remains unavailable: this file may
 * reach PROVEN only through explicit synthetic test injection, and
 * asProductionGroundingEvidence is always null.
 *
 * Does not change #200 fixture results, TSEI runtime verdicts, or the
 * frozen specification artifact. Protocol-hardening observations on B
 * are metadata only and cannot mint VALID_PROVENANCE or PROVEN.
 */

import { createHash, generateKeyPairSync, sign as cryptoSign } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "bun:test"
import {
  AUTHORITY_SAN_EMAIL,
  AUTHORITY_ORACLE_SCHEMA,
  BLIND_PROBLEM_SCHEMA,
  CLAIM_BOUNDARY,
  CO_SIGNED_CHECKPOINT_TIME,
  DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED,
  DECLARED_PRODUCTION_PROVIDER,
  DECLARED_PROVIDER_SELECTION,
  DUMMY_GATE_D0_SHA256,
  DUMMY_GATE_D1_SHA256,
  DUMMY_GATE_D2_SHA256,
  OIDC_ISSUER_GITHUB_OAUTH,
  ORIGINATOR_SAN_EMAIL,
  PROVIDER_CANDIDATE_REKOR_V2,
  PROVIDER_DRY_RUN_REQUIRED_BEFORE_OBJECT_A,
  PROHIBITED_CONTROLLER_IDENTIFIERS,
  REKOR_V1_ENDPOINT,
  REKOR_V1_LOG_ID,
  SECOND_PARTY_OBSERVATION_ONLY,
  type AuthorityOraclePayload,
  type BlindProblemPackage,
  type DummyProviderEvent,
  type GenericProvenanceEnvelope,
  type ProviderDryRunInput,
  type ProviderVerificationOutcome,
} from "../../conformance/tsei-invariant-discrimination-v0/independent-authority-model"
import {
  asProductionGroundingEvidence,
  caseIdsFromMap,
  checkBlindPackageFaithfulness,
  claimBoundaryUnchanged,
  closeCaseUniverse,
  computeOracleCommitment,
  digestAuthorityOracleBytes,
  digestBlindProblemBytes,
  encodeJsonUtf8Lf,
  evaluateProductionIndependentGrounding,
  evaluateProviderDryRun,
  evaluateProviderPolicyFreeze,
  isTseiRuntimeViolation,
  leakCheckBlindPackage,
  lookupFromRekorDocuments,
  normativeDefinitionIdentity,
  providerPolicySha256,
  REKOR_V1_PROVIDER_POLICY_SHA256,
  sha256ExactBytes,
  verifyPinnedFulcioCertificate,
  verifyOracleCommitment,
  verifyRekorV1OrderedEvents,
  verifyRekorV1Publication,
} from "../../conformance/tsei-invariant-discrimination-v0/independent-authority"
import {
  evaluateSyntheticIndependentGrounding,
  injectSyntheticVerifiedProvenance,
  SYNTHETIC_TEST_PUBLISHER,
} from "../../conformance/tsei-invariant-discrimination-v0/independent-authority-synthetic"
import { INDEPENDENT_GROUNDING_REASON, INDEPENDENT_GROUNDING_STATUS } from "../../conformance/tsei-invariant-discrimination-v0/ladder"

const SPEC_PATH = resolve(import.meta.dir, "..", "..", "docs", "TRANSFORMATION_STABLE_EVIDENCE_INTEROPERABILITY_V0.md")
const EXPECTED_SPEC_SHA256 = "3396516bfd89d738327a2fa986d9cfc119169ded58704fcdbadb3d7c7442044d"

const DEF_P = "p is an even integer."
const DEF_Q = 'q does not contain the marker substring "QUARANTINE".'
const DEF_R = "r is a strictly increasing sequence of numbers."

const BASELINE = { p: 2, q: "clean", r: [1, 2, 3] as const }

function scaffoldPackage(): BlindProblemPackage {
  return {
    schema: BLIND_PROBLEM_SCHEMA,
    instance_id: "scaffold-test-instance.not-production",
    evaluation_instruction:
      "For each mutant_id, report the exact set of invariant_id values whose normative definitions do not hold on the mutated case value.",
    invariants: {
      I_P: {
        invariant_id: "I_P",
        normative_definition: DEF_P,
        normative_definition_identity: normativeDefinitionIdentity(DEF_P),
      },
      I_Q: {
        invariant_id: "I_Q",
        normative_definition: DEF_Q,
        normative_definition_identity: normativeDefinitionIdentity(DEF_Q),
      },
      I_R: {
        invariant_id: "I_R",
        normative_definition: DEF_R,
        normative_definition_identity: normativeDefinitionIdentity(DEF_R),
      },
    },
    cases: {
      M_P: { mutant_id: "M_P", baseline: BASELINE, mutated: { p: 3, q: "clean", r: [1, 2, 3] } },
      M_Q: { mutant_id: "M_Q", baseline: BASELINE, mutated: { p: 2, q: "QUARANTINE-here", r: [1, 2, 3] } },
      M_PQ: { mutant_id: "M_PQ", baseline: BASELINE, mutated: { p: 3, q: "QUARANTINE-here", r: [1, 2, 3] } },
    },
  }
}

function intendedFrom(pkg: BlindProblemPackage) {
  return {
    invariants: Object.fromEntries(
      Object.entries(pkg.invariants).map(([id, row]) => [
        id,
        { normative_definition: row.normative_definition, normative_definition_identity: row.normative_definition_identity },
      ]),
    ),
    cases: Object.fromEntries(
      Object.entries(pkg.cases).map(([id, row]) => [id, { baseline: row.baseline, mutated: row.mutated }]),
    ),
  }
}

const OBSERVED = {
  M_P: ["I_P"],
  M_Q: ["I_Q"],
  M_PQ: ["I_P", "I_Q"],
} as const

function matchingAuthority(digest: string): AuthorityOraclePayload {
  return {
    schema: AUTHORITY_ORACLE_SCHEMA,
    problem_package_digest: digest,
    cases: {
      M_P: { mutant_id: "M_P", derived_attribution_set: ["I_P"] },
      M_Q: { mutant_id: "M_Q", derived_attribution_set: ["I_Q"] },
      M_PQ: { mutant_id: "M_PQ", derived_attribution_set: ["I_P", "I_Q"] },
    },
  }
}

function syntheticOk(pkgDigest: string, oracleDigest: string, overrides?: Partial<Parameters<typeof injectSyntheticVerifiedProvenance>[0]>): ProviderVerificationOutcome {
  return injectSyntheticVerifiedProvenance({
    provider_id: "synthetic-test-only",
    trust_root_id: "synthetic-test-only.not-a-trust-root",
    publisher_identifiers: [SYNTHETIC_TEST_PUBLISHER],
    oracle_bytes_sha256: oracleDigest,
    problem_package_digest: pkgDigest,
    freeze_precedes_comparison: true,
    freeze_precedes_answer_disclosure: true,
    source_material_refs: [],
    ...overrides,
  })
}

describe("TSEI spec freeze", () => {
  test("specification bytes are unchanged", () => {
    const sha = createHash("sha256").update(readFileSync(SPEC_PATH)).digest("hex")
    expect(sha).toBe(EXPECTED_SPEC_SHA256)
  })
})

describe("#200 independent grounding remains UNPROVEN", () => {
  test("published instance status and reason are unchanged", () => {
    expect(INDEPENDENT_GROUNDING_STATUS).toBe("UNPROVEN")
    expect(INDEPENDENT_GROUNDING_REASON).toContain("INDEPENDENT_GROUNDING_NOT_PROVEN")
    expect(INDEPENDENT_GROUNDING_REASON).toContain("single authoring authority")
  })
})

describe("Object A leak checks", () => {
  test("clean scaffold package has no leaks and is faithful", () => {
    const pkg = scaffoldPackage()
    expect(leakCheckBlindPackage(pkg).clean).toBe(true)
    expect(checkBlindPackageFaithfulness(pkg, intendedFrom(pkg)).faithful).toBe(true)
  })

  test("harness predicate source is forbidden from A", () => {
    const pkg = { ...scaffoldPackage(), predicate_source: "(value) => value.p % 2 === 0" }
    expect(leakCheckBlindPackage(pkg).clean).toBe(false)
  })

  test("executable predicate is forbidden from A", () => {
    const pkg = { ...scaffoldPackage(), predicate: () => true }
    expect(leakCheckBlindPackage(pkg).clean).toBe(false)
  })

  test("evaluator output is forbidden from A", () => {
    const pkg = { ...scaffoldPackage(), evaluator_output: { M_P: ["I_P"] } }
    expect(leakCheckBlindPackage(pkg).clean).toBe(false)
  })

  test("expected_attribution is forbidden from A", () => {
    const pkg = { ...scaffoldPackage(), expected_attribution: ["I_P"] }
    expect(leakCheckBlindPackage(pkg).clean).toBe(false)
  })

  test("expected_attribution_digest is forbidden from A", () => {
    const pkg = { ...scaffoldPackage(), expected_attribution_digest: "abcd" }
    expect(leakCheckBlindPackage(pkg).clean).toBe(false)
  })
})

describe("Object A exact-byte digest (no self-recursion)", () => {
  test("digest is SHA-256 of exact bytes computed outside the package", () => {
    const pkg = scaffoldPackage()
    const bytes = encodeJsonUtf8Lf(pkg)
    const digest = digestBlindProblemBytes(bytes)
    expect(digest).toBe(sha256ExactBytes(bytes))
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
    expect("artifact_digest" in pkg).toBe(false)
    expect(JSON.stringify(pkg).includes("artifact_digest")).toBe(false)
  })

  test("including artifact_digest is a leak, not a digest input", () => {
    const pkg = { ...scaffoldPackage(), artifact_digest: "00".repeat(32) }
    expect(leakCheckBlindPackage(pkg).clean).toBe(false)
    const bytes = encodeJsonUtf8Lf(scaffoldPackage())
    expect(digestBlindProblemBytes(bytes)).not.toBe("00".repeat(32))
  })
})

describe("closed case universe", () => {
  test("exact set equality; coverage count derived from the closed set", () => {
    const declared = caseIdsFromMap(scaffoldPackage().cases)
    const report = closeCaseUniverse({
      declared,
      packaged: declared,
      authority: declared,
      comparison: declared,
    })
    expect(report.closed).toBe(true)
    expect(report.closed_case_count).toBe(report.DECLARED_CASE_IDS.length)
    expect(report.closed_case_count).toBe(new Set(report.DECLARED_CASE_IDS).size)
    expect(report.DECLARED_CASE_IDS).toEqual(["M_P", "M_PQ", "M_Q"])
  })

  test("missing case is detected", () => {
    const declared = new Set(["M_P", "M_Q", "M_PQ"])
    const report = closeCaseUniverse({
      declared,
      packaged: declared,
      authority: new Set(["M_P", "M_Q"]),
      comparison: declared,
    })
    expect(report.closed).toBe(false)
    expect(report.missing_from_authority).toEqual(["M_PQ"])
    expect(report.closed_case_count).toBeNull()
  })

  test("extra case is detected", () => {
    const declared = new Set(["M_P", "M_Q", "M_PQ"])
    const report = closeCaseUniverse({
      declared,
      packaged: declared,
      authority: new Set(["M_P", "M_Q", "M_PQ", "M_ALIAS"]),
      comparison: declared,
    })
    expect(report.closed).toBe(false)
    expect(report.extra_in_authority).toEqual(["M_ALIAS"])
    expect(report.closed_case_count).toBeNull()
  })

  test("duplicate/alias ids cannot silently close via positional counting", () => {
    const declared = new Set(["M_P", "M_Q", "M_PQ"])
    const positionalCount = 3
    const report = closeCaseUniverse({
      declared,
      packaged: declared,
      authority: new Set(["M_P", "M_Q", "M_P_ALIAS"]),
      comparison: declared,
    })
    expect(report.AUTHORITY_CASE_IDS?.length).toBe(positionalCount)
    expect(report.closed).toBe(false)
    expect(report.missing_from_authority).toEqual(["M_PQ"])
    expect(report.extra_in_authority).toEqual(["M_P_ALIAS"])
  })
})

describe("production path: no authority / generic C", () => {
  test("no authority → awaiting, and is not disagreement", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const result = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority: null,
      authority_bytes_sha256: null,
      generic_envelope: null,
    })
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("AWAITING_INDEPENDENT_AUTHORITY")
    expect(result.oracle_input_state).toBe("ABSENT")
    expect(result.independent_grounding).not.toBe("DISAGREED")
    expect(result.production_publishable).toBe(false)
    expect(asProductionGroundingEvidence(result)).toBeNull()
    expect(DECLARED_PRODUCTION_PROVIDER).toBe("rekor-v1")
  })

  test("internally authored/generic C cannot become VALID_PROVENANCE", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const envelope: GenericProvenanceEnvelope = {
      publisher_account: "someone-else",
      source_class: "independent",
      independence_claim: "independently derived",
      artifact_digest: digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority)),
      problem_package_digest: digest,
    }
    const result = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: envelope.artifact_digest ?? null,
      generic_envelope: envelope,
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("UNPROVEN_INDEPENDENCE")
  })

  test("B authority_account is ignored as evidence", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = {
      ...matchingAuthority(digest),
      authority_account: SYNTHETIC_TEST_PUBLISHER,
    }
    const result = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority)),
      generic_envelope: null,
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
  })

  test("B independence_claim is ignored as evidence", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = {
      ...matchingAuthority(digest),
      independence_claim: "this was independently derived",
    }
    const result = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority)),
      generic_envelope: { independence_claim: authority.independence_claim },
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
  })

  test("self-reported source_class is ignored/rejected as evidence", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = { ...matchingAuthority(digest), source_class: "independent" }
    const result = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority)),
      generic_envelope: { source_class: "independent" },
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
  })

  test("same known controller is rejected even with synthetic observations", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest, {
        publisher_identifiers: [PROHIBITED_CONTROLLER_IDENTIFIERS[0]],
      }),
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(result.independent_grounding_reason).toBe("UNPROVEN_INDEPENDENCE")
  })

  test("different display name alone does not help", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const result = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority)),
      generic_envelope: { publisher_display_name: "Definitely Not Pavlo" },
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
  })

  test("different email string alone does not help", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const result = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority)),
      generic_envelope: { publisher_email: "other@example.com" },
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
  })

  test("random public key alone does not help", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = {
      ...matchingAuthority(digest),
      public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAItestonlynotakey",
    }
    const result = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority)),
      generic_envelope: { public_key: authority.public_key },
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
  })

  test("copied/preinformed oracle remains unqualified", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = {
      ...matchingAuthority(digest),
      source_material_refs: ["conformance/tsei-invariant-discrimination-v0/fixtures.ts"],
    }
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: { source_material_refs: ["expected_attribution"] },
      synthetic: syntheticOk(digest, oracleDigest, {
        source_material_refs: ["expected_attribution"],
      }),
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(result.independent_grounding).toBe("UNPROVEN")
  })

  test("a fake production injection_kind cannot mint VALID_PROVENANCE on the production entry", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const fakeProduction: ProviderVerificationOutcome = {
      ok: true,
      injection_kind: "production",
      observations: {
        provider_id: "pretend-github",
        trust_root_id: "pretend-root",
        publisher_identifiers: [SYNTHETIC_TEST_PUBLISHER],
        oracle_bytes_sha256: oracleDigest,
        problem_package_digest: digest,
        freeze_precedes_comparison: true,
        freeze_precedes_answer_disclosure: true,
        source_material_refs: [],
      },
    }
    const forgedProductionEntry = {
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      provider_outcome: fakeProduction,
    }
    const result = evaluateProductionIndependentGrounding(forgedProductionEntry)
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(result.independent_grounding).not.toBe("PROVEN")
    expect(result.independent_grounding).not.toBe("DISAGREED")
  })
})

describe("synthetic VALID_PROVENANCE branches (test-only)", () => {
  test("valid provenance + incomplete → UNPROVEN / AUTHORITY_INCOMPLETE", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = {
      schema: AUTHORITY_ORACLE_SCHEMA,
      problem_package_digest: digest,
      cases: {
        M_P: { mutant_id: "M_P", derived_attribution_set: ["I_P"] },
        M_Q: { mutant_id: "M_Q", derived_attribution_set: ["I_Q"] },
      },
    }
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.oracle_input_state).toBe("VALID_PROVENANCE")
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("AUTHORITY_INCOMPLETE")
    expect(result.universe.missing_from_authority).toEqual(["M_PQ"])
    expect(result.production_publishable).toBe(false)
  })

  test("valid provenance + ambiguous → UNPROVEN / AUTHORITY_AMBIGUOUS", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = {
      schema: AUTHORITY_ORACLE_SCHEMA,
      problem_package_digest: digest,
      cases: {
        M_P: { mutant_id: "M_P", derived_attribution_set: ["I_P or I_Q"] },
        M_Q: { mutant_id: "M_Q", derived_attribution_set: ["I_Q"] },
        M_PQ: { mutant_id: "M_PQ", derived_attribution_set: ["I_P", "I_Q"] },
      },
    }
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.oracle_input_state).toBe("VALID_PROVENANCE")
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("AUTHORITY_AMBIGUOUS")
  })

  test("valid synthetic provenance + disagreement → DISAGREED, not a TSEI runtime violation", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = {
      schema: AUTHORITY_ORACLE_SCHEMA,
      problem_package_digest: digest,
      cases: {
        M_P: { mutant_id: "M_P", derived_attribution_set: ["I_Q"] },
        M_Q: { mutant_id: "M_Q", derived_attribution_set: ["I_Q"] },
        M_PQ: { mutant_id: "M_PQ", derived_attribution_set: ["I_P", "I_Q"] },
      },
    }
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("DISAGREED")
    expect(result.independent_grounding_reason).toBe("AUTHORITY_DISAGREEMENT")
    expect(isTseiRuntimeViolation(result)).toBe(false)
    expect(result.production_publishable).toBe(false)
  })

  test("valid synthetic provenance + exact full agreement → PROVEN, not production-publishable", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.oracle_input_state).toBe("VALID_PROVENANCE")
    expect(result.independent_grounding).toBe("PROVEN")
    expect(result.semantic_relation).toBe("AGREES")
    expect(result.universe.closed).toBe(true)
    expect(result.universe.closed_case_count).toBe(result.universe.DECLARED_CASE_IDS.length)
    expect(result.synthetic_test_only).toBe(true)
    expect(result.production_publishable).toBe(false)
    expect(asProductionGroundingEvidence(result)).toBeNull()
  })

  test("non-arrival never becomes disagreement", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const result = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority: null,
      authority_bytes_sha256: null,
      generic_envelope: {
        independence_claim: "will arrive later",
      },
    })
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("AWAITING_INDEPENDENT_AUTHORITY")
    expect(result.independent_grounding).not.toBe("DISAGREED")
  })
})

function disagreeingAuthority(digest: string): AuthorityOraclePayload {
  return {
    schema: AUTHORITY_ORACLE_SCHEMA,
    problem_package_digest: digest,
    cases: {
      M_P: { mutant_id: "M_P", derived_attribution_set: ["I_Q"] },
      M_Q: { mutant_id: "M_Q", derived_attribution_set: ["I_Q"] },
      M_PQ: { mutant_id: "M_PQ", derived_attribution_set: ["I_P", "I_Q"] },
    },
  }
}

describe("faithfulness precedes comparison", () => {
  test("unfaithful Object A cannot become DISAGREED even with disagreeing issued synthetic authority", () => {
    const intendedPkg = scaffoldPackage()
    const pkg = {
      ...intendedPkg,
      invariants: {
        ...intendedPkg.invariants,
        I_P: {
          ...intendedPkg.invariants.I_P,
          normative_definition_identity: "00".repeat(32),
        },
      },
    }
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = disagreeingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(intendedPkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("PROBLEM_PACKAGE_NOT_FAITHFUL")
    expect(result.oracle_input_state).toBe("NOT_EVALUATED")
    expect(result.semantic_relation).toBe("NOT_EVALUATED")
    expect(result.synthetic_test_only).toBe(false)
    expect(result.production_publishable).toBe(false)
    expect(result.independent_grounding).not.toBe("DISAGREED")
    expect(result.independent_grounding).not.toBe("PROVEN")
    expect(result.independent_grounding_reason).not.toBe("UNPROVEN_INDEPENDENCE")
    expect(result.independent_grounding_reason).not.toBe("AUTHORITY_DISAGREEMENT")
    expect(isTseiRuntimeViolation(result)).toBe(false)
  })
})

describe("Object A runtime schema allow-list and nested leaks", () => {
  test("nested forbidden Object-A key / answer-bearing nested value fails evaluate as unfaithful", () => {
    const intendedPkg = scaffoldPackage()
    const pkg = {
      ...intendedPkg,
      cases: {
        ...intendedPkg.cases,
        M_P: {
          ...intendedPkg.cases.M_P,
          mutated: {
            ...intendedPkg.cases.M_P.mutated,
            nested_answer: { expected_attribution: ["I_P"] },
          },
        },
      },
    } as unknown as BlindProblemPackage
    const intended = {
      ...intendedFrom(intendedPkg),
      cases: {
        ...intendedFrom(intendedPkg).cases,
        M_P: {
          baseline: intendedPkg.cases.M_P.baseline,
          mutated: pkg.cases.M_P.mutated,
        },
      },
    }
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = disagreeingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended,
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(leakCheckBlindPackage(pkg).clean).toBe(false)
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("PROBLEM_PACKAGE_NOT_FAITHFUL")
    expect(result.independent_grounding).not.toBe("DISAGREED")
  })

  test("differently-cased evaluator metadata beside contract fields is rejected", () => {
    const intendedPkg = scaffoldPackage()
    const pkg = { ...intendedPkg, Evaluator: { M_P: ["I_P"] } } as unknown as BlindProblemPackage
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(intendedPkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(leakCheckBlindPackage(pkg).clean).toBe(false)
    expect(result.independent_grounding_reason).toBe("PROBLEM_PACKAGE_NOT_FAITHFUL")
    expect(result.independent_grounding).not.toBe("PROVEN")
  })

  test("stale normative_definition_identity fails evaluate as unfaithful, not DISAGREED", () => {
    const intendedPkg = scaffoldPackage()
    const pkg = {
      ...intendedPkg,
      invariants: {
        ...intendedPkg.invariants,
        I_Q: {
          ...intendedPkg.invariants.I_Q,
          normative_definition_identity: "ff".repeat(32),
        },
      },
    }
    expect(checkBlindPackageFaithfulness(pkg, intendedFrom(intendedPkg)).faithful).toBe(false)
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = disagreeingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(intendedPkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("PROBLEM_PACKAGE_NOT_FAITHFUL")
    expect(result.oracle_input_state).toBe("NOT_EVALUATED")
    expect(result.semantic_relation).toBe("NOT_EVALUATED")
    expect(result.synthetic_test_only).toBe(false)
    expect(result.production_publishable).toBe(false)
    expect(result.independent_grounding).not.toBe("DISAGREED")
  })
})

describe("mandatory oracle byte binding and freeze/digest gates", () => {
  test("freeze_precedes_comparison = false → INVALID_PROVENANCE, not PROVEN", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest, { freeze_precedes_comparison: false }),
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("UNPROVEN_INDEPENDENCE")
    expect(result.independent_grounding).not.toBe("PROVEN")
  })

  test("freeze_precedes_answer_disclosure = false → INVALID_PROVENANCE, not PROVEN", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest, { freeze_precedes_answer_disclosure: false }),
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("UNPROVEN_INDEPENDENCE")
    expect(result.independent_grounding).not.toBe("PROVEN")
  })

  test("problem_package_digest mismatch → INVALID_PROVENANCE, not PROVEN", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const otherDigest = "11".repeat(32)
    const authority = matchingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(otherDigest, oracleDigest),
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding).not.toBe("PROVEN")
  })

  test("oracle_bytes_sha256 mismatch → INVALID_PROVENANCE, not PROVEN", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const otherOracle = "22".repeat(32)
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, otherOracle),
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding).not.toBe("PROVEN")
    expect(result.independent_grounding).not.toBe("DISAGREED")
  })

  test("missing oracle_bytes_sha256 → INVALID_PROVENANCE, not PROVEN", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: null,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding).not.toBe("PROVEN")
    expect(result.independent_grounding).not.toBe("DISAGREED")
  })
})

describe("closed universe at evaluate entry", () => {
  test("extra authority case through evaluate → AUTHORITY_INCOMPLETE, not PROVEN", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = {
      schema: AUTHORITY_ORACLE_SCHEMA,
      problem_package_digest: digest,
      cases: {
        ...matchingAuthority(digest).cases,
        M_ALIAS: { mutant_id: "M_ALIAS", derived_attribution_set: ["I_P"] },
      },
    }
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.oracle_input_state).toBe("VALID_PROVENANCE")
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("AUTHORITY_INCOMPLETE")
    expect(result.universe.extra_in_authority).toEqual(["M_ALIAS"])
    expect(result.universe.closed).toBe(false)
    expect(result.independent_grounding).not.toBe("PROVEN")
  })
})

describe("forged synthetic_test_only cannot mint provenance on either entry", () => {
  test("caller-shaped synthetic_test_only on the production entry stays INVALID_PROVENANCE", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const forged: ProviderVerificationOutcome = {
      ok: true,
      injection_kind: "synthetic_test_only",
      observations: {
        provider_id: "synthetic-test-only",
        trust_root_id: "synthetic-test-only.not-a-trust-root",
        publisher_identifiers: [SYNTHETIC_TEST_PUBLISHER],
        oracle_bytes_sha256: oracleDigest,
        problem_package_digest: digest,
        freeze_precedes_comparison: true,
        freeze_precedes_answer_disclosure: true,
        source_material_refs: [],
      },
    }
    const productionAttempt = {
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      provider_outcome: forged,
    }
    const result = evaluateProductionIndependentGrounding(productionAttempt)
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("UNPROVEN_INDEPENDENCE")
    expect(result.independent_grounding).not.toBe("PROVEN")
  })

  test("caller-shaped synthetic_test_only on the test-only entry is not issued and stays INVALID", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const forged: ProviderVerificationOutcome = {
      ok: true,
      injection_kind: "synthetic_test_only",
      observations: {
        provider_id: "synthetic-test-only",
        trust_root_id: "synthetic-test-only.not-a-trust-root",
        publisher_identifiers: [SYNTHETIC_TEST_PUBLISHER],
        oracle_bytes_sha256: oracleDigest,
        problem_package_digest: digest,
        freeze_precedes_comparison: true,
        freeze_precedes_answer_disclosure: true,
        source_material_refs: [],
      },
    }
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: forged,
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(result.independent_grounding).not.toBe("PROVEN")
    expect(result.independent_grounding).not.toBe("DISAGREED")
  })
})

function withCaseFields(
  authority: AuthorityOraclePayload,
  mutantId: string,
  extra: Partial<AuthorityOraclePayload["cases"][string]>,
): AuthorityOraclePayload {
  return {
    ...authority,
    cases: {
      ...authority.cases,
      [mutantId]: { ...authority.cases[mutantId], ...extra },
    },
  }
}

function dummyEvent(kind: DummyProviderEvent["kind"], ordering_index: number, extra?: Partial<DummyProviderEvent>): DummyProviderEvent {
  return {
    kind,
    originator_identity: "originator-dummy",
    authority_identity: "authority-dummy",
    artifact_digest: "aa".repeat(32),
    provider_id: PROVIDER_CANDIDATE_REKOR_V2,
    log_identity: "single-log-shard",
    ordering_index,
    proof_material: "dummy-verified-checkpoint",
    ...extra,
  }
}

function validDryRun(extra?: Partial<ProviderDryRunInput>): ProviderDryRunInput {
  return {
    events: {
      D0: dummyEvent("D0", 10),
      D1: dummyEvent("D1", 20),
      D2: dummyEvent("D2", 30),
    },
    expected_originator_identity: "originator-dummy",
    expected_authority_identity: "authority-dummy",
    expected_artifact_digest: "aa".repeat(32),
    expected_provider_id: PROVIDER_CANDIDATE_REKOR_V2,
    expected_log_identity: "single-log-shard",
    expected_proof_material: "dummy-verified-checkpoint",
    independently_verified_cross_log_bridge: false,
    ...extra,
  }
}

describe("protocol claim boundary and provider selection", () => {
  test("production provider is rekor-v1; model dry run still cannot mint Object A", () => {
    expect(DECLARED_PRODUCTION_PROVIDER).toBe("rekor-v1")
    expect(DECLARED_PROVIDER_SELECTION).toBe("rekor-v1")
    expect(PROVIDER_DRY_RUN_REQUIRED_BEFORE_OBJECT_A).toBe(true)
    expect(PROVIDER_CANDIDATE_REKOR_V2).toBe("rekor-v2-candidate-not-selected")
    expect(CO_SIGNED_CHECKPOINT_TIME).toBe("NOT_YET_QUALIFIED")
    expect(claimBoundaryUnchanged(CLAIM_BOUNDARY)).toBe(true)
    expect(
      claimBoundaryUnchanged({
        ...CLAIM_BOUNDARY,
        authority_assistant_role: "SEMANTIC",
      }),
    ).toBe(false)
  })

  test("claim-boundary class is declared-not-verified and cannot mint provenance or change status", () => {
    expect(CLAIM_BOUNDARY.class).toBe(DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED)
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const production = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority)),
      generic_envelope: {
        independence_claim: "HUMAN_PRIMARY therefore independent",
      },
    })
    expect(production.claim_boundary.class).toBe(DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED)
    expect(production.claim_boundary_class).toBe(DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED)
    expect(production.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(production.independent_grounding).toBe("UNPROVEN")
    expect(production.independent_grounding).not.toBe("PROVEN")
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const synthetic = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(synthetic.independent_grounding).toBe("PROVEN")
    expect(synthetic.claim_boundary_class).toBe(DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED)
    expect(synthetic.production_publishable).toBe(false)
    expect(asProductionGroundingEvidence(synthetic)).toBeNull()
  })

  test("runtime mutation of a returned claim boundary cannot change the canonical comparator or later results", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const first = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority)),
      generic_envelope: null,
    })
    expect(first.claim_boundary).not.toBe(CLAIM_BOUNDARY)
    const mutableBoundary = first.claim_boundary as unknown as {
      authority_assistant_role: string
      class: string
    }
    try {
      mutableBoundary.authority_assistant_role = "SEMANTIC"
      mutableBoundary.class = "INDEPENDENTLY_VERIFIED"
    } catch {
      // runtime freeze is the intended protection
    }
    const mutableResult = first as unknown as { claim_boundary: { authority_assistant_role: string } }
    try {
      mutableResult.claim_boundary = {
        ...CLAIM_BOUNDARY,
        authority_assistant_role: "SEMANTIC",
      }
    } catch {
      // replacing a frozen result field is not required; sharing must still be impossible
    }
    expect(claimBoundaryUnchanged(CLAIM_BOUNDARY)).toBe(true)
    expect(CLAIM_BOUNDARY.authority_assistant_role).toBe("MECHANICAL_ONLY")
    expect(CLAIM_BOUNDARY.class).toBe(DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED)
    const later = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority)),
      generic_envelope: null,
    })
    expect(later.claim_boundary).not.toBe(first.claim_boundary)
    expect(claimBoundaryUnchanged(later.claim_boundary)).toBe(true)
    expect(later.claim_boundary.authority_assistant_role).toBe("MECHANICAL_ONLY")
    expect(
      claimBoundaryUnchanged({
        ...CLAIM_BOUNDARY,
        authority_assistant_role: "SEMANTIC",
      }),
    ).toBe(false)
    expect(later.independent_grounding).toBe("UNPROVEN")
    expect(later.oracle_input_state).not.toBe("VALID_PROVENANCE")
    expect(later.independent_grounding).not.toBe("PROVEN")
    expect(asProductionGroundingEvidence(later)).toBeNull()
  })
})

describe("definition-ambiguity observation is metadata only", () => {
  test("ambiguity observation survives exact agreement", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = withCaseFields(matchingAuthority(digest), "M_P", {
      definition_ambiguity_observation: {
        observed: true,
        invariant_ids: ["I_Q", "I_P"],
        note: "two readings of I_P",
        readings_considered: 2,
      },
    })
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("PROVEN")
    expect(result.semantic_relation).toBe("AGREES")
    expect(result.definition_ambiguity_observations.M_P).toEqual({
      observed: true,
      invariant_ids: ["I_P", "I_Q"],
      note: "two readings of I_P",
      readings_considered: 2,
    })
    expect(result.claim_boundary).toEqual(CLAIM_BOUNDARY)
  })

  test("ambiguity observation survives exact disagreement", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = withCaseFields(disagreeingAuthority(digest), "M_P", {
      definition_ambiguity_observation: {
        observed: true,
        invariant_ids: ["I_P"],
      },
    })
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("DISAGREED")
    expect(result.independent_grounding_reason).toBe("AUTHORITY_DISAGREEMENT")
    expect(result.definition_ambiguity_observations.M_P).toEqual({
      observed: true,
      invariant_ids: ["I_P"],
    })
    expect(isTseiRuntimeViolation(result)).toBe(false)
  })

  test("ambiguity observation cannot change comparison outcome", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const matching = matchingAuthority(digest)
    const matchingObserved = withCaseFields(matching, "M_Q", {
      definition_ambiguity_observation: { observed: true, invariant_ids: ["I_Q"], readings_considered: 9 },
    })
    const disagreeing = disagreeingAuthority(digest)
    const disagreeingObserved = withCaseFields(disagreeing, "M_Q", {
      definition_ambiguity_observation: { observed: true, invariant_ids: ["I_Q"] },
    })
    const run = (authority: AuthorityOraclePayload) => {
      const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
      return evaluateSyntheticIndependentGrounding({
        pkg,
        intended: intendedFrom(pkg),
        problem_package_digest: digest,
        observed_attribution: OBSERVED,
        authority,
        authority_bytes_sha256: oracleDigest,
        generic_envelope: null,
        synthetic: syntheticOk(digest, oracleDigest),
      })
    }
    expect(run(matching).independent_grounding).toBe("PROVEN")
    expect(run(matchingObserved).independent_grounding).toBe("PROVEN")
    expect(run(disagreeing).independent_grounding).toBe("DISAGREED")
    expect(run(disagreeingObserved).independent_grounding).toBe("DISAGREED")
  })

  test("ambiguity observation cannot mint PROVEN on the production path", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = withCaseFields(matchingAuthority(digest), "M_P", {
      definition_ambiguity_observation: { observed: true, invariant_ids: ["I_P"] },
    })
    const result = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority)),
      generic_envelope: null,
    })
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding).not.toBe("PROVEN")
    expect(result.definition_ambiguity_observations.M_P?.observed).toBe(true)
  })

  test("ambiguity observation cannot mint VALID_PROVENANCE", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = withCaseFields(matchingAuthority(digest), "M_P", {
      definition_ambiguity_observation: { observed: true, invariant_ids: ["I_P"] },
    })
    const envelope: GenericProvenanceEnvelope = {
      independence_claim: "independently derived",
      artifact_digest: digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority)),
      problem_package_digest: digest,
    }
    const result = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: envelope.artifact_digest ?? null,
      generic_envelope: envelope,
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("UNPROVEN_INDEPENDENCE")
    expect(result.independent_grounding).not.toBe("PROVEN")
  })

  test("unknown invariant ID inside ambiguity observation is rejected", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = withCaseFields(matchingAuthority(digest), "M_P", {
      definition_ambiguity_observation: { observed: true, invariant_ids: ["I_UNKNOWN"] },
    })
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("AUTHORITY_INCOMPLETE")
    expect(result.independent_grounding).not.toBe("PROVEN")
    expect(result.semantic_relation).toBe("NOT_EVALUATED")
  })

  test("duplicate ambiguity invariant IDs are rejected", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = withCaseFields(matchingAuthority(digest), "M_P", {
      definition_ambiguity_observation: { observed: true, invariant_ids: ["I_P", "I_P"] },
    })
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("AUTHORITY_AMBIGUOUS")
    expect(result.independent_grounding).not.toBe("PROVEN")
  })
})

describe("second-party answer-free observation", () => {
  test("answer-free Authority observation survives into result", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = {
      ...matchingAuthority(digest),
      authority_observations: {
        package_appeared_answer_free: true,
        notes: "no derived_attribution_set visible on A",
      },
    }
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("PROVEN")
    expect(result.authority_observations).toEqual({
      package_appeared_answer_free: true,
      notes: "no derived_attribution_set visible on A",
      class: SECOND_PARTY_OBSERVATION_ONLY,
    })
  })

  test("answer-free observation cannot bypass mechanical A faithfulness", () => {
    const intendedPkg = scaffoldPackage()
    const pkg = {
      ...intendedPkg,
      invariants: {
        ...intendedPkg.invariants,
        I_P: {
          ...intendedPkg.invariants.I_P,
          normative_definition_identity: "00".repeat(32),
        },
      },
    }
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = {
      ...disagreeingAuthority(digest),
      authority_observations: { package_appeared_answer_free: true },
    }
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(intendedPkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("PROBLEM_PACKAGE_NOT_FAITHFUL")
    expect(result.oracle_input_state).toBe("NOT_EVALUATED")
    expect(result.semantic_relation).toBe("NOT_EVALUATED")
    expect(result.authority_observations?.class).toBe(SECOND_PARTY_OBSERVATION_ONLY)
    expect(result.independent_grounding).not.toBe("DISAGREED")
    expect(result.independent_grounding).not.toBe("PROVEN")
  })
})

describe("undeclared-effect observation is telemetry only", () => {
  test("undeclared-effect observation is preserved and cannot enter attribution universe", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = withCaseFields(matchingAuthority(digest), "M_P", {
      observed_undeclared_effects: [{ note: "mutation appeared to affect undeclared field z / I_UNKNOWN" }],
    })
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("PROVEN")
    expect(result.observed_undeclared_effects.M_P).toEqual([
      { note: "mutation appeared to affect undeclared field z / I_UNKNOWN" },
    ])
    expect(result.declared_invariant_ids).toEqual(["I_P", "I_Q", "I_R"])
    expect(result.universe.DECLARED_CASE_IDS).toEqual(["M_P", "M_PQ", "M_Q"])
    expect(result.universe.closed).toBe(true)
    expect(JSON.stringify(result.universe)).not.toContain("I_UNKNOWN")
  })

  test("unknown ID inside derived_attribution_set still fails closed", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = withCaseFields(matchingAuthority(digest), "M_P", {
      derived_attribution_set: ["I_P", "I_UNKNOWN"],
      observed_undeclared_effects: [{ note: "saw an extra effect" }],
    })
    const observed = { ...OBSERVED, M_P: ["I_P", "I_UNKNOWN"] }
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: observed,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.independent_grounding_reason).toBe("AUTHORITY_INCOMPLETE")
    expect(result.independent_grounding).not.toBe("PROVEN")
    expect(result.observed_undeclared_effects.M_P).toEqual([{ note: "saw an extra effect" }])
  })

  test("observations cannot alter closed case universe", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = {
      ...withCaseFields(matchingAuthority(digest), "M_PQ", {
        definition_ambiguity_observation: { observed: true, invariant_ids: ["I_P", "I_Q"] },
        observed_undeclared_effects: [{ note: "would-be extra case M_ALIAS is not declared" }],
      }),
      authority_observations: { package_appeared_answer_free: true },
    }
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("PROVEN")
    expect(result.universe.DECLARED_CASE_IDS).toEqual(["M_P", "M_PQ", "M_Q"])
    expect(result.universe.AUTHORITY_CASE_IDS).toEqual(["M_P", "M_PQ", "M_Q"])
    expect(result.universe.COMPARISON_CASE_IDS).toEqual(["M_P", "M_PQ", "M_Q"])
    expect(result.universe.closed).toBe(true)
    expect(result.universe.closed_case_count).toBe(3)
    expect(result.declared_invariant_ids).toEqual(["I_P", "I_Q", "I_R"])
  })
})

describe("synthetic and production boundaries remain intact under observations", () => {
  test("synthetic path remains test-only", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = {
      ...withCaseFields(matchingAuthority(digest), "M_P", {
        definition_ambiguity_observation: { observed: true, invariant_ids: ["I_P"] },
      }),
      authority_observations: { package_appeared_answer_free: true },
    }
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("PROVEN")
    expect(result.synthetic_test_only).toBe(true)
    expect(result.production_publishable).toBe(false)
    expect(asProductionGroundingEvidence(result)).toBeNull()
  })

  test("caller-shaped provenance still cannot mint VALID_PROVENANCE", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority: AuthorityOraclePayload = {
      ...matchingAuthority(digest),
      authority_observations: { package_appeared_answer_free: true },
    }
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const forged: ProviderVerificationOutcome = {
      ok: true,
      injection_kind: "synthetic_test_only",
      observations: {
        provider_id: "synthetic-test-only",
        trust_root_id: "synthetic-test-only.not-a-trust-root",
        publisher_identifiers: [SYNTHETIC_TEST_PUBLISHER],
        oracle_bytes_sha256: oracleDigest,
        problem_package_digest: digest,
        freeze_precedes_comparison: true,
        freeze_precedes_answer_disclosure: true,
        source_material_refs: [],
      },
    }
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: forged,
    })
    expect(result.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(result.independent_grounding).toBe("UNPROVEN")
    expect(result.authority_observations?.package_appeared_answer_free).toBe(true)
  })

  test("production_publishable remains false for synthetic PROVEN", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority))
    const result = evaluateSyntheticIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: oracleDigest,
      generic_envelope: null,
      synthetic: syntheticOk(digest, oracleDigest),
    })
    expect(result.independent_grounding).toBe("PROVEN")
    expect(result.production_publishable).toBe(false)
    expect(DECLARED_PRODUCTION_PROVIDER).toBe("rekor-v1")
    expect(asProductionGroundingEvidence(result)).toBeNull()
  })
})

describe("provider dry-run gate (dummy only; no real publication)", () => {
  test("model D0 < D1 < D2 may pass model checks but cannot freeze a provider policy or create Object A", () => {
    const result = evaluateProviderDryRun(validDryRun())
    expect(result.ok).toBe(true)
    expect(result.model_checks_pass).toBe(true)
    expect(result.provider_policy_freezable).toBe(false)
    expect(result.selected_provider_pass).toBe(false)
    expect(result.declared_provider_selection).toBe("rekor-v1")
    expect(DECLARED_PROVIDER_SELECTION).toBe("rekor-v1")
    expect(result.caller_supplied_proof_material_verified).toBe(false)
    expect(result.independently_verified_cross_log_bridge_established).toBe(false)
    expect(result.independent_provider_condition_established).toBe(false)
    expect(result.sufficient_for_real_object_a).toBe(false)
    expect(result.sufficient_for_proven_grounding).toBe(false)
    expect(result.production_publishable).toBe(false)
    expect(result.ordering_policy).toBe("D0_lt_D1_lt_D2")
  })

  test("arbitrary matching provider/proof strings cannot freeze policy", () => {
    const result = evaluateProviderDryRun(validDryRun())
    expect(result.model_checks_pass).toBe(true)
    expect(result.provider_policy_freezable).toBe(false)
    expect(result.caller_supplied_proof_material_verified).toBe(false)
  })

  test("caller-asserted cross-log bridge cannot freeze policy", () => {
    const result = evaluateProviderDryRun(validDryRun({
      independently_verified_cross_log_bridge: true,
      events: {
        D0: dummyEvent("D0", 10, { log_identity: "shard-a" }),
        D1: dummyEvent("D1", 20, { log_identity: "shard-b" }),
        D2: dummyEvent("D2", 30, { log_identity: "shard-a" }),
      },
    }))
    expect(result.ok).toBe(false)
    expect(result.provider_policy_freezable).toBe(false)
    expect(result.independently_verified_cross_log_bridge_established).toBe(false)
    expect(result.reasons).toContain("cross-log/shard ordering without an independently verified bridge")
    expect(result.reasons).toContain("caller-asserted independently_verified_cross_log_bridge is not an independently verified bridge")
  })

  test("identical Originator and Authority identities cannot establish independent-provider condition", () => {
    const result = evaluateProviderDryRun(validDryRun({
      expected_originator_identity: "same-party",
      expected_authority_identity: "same-party",
      events: {
        D0: dummyEvent("D0", 10, { originator_identity: "same-party", authority_identity: "same-party" }),
        D1: dummyEvent("D1", 20, { originator_identity: "same-party", authority_identity: "same-party" }),
        D2: dummyEvent("D2", 30, { originator_identity: "same-party", authority_identity: "same-party" }),
      },
    }))
    expect(result.ok).toBe(false)
    expect(result.independent_provider_condition_established).toBe(false)
    expect(result.provider_policy_freezable).toBe(false)
    expect(result.reasons).toContain("Originator and Authority identities are not distinct; model cannot establish independent-provider condition")
  })

  test("DECLARED_PROVIDER_SELECTION = rekor-v1 does not make the in-memory model a selected-provider pass", () => {
    const result = evaluateProviderDryRun(validDryRun())
    expect(DECLARED_PROVIDER_SELECTION).toBe("rekor-v1")
    expect(result.declared_provider_selection).toBe("rekor-v1")
    expect(result.selected_provider_pass).toBe(false)
    expect(result.provider_policy_freezable).toBe(false)
    expect(result.reasons).toContain("evaluateProviderDryRun is an in-memory model and cannot mint a selected-provider pass")
  })

  test("negative controls reject before a policy can freeze", () => {
    expect(evaluateProviderDryRun(validDryRun({
      events: {
        D0: dummyEvent("D0", 30),
        D1: dummyEvent("D1", 20),
        D2: dummyEvent("D2", 10),
      },
    })).reasons).toContain("wrong event order: required D0 < D1 < D2 under the frozen ordering policy")
    expect(evaluateProviderDryRun(validDryRun({
      events: {
        D0: dummyEvent("D0", 10, { originator_identity: "other" }),
        D1: dummyEvent("D1", 20),
        D2: dummyEvent("D2", 30),
      },
    })).ok).toBe(false)
    expect(evaluateProviderDryRun(validDryRun({
      events: {
        D0: dummyEvent("D0", 10),
        D1: dummyEvent("D1", 20, { authority_identity: "other" }),
        D2: dummyEvent("D2", 30),
      },
    })).reasons).toContain("wrong Authority identity")
    expect(evaluateProviderDryRun(validDryRun({
      events: {
        D0: dummyEvent("D0", 10),
        D1: dummyEvent("D1", 20),
        D2: dummyEvent("D2", 30, { artifact_digest: "bb".repeat(32) }),
      },
    })).reasons).toContain("corrupted artifact digest")
    expect(evaluateProviderDryRun(validDryRun({
      events: {
        D0: dummyEvent("D0", 10),
        D1: dummyEvent("D1", 20, { proof_material: "tampered" }),
        D2: dummyEvent("D2", 30),
      },
    })).reasons).toContain("caller-supplied proof material does not match expected dummy material")
    expect(evaluateProviderDryRun(validDryRun({
      events: {
        D0: dummyEvent("D0", 10, { provider_id: "other-log" }),
        D1: dummyEvent("D1", 20),
        D2: dummyEvent("D2", 30),
      },
    })).reasons).toContain("wrong provider/log identity")
    const cross = evaluateProviderDryRun(validDryRun({
      events: {
        D0: dummyEvent("D0", 10, { log_identity: "shard-a" }),
        D1: dummyEvent("D1", 20, { log_identity: "shard-b" }),
        D2: dummyEvent("D2", 30, { log_identity: "shard-a" }),
      },
    }))
    expect(cross.ok).toBe(false)
    expect(cross.provider_policy_freezable).toBe(false)
    expect(cross.reasons).toContain("cross-log/shard ordering without an independently verified bridge")
  })
})

const PROTOCOL_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "INDEPENDENT_AUTHORITY_BLIND_GROUNDING_PROTOCOL_V0.md",
)

describe("protocol artifact load-bearing text", () => {
  test("protocol file contains the required conservative commitments", () => {
    const text = readFileSync(PROTOCOL_PATH, "utf8")
    expect(text).toContain("E0 = Originator hiding commitment")
    expect(text).toContain("E1 = Authority freezes / publishes exact B")
    expect(text).toContain("E2 = Originator reveals oracle + nonce")
    expect(text).toContain('DOMAIN = ASCII("TSEI-IA-COMMIT-v0")')
    expect(text).toContain("EXTERNAL_PRIOR_PROTOCOL_EXPOSURE")
    expect(text).toContain("CO_SIGNED_CHECKPOINT_TIME = NOT_YET_QUALIFIED")
    expect(text).toContain("provider_policy_freezable = false")
    expect(text).toContain("No retroactive blindness")
    expect(text).toContain("DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED")
    expect(text).toContain("MODEL_DRY_RUN_TESTS_PASS")
    expect(text).toContain("REAL_EXTERNAL_PROVIDER_DRY_RUN_PASS")
    expect(text).toContain("DECLARED_PROVIDER_SELECTION = rekor-v1")
    expect(text).toContain("SigningConfig / TUF")
    expect(text).toContain("`integratedTime` is **not** trusted wall-clock time.")
    expect(text).toContain("RFC3161 remains required only for a wall-clock claim")
    expect(text).toContain("no runtime field named `INTERNAL_ORACLE_CASE_IDS`")
  })

  test("truncation of load-bearing protocol obligations fails mechanically", () => {
    const text = readFileSync(PROTOCOL_PATH, "utf8")
    expect(text).toContain("No Object A may be created until all of the following are fixed:")
    expect(text).toContain("The Authority must not be asked to execute an Originator-supplied")
    expect(text).toContain("P1  independently verifiable trust root")
    expect(text).toContain("P2  append-only or cryptographically consistency-verifiable publication history")
    expect(text).toContain("P3  inclusion proof or equivalent proof that the event is part of the witnessed history")
    expect(text).toContain("P4  stable provider/log identity for the entire E0/E1/E2 run")
    expect(text).toContain("P5  monotonic order that can prove E0 < E1 < E2")
    expect(text).toContain("P6  publisher/controller identity binding sufficient for the declared policy")
    expect(text).toContain("P7  exact digest binding for published records/artifacts")
    expect(text).toContain("P8  independent retrieval by the verifier")
    expect(text).toContain("P9  no reliance on artifact self-report for publisher identity")
    expect(text).toContain("P10 provider-specific verification implementable in the repository")
    expect(text).toContain("originator_identity_selector = SAN email shtomko@gmail.com AND OIDC issuer https://github.com/login/oauth")
    expect(text).toContain("authority_identity_selector  = SAN email 114340671+TMerlini@users.noreply.github.com AND OIDC issuer https://github.com/login/oauth")
    expect(text).toContain("A display name inside JSON, a chat handle typed into Object B, or a")
    expect(text).toContain("A faithfulness failure")
    expect(text).toContain("protocol semantic change")
    expect(text).toContain("provider-policy semantic change")
    expect(text).toContain("provider identity selector change")
    expect(text).toContain("provider cannot support E0<E1<E2")
    expect(text).toContain("answer leakage to Authority before B freeze")
    expect(text).toContain("PHASE 0")
    expect(text).toContain("PHASE 1")
    expect(text).toContain("PHASE 2")
    expect(text).toContain("PHASE 3")
    expect(text).toContain("PHASE 4 — E0")
    expect(text).toContain("PHASE 5")
    expect(text).toContain("PHASE 6")
    expect(text).toContain("PHASE 7 — E1")
    expect(text).toContain("PHASE 8 — E2")
    expect(text).toContain("PHASE 9")
    expect(text).toContain("PHASE 10")
    expect(text).toContain("PHASE 11")
    expect(text).toContain("PHASE 12")
    expect(text).toContain("protocol.md")
    expect(text).toContain("provider-policy.json")
    expect(text).toContain("problem-package-A.json")
    expect(text).toContain("authority-oracle-B.json")
    expect(text).toContain("provider-verification-C.json")
    expect(text).toContain("comparison-D.json")
    expect(text).toContain("sha256_inventory.txt")
    expect(text).toContain("reproduction.md")
    expect(text).toContain("use a different Authority relationship policy")
    expect(text).toContain('do not reuse the first run as a "blind" test for the second Authority')
    expect(text).toContain("[ ] I understand I will receive a new blind Object A with no expected attribution answers.")
    expect(text).toContain("[ ] I will derive each attribution set from the frozen normative definitions and concrete values, not by executing an Originator-supplied answer predicate.")
    expect(text).toContain("[ ] I accept that disagreement will be published as disagreement rather than reconciled.")
    expect(text).toContain("[ ] I accept that the provider path / identity selectors / ordering rule will be frozen before Object A exists.")
    expect(text).toContain("CASES_CREATED = false")
    expect(text).toContain("ANSWERS_DISCLOSED = false")
    expect(text).toContain("PROVIDER_SELECTED = true")
    expect(text).toContain("PROVIDER_POLICY_FROZEN = true")
  })
})

describe("observational metadata fails closed without throwing", () => {
  function expectFailClosed(authority: unknown) {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const production = () =>
      evaluateProductionIndependentGrounding({
        pkg,
        intended: intendedFrom(pkg),
        problem_package_digest: digest,
        observed_attribution: OBSERVED,
        authority: authority as AuthorityOraclePayload,
        authority_bytes_sha256: digestAuthorityOracleBytes(encodeJsonUtf8Lf(matchingAuthority(digest))),
        generic_envelope: null,
      })
    const synthetic = () => {
      const oracleDigest = digestAuthorityOracleBytes(encodeJsonUtf8Lf(matchingAuthority(digest)))
      return evaluateSyntheticIndependentGrounding({
        pkg,
        intended: intendedFrom(pkg),
        problem_package_digest: digest,
        observed_attribution: OBSERVED,
        authority: authority as AuthorityOraclePayload,
        authority_bytes_sha256: oracleDigest,
        generic_envelope: null,
        synthetic: syntheticOk(digest, oracleDigest),
      })
    }
    let productionResult: ReturnType<typeof evaluateProductionIndependentGrounding> | undefined
    let syntheticResult: ReturnType<typeof evaluateSyntheticIndependentGrounding> | undefined
    expect(() => {
      productionResult = production()
    }).not.toThrow()
    expect(() => {
      syntheticResult = synthetic()
    }).not.toThrow()
    for (const result of [productionResult!, syntheticResult!]) {
      expect(result.independent_grounding).toBe("UNPROVEN")
      expect(result.independent_grounding).not.toBe("PROVEN")
      expect(result.independent_grounding).not.toBe("DISAGREED")
      expect(result.oracle_input_state).not.toBe("VALID_PROVENANCE")
      expect(result.definition_ambiguity_observations).toEqual({})
      expect(result.observed_undeclared_effects).toEqual({})
      expect(result.authority_observations).toBeNull()
      expect(asProductionGroundingEvidence(result)).toBeNull()
    }
  }

  function authorityWithAmbiguity(observation: unknown): unknown {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const base = matchingAuthority(digest)
    return {
      ...base,
      cases: {
        ...base.cases,
        M_P: {
          ...base.cases.M_P,
          definition_ambiguity_observation: observation,
        },
      },
    }
  }

  test("null, string, and object observation values fail closed", () => {
    expectFailClosed(authorityWithAmbiguity(null))
    expectFailClosed(authorityWithAmbiguity("observed"))
    expectFailClosed(authorityWithAmbiguity({ observed: true }))
    expectFailClosed(authorityWithAmbiguity({ observed: "true", invariant_ids: ["I_P"] }))
    expectFailClosed(authorityWithAmbiguity({ observed: {}, invariant_ids: ["I_P"] }))
    expectFailClosed(authorityWithAmbiguity({ observed: true, invariant_ids: null }))
    expectFailClosed(authorityWithAmbiguity({ observed: true, invariant_ids: "I_P" }))
    expectFailClosed(authorityWithAmbiguity({ observed: true, invariant_ids: { I_P: true } }))
  })

  test("duplicate and unknown observation IDs fail closed without copying raw metadata", () => {
    expectFailClosed(authorityWithAmbiguity({ observed: true, invariant_ids: ["I_P", "I_P"] }))
    expectFailClosed(authorityWithAmbiguity({ observed: true, invariant_ids: ["I_UNKNOWN"] }))
    expectFailClosed(authorityWithAmbiguity({ observed: true, invariant_ids: [""] }))
  })

  test("NaN, Infinity, fractional, and malformed nested observation values fail closed", () => {
    expectFailClosed(authorityWithAmbiguity({ observed: true, invariant_ids: ["I_P"], readings_considered: Number.NaN }))
    expectFailClosed(authorityWithAmbiguity({ observed: true, invariant_ids: ["I_P"], readings_considered: Number.POSITIVE_INFINITY }))
    expectFailClosed(authorityWithAmbiguity({ observed: true, invariant_ids: ["I_P"], readings_considered: Number.NEGATIVE_INFINITY }))
    expectFailClosed(authorityWithAmbiguity({ observed: true, invariant_ids: ["I_P"], readings_considered: -1 }))
    expectFailClosed(authorityWithAmbiguity({ observed: true, invariant_ids: ["I_P"], readings_considered: 1.5 }))
    expectFailClosed(authorityWithAmbiguity({ observed: true, invariant_ids: ["I_P"], note: 12 }))
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const base = matchingAuthority(digest)
    expectFailClosed({
      ...base,
      authority_observations: null,
    })
    expectFailClosed({
      ...base,
      authority_observations: "answer-free",
    })
    expectFailClosed({
      ...base,
      authority_observations: { package_appeared_answer_free: "true" },
    })
    expectFailClosed({
      ...base,
      authority_observations: { package_appeared_answer_free: true, notes: 1 },
    })
    expectFailClosed({
      ...base,
      cases: {
        ...base.cases,
        M_P: {
          ...base.cases.M_P,
          observed_undeclared_effects: null,
        },
      },
    })
    expectFailClosed({
      ...base,
      cases: {
        ...base.cases,
        M_P: {
          ...base.cases.M_P,
          observed_undeclared_effects: "note",
        },
      },
    })
    expectFailClosed({
      ...base,
      cases: {
        ...base.cases,
        M_P: {
          ...base.cases.M_P,
          observed_undeclared_effects: [{ note: 1 }],
        },
      },
    })
    expectFailClosed({
      ...base,
      cases: {
        ...base.cases,
        M_P: {
          ...base.cases.M_P,
          observed_undeclared_effects: [{}],
        },
      },
    })
  })
})

const POLICY_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "provider-policy.rekor-v1.json",
)
const DUMMY_GATE_DIR = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "fixtures",
  "rekor-v1-dummy-gate",
)

function loadPolicyBytes(): Buffer {
  return readFileSync(POLICY_PATH)
}

function loadDummyDocument(stage: "d0" | "d1" | "d2"): unknown {
  return JSON.parse(readFileSync(resolve(DUMMY_GATE_DIR, `${stage}.entry.json`), "utf8"))
}

function dummyLookup(documents: readonly unknown[] = [loadDummyDocument("d0"), loadDummyDocument("d1"), loadDummyDocument("d2")]) {
  return lookupFromRekorDocuments(documents)
}

function cloneDocument(document: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(document)) as Record<string, unknown>
}

function derLen(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n])
  if (n <= 0xff) return Buffer.from([0x81, n])
  if (n <= 0xffff) return Buffer.from([0x82, (n >> 8) & 0xff, n & 0xff])
  throw new Error("der length")
}

function der(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLen(content.length), content])
}

function derInt(n: number): Buffer {
  if (n === 0) return der(0x02, Buffer.from([0]))
  const bytes: number[] = []
  let v = n
  while (v > 0) {
    bytes.unshift(v & 0xff)
    v >>= 8
  }
  if ((bytes[0] ?? 0) & 0x80) bytes.unshift(0)
  return der(0x02, Buffer.from(bytes))
}

function derOid(parts: readonly number[]): Buffer {
  if (parts.length < 2 || parts[0]! < 0 || parts[0]! > 2 || parts[1]! < 0) throw new Error("oid")
  const bytes: number[] = [parts[0]! * 40 + parts[1]!]
  for (const part of parts.slice(2)) {
    if (!Number.isInteger(part) || part < 0) throw new Error("oid")
    const encoded = [part & 0x7f]
    let remaining = Math.floor(part / 128)
    while (remaining > 0) {
      encoded.unshift((remaining & 0x7f) | 0x80)
      remaining = Math.floor(remaining / 128)
    }
    bytes.push(...encoded)
  }
  return der(0x06, Buffer.from(bytes))
}

function ephemeralOriginatorCert(includeGithubOidc = false, includeUnrelatedIssuerText = false): string {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const spki = publicKey.export({ type: "spki", format: "der" }) as Buffer
  const cn = der(
    0x30,
    Buffer.concat([der(0x06, Buffer.from([0x55, 0x04, 0x03])), der(0x0c, Buffer.from("test-only-not-fulcio", "utf8"))]),
  )
  const name = der(0x30, der(0x31, cn))
  const validity = der(
    0x30,
    Buffer.concat([der(0x17, Buffer.from("250101000000Z")), der(0x17, Buffer.from("360101000000Z"))]),
  )
  const sha256WithRsa = der(
    0x30,
    Buffer.concat([der(0x06, Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b])), der(0x05, Buffer.alloc(0))]),
  )
  const sanValue = der(0x30, der(0x81, Buffer.from(ORIGINATOR_SAN_EMAIL, "ascii")))
  const sanExt = der(0x30, Buffer.concat([der(0x06, Buffer.from([0x55, 0x1d, 0x11])), der(0x04, sanValue)]))
  const oidcExt = der(
    0x30,
    Buffer.concat([
      derOid([1, 3, 6, 1, 4, 1, 57264, 1, 1]),
      der(0x04, Buffer.from(OIDC_ISSUER_GITHUB_OAUTH, "utf8")),
    ]),
  )
  const unrelatedIssuerTextExt = der(
    0x30,
    Buffer.concat([derOid([1, 2, 3, 4]), der(0x04, Buffer.from(OIDC_ISSUER_GITHUB_OAUTH, "utf8"))]),
  )
  const extensionList = [sanExt]
  if (includeGithubOidc) extensionList.push(oidcExt)
  if (includeUnrelatedIssuerText) extensionList.push(unrelatedIssuerTextExt)
  const extensions = der(0xa3, der(0x30, Buffer.concat(extensionList)))
  const tbs = der(
    0x30,
    Buffer.concat([der(0xa0, derInt(2)), derInt(1), sha256WithRsa, name, validity, name, spki, extensions]),
  )
  const sig = cryptoSign("sha256", tbs, privateKey)
  const cert = der(0x30, Buffer.concat([tbs, sha256WithRsa, der(0x03, Buffer.concat([Buffer.from([0x00]), sig]))]))
  const wrapped = (cert.toString("base64").match(/.{1,64}/g) ?? [cert.toString("base64")]).join("\n")
  return `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----\n`
}

describe("Rekor v1 provider policy freeze", () => {
  test("exact committed bytes freeze via production verifier and external digest", () => {
    const bytes = loadPolicyBytes()
    expect(bytes.includes(0x0d)).toBe(false)
    expect(bytes[0]).not.toBe(0xef)
    expect(bytes.includes(0x00)).toBe(false)
    expect(bytes.at(-1)).toBe(0x0a)
    const parsed = JSON.parse(bytes.toString("utf8"))
    expect(encodeJsonUtf8Lf(parsed).equals(bytes)).toBe(true)
    expect(parsed).not.toHaveProperty("sha256")
    const freeze = evaluateProviderPolicyFreeze(bytes)
    expect(freeze.frozen).toBe(true)
    expect(freeze.digest).toBe(providerPolicySha256(bytes))
    expect(freeze.digest).toBe(REKOR_V1_PROVIDER_POLICY_SHA256)
    expect(freeze.selected_provider_pass).toBe(true)
    expect(freeze.dummy_gate_class).toBe("ELIGIBILITY_ONLY_NOT_OBJECT_A_NOT_PROVEN")
    expect(freeze.sufficient_for_real_object_a).toBe(false)
    expect(freeze.sufficient_for_proven_grounding).toBe(false)
    expect(freeze.production_publishable).toBe(false)
    expect(freeze.independently_grounded).toBe("UNPROVEN")
    expect(INDEPENDENT_GROUNDING_STATUS).toBe("UNPROVEN")
  })

  test("policy mutation and digest drift fail closed", () => {
    const bytes = loadPolicyBytes()
    const mutated = Buffer.from(bytes.toString("utf8").replace(ORIGINATOR_SAN_EMAIL, "nobody@example.com"))
    const freeze = evaluateProviderPolicyFreeze(mutated)
    expect(freeze.frozen).toBe(false)
    expect(freeze.digest).not.toBe(providerPolicySha256(bytes))
    expect(freeze.reasons.length).toBeGreaterThan(0)
  })

  test("semantically identical policy with byte drift cannot freeze or verify", () => {
    const bytes = loadPolicyBytes()
    const drifted = Buffer.concat([Buffer.from(" "), bytes])
    const freeze = evaluateProviderPolicyFreeze(drifted)
    expect(freeze.frozen).toBe(false)
    expect(freeze.reasons).toEqual(["provider_policy_digest_mismatch"])
    const publication = verifyRekorV1Publication({
      policy_bytes: drifted,
      artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")),
      controller: "originator",
      lookup: dummyLookup(),
      observed_endpoint: REKOR_V1_ENDPOINT,
    })
    expect(publication.ok).toBe(false)
    expect(publication.reasons).toEqual(["provider_policy_digest_mismatch"])
  })

  test("caller-fabricated freeze boolean is not a policy", () => {
    const freeze = evaluateProviderPolicyFreeze(Buffer.from(JSON.stringify({ frozen: true, ok: true }), "utf8"))
    expect(freeze.frozen).toBe(false)
  })
})

describe("Rekor v1 production verifier (offline dummy fixtures)", () => {
  test("dummy D0/D1/D2 verify with captured tree and strict global order", () => {
    const policy_bytes = loadPolicyBytes()
    const lookup = dummyLookup()
    const ordered = verifyRekorV1OrderedEvents({
      policy_bytes,
      lookup,
      observed_endpoint: REKOR_V1_ENDPOINT,
      events: [
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")), controller: "originator" },
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d1.json")), controller: "authority" },
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d2.json")), controller: "originator" },
      ],
    })
    expect(ordered.ok).toBe(true)
    expect(ordered.captured_tree_id).toBe("1193050959916656506")
    expect(ordered.global_log_indexes).toEqual([2518155653, 2518462930, 2518661048])
    expect(ordered.publications[0]?.artifact_sha256).toBe(DUMMY_GATE_D0_SHA256)
    expect(ordered.publications[1]?.artifact_sha256).toBe(DUMMY_GATE_D1_SHA256)
    expect(ordered.publications[2]?.artifact_sha256).toBe(DUMMY_GATE_D2_SHA256)
    expect(ordered.publications[0]?.san_email).toBe(ORIGINATOR_SAN_EMAIL)
    expect(ordered.publications[1]?.san_email).toBe(AUTHORITY_SAN_EMAIL)
    expect(ordered.dummy_gate_eligibility_only).toBe(true)
    expect(ordered.sufficient_for_proven_grounding).toBe(false)
    expect(ordered.production_publishable).toBe(false)
  })

  test("SET binds top-level global indexes before ordering is evaluated", () => {
    const documents = (["d0", "d1", "d2"] as const).map((stage, index) => {
      const cloned = cloneDocument(loadDummyDocument(stage))
      const uuid = Object.keys(cloned)[0]!
      ;(cloned[uuid] as Record<string, unknown>)["logIndex"] = index + 1
      return cloned
    })
    const ordered = verifyRekorV1OrderedEvents({
      policy_bytes: loadPolicyBytes(),
      lookup: dummyLookup(documents),
      observed_endpoint: REKOR_V1_ENDPOINT,
      events: [
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")), controller: "originator" },
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d1.json")), controller: "authority" },
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d2.json")), controller: "originator" },
      ],
    })
    expect(ordered.ok).toBe(false)
    expect(ordered.reasons).toEqual(["invalid_signed_entry_timestamp"])
  })

  test("a forged common checkpoint tree ID cannot create a same-tree run", () => {
    const documents = (["d0", "d1", "d2"] as const).map((stage) => {
      const cloned = cloneDocument(loadDummyDocument(stage))
      const uuid = Object.keys(cloned)[0]!
      const record = cloned[uuid] as Record<string, unknown>
      const inclusion = (record["verification"] as Record<string, unknown>)["inclusionProof"] as Record<string, unknown>
      inclusion["checkpoint"] = String(inclusion["checkpoint"]).replace("1193050959916656506", "1")
      return cloned
    })
    const ordered = verifyRekorV1OrderedEvents({
      policy_bytes: loadPolicyBytes(),
      lookup: dummyLookup(documents),
      observed_endpoint: REKOR_V1_ENDPOINT,
      events: [
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")), controller: "originator" },
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d1.json")), controller: "authority" },
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d2.json")), controller: "originator" },
      ],
    })
    expect(ordered.ok).toBe(false)
    expect(ordered.reasons).toEqual(["invalid_checkpoint_signature"])
  })

  test("a corrupt Rekor signedEntryTimestamp fails closed", () => {
    const cloned = cloneDocument(loadDummyDocument("d0"))
    const uuid = Object.keys(cloned)[0]!
    const record = cloned[uuid] as Record<string, unknown>
    const verification = record["verification"] as Record<string, unknown>
    const set = Buffer.from(String(verification["signedEntryTimestamp"]), "base64")
    set[set.length - 1] = set[set.length - 1]! ^ 1
    verification["signedEntryTimestamp"] = set.toString("base64")
    const result = verifyRekorV1Publication({
      policy_bytes: loadPolicyBytes(),
      artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")),
      controller: "originator",
      lookup: dummyLookup([cloned]),
      observed_endpoint: REKOR_V1_ENDPOINT,
    })
    expect(result.ok).toBe(false)
    expect(result.reasons).toEqual(["invalid_signed_entry_timestamp"])
  })

  test("negative controls reject before a publication can pass", () => {
    const policy_bytes = loadPolicyBytes()
    const d0 = readFileSync(resolve(DUMMY_GATE_DIR, "d0.json"))
    const d1 = readFileSync(resolve(DUMMY_GATE_DIR, "d1.json"))
    const d0Doc = loadDummyDocument("d0")
    const d1Doc = loadDummyDocument("d1")
    const d2Doc = loadDummyDocument("d2")

    expect(
      verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes: d0,
        controller: "authority",
        lookup: dummyLookup(),
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).reasons,
    ).toContain("wrong_san")

    expect(
      verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes: d0,
        controller: "originator",
        lookup: dummyLookup(),
        observed_endpoint: "https://rekor.example.invalid",
      }).reasons,
    ).toContain("wrong_endpoint")

    const wrongLog = cloneDocument(d0Doc)
    const wrongLogUuid = Object.keys(wrongLog)[0]!
    ;(wrongLog[wrongLogUuid] as Record<string, unknown>)["logID"] = "aa".repeat(32)
    expect(
      verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes: d0,
        controller: "originator",
        lookup: dummyLookup([wrongLog]),
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).reasons,
    ).toContain("invalid_signed_entry_timestamp")

    const rotated = cloneDocument(d1Doc)
    const rotatedUuid = Object.keys(rotated)[0]!
    const rotatedRec = rotated[rotatedUuid] as Record<string, unknown>
    const rotatedInc = (rotatedRec["verification"] as Record<string, unknown>)["inclusionProof"] as Record<string, unknown>
    rotatedInc["checkpoint"] = String(rotatedInc["checkpoint"]).replace("1193050959916656506", "1")
    const d0Pub = verifyRekorV1Publication({
      policy_bytes,
      artifact_bytes: d0,
      controller: "originator",
      lookup: dummyLookup(),
      observed_endpoint: REKOR_V1_ENDPOINT,
    })
    expect(
      verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes: d1,
        controller: "authority",
        lookup: dummyLookup([rotated]),
        observed_endpoint: REKOR_V1_ENDPOINT,
        captured_tree_id: d0Pub.tree_id,
      }).reasons,
    ).toContain("invalid_checkpoint_signature")

    expect(
      verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes: d0,
        controller: "originator",
        lookup: { searchByHash: () => [], getEntry: () => null },
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).reasons,
    ).toContain("zero_matches")

    expect(
      verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes: d0,
        controller: "originator",
        lookup: { searchByHash: () => ["a", "b"], getEntry: () => d0Doc },
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).reasons,
    ).toContain("multiple_matches")

    expect(
      verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes: d0,
        controller: "originator",
        lookup: { searchByHash: () => ["x"], getEntry: () => ({ ok: true, frozen: true }) },
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).reasons,
    ).toContain("malformed_structure")

    const wrongKind = cloneDocument(d0Doc)
    const kindUuid = Object.keys(wrongKind)[0]!
    const kindRec = wrongKind[kindUuid] as Record<string, unknown>
    const kindCanon = JSON.parse(Buffer.from(String(kindRec["body"]), "base64").toString("utf8")) as Record<string, unknown>
    kindCanon["kind"] = "rfc3161"
    kindRec["body"] = Buffer.from(JSON.stringify(kindCanon)).toString("base64")
    expect(
      verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes: d0,
        controller: "originator",
        lookup: dummyLookup([wrongKind]),
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).reasons,
    ).toContain("invalid_signed_entry_timestamp")

    const wrongVer = cloneDocument(d0Doc)
    const verUuid = Object.keys(wrongVer)[0]!
    const verRec = wrongVer[verUuid] as Record<string, unknown>
    const verCanon = JSON.parse(Buffer.from(String(verRec["body"]), "base64").toString("utf8")) as Record<string, unknown>
    verCanon["apiVersion"] = "0.0.2"
    verRec["body"] = Buffer.from(JSON.stringify(verCanon)).toString("base64")
    expect(
      verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes: d0,
        controller: "originator",
        lookup: dummyLookup([wrongVer]),
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).reasons,
    ).toContain("invalid_signed_entry_timestamp")

    expect(
      verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes: Buffer.from("altered-dummy-artifact", "utf8"),
        controller: "originator",
        lookup: dummyLookup(),
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).reasons,
    ).toContain("zero_matches")

    const brokenSig = cloneDocument(d0Doc)
    const sigUuid = Object.keys(brokenSig)[0]!
    const sigRec = brokenSig[sigUuid] as Record<string, unknown>
    const sigCanon = JSON.parse(Buffer.from(String(sigRec["body"]), "base64").toString("utf8")) as Record<string, unknown>
    const spec = sigCanon["spec"] as Record<string, unknown>
    const signature = spec["signature"] as Record<string, unknown>
    const sigBuf = Buffer.from(String(signature["content"]), "base64")
    sigBuf[0] = sigBuf[0]! ^ 1
    signature["content"] = sigBuf.toString("base64")
    sigRec["body"] = Buffer.from(JSON.stringify(sigCanon)).toString("base64")
    expect(
      verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes: d0,
        controller: "originator",
        lookup: dummyLookup([brokenSig]),
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).reasons,
    ).toContain("invalid_signed_entry_timestamp")

    const brokenProof = cloneDocument(d0Doc)
    const proofUuid = Object.keys(brokenProof)[0]!
    const proofRec = brokenProof[proofUuid] as Record<string, unknown>
    const proofInc = (proofRec["verification"] as Record<string, unknown>)["inclusionProof"] as Record<string, unknown>
    const hashes = [...(proofInc["hashes"] as string[])]
    const flipped = Buffer.from(hashes[0]!, "hex")
    flipped[0] = flipped[0]! ^ 1
    hashes[0] = flipped.toString("hex")
    proofInc["hashes"] = hashes
    expect(
      verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes: d0,
        controller: "originator",
        lookup: dummyLookup([brokenProof]),
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).reasons,
    ).toContain("invalid_inclusion_proof")

    const brokenCkpt = cloneDocument(d0Doc)
    const ckptUuid = Object.keys(brokenCkpt)[0]!
    const ckptRec = brokenCkpt[ckptUuid] as Record<string, unknown>
    const ckptInc = (ckptRec["verification"] as Record<string, unknown>)["inclusionProof"] as Record<string, unknown>
    const lines = String(ckptInc["checkpoint"]).split("\n")
    lines[2] = Buffer.alloc(32, 7).toString("base64")
    ckptInc["checkpoint"] = lines.join("\n")
    expect(
      verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes: d0,
        controller: "originator",
        lookup: dummyLookup([brokenCkpt]),
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).reasons,
    ).toContain("invalid_checkpoint_signature")

    const equalDoc = cloneDocument(d1Doc)
    const equalUuid = Object.keys(equalDoc)[0]!
    ;(equalDoc[equalUuid] as Record<string, unknown>)["logIndex"] = 2518155653
    expect(
      verifyRekorV1OrderedEvents({
        policy_bytes,
        lookup: dummyLookup([d0Doc, equalDoc, d2Doc]),
        observed_endpoint: REKOR_V1_ENDPOINT,
        events: [
          { artifact_bytes: d0, controller: "originator" },
          { artifact_bytes: d1, controller: "authority" },
        ],
      }).reasons,
    ).toContain("invalid_signed_entry_timestamp")

    const reversedDoc = cloneDocument(d1Doc)
    const reversedUuid = Object.keys(reversedDoc)[0]!
    ;(reversedDoc[reversedUuid] as Record<string, unknown>)["logIndex"] = 1
    expect(
      verifyRekorV1OrderedEvents({
        policy_bytes,
        lookup: dummyLookup([d0Doc, reversedDoc, d2Doc]),
        observed_endpoint: REKOR_V1_ENDPOINT,
        events: [
          { artifact_bytes: d0, controller: "originator" },
          { artifact_bytes: d1, controller: "authority" },
        ],
      }).reasons,
    ).toContain("invalid_signed_entry_timestamp")
  })

  test("digest_mismatch fails closed when lookup uniqueness is satisfied against a hashedrekord whose hash.value is not the provided artifact digest", () => {
    const policy_bytes = loadPolicyBytes()
    const d0Doc = loadDummyDocument("d0")
    const uuid = Object.keys(d0Doc as Record<string, unknown>)[0]!
    const artifact_bytes = Buffer.from("altered-dummy-artifact", "utf8")
    const artifactDigest = createHash("sha256").update(artifact_bytes).digest("hex")
    expect(artifactDigest).not.toBe(DUMMY_GATE_D0_SHA256)
    const lookup = {
      searchByHash: (sha256Hex: string) => (sha256Hex === artifactDigest ? [uuid] : []),
      getEntry: (id: unknown) => (id === uuid ? d0Doc : null),
    }
    let result: ReturnType<typeof verifyRekorV1Publication> | undefined
    expect(() => {
      result = verifyRekorV1Publication({
        policy_bytes,
        artifact_bytes,
        controller: "originator",
        lookup,
        observed_endpoint: REKOR_V1_ENDPOINT,
      })
    }).not.toThrow()
    expect(result!.ok).toBe(false)
    expect(result!.reasons).toContain("digest_mismatch")
    expect(result!.reasons).not.toContain("zero_matches")
    expect(result!.reasons).not.toContain("wrong_kind_or_version")
    expect(result!.artifact_sha256).toBe(artifactDigest)
  })

  test("exact OIDC extension parsing rejects a matching SAN without the GitHub OAuth issuer", () => {
    const pem = ephemeralOriginatorCert(false, true)
    expect(pem).not.toContain(OIDC_ISSUER_GITHUB_OAUTH)
    let result: ReturnType<typeof verifyPinnedFulcioCertificate> | undefined
    expect(() => {
      result = verifyPinnedFulcioCertificate({
        certificate_pem: pem,
        expected_san_email: ORIGINATOR_SAN_EMAIL,
        expected_oidc_issuer: OIDC_ISSUER_GITHUB_OAUTH,
        integrated_time: 1787158771,
      })
    }).not.toThrow()
    expect(result!.ok).toBe(false)
    expect(result!.reasons).toContain("wrong_oidc_issuer")
    expect(result!.reasons).not.toContain("wrong_san")
  })

  test("a self-signed certificate with matching SAN and OIDC extension is not a Fulcio chain", () => {
    const pem = ephemeralOriginatorCert(true)
    const result = verifyPinnedFulcioCertificate({
      certificate_pem: pem,
      expected_san_email: ORIGINATOR_SAN_EMAIL,
      expected_oidc_issuer: OIDC_ISSUER_GITHUB_OAUTH,
      integrated_time: 1787158771,
    })
    expect(result.ok).toBe(false)
    expect(result.reasons).toEqual(["untrusted_fulcio_chain"])
  })

  test("synthetic evidence cannot satisfy production evaluation", () => {
    const pkg = scaffoldPackage()
    const digest = digestBlindProblemBytes(encodeJsonUtf8Lf(pkg))
    const authority = matchingAuthority(digest)
    const production = evaluateProductionIndependentGrounding({
      pkg,
      intended: intendedFrom(pkg),
      problem_package_digest: digest,
      observed_attribution: OBSERVED,
      authority,
      authority_bytes_sha256: digestAuthorityOracleBytes(encodeJsonUtf8Lf(authority)),
      generic_envelope: null,
    })
    expect(production.independent_grounding).toBe("UNPROVEN")
    expect(production.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(asProductionGroundingEvidence(production)).toBeNull()
  })
})

describe("oracle commitment helpers (no real oracle or nonce)", () => {
  const sample = {
    instance_id: "test-only.not-a-real-instance",
    problem_package_sha256: "ab".repeat(32),
    nonce: Buffer.alloc(32, 3),
    oracle_bytes: Buffer.from('{"schema":"test-only.not-a-real-oracle","v":0}', "utf8"),
  }

  test("compute and verify round-trip", () => {
    const computed = computeOracleCommitment(sample)
    expect(computed.ok).toBe(true)
    if (!computed.ok) return
    expect(verifyOracleCommitment({ ...sample, commitment: computed.commitment }).ok).toBe(true)
  })

  test("negatives reject byte, nonce, oracle, and domain confusion", () => {
    const computed = computeOracleCommitment(sample)
    expect(computed.ok).toBe(true)
    if (!computed.ok) return
    const commitment = computed.commitment
    expect(computeOracleCommitment({ ...sample, instance_id: "BAD ID" }).ok).toBe(false)
    expect(computeOracleCommitment({ ...sample, problem_package_sha256: "AB".repeat(32) }).ok).toBe(false)
    expect(computeOracleCommitment({ ...sample, nonce: Buffer.alloc(31, 3) }).ok).toBe(false)
    expect(computeOracleCommitment({ ...sample, oracle_bytes: Buffer.alloc(0) }).ok).toBe(false)
    expect(verifyOracleCommitment({ ...sample, commitment: "00".repeat(32) }).ok).toBe(false)
    const mutatedOracle = Buffer.from(sample.oracle_bytes)
    mutatedOracle[mutatedOracle.length - 1] ^= 1
    expect(verifyOracleCommitment({ ...sample, oracle_bytes: mutatedOracle, commitment }).ok).toBe(false)
    const mutatedNonce = Buffer.from(sample.nonce)
    mutatedNonce[0] ^= 1
    expect(verifyOracleCommitment({ ...sample, nonce: mutatedNonce, commitment }).ok).toBe(false)
    expect(verifyOracleCommitment({ ...sample, instance_id: "test-only.other", commitment }).ok).toBe(false)
  })
})
