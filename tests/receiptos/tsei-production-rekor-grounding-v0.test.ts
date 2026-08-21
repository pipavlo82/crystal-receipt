/**
 * Future-run P0/E0 v1 production-bridge scaffold tests.
 * Synthetic fixtures only. Not a real intended corpus, P0, or provider run.
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "bun:test"
import {
  AUTHORITY_ORACLE_SCHEMA,
  AUTHORITY_SAN_EMAIL,
  AUTHORITY_RELATIONSHIP_CLASS,
  BLIND_PROBLEM_SCHEMA,
  DUMMY_GATE_D0_SHA256,
  DUMMY_GATE_D1_SHA256,
  DUMMY_GATE_D2_SHA256,
  OIDC_ISSUER_GITHUB_OAUTH,
  ORIGINATOR_SAN_EMAIL,
  REKOR_V1_ENDPOINT,
  type BlindProblemPackage,
} from "../../conformance/tsei-invariant-discrimination-v0/independent-authority-model"
import * as IndependentAuthority from "../../conformance/tsei-invariant-discrimination-v0/independent-authority"
import {
  asProductionGroundingEvidence,
  evaluateProductionIndependentGrounding,
  evaluateProductionRekorIndependentGrounding,
  lookupFromRekorDocuments,
  verifyRekorV1OrderedEvents,
  verifyRekorV1ProductionSequence,
  verifyRekorV1Publication,
} from "../../conformance/tsei-invariant-discrimination-v0/independent-authority"
import {
  acceptE0RecordV1,
  acceptObjectAFromBytes,
  commitOriginatorE0V1,
} from "../../conformance/tsei-invariant-discrimination-v0/object-a-e0-contract"
import {
  acceptIntendedFaithfulnessFromBytes,
  FROZEN_PROTOCOL_V1_SHA256,
  HISTORICAL_IA_INSTANCE_ID,
  INTENDED_FAITHFULNESS_SCHEMA,
} from "../../conformance/tsei-invariant-discrimination-v0/intended-faithfulness"
import {
  evaluateP0ProviderPolicyFreeze,
  evaluateProviderPolicyFreeze,
  REKOR_V1_P0_PROVIDER_POLICY_SHA256,
  REKOR_V1_PROVIDER_POLICY_SHA256,
} from "../../conformance/tsei-invariant-discrimination-v0/rekor-v1-verifier"
import {
  ORIGINATOR_DECLARED_CASE_IDS,
  ORIGINATOR_DECLARED_INVARIANT_IDS,
  acceptOriginatorOracle,
  materializeOriginatorOracle,
} from "../../conformance/tsei-invariant-discrimination-v0/originator-oracle"
import { acceptRealRunPublicEvidence } from "../../conformance/tsei-invariant-discrimination-v0/rekor-v1-real-run-public-evidence"
import { INDEPENDENT_GROUNDING_STATUS } from "../../conformance/tsei-invariant-discrimination-v0/ladder"

const DUMMY_GATE_DIR = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "fixtures",
  "rekor-v1-dummy-gate",
)
const PUBLIC_EVIDENCE_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "fixtures",
  "rekor-v1-real-run-public-evidence",
  "public-evidence.json",
)
const HISTORICAL_E0_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "fixtures",
  "rekor-v1-real-run-public-evidence",
  "e0-record.json",
)
const POLICY_V0_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "provider-policy.rekor-v1.json",
)
const POLICY_P0_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "provider-policy.rekor-v1.p0-e0-e1-e2.json",
)

const TEST_NONCE = Uint8Array.from({ length: 32 }, () => 0x21)
const DEFS: Record<(typeof ORIGINATOR_DECLARED_INVARIANT_IDS)[number], string> = {
  I_A: "n is even.",
  I_B: "n is less than 100.",
  I_C: "n is non-negative.",
}

function loadP0Policy(): Buffer {
  return readFileSync(POLICY_P0_PATH)
}

function loadV0Policy(): Buffer {
  return readFileSync(POLICY_V0_PATH)
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

function twelveCasePackage(): BlindProblemPackage {
  const invariants = Object.fromEntries(
    ORIGINATOR_DECLARED_INVARIANT_IDS.map((id) => [
      id,
      {
        invariant_id: id,
        normative_definition: DEFS[id],
        normative_definition_identity: IndependentAuthority.normativeDefinitionIdentity(DEFS[id]),
      },
    ]),
  )
  const cases = Object.fromEntries(
    ORIGINATOR_DECLARED_CASE_IDS.map((id, index) => [
      id,
      { mutant_id: id, baseline: { n: 0 }, mutated: { n: index + 1 } },
    ]),
  )
  return {
    schema: BLIND_PROBLEM_SCHEMA,
    instance_id: "scaffold-future-intended.not-production",
    evaluation_instruction: "Report the exact set of violated invariant_id values per mutant_id.",
    invariants,
    cases,
  }
}

function intendedArtifact(pkg: BlindProblemPackage) {
  return {
    schema: INTENDED_FAITHFULNESS_SCHEMA,
    instance_id: pkg.instance_id,
    protocol_sha256: FROZEN_PROTOCOL_V1_SHA256,
    provider_policy_sha256: REKOR_V1_P0_PROVIDER_POLICY_SHA256,
    invariants: Object.fromEntries(
      Object.entries(pkg.invariants).map(([id, row]) => [
        id,
        {
          invariant_id: row.invariant_id,
          normative_definition: row.normative_definition,
          normative_definition_identity: row.normative_definition_identity,
        },
      ]),
    ),
    cases: Object.fromEntries(
      Object.entries(pkg.cases).map(([id, row]) => [id, { mutant_id: row.mutant_id, baseline: row.baseline, mutated: row.mutated }]),
    ),
  }
}

function intendedFromProjection(pkg: BlindProblemPackage) {
  return {
    invariants: Object.fromEntries(
      Object.entries(pkg.invariants).map(([id, row]) => [
        id,
        { normative_definition: row.normative_definition, normative_definition_identity: row.normative_definition_identity },
      ]),
    ),
    cases: Object.fromEntries(Object.entries(pkg.cases).map(([id, row]) => [id, { baseline: row.baseline, mutated: row.mutated }])),
  }
}

function oracleCases() {
  return Object.fromEntries(
    ORIGINATOR_DECLARED_CASE_IDS.map((id) => [id, { mutant_id: id, originator_attribution_set: [] as const }]),
  )
}

function authorityPayload(digest: string) {
  return {
    schema: AUTHORITY_ORACLE_SCHEMA,
    problem_package_digest: digest,
    cases: Object.fromEntries(
      ORIGINATOR_DECLARED_CASE_IDS.map((id) => [id, { mutant_id: id, derived_attribution_set: [] as string[] }]),
    ),
  }
}

function buildScaffoldOperands() {
  const pkg = twelveCasePackage()
  const intendedBytes = IndependentAuthority.encodeJsonUtf8Lf(intendedArtifact(pkg))
  const intended = acceptIntendedFaithfulnessFromBytes({ bytes: intendedBytes })
  if (!intended.ok) throw new Error(intended.reasons.join("|"))
  const objectABytes = IndependentAuthority.encodeJsonUtf8Lf(pkg)
  const objectA = acceptObjectAFromBytes({ bytes: objectABytes, intended: intended.intended })
  if (!objectA.ok) throw new Error(objectA.reasons.join("|"))
  const oracle = materializeOriginatorOracle({
    instance_id: pkg.instance_id,
    problem_package_sha256: objectA.digest,
    cases: oracleCases(),
  })
  if (!oracle.ok) throw new Error(oracle.reasons.join("|"))
  const e0 = commitOriginatorE0V1({
    pkg,
    intended_faithfulness_bytes: intendedBytes,
    nonce: TEST_NONCE,
    oracle_bytes: oracle.bytes,
  })
  if (!e0.ok) throw new Error(e0.reasons.join("|"))
  const objectBBytes = IndependentAuthority.encodeJsonUtf8Lf(authorityPayload(objectA.digest))
  return {
    pkg,
    intendedBytes,
    objectABytes: objectA.bytes,
    objectA,
    oracleBytes: oracle.bytes,
    e0Bytes: e0.bytes,
    objectBBytes,
    nonce: TEST_NONCE,
  }
}

function baseBundle(operands = buildScaffoldOperands()) {
  return {
    intended_faithfulness_bytes: operands.intendedBytes,
    object_a_bytes: operands.objectABytes,
    object_b_bytes: operands.objectBBytes,
    e1_artifact_bytes: operands.objectBBytes,
    originator_oracle_bytes: operands.oracleBytes,
    e2_artifact_bytes: operands.oracleBytes,
    nonce_bytes: operands.nonce,
    e0_record_bytes: operands.e0Bytes,
    policy_bytes: loadP0Policy(),
    rekor_documents: [loadDummyDocument("d0"), loadDummyDocument("d1"), loadDummyDocument("d2")],
  }
}

function expectNotProven(result: ReturnType<typeof evaluateProductionRekorIndependentGrounding>, label?: string) {
  expect(result.independent_grounding, label).not.toBe("PROVEN")
  expect(result.production_publishable, label).toBe(false)
  expect(result.sufficient_for_proven_grounding, label).toBe(false)
  expect(result.sufficient_for_real_run, label).toBe(false)
}

describe("locked historical evaluators", () => {
  test("evaluateProductionIndependentGrounding remains UNPROVEN and asProductionGroundingEvidence is null", () => {
    const operands = buildScaffoldOperands()
    const production = evaluateProductionIndependentGrounding({
      pkg: operands.pkg,
      intended: intendedFromProjection(operands.pkg),
      problem_package_digest: operands.objectA.digest,
      observed_attribution: Object.fromEntries(ORIGINATOR_DECLARED_CASE_IDS.map((id) => [id, []])),
      authority: authorityPayload(operands.objectA.digest),
      authority_bytes_sha256: IndependentAuthority.sha256ExactBytes(operands.objectBBytes),
      generic_envelope: null,
    })
    expect(production.independent_grounding).toBe("UNPROVEN")
    expect(production.production_publishable).toBe(false)
    expect(asProductionGroundingEvidence(production)).toBeNull()
  })

  test("#200 ladder remains UNPROVEN", () => {
    expect(INDEPENDENT_GROUNDING_STATUS).toBe("UNPROVEN")
  })

  test("#206 public receipt alone remains UNPROVEN", () => {
    const parsed = JSON.parse(readFileSync(PUBLIC_EVIDENCE_PATH, "utf8"))
    const accepted = acceptRealRunPublicEvidence(parsed)
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(parsed.derived_status.public_evidence_status).toBe("REKOR_V1_PUBLIC_RECEIPT_RECORDED_PRODUCTION_UNPROVEN")
    const derived = parsed.derived_status.evaluateProductionIndependentGrounding
    expect(derived.independent_grounding).toBe("UNPROVEN")
    expect(derived.production_publishable).toBe(false)
  })

  test("private core is not exported", () => {
    expect(Object.prototype.hasOwnProperty.call(IndependentAuthority, "evaluateIndependentGroundingCore")).toBe(false)
  })
})

describe("P0 policy freeze vs historical policy", () => {
  test("v0 freeze rejects P0 policy bytes; P0 freeze rejects v0 policy bytes", () => {
    expect(evaluateProviderPolicyFreeze(loadP0Policy()).frozen).toBe(false)
    expect(evaluateProviderPolicyFreeze(loadV0Policy()).frozen).toBe(true)
    expect(evaluateP0ProviderPolicyFreeze(loadV0Policy()).frozen).toBe(false)
    expect(evaluateP0ProviderPolicyFreeze(loadP0Policy()).frozen).toBe(true)
    expect(evaluateP0ProviderPolicyFreeze(loadP0Policy()).sufficient_for_proven_grounding).toBe(false)
  })

  test("new policy still verifies dummy publication but production sequence forbids dummy artifacts", () => {
    const publication = verifyRekorV1Publication({
      policy_bytes: loadP0Policy(),
      artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")),
      controller: "originator",
      lookup: dummyLookup(),
      observed_endpoint: REKOR_V1_ENDPOINT,
    })
    expect(publication.ok).toBe(true)
    expect(publication.san_email).toBe(ORIGINATOR_SAN_EMAIL)
    const ordered = verifyRekorV1OrderedEvents({
      policy_bytes: loadV0Policy(),
      lookup: dummyLookup(),
      observed_endpoint: REKOR_V1_ENDPOINT,
      events: [
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")), controller: "originator" },
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d1.json")), controller: "authority" },
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d2.json")), controller: "originator" },
      ],
    })
    expect(ordered.ok).toBe(true)
    expect(ordered.sufficient_for_proven_grounding).toBe(false)
    expect(ordered.dummy_gate_eligibility_only).toBe(true)
    const production = verifyRekorV1ProductionSequence({
      policy_bytes: loadP0Policy(),
      lookup: dummyLookup(),
      observed_endpoint: REKOR_V1_ENDPOINT,
      events: {
        p0_artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")),
        e0_artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")),
        e1_artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d1.json")),
        e2_artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d2.json")),
      },
    })
    expect(production.ok).toBe(false)
    expect(production.reasons).toContain("dummy_gate_artifact_forbidden")
    expect(production.sufficient_for_proven_grounding).toBe(false)
    expect(publication.artifact_sha256).toBe(DUMMY_GATE_D0_SHA256)
    expect(DUMMY_GATE_D1_SHA256.length).toBe(64)
    expect(DUMMY_GATE_D2_SHA256.length).toBe(64)
  })

  test("zero and multiple matches fail closed under the P0 policy", () => {
    const artifact = IndependentAuthority.encodeJsonUtf8Lf({ scaffold: "not-logged" })
    expect(
      verifyRekorV1Publication({
        policy_bytes: loadP0Policy(),
        artifact_bytes: artifact,
        controller: "originator",
        lookup: dummyLookup(),
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).reasons,
    ).toContain("zero_matches")
    const d0 = loadDummyDocument("d0") as Record<string, unknown>
    const uuid = Object.keys(d0)[0]!
    const duplicate = { [`${uuid}dup`]: (d0[uuid] as object) }
    const hash = IndependentAuthority.sha256ExactBytes(readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")))
    const lookup = lookupFromRekorDocuments([d0, duplicate])
    const multiple = lookup.searchByHash(hash)
    expect(Array.isArray(multiple) && multiple.length >= 1).toBe(true)
  })

  test("wrong SAN/OIDC/log/tree fail closed on dummy documents with P0 policy", () => {
    const d0 = readFileSync(resolve(DUMMY_GATE_DIR, "d0.json"))
    expect(
      verifyRekorV1Publication({
        policy_bytes: loadP0Policy(),
        artifact_bytes: d0,
        controller: "authority",
        lookup: dummyLookup(),
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).reasons,
    ).toContain("wrong_san")
    const wrongLog = cloneDocument(loadDummyDocument("d0"))
    const uuid = Object.keys(wrongLog)[0]!
    ;(wrongLog[uuid] as Record<string, unknown>)["logID"] = "00".repeat(32)
    expect(
      verifyRekorV1Publication({
        policy_bytes: loadP0Policy(),
        artifact_bytes: d0,
        controller: "originator",
        lookup: dummyLookup([wrongLog]),
        observed_endpoint: REKOR_V1_ENDPOINT,
      }).ok,
    ).toBe(false)
    expect(OIDC_ISSUER_GITHUB_OAUTH.startsWith("https://")).toBe(true)
    expect(AUTHORITY_SAN_EMAIL.includes("@")).toBe(true)
  })
})

describe("evaluateProductionRekorIndependentGrounding negatives", () => {
  test("missing private operands remain UNPROVEN", () => {
    expectNotProven(evaluateProductionRekorIndependentGrounding({}))
  })

  test("caller-shaped intended without frozen bytes is rejected", () => {
    const pkg = twelveCasePackage()
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(),
      intended: intendedFromProjection(pkg),
    })
    expectNotProven(result)
    expect(result.reasons.some((reason) => reason.includes("caller_shaped_intended"))).toBe(true)
  })

  test("intendedFrom(A) projection as intended bytes cannot mint PROVEN", () => {
    const pkg = twelveCasePackage()
    const projected = IndependentAuthority.encodeJsonUtf8Lf(intendedFromProjection(pkg))
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(),
      intended_faithfulness_bytes: projected,
    })
    expectNotProven(result)
  })

  test("cross-instance historical intended is rejected", () => {
    const pkg = { ...twelveCasePackage(), instance_id: HISTORICAL_IA_INSTANCE_ID }
    const bytes = IndependentAuthority.encodeJsonUtf8Lf(intendedArtifact(pkg))
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(),
      intended_faithfulness_bytes: bytes,
    })
    expectNotProven(result)
  })

  test("intended bytes/digest mismatch against E0 fails", () => {
    const operands = buildScaffoldOperands()
    const other = IndependentAuthority.encodeJsonUtf8Lf({
      ...intendedArtifact(operands.pkg),
      instance_id: "scaffold-future-intended.other-not-production",
    })
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(operands),
      intended_faithfulness_bytes: other,
    })
    expectNotProven(result)
  })

  test("answer-bearing intended artifact is rejected", () => {
    const artifact = { ...intendedArtifact(twelveCasePackage()), derived_attribution_set: ["I_A"] }
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(),
      intended_faithfulness_bytes: IndependentAuthority.encodeJsonUtf8Lf(artifact),
    })
    expectNotProven(result)
  })

  test("historical E0 replayed as v1 is rejected", () => {
    const historical = readFileSync(HISTORICAL_E0_PATH)
    expect(acceptE0RecordV1(JSON.parse(historical.toString("utf8"))).ok).toBe(false)
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(),
      e0_record_bytes: historical,
    })
    expectNotProven(result)
    expect(result.reasons.some((reason) => reason.includes("e0_v1") || reason.includes("non_canonical") || reason.includes("e0_"))).toBe(true)
  })

  test("dummy-gate replay onto production is rejected", () => {
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(),
      intended_faithfulness_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")),
      e0_record_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")),
      e1_artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d1.json")),
      object_b_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d1.json")),
      e2_artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d2.json")),
      originator_oracle_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d2.json")),
    })
    expectNotProven(result)
  })

  test("P0/E0/E1/E2 wrong order cannot pass the production sequence", () => {
    const reversed = verifyRekorV1ProductionSequence({
      policy_bytes: loadP0Policy(),
      lookup: dummyLookup(),
      observed_endpoint: REKOR_V1_ENDPOINT,
      events: {
        p0_artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d2.json")),
        e0_artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d1.json")),
        e1_artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")),
        e2_artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d2.json")),
      },
    })
    expect(reversed.ok).toBe(false)
    expect(reversed.sufficient_for_proven_grounding).toBe(false)
    expect(
      reversed.reasons.some((reason) =>
        reason === "dummy_gate_artifact_forbidden" || reason === "reversed_log_index" || reason === "zero_matches",
      ),
    ).toBe(true)
    const historicalOrder = verifyRekorV1OrderedEvents({
      policy_bytes: loadV0Policy(),
      lookup: dummyLookup(),
      observed_endpoint: REKOR_V1_ENDPOINT,
      events: [
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d2.json")), controller: "originator" },
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d1.json")), controller: "authority" },
        { artifact_bytes: readFileSync(resolve(DUMMY_GATE_DIR, "d0.json")), controller: "originator" },
      ],
    })
    expect(historicalOrder.ok).toBe(false)
    expect(historicalOrder.sufficient_for_proven_grounding).toBe(false)
  })

  test("intended first anchored after E0 remains UNPROVEN", () => {
    const operands = buildScaffoldOperands()
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(operands),
      rekor_documents: [loadDummyDocument("d0"), loadDummyDocument("d1"), loadDummyDocument("d2")],
    })
    expectNotProven(result)
    expect(
      result.reasons.some((reason) =>
        reason === "intended_anchored_after_e0" ||
        reason === "production_sequence_unverified" ||
        reason.includes("zero_matches") ||
        reason.includes("dummy_gate"),
      ),
    ).toBe(true)
  })

  test("caller-forged observations/order/identity/digest/status cannot mint PROVEN", () => {
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(),
      observations: {
        provider_id: "rekor-v1",
        trust_root_id: "forged",
        publisher_identifiers: ["forged"],
        oracle_bytes_sha256: "ab".repeat(32),
        problem_package_digest: "cd".repeat(32),
        freeze_precedes_comparison: true,
        freeze_precedes_answer_disclosure: true,
        source_material_refs: [],
      },
      freeze_precedes_comparison: true,
      production_publishable: true,
      independent_grounding: "PROVEN",
      sufficient_for_proven_grounding: true,
      PROVEN: true,
    })
    expectNotProven(result)
    expect(result.reasons.some((reason) => reason.startsWith("caller_shaped_"))).toBe(true)
  })

  test("E1 payload bytes unequal to Object B fail", () => {
    const operands = buildScaffoldOperands()
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(operands),
      e1_artifact_bytes: Buffer.from(operands.objectBBytes.toString("utf8").replace("\n", " \n")),
    })
    expectNotProven(result)
    expect(result.reasons).toContain("e1_payload_bytes_not_object_b")
  })

  test("non-canonical Object B bytes fail closed before semantic comparison", () => {
    const operands = buildScaffoldOperands()
    const prettyPrinted = Buffer.from(JSON.stringify(JSON.parse(operands.objectBBytes.toString("utf8")), null, 2), "utf8")
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(operands),
      object_b_bytes: prettyPrinted,
      e1_artifact_bytes: prettyPrinted,
    })
    expectNotProven(result)
    expect(result.reasons).toContain("object_b_bytes_non_canonical")
    expect(result.semantic_relation).toBe("NOT_EVALUATED")
  })

  test("missing final LF on Object B fails closed before semantic comparison", () => {
    const operands = buildScaffoldOperands()
    const missingLf = operands.objectBBytes.subarray(0, operands.objectBBytes.length - 1)
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(operands),
      object_b_bytes: missingLf,
      e1_artifact_bytes: missingLf,
    })
    expectNotProven(result)
    expect(result.reasons).toContain("object_b_bytes_non_canonical")
    expect(result.semantic_relation).toBe("NOT_EVALUATED")
  })

  test("E2 payload bytes unequal to oracle fail", () => {
    const operands = buildScaffoldOperands()
    const mutated = Buffer.from(operands.oracleBytes)
    mutated[mutated.length - 2] = mutated[mutated.length - 2]! ^ 1
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(operands),
      e2_artifact_bytes: mutated,
    })
    expectNotProven(result)
    expect(result.reasons).toContain("e2_payload_bytes_not_oracle")
  })

  test("commitment failure remains UNPROVEN", () => {
    const operands = buildScaffoldOperands()
    const badNonce = Uint8Array.from({ length: 32 }, () => 0x22)
    const result = evaluateProductionRekorIndependentGrounding({
      ...baseBundle(operands),
      nonce_bytes: badNonce,
    })
    expectNotProven(result)
    expect(result.reasons.some((reason) => reason.includes("commitment"))).toBe(true)
  })

  test("post-call mutation of caller bytes cannot mint PROVEN and a second mutated call fails", () => {
    const operands = buildScaffoldOperands()
    const bundle = baseBundle(operands)
    const first = evaluateProductionRekorIndependentGrounding(bundle)
    expectNotProven(first)
    bundle.object_a_bytes[0] = bundle.object_a_bytes[0]! ^ 0xff
    const mutated = evaluateProductionRekorIndependentGrounding(bundle)
    expectNotProven(mutated)
    expect(first.independent_grounding).not.toBe("PROVEN")
  })

  test("no reusable brand/capability is returned", () => {
    const result = evaluateProductionRekorIndependentGrounding(baseBundle())
    expectNotProven(result)
    expect("capability" in result).toBe(false)
    expect("brand" in result).toBe(false)
    const cloned = JSON.parse(JSON.stringify({ ...result, core: null }))
    cloned.independent_grounding = "PROVEN"
    cloned.production_publishable = true
    expect(cloned.independent_grounding).toBe("PROVEN")
    const second = evaluateProductionRekorIndependentGrounding(baseBundle())
    expectNotProven(second)
  })

  test("wrong/missing/extra keys, BOM/CRLF, and v0 policy fail closed", () => {
    expectNotProven(evaluateProductionRekorIndependentGrounding({ ...baseBundle(), extra: true }))
    const operands = buildScaffoldOperands()
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), operands.intendedBytes])
    expectNotProven(evaluateProductionRekorIndependentGrounding({ ...baseBundle(operands), intended_faithfulness_bytes: bom }))
    expectNotProven(evaluateProductionRekorIndependentGrounding({ ...baseBundle(operands), policy_bytes: loadV0Policy() }))
  })

  test("production sequence with scaffold bytes is unverified (no P0) and not PROVEN", () => {
    const result = evaluateProductionRekorIndependentGrounding(baseBundle())
    expectNotProven(result)
    expect(result.reasons.some((reason) => reason.includes("production_sequence_unverified") || reason.includes("zero_matches") || reason.includes("intended"))).toBe(true)
  })
})
