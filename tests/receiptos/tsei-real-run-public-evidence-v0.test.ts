/**
 * Public receipt for the real independent-authority Rekor v1 run.
 *
 * Offline: frozen public E0-record + public Rekor entry documents.
 * Does not read private-run payloads. Does not mint production
 * evaluateProductionIndependentGrounding PROVEN. The reported 12/12
 * table is a private-artifact result, not a public recomputation.
 */

import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "bun:test"
import {
  AUTHORITY_SAN_EMAIL,
  OIDC_ISSUER_GITHUB_OAUTH,
  ORIGINATOR_SAN_EMAIL,
  REKOR_V1_ENDPOINT,
  REKOR_V1_LOG_ID,
} from "../../conformance/tsei-invariant-discrimination-v0/independent-authority-model"
import {
  encodeJsonUtf8Lf,
  lookupFromRekorDocuments,
  REKOR_V1_PROVIDER_POLICY_SHA256,
  sha256ExactBytes,
  verifyRekorV1Publication,
} from "../../conformance/tsei-invariant-discrimination-v0/independent-authority"
import { INDEPENDENT_GROUNDING_REASON, INDEPENDENT_GROUNDING_STATUS } from "../../conformance/tsei-invariant-discrimination-v0/ladder"
import { acceptE0Record, FROZEN_PROTOCOL_SHA256 } from "../../conformance/tsei-invariant-discrimination-v0/object-a-e0-contract"
import {
  ALLOWED_INVARIANT_IDS,
  acceptRealRunPublicEvidence,
  CASE_IDS,
  PRIVATE_ARTIFACT_REPORTED_RELATION,
  REAL_RUN_PUBLIC_EVIDENCE_SCHEMA,
  REAL_RUN_PUBLIC_EVIDENCE_STATUS,
} from "../../conformance/tsei-invariant-discrimination-v0/rekor-v1-real-run-public-evidence"

const FIXTURE_DIR = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "fixtures",
  "rekor-v1-real-run-public-evidence",
)
const POLICY_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "provider-policy.rekor-v1.json",
)

const FORBIDDEN_SUBSTRINGS = [
  "CrystalReceiptPrivateRuns",
  "nonce.bin",
  "C:\\Users\\",
  "C:/Users/",
  "/Users/",
  "originator-oracle.private.json",
  "internal-oracle-reveal.json",
  "chatgpt",
  "screenshot",
  ".png",
  "derived_attribution_set",
  "AppData\\Local\\Temp",
  "feature/tsei-spec-artifact-v0",
]

function loadJson(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), "utf8"))
}

function hashedrekordValue(entry: unknown): { kind: string; apiVersion: string; sha256: string } {
  if (typeof entry !== "object" || entry === null) throw new Error("entry")
  const uuid = Object.keys(entry as object)[0]
  if (!uuid) throw new Error("uuid")
  const rec = (entry as Record<string, { body: string }>)[uuid]
  const body = JSON.parse(Buffer.from(rec.body, "base64").toString("utf8")) as {
    kind: string
    apiVersion: string
    spec: { data: { hash: { algorithm: string; value: string } } }
  }
  return { kind: body.kind, apiVersion: body.apiVersion, sha256: body.spec.data.hash.value }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("record")
  return value as Record<string, unknown>
}

function cloneEvidence(): Record<string, unknown> {
  return asRecord(JSON.parse(readFileSync(resolve(FIXTURE_DIR, "public-evidence.json"), "utf8")))
}

function collectStrings(value: unknown, acc: string[]): void {
  if (typeof value === "string") {
    acc.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, acc)
    return
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      acc.push(key)
      collectStrings(item, acc)
    }
  }
}

describe("TSEI real-run public evidence v0", () => {
  test("#200 ladder independent_grounding remains UNPROVEN", () => {
    expect(INDEPENDENT_GROUNDING_STATUS).toBe("UNPROVEN")
    expect(INDEPENDENT_GROUNDING_REASON.startsWith("INDEPENDENT_GROUNDING_NOT_PROVEN")).toBe(true)
  })

  test("schema, canonical bytes, and non-overclaiming derived status", () => {
    const bytes = readFileSync(resolve(FIXTURE_DIR, "public-evidence.json"))
    expect(bytes.includes(0x0d)).toBe(false)
    expect(bytes.includes(0x00)).toBe(false)
    expect(bytes[bytes.length - 1]).toBe(0x0a)
    const parsed = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>
    expect(parsed.schema).toBe(REAL_RUN_PUBLIC_EVIDENCE_SCHEMA)
    expect(encodeJsonUtf8Lf(parsed).equals(bytes)).toBe(true)
    const accepted = acceptRealRunPublicEvidence(parsed)
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.digest).toBe(sha256ExactBytes(bytes))
    const derived = asRecord(parsed.derived_status)
    const evaluator = asRecord(derived.evaluateProductionIndependentGrounding)
    expect(evaluator.independent_grounding).toBe("UNPROVEN")
    expect(evaluator.independent_grounding_reason).toBe("UNPROVEN_INDEPENDENCE")
    expect(evaluator.oracle_input_state).toBe("INVALID_PROVENANCE")
    expect(evaluator.production_publishable).toBe(false)
    const ordered = asRecord(derived.verifyRekorV1OrderedEvents)
    expect(ordered.ran_on_public_e1_e2_payloads).toBe(false)
    expect(ordered.sufficient_for_proven_grounding).toBe(false)
    expect(ordered.production_publishable).toBe(false)
    expect(ordered.ok).toBeUndefined()
    const privateResult = asRecord(derived.private_artifact_run_result)
    expect(privateResult.relation).toBe(PRIVATE_ARTIFACT_REPORTED_RELATION)
    expect(privateResult.cases_equal).toBe(12)
    expect(privateResult.cases_total).toBe(12)
    expect(privateResult.publicly_recomputable_from_package).toBe(false)
    expect(derived.public_evidence_status).toBe(REAL_RUN_PUBLIC_EVIDENCE_STATUS)
    expect(derived.mechanical_exact_set_relation).toBeUndefined()
    expect(parsed.exact_set_agreement).toBeUndefined()
    expect(derived.e0_commitment_opening_from_package).toBe(false)
    expect(derived.e1_e2_payload_signatures_verified_from_package).toBe(false)
    expect(parsed.public_reproducibility).toBe("NOT_FULLY_PUBLICLY_REPRODUCIBLE_PRIVATE_PAYLOADS_UNPUBLISHED")
    const strings: string[] = []
    collectStrings(parsed, strings)
    expect(strings.some((item) => item.includes("VERIFIED_EXACT_SET_AGREES"))).toBe(false)
    expect(strings.some((item) => item === "PROVEN")).toBe(false)
  })

  test("reported exact-set result is classified as reported, not a public recomputation", () => {
    const parsed = asRecord(loadJson("public-evidence.json"))
    const reported = asRecord(parsed.reported_exact_set_result)
    const ids = Object.keys(reported)
    expect(ids.length).toBe(CASE_IDS.length)
    expect(CASE_IDS.every((id) => ids.includes(id))).toBe(true)
    const allowed = new Set<string>(ALLOWED_INVARIANT_IDS)
    for (const id of CASE_IDS) {
      const row = reported[id]
      expect(Array.isArray(row)).toBe(true)
      const set = row as unknown[]
      expect(set.every((item) => typeof item === "string" && allowed.has(item))).toBe(true)
      expect(new Set(set as string[]).size).toBe(set.length)
    }
    const privateResult = asRecord(asRecord(parsed.derived_status).private_artifact_run_result)
    expect(privateResult.publicly_recomputable_from_package).toBe(false)
    expect(privateResult.relation).toBe("REPORTED_EXACT_SET_AGREES")
    const amb = asRecord(parsed.definition_ambiguity_observations_non_gating)
    expect(Object.keys(amb).sort()).toEqual(["c07", "c11", "c12"])
    for (const id of ["c07", "c11", "c12"] as const) {
      const row = asRecord(amb[id])
      expect(row.observed).toBe(true)
      expect(row.invariant_ids).toEqual(["I_C"])
      expect(row.readings_considered).toBe(2)
      expect(row.both_readings_coincided_on_vacuous_truth).toBe(true)
    }
  })

  test("recorded indexes, identity, and commitment coordinates", () => {
    const parsed = asRecord(loadJson("public-evidence.json"))
    const events = asRecord(parsed.events)
    const e0 = asRecord(events.E0)
    const e1 = asRecord(events.E1)
    const e2 = asRecord(events.E2)
    const order = asRecord(parsed.order)
    const provider = asRecord(parsed.provider)
    const artifacts = asRecord(parsed.artifacts)
    expect(order.recorded_numeric_relation).toBe("E0_lt_E1_lt_E2")
    expect(order.recorded_global_indexes).toEqual([2533202771, 2534488743, 2535402205])
    expect(order.independently_verified_from_public_payloads).toBe(false)
    expect(e0.global_log_index).toBe(2533202771)
    expect(e1.global_log_index).toBe(2534488743)
    expect(e2.global_log_index).toBe(2535402205)
    expect((e0.global_log_index as number) < (e1.global_log_index as number)).toBe(true)
    expect((e1.global_log_index as number) < (e2.global_log_index as number)).toBe(true)
    expect(provider.log_id).toBe(REKOR_V1_LOG_ID)
    expect(provider.tree_id).toBe("1193050959916656506")
    expect(provider.oidc_issuer).toBe(OIDC_ISSUER_GITHUB_OAUTH)
    expect(provider.originator_san_email).toBe(ORIGINATOR_SAN_EMAIL)
    expect(provider.authority_san_email).toBe(AUTHORITY_SAN_EMAIL)
    expect(provider.hashedrekord).toBe("0.0.1")
    expect(e0.controller).toBe("originator")
    expect(e1.controller).toBe("authority")
    expect(e2.controller).toBe("originator")
    expect(e1.artifact_unpublished).toBe(true)
    expect(e2.artifact_unpublished).toBe(true)
    expect(e1.payload_signatures_verified_from_package).toBe(false)
    expect(e2.payload_signatures_verified_from_package).toBe(false)
    expect(artifacts.oracle_commitment).toBe("2354fc94bdb586e76d9904513affad1de8b67acc43e7af803368438caf3d2520")
    expect(artifacts.nonce_length).toBe(32)
    expect(artifacts.object_a_sha256).toBe("50a3cc6151eff75a9ee3088a5dfdb0b2d354468432175b339f59a07b881e3a3f")
    expect(parsed.protocol_sha256).toBe(FROZEN_PROTOCOL_SHA256)
    expect(parsed.provider_policy_sha256).toBe(REKOR_V1_PROVIDER_POLICY_SHA256)
    expect(parsed.package_claims).toEqual([
      "e0_record_bytes_hash_to_anchored_digest",
      "e0_publication_signature_selector_rekor_verified_from_package",
      "e1_e2_rekor_entry_documents_record_stated_digests_log_ids_uuids_indexes",
      "recorded_global_indexes_numerically_e0_lt_e1_lt_e2",
      "private_artifact_independent_recomputation_reported_12_of_12_equality",
      "production_status_unproven",
    ])
    expect(parsed.package_does_not_claim).toEqual([
      "e1_e2_payload_signatures_verified_from_package",
      "e1_e2_identity_to_payload_binding_verified_from_package",
      "e0_commitment_opening_without_nonce_and_oracle_bytes",
      "exact_set_equality_between_two_public_operands",
    ])
  })

  test("public E0-record accepts and binds the published commitment", () => {
    const e0Bytes = readFileSync(resolve(FIXTURE_DIR, "e0-record.json"))
    expect(sha256ExactBytes(e0Bytes)).toBe("b8a41ce2a76a12aefceaab5e89127238e6a6dfcdfbb3a44b3c3572bb661cada7")
    const accepted = acceptE0Record(JSON.parse(e0Bytes.toString("utf8")))
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.record.oracle_commitment).toBe("2354fc94bdb586e76d9904513affad1de8b67acc43e7af803368438caf3d2520")
    expect(accepted.record.problem_package_sha256).toBe("50a3cc6151eff75a9ee3088a5dfdb0b2d354468432175b339f59a07b881e3a3f")
    expect(accepted.record.instance_id).toBe("tsei-ia-real-v0-20260819-01")
  })

  test("offline Rekor verifies public E0 bytes against the frozen E0 entry", () => {
    const policy_bytes = readFileSync(POLICY_PATH)
    const e0Bytes = readFileSync(resolve(FIXTURE_DIR, "e0-record.json"))
    const e0Entry = loadJson("e0.entry.json")
    const lookup = lookupFromRekorDocuments([e0Entry])
    const publication = verifyRekorV1Publication({
      policy_bytes,
      artifact_bytes: e0Bytes,
      controller: "originator",
      lookup,
      observed_endpoint: REKOR_V1_ENDPOINT,
      captured_tree_id: "1193050959916656506",
    })
    expect(publication.ok).toBe(true)
    expect(publication.global_log_index).toBe(2533202771)
    expect(publication.tree_id).toBe("1193050959916656506")
    expect(publication.san_email).toBe(ORIGINATOR_SAN_EMAIL)
    expect(publication.artifact_sha256).toBe("b8a41ce2a76a12aefceaab5e89127238e6a6dfcdfbb3a44b3c3572bb661cada7")
  })

  test("frozen Rekor bodies RECORD E1/E2 digest coordinates; private payloads are not verified", () => {
    const e1 = hashedrekordValue(loadJson("e1.entry.json"))
    const e2 = hashedrekordValue(loadJson("e2.entry.json"))
    expect(e1.kind).toBe("hashedrekord")
    expect(e1.apiVersion).toBe("0.0.1")
    expect(e1.sha256).toBe("986185d96f53c08852a47396c6ffe3f1fa7680ca859a0908edee8573b2cdc0ed")
    expect(e2.kind).toBe("hashedrekord")
    expect(e2.apiVersion).toBe("0.0.1")
    expect(e2.sha256).toBe("537364c2e3a460060a3f46eb5b5b8acd5a938bd9030175a667bba0e77a5c29d9")
    const e1Doc = asRecord(loadJson("e1.entry.json"))
    const e2Doc = asRecord(loadJson("e2.entry.json"))
    const e1Uuid = Object.keys(e1Doc)[0]!
    const e2Uuid = Object.keys(e2Doc)[0]!
    expect(e1Uuid).toBe("108e9186e8c5677ae925b2aa5ff8ab635b1116012cbd3d7334d18025107e974591c2ebb7d6475318")
    expect(e2Uuid).toBe("108e9186e8c5677a10d5dfb4f0fccaa9f8e21b852d2d8ed74e263d2771b7d90048b2c70816110a92")
    expect(asRecord(e1Doc[e1Uuid]).logIndex).toBe(2534488743)
    expect(asRecord(e2Doc[e2Uuid]).logIndex).toBe(2535402205)
    expect(asRecord(e1Doc[e1Uuid]).logID).toBe(REKOR_V1_LOG_ID)
    expect(asRecord(e2Doc[e2Uuid]).logID).toBe(REKOR_V1_LOG_ID)
    const parsed = asRecord(loadJson("public-evidence.json"))
    expect(asRecord(asRecord(parsed.events).E1).payload_signatures_verified_from_package).toBe(false)
    expect(asRecord(asRecord(parsed.events).E2).payload_signatures_verified_from_package).toBe(false)
  })

  test("negative: forbidden private reconstruction material is absent", () => {
    const names = readdirSync(FIXTURE_DIR)
    expect(names.sort()).toEqual(["e0-record.json", "e0.entry.json", "e1.entry.json", "e2.entry.json", "public-evidence.json"].sort())
    const all = names.map((name) => readFileSync(resolve(FIXTURE_DIR, name)).toString("utf8")).join("\n")
    const publicText = [
      readFileSync(resolve(FIXTURE_DIR, "public-evidence.json"), "utf8"),
      readFileSync(resolve(FIXTURE_DIR, "e0-record.json"), "utf8"),
    ].join("\n")
    for (const token of FORBIDDEN_SUBSTRINGS) {
      expect(all.toLowerCase().includes(token.toLowerCase())).toBe(false)
    }
    for (const token of ["gamma", "baseline", "mutated", "originator_attribution_set"]) {
      expect(publicText.toLowerCase().includes(token)).toBe(false)
    }
  })

  test("negative: malformed public evidence fails closed", () => {
    expect(() => acceptRealRunPublicEvidence(null)).not.toThrow()
    expect(acceptRealRunPublicEvidence(null).ok).toBe(false)
    expect(acceptRealRunPublicEvidence("public-evidence").ok).toBe(false)
    expect(acceptRealRunPublicEvidence({}).ok).toBe(false)
    expect(acceptRealRunPublicEvidence({ schema: REAL_RUN_PUBLIC_EVIDENCE_SCHEMA }).ok).toBe(false)
    const missingReported = cloneEvidence()
    delete missingReported.reported_exact_set_result
    expect(acceptRealRunPublicEvidence(missingReported).ok).toBe(false)
    const undeclared = cloneEvidence()
    asRecord(undeclared.reported_exact_set_result).c02 = ["I_Z"]
    expect(acceptRealRunPublicEvidence(undeclared).ok).toBe(false)
  })

  test("negative: status escalation and public recomputation claims fail closed", () => {
    const escalatedStatus = cloneEvidence()
    asRecord(escalatedStatus.derived_status).public_evidence_status = "REKOR_V1_E0_LT_E1_LT_E2_VERIFIED_EXACT_SET_AGREES"
    const escalatedAccepted = acceptRealRunPublicEvidence(escalatedStatus)
    expect(escalatedAccepted.ok).toBe(false)
    if (escalatedAccepted.ok) return
    expect(escalatedAccepted.reasons.includes("wrong_public_evidence_status")).toBe(true)
    expect(escalatedAccepted.reasons.includes("overclaim_verified_exact_set_agrees")).toBe(true)

    const mechanical = cloneEvidence()
    asRecord(mechanical.derived_status).mechanical_exact_set_relation = "AGREES"
    expect(acceptRealRunPublicEvidence(mechanical).ok).toBe(false)

    const legacyTable = cloneEvidence()
    legacyTable.exact_set_agreement = asRecord(legacyTable.reported_exact_set_result)
    expect(acceptRealRunPublicEvidence(legacyTable).ok).toBe(false)

    const publicRecompute = cloneEvidence()
    asRecord(asRecord(publicRecompute.derived_status).private_artifact_run_result).publicly_recomputable_from_package =
      true
    const publicRecomputeAccepted = acceptRealRunPublicEvidence(publicRecompute)
    expect(publicRecomputeAccepted.ok).toBe(false)
    if (publicRecomputeAccepted.ok) return
    expect(publicRecomputeAccepted.reasons.includes("publicly_recomputable_from_package_not_false")).toBe(true)

    const proven = cloneEvidence()
    asRecord(asRecord(proven.derived_status).evaluateProductionIndependentGrounding).independent_grounding = "PROVEN"
    const provenAccepted = acceptRealRunPublicEvidence(proven)
    expect(provenAccepted.ok).toBe(false)
    if (provenAccepted.ok) return
    expect(provenAccepted.reasons.includes("production_independent_grounding_not_unproven")).toBe(true)

    const publishable = cloneEvidence()
    asRecord(asRecord(publishable.derived_status).evaluateProductionIndependentGrounding).production_publishable = true
    expect(acceptRealRunPublicEvidence(publishable).ok).toBe(false)

    const sufficient = cloneEvidence()
    asRecord(asRecord(sufficient.derived_status).verifyRekorV1OrderedEvents).sufficient_for_proven_grounding = true
    expect(acceptRealRunPublicEvidence(sufficient).ok).toBe(false)
  })
})
