/**
 * Protocol-v2 exact-byte intended-faithfulness acceptor.
 *
 * Acceptance is deliberately narrower than real intended-instance
 * eligibility. This module never inspects Rekor evidence and never returns a
 * publishability or sufficiency verdict.
 */

import { types } from "node:util"
import {
  DUMMY_GATE_RUN,
  OBJECT_A_CASE_KEYS,
  OBJECT_A_FORBIDDEN_KEYS,
  OBJECT_A_INVARIANT_KEYS,
  type ConcreteCaseValue,
} from "./independent-authority-model"
import * as IndependentAuthority from "./independent-authority"
import type { IntendedFaithfulness } from "./independent-authority"

export const INTENDED_FAITHFULNESS_V1_SCHEMA =
  "tsei-invariant-discrimination-v1.intended-faithfulness.v1" as const
export const FROZEN_PROTOCOL_V2_SHA256 =
  "3150b5ae09d9b14d706cb64473de63917804e002bd79b5f60473927460b454d0" as const
export const REKOR_V1_PROVIDER_POLICY_V1_SHA256 =
  "744d024586c983f8bb6c1dd10209aeb0354b65a5121af0ef6580ea2fd8aa8e56" as const
export const HISTORICAL_IA_INSTANCE_IDS = new Set<string>([
  "tsei-ia-real-v0-20260819-01",
  "tsei-ia-real-v1-20260821-02",
  DUMMY_GATE_RUN,
])

export const INTENDED_FAITHFULNESS_V1_TOP_LEVEL_KEYS = [
  "schema",
  "instance_id",
  "protocol_sha256",
  "provider_policy_sha256",
  "invariants",
  "cases",
] as const

const INSTANCE_ID_RE = /^[a-z0-9._-]+$/
const LOWER_HEX_64 = /^[0-9a-f]{64}$/
const MAX_GRAPH_DEPTH = 32
const FORBIDDEN_KEYS = new Set<string>([
  ...OBJECT_A_FORBIDDEN_KEYS,
  "evaluation_instruction",
  "problem_package_sha256",
  "originator_attribution_set",
  "derived_attribution_set",
  "expected_attribution",
  "expected_attribution_digest",
  "nonce",
  "oracle",
  "oracle_bytes",
  "internal_oracle",
  "answer",
  "answers",
  "evaluator_output",
  "repair",
  "discrimination",
  "production_publishable",
  "sufficient_for_real_intended_instance",
  "sufficient_for_proven_grounding",
  "sufficient_for_real_run",
  "PROVEN",
])
const FORBIDDEN_STRING_TOKENS = [
  "expected_attribution",
  "expected_attribution_digest",
  "predicate_source",
  "evaluator_output",
  "derived_attribution_set",
  "originator_attribution_set",
] as const

export type IntendedFaithfulnessArtifactV1 = {
  readonly schema: typeof INTENDED_FAITHFULNESS_V1_SCHEMA
  readonly instance_id: string
  readonly protocol_sha256: typeof FROZEN_PROTOCOL_V2_SHA256
  readonly provider_policy_sha256: typeof REKOR_V1_PROVIDER_POLICY_V1_SHA256
  readonly invariants: {
    readonly [invariantId: string]: {
      readonly invariant_id: string
      readonly normative_definition: string
      readonly normative_definition_identity: string
    }
  }
  readonly cases: {
    readonly [mutantId: string]: {
      readonly mutant_id: string
      readonly baseline: ConcreteCaseValue
      readonly mutated: ConcreteCaseValue
    }
  }
}

export type IntendedFaithfulnessAcceptanceV1 =
  | {
      readonly ok: true
      readonly reasons: readonly []
      readonly accepted_state: "INTENDED_BYTES_ACCEPTED"
      readonly bytes: Buffer
      readonly digest: string
      readonly artifact: IntendedFaithfulnessArtifactV1
      readonly intended: IntendedFaithfulness
    }
  | {
      readonly ok: false
      readonly reasons: readonly string[]
      readonly accepted_state: "INTENDED_BYTES_REJECTED"
      readonly bytes: null
      readonly digest: null
      readonly artifact: null
      readonly intended: null
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function keysExact(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

function unique(reasons: readonly string[]): string[] {
  return [...new Set(reasons)]
}

function fail(reasons: readonly string[]): IntendedFaithfulnessAcceptanceV1 {
  return {
    ok: false,
    reasons: unique(reasons),
    accepted_state: "INTENDED_BYTES_REJECTED",
    bytes: null,
    digest: null,
    artifact: null,
    intended: null,
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value
  Object.freeze(value)
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item)
  } else {
    for (const key of Object.keys(value as object)) deepFreeze((value as Record<string, unknown>)[key])
  }
  return value
}

function inspectGraph(value: unknown, path: string, reasons: string[], visiting: WeakSet<object>, depth = 0): void {
  if (depth > MAX_GRAPH_DEPTH) {
    reasons.push(`${path}: graph depth denied`)
    return
  }
  if (value === undefined || typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    reasons.push(`${path}: forbidden value type`)
    return
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) reasons.push(`${path}: non-finite number`)
    else if (Object.is(value, -0)) reasons.push(`${path}: negative zero is not canonical`)
    else if (Number.isInteger(value) && !Number.isSafeInteger(value)) reasons.push(`${path}: unsafe integer`)
    return
  }
  if (typeof value === "string") {
    const lowered = value.toLowerCase()
    if (FORBIDDEN_STRING_TOKENS.some((token) => lowered.includes(token))) {
      reasons.push(`${path}: forbidden answer or implementation token`)
    }
    if (value.includes("=>") || /\bfunction\s*\(/.test(value)) reasons.push(`${path}: executable-looking string`)
    return
  }
  if (value === null || typeof value !== "object") return
  if (types.isProxy(value)) {
    reasons.push(`${path}: Proxy values are forbidden`)
    return
  }
  if (visiting.has(value)) {
    reasons.push(`${path}: cyclic structure`)
    return
  }
  visiting.add(value)
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) reasons.push(`${path}: prototype-bearing array`)
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) reasons.push(`${path}[${index}]: sparse array`)
        inspectGraph(value[index], `${path}[${index}]`, reasons, visiting, depth + 1)
      }
      return
    }
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) reasons.push(`${path}: prototype-bearing object`)
    if (Object.getOwnPropertySymbols(value).length > 0) reasons.push(`${path}: symbol keys are forbidden`)
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        reasons.push(`${path}.${key}: getter/setter rejected`)
        continue
      }
      if (FORBIDDEN_KEYS.has(key)) reasons.push(`${path}.${key}: forbidden intended key`)
      inspectGraph(descriptor.value, `${path}.${key}`, reasons, visiting, depth + 1)
    }
  } finally {
    visiting.delete(value)
  }
}

function parseCanonicalBytes(bytes: Buffer): { ok: true; value: unknown } | { ok: false; reasons: string[] } {
  const reasons: string[] = []
  if (bytes.length === 0) reasons.push("intended_bytes_empty")
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) reasons.push("intended_bytes_bom")
  let lfCount = 0
  for (const byte of bytes) {
    if (byte === 0x00) reasons.push("intended_bytes_nul")
    if (byte === 0x0d) reasons.push("intended_bytes_cr")
    if (byte === 0x0a) lfCount += 1
  }
  if (bytes.length === 0 || bytes[bytes.length - 1] !== 0x0a) reasons.push("intended_bytes_missing_lf")
  if (lfCount !== 1) reasons.push("intended_bytes_wrong_lf_count")
  if (reasons.length > 0) return { ok: false, reasons: unique(reasons) }
  let value: unknown
  try {
    value = JSON.parse(bytes.toString("utf8").slice(0, -1))
  } catch {
    return { ok: false, reasons: ["intended_bytes_invalid_json"] }
  }
  try {
    if (!IndependentAuthority.encodeJsonUtf8Lf(value).equals(bytes)) {
      return { ok: false, reasons: ["intended_bytes_non_canonical"] }
    }
  } catch {
    return { ok: false, reasons: ["intended_bytes_non_canonical"] }
  }
  return { ok: true, value }
}

function isConcreteValue(value: unknown, path: string, reasons: string[]): value is ConcreteCaseValue {
  if (!isRecord(value)) {
    reasons.push(`${path}: concrete value must be an object`)
    return false
  }
  let ok = true
  for (const [key, item] of Object.entries(value)) {
    if (item === null || typeof item === "string" || typeof item === "boolean" || typeof item === "number") continue
    if (Array.isArray(item) && item.every((part) => typeof part === "number" || typeof part === "string")) continue
    reasons.push(`${path}.${key}: malformed concrete field`)
    ok = false
  }
  return ok
}

function snapshotConcrete(value: Record<string, unknown>): ConcreteCaseValue {
  const out: Record<string, ConcreteCaseValue[string]> = {}
  for (const [key, item] of Object.entries(value)) {
    out[key] = Array.isArray(item) ? ([...item] as number[] | string[]) : (item as ConcreteCaseValue[string])
  }
  return out
}

function shape(value: Record<string, unknown>):
  | { ok: true; artifact: IntendedFaithfulnessArtifactV1; intended: IntendedFaithfulness }
  | { ok: false; reasons: string[] } {
  const reasons: string[] = []
  if (!keysExact(value, INTENDED_FAITHFULNESS_V1_TOP_LEVEL_KEYS)) reasons.push("intended_top_level_keys_mismatch")
  if (value["schema"] !== INTENDED_FAITHFULNESS_V1_SCHEMA) reasons.push("intended_schema_mismatch")
  const instanceId = value["instance_id"]
  if (typeof instanceId !== "string" || !INSTANCE_ID_RE.test(instanceId)) reasons.push("instance_id_malformed")
  else if (HISTORICAL_IA_INSTANCE_IDS.has(instanceId)) reasons.push("instance_id_not_real_candidate")
  if (value["protocol_sha256"] !== FROZEN_PROTOCOL_V2_SHA256) reasons.push("protocol_digest_mismatch")
  if (value["provider_policy_sha256"] !== REKOR_V1_PROVIDER_POLICY_V1_SHA256) reasons.push("provider_policy_digest_mismatch")

  const invariantsRaw = value["invariants"]
  const casesRaw = value["cases"]
  if (!isRecord(invariantsRaw)) reasons.push("intended_invariants_not_map")
  if (!isRecord(casesRaw)) reasons.push("intended_cases_not_map")
  if (reasons.length > 0 || !isRecord(invariantsRaw) || !isRecord(casesRaw) || typeof instanceId !== "string") {
    return { ok: false, reasons: unique(reasons) }
  }
  if (Object.keys(invariantsRaw).length === 0) reasons.push("intended_invariants_empty")
  if (Object.keys(casesRaw).length === 0) reasons.push("intended_cases_empty")

  const invariants: IntendedFaithfulnessArtifactV1["invariants"] = {}
  const intendedInvariants: IntendedFaithfulness["invariants"] = {}
  for (const id of Object.keys(invariantsRaw)) {
    const row = invariantsRaw[id]
    if (!isRecord(row) || !keysExact(row, OBJECT_A_INVARIANT_KEYS)) {
      reasons.push(`invariant_${id}_shape_mismatch`)
      continue
    }
    const invariantId = row["invariant_id"]
    const definition = row["normative_definition"]
    const identity = row["normative_definition_identity"]
    if (invariantId !== id) reasons.push(`invariant_${id}_id_mismatch`)
    if (typeof definition !== "string") reasons.push(`invariant_${id}_definition_malformed`)
    if (typeof identity !== "string" || !LOWER_HEX_64.test(identity)) reasons.push(`invariant_${id}_identity_malformed`)
    if (typeof definition === "string" && typeof identity === "string" && identity !== IndependentAuthority.normativeDefinitionIdentity(definition)) {
      reasons.push(`invariant_${id}_identity_mismatch`)
    }
    if (typeof invariantId === "string" && typeof definition === "string" && typeof identity === "string") {
      invariants[id] = { invariant_id: invariantId, normative_definition: definition, normative_definition_identity: identity }
      intendedInvariants[id] = { normative_definition: definition, normative_definition_identity: identity }
    }
  }

  const cases: IntendedFaithfulnessArtifactV1["cases"] = {}
  const intendedCases: IntendedFaithfulness["cases"] = {}
  for (const id of Object.keys(casesRaw)) {
    const row = casesRaw[id]
    if (!isRecord(row) || !keysExact(row, OBJECT_A_CASE_KEYS)) {
      reasons.push(`case_${id}_shape_mismatch`)
      continue
    }
    if (row["mutant_id"] !== id) reasons.push(`case_${id}_id_mismatch`)
    const baselineOk = isConcreteValue(row["baseline"], `case_${id}_baseline`, reasons)
    const mutatedOk = isConcreteValue(row["mutated"], `case_${id}_mutated`, reasons)
    if (baselineOk && mutatedOk && isRecord(row["baseline"]) && isRecord(row["mutated"])) {
      const baseline = snapshotConcrete(row["baseline"])
      const mutated = snapshotConcrete(row["mutated"])
      cases[id] = { mutant_id: id, baseline, mutated }
      intendedCases[id] = { baseline, mutated }
    }
  }
  if (reasons.length > 0) return { ok: false, reasons: unique(reasons) }
  return {
    ok: true,
    artifact: {
      schema: INTENDED_FAITHFULNESS_V1_SCHEMA,
      instance_id: instanceId,
      protocol_sha256: FROZEN_PROTOCOL_V2_SHA256,
      provider_policy_sha256: REKOR_V1_PROVIDER_POLICY_V1_SHA256,
      invariants,
      cases,
    },
    intended: { invariants: intendedInvariants, cases: intendedCases },
  }
}

export function acceptIntendedFaithfulnessV1FromBytes(input: unknown): IntendedFaithfulnessAcceptanceV1 {
  try {
    if (!isRecord(input) || !keysExact(input, ["bytes"])) return fail(["malformed_intended_input"])
    if (!(input["bytes"] instanceof Uint8Array)) return fail(["intended_bytes_not_bytes"])
    const bytes = Buffer.from(input["bytes"])
    const parsed = parseCanonicalBytes(bytes)
    if (!parsed.ok) return fail(parsed.reasons)
    const inspection: string[] = []
    inspectGraph(parsed.value, "intended", inspection, new WeakSet())
    if (inspection.length > 0) return fail(inspection)
    if (!isRecord(parsed.value)) return fail(["intended_not_object"])
    const shaped = shape(parsed.value)
    if (!shaped.ok) return fail(shaped.reasons)
    const canonical = IndependentAuthority.encodeJsonUtf8Lf(shaped.artifact)
    if (!canonical.equals(bytes)) return fail(["intended_bytes_non_canonical"])
    return {
      ok: true,
      reasons: [],
      accepted_state: "INTENDED_BYTES_ACCEPTED",
      bytes: Buffer.from(bytes),
      digest: IndependentAuthority.sha256ExactBytes(bytes),
      artifact: deepFreeze(shaped.artifact),
      intended: deepFreeze(shaped.intended),
    }
  } catch {
    return fail(["malformed_intended_input"])
  }
}
