/**
 * TSEI independent-authority scaffold v0 (PR #201).
 *
 * Proves the internal comparison/provenance scaffold mechanically.
 * Production independent grounding remains unavailable: this file may
 * reach PROVEN only through explicit synthetic test injection, and
 * asProductionGroundingEvidence is always null.
 *
 * Does not change #200 fixture results, TSEI runtime verdicts, or the
 * frozen specification artifact.
 */

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "bun:test"
import {
  AUTHORITY_ORACLE_SCHEMA,
  BLIND_PROBLEM_SCHEMA,
  DECLARED_PRODUCTION_PROVIDER,
  PROHIBITED_CONTROLLER_IDENTIFIERS,
  type AuthorityOraclePayload,
  type BlindProblemPackage,
  type GenericProvenanceEnvelope,
  type ProviderVerificationOutcome,
} from "../../conformance/tsei-invariant-discrimination-v0/independent-authority-model"
import {
  asProductionGroundingEvidence,
  caseIdsFromMap,
  checkBlindPackageFaithfulness,
  closeCaseUniverse,
  digestAuthorityOracleBytes,
  digestBlindProblemBytes,
  encodeJsonUtf8Lf,
  evaluateProductionIndependentGrounding,
  isTseiRuntimeViolation,
  leakCheckBlindPackage,
  normativeDefinitionIdentity,
  sha256ExactBytes,
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
    expect(DECLARED_PRODUCTION_PROVIDER).toBeNull()
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
