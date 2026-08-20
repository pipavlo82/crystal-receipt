/**
 * Answer-free intended-faithfulness contract for a future independent-authority
 * run (protocol v1 addendum).
 *
 * This module does not create a real intended corpus, does not publish P0,
 * and cannot mint production PROVEN. Scaffold fixtures are not a real instance.
 *
 * Narrow claim later bound by Rekor P0: exact intended bytes were independently
 * verifiably frozen before Object A / E0. That is not proof of private creation
 * time and not independent authorship.
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
import { REKOR_V1_P0_PROVIDER_POLICY_SHA256 } from "./rekor-v1-verifier"

export const INTENDED_FAITHFULNESS_SCHEMA =
  "tsei-invariant-discrimination-v0.intended-faithfulness.v0" as const

/** SHA-256 of INDEPENDENT_AUTHORITY_BLIND_GROUNDING_PROTOCOL_V1.md (exact bytes). */
export const FROZEN_PROTOCOL_V1_SHA256 =
  "ed683a030c0c735124349b1f29ffb7f9d12dfeedbb9153a0d03c3920c877a7f7" as const

export const HISTORICAL_IA_INSTANCE_ID = "tsei-ia-real-v0-20260819-01" as const

export const INTENDED_FAITHFULNESS_TOP_LEVEL_KEYS = [
  "schema",
  "instance_id",
  "protocol_sha256",
  "provider_policy_sha256",
  "invariants",
  "cases",
] as const

export const INTENDED_INVARIANT_KEYS = OBJECT_A_INVARIANT_KEYS
export const INTENDED_CASE_KEYS = OBJECT_A_CASE_KEYS

const INSTANCE_ID_RE = /^[a-z0-9._-]+$/
const LOWER_HEX_64 = /^[0-9a-f]{64}$/
const MAX_GRAPH_DEPTH = 32

const INTENDED_FORBIDDEN_KEYS = [
  ...OBJECT_A_FORBIDDEN_KEYS,
  "evaluation_instruction",
  "problem_package_sha256",
  "originator_attribution_set",
  "nonce",
  "oracle",
  "oracle_bytes",
  "internal_oracle",
  "answer",
  "answers",
  "PROVEN",
  "DISAGREED",
  "UNPROVEN",
  "repair",
  "discrimination",
] as const

const FORBIDDEN_INSTANCE_IDS = new Set<string>([HISTORICAL_IA_INSTANCE_ID, DUMMY_GATE_RUN])

const FORBIDDEN_STRING_TOKENS = [
  "expected_attribution",
  "expected_attribution_digest",
  "predicate_source",
  "evaluator_output",
  "derived_attribution_set",
  "originator_attribution_set",
] as const

export type IntendedFaithfulnessArtifact = {
  readonly schema: typeof INTENDED_FAITHFULNESS_SCHEMA
  readonly instance_id: string
  readonly protocol_sha256: typeof FROZEN_PROTOCOL_V1_SHA256
  readonly provider_policy_sha256: typeof REKOR_V1_P0_PROVIDER_POLICY_SHA256
  readonly invariants: {
    readonly [invariant_id: string]: {
      readonly invariant_id: string
      readonly normative_definition: string
      readonly normative_definition_identity: string
    }
  }
  readonly cases: {
    readonly [mutant_id: string]: {
      readonly mutant_id: string
      readonly baseline: ConcreteCaseValue
      readonly mutated: ConcreteCaseValue
    }
  }
}

export type IntendedFaithfulnessAcceptance =
  | {
      readonly ok: true
      readonly reasons: readonly string[]
      readonly bytes: Buffer
      readonly digest: string
      readonly artifact: IntendedFaithfulnessArtifact
      readonly intended: IntendedFaithfulness
      readonly production_publishable: false
      readonly sufficient_for_real_intended_instance: false
    }
  | {
      readonly ok: false
      readonly reasons: readonly string[]
      readonly bytes: null
      readonly digest: null
      readonly artifact: null
      readonly intended: null
      readonly production_publishable: false
      readonly sufficient_for_real_intended_instance: false
    }

function failIntended(reasons: readonly string[]): IntendedFaithfulnessAcceptance {
  return {
    ok: false,
    reasons,
    bytes: null,
    digest: null,
    artifact: null,
    intended: null,
    production_publishable: false,
    sufficient_for_real_intended_instance: false,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function uniqueReasons(reasons: readonly string[]): string[] {
  return [...new Set(reasons)]
}

function inspectUntrustedGraph(
  value: unknown,
  path: string,
  reasons: string[],
  visiting: WeakSet<object>,
  depth = 0,
): void {
  if (value === undefined) {
    reasons.push(`${path}: undefined is not allowed`)
    return
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    reasons.push(`${path}: forbidden value type ${typeof value}`)
    return
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) reasons.push(`${path}: non-finite number`)
    else if (Object.is(value, -0)) reasons.push(`${path}: negative zero is not canonical`)
    else if (Number.isInteger(value) && !Number.isSafeInteger(value)) reasons.push(`${path}: unsafe integer`)
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
  if (depth > MAX_GRAPH_DEPTH) {
    reasons.push(`${path}: graph depth denied`)
    return
  }
  visiting.add(value)
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        reasons.push(`${path}: prototype-bearing array`)
      }
      if (Object.getOwnPropertySymbols(value).length > 0) {
        reasons.push(`${path}: symbol keys are forbidden`)
      }
      const descs = Object.getOwnPropertyDescriptors(value)
      const lengthDesc = descs["length"]
      if (lengthDesc && (lengthDesc.get !== undefined || lengthDesc.set !== undefined)) {
        reasons.push(`${path}[length]: getter/setter rejected`)
      } else if (typeof lengthDesc?.value === "number" && Number.isSafeInteger(lengthDesc.value) && lengthDesc.value >= 0) {
        for (let index = 0; index < lengthDesc.value; index += 1) {
          if (!Object.prototype.hasOwnProperty.call(value, String(index))) {
            reasons.push(`${path}[${index}]: sparse arrays are forbidden`)
          }
        }
      }
      for (const key of Object.keys(descs)) {
        const desc = descs[key]
        if (!desc) continue
        if (desc.get !== undefined || desc.set !== undefined) {
          reasons.push(`${path}[${key}]: getter/setter rejected`)
          continue
        }
        if (key === "length") continue
        inspectUntrustedGraph(
          desc.value,
          /^\d+$/.test(key) ? `${path}[${key}]` : `${path}.${key}`,
          reasons,
          visiting,
          depth + 1,
        )
      }
      return
    }
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) {
      reasons.push(`${path}: prototype-bearing object rejected`)
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      reasons.push(`${path}: symbol keys are forbidden`)
    }
    const descs = Object.getOwnPropertyDescriptors(value)
    for (const key of Object.keys(descs)) {
      const desc = descs[key]
      if (!desc) continue
      if (desc.get !== undefined || desc.set !== undefined) {
        reasons.push(`${path}.${key}: getter/setter rejected`)
        continue
      }
      inspectUntrustedGraph(desc.value, `${path}.${key}`, reasons, visiting, depth + 1)
    }
  } finally {
    visiting.delete(value)
  }
}

function missingKeys(record: Record<string, unknown>, allowed: readonly string[], path: string, reasons: string[]): void {
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      reasons.push(`${path}.${key}: missing required key`)
    }
  }
}

function extraKeys(record: Record<string, unknown>, allowed: readonly string[], path: string, reasons: string[]): void {
  const allow = new Set(allowed)
  for (const key of Object.keys(record)) {
    if (!allow.has(key)) reasons.push(`${path}.${key}: unexpected key`)
  }
}

function walkForbidden(value: unknown, path: string, reasons: string[]): void {
  if (typeof value === "function") {
    reasons.push(`${path}: executable function value is forbidden on intended`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForbidden(item, `${path}[${index}]`, reasons))
    return
  }
  if (!isRecord(value)) {
    if (typeof value === "string") {
      const lowered = value.toLowerCase()
      if (FORBIDDEN_STRING_TOKENS.some((token) => lowered.includes(token))) {
        reasons.push(`${path}: string mentions forbidden implementation/answer token`)
      }
      if (value.includes("=>") || /\bfunction\s*\(/.test(value)) {
        reasons.push(`${path}: string looks like executable predicate/source`)
      }
    }
    return
  }
  for (const key of Object.keys(value)) {
    if ((INTENDED_FORBIDDEN_KEYS as readonly string[]).includes(key)) {
      reasons.push(`${path}.${key}: forbidden intended key`)
    }
    walkForbidden(value[key], `${path}.${key}`, reasons)
  }
}

function isPlainConcreteValue(value: unknown, path: string, reasons: string[]): value is ConcreteCaseValue {
  if (!isRecord(value)) {
    reasons.push(`${path}: concrete value must be a plain object`)
    return false
  }
  let ok = true
  for (const [field, item] of Object.entries(value)) {
    if (item === null || typeof item === "string" || typeof item === "boolean" || typeof item === "number") continue
    if (Array.isArray(item) && item.every((el) => typeof el === "number" || typeof el === "string")) continue
    reasons.push(`${path}.${field}: malformed concrete field`)
    ok = false
  }
  return ok
}

function snapshotConcrete(value: Record<string, unknown>): ConcreteCaseValue {
  const out: { [field: string]: ConcreteCaseValue[string] } = {}
  for (const key of Object.keys(value)) {
    const item = value[key]
    if (Array.isArray(item)) {
      out[key] = item.map((el) => el) as number[] | string[]
    } else {
      out[key] = item as ConcreteCaseValue[string]
    }
  }
  return out
}

function asExactBytes(value: unknown, label: string): { ok: true; bytes: Buffer } | { ok: false; reasons: string[] } {
  if (!(value instanceof Uint8Array)) return { ok: false, reasons: [`${label}_not_bytes`] }
  return { ok: true, bytes: Buffer.from(value) }
}

function validateCanonicalUtf8JsonLf(bytes: Uint8Array): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = []
  if (bytes.length === 0) return { ok: false, reasons: ["canonical_bytes_empty"] }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    reasons.push("canonical_bytes_bom")
  }
  let lfCount = 0
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i]
    if (b === 0x00) reasons.push("canonical_bytes_nul")
    if (b === 0x0d) reasons.push("canonical_bytes_cr")
    if (b === 0x0a) lfCount += 1
  }
  if (bytes[bytes.length - 1] !== 0x0a) reasons.push("canonical_bytes_missing_lf")
  if (lfCount === 0) reasons.push("canonical_bytes_missing_lf")
  if (lfCount > 1) reasons.push("canonical_bytes_extra_lf")
  if (reasons.length > 0) return { ok: false, reasons: uniqueReasons(reasons) }
  let text: string
  try {
    text = Buffer.from(bytes).toString("utf8")
  } catch {
    return { ok: false, reasons: ["canonical_bytes_not_utf8"] }
  }
  const body = text.endsWith("\n") ? text.slice(0, -1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return { ok: false, reasons: ["canonical_bytes_invalid_json"] }
  }
  let encoded: Buffer
  try {
    encoded = IndependentAuthority.encodeJsonUtf8Lf(parsed)
  } catch {
    return { ok: false, reasons: ["canonical_bytes_encode_failed"] }
  }
  if (!encoded.equals(Buffer.from(bytes))) {
    return { ok: false, reasons: ["canonical_bytes_non_canonical"] }
  }
  return { ok: true }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value
  Object.freeze(value)
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item)
    return value
  }
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Record<string, unknown>)[key])
  }
  return value
}

function validateIntendedShape(
  record: Record<string, unknown>,
): { ok: true; artifact: IntendedFaithfulnessArtifact; intended: IntendedFaithfulness } | { ok: false; reasons: string[] } {
  const reasons: string[] = []
  missingKeys(record, INTENDED_FAITHFULNESS_TOP_LEVEL_KEYS, "intended", reasons)
  extraKeys(record, INTENDED_FAITHFULNESS_TOP_LEVEL_KEYS, "intended", reasons)
  walkForbidden(record, "intended", reasons)
  if (record["schema"] !== INTENDED_FAITHFULNESS_SCHEMA) {
    reasons.push("intended.schema must be tsei-invariant-discrimination-v0.intended-faithfulness.v0")
  }
  if (typeof record["instance_id"] !== "string" || !INSTANCE_ID_RE.test(record["instance_id"])) {
    reasons.push("intended.instance_id is malformed")
  } else if (FORBIDDEN_INSTANCE_IDS.has(record["instance_id"])) {
    reasons.push("intended.instance_id is a forbidden historical or dummy-gate id")
  }
  if (record["protocol_sha256"] !== FROZEN_PROTOCOL_V1_SHA256) {
    reasons.push("intended.protocol_sha256 mismatch")
  }
  if (record["provider_policy_sha256"] !== REKOR_V1_P0_PROVIDER_POLICY_SHA256) {
    reasons.push("intended.provider_policy_sha256 mismatch")
  }
  const invariantsRaw = record["invariants"]
  const casesRaw = record["cases"]
  if (Array.isArray(invariantsRaw) || !isRecord(invariantsRaw)) {
    reasons.push("intended.invariants must be a map, not an array or other value")
  }
  if (Array.isArray(casesRaw) || !isRecord(casesRaw)) {
    reasons.push("intended.cases must be a map, not an array or other value")
  }
  if (reasons.length > 0 || !isRecord(invariantsRaw) || !isRecord(casesRaw)) {
    return { ok: false, reasons: uniqueReasons(reasons) }
  }
  if (Object.keys(invariantsRaw).length === 0) reasons.push("intended.invariants must be non-empty")
  if (Object.keys(casesRaw).length === 0) reasons.push("intended.cases must be non-empty")

  const invariants: IntendedFaithfulnessArtifact["invariants"] = {}
  const intendedInvariants: IntendedFaithfulness["invariants"] = {}
  for (const id of Object.keys(invariantsRaw)) {
    const row = invariantsRaw[id]
    if (!isRecord(row) || Array.isArray(row)) {
      reasons.push(`intended.invariants.${id}: invariant must be an object`)
      continue
    }
    missingKeys(row, INTENDED_INVARIANT_KEYS, `intended.invariants.${id}`, reasons)
    extraKeys(row, INTENDED_INVARIANT_KEYS, `intended.invariants.${id}`, reasons)
    if (row["invariant_id"] !== id) {
      reasons.push(`intended.invariants.${id}: map key must equal invariant_id`)
    }
    if (typeof row["normative_definition"] !== "string") {
      reasons.push(`intended.invariants.${id}.normative_definition must be a string`)
    }
    if (typeof row["normative_definition_identity"] !== "string" || !LOWER_HEX_64.test(row["normative_definition_identity"])) {
      reasons.push(`intended.invariants.${id}.normative_definition_identity must be 64 lowercase hex characters`)
    } else if (typeof row["normative_definition"] === "string") {
      const identity = IndependentAuthority.normativeDefinitionIdentity(row["normative_definition"])
      if (row["normative_definition_identity"] !== identity) {
        reasons.push(`intended.invariants.${id}: normative definition identity does not match definition bytes`)
      }
    }
    if (
      typeof row["invariant_id"] === "string" &&
      typeof row["normative_definition"] === "string" &&
      typeof row["normative_definition_identity"] === "string"
    ) {
      invariants[id] = {
        invariant_id: row["invariant_id"],
        normative_definition: row["normative_definition"],
        normative_definition_identity: row["normative_definition_identity"],
      }
      intendedInvariants[id] = {
        normative_definition: row["normative_definition"],
        normative_definition_identity: row["normative_definition_identity"],
      }
    }
  }

  const cases: IntendedFaithfulnessArtifact["cases"] = {}
  const intendedCases: IntendedFaithfulness["cases"] = {}
  for (const id of Object.keys(casesRaw)) {
    const row = casesRaw[id]
    if (!isRecord(row) || Array.isArray(row)) {
      reasons.push(`intended.cases.${id}: case must be an object`)
      continue
    }
    missingKeys(row, INTENDED_CASE_KEYS, `intended.cases.${id}`, reasons)
    extraKeys(row, INTENDED_CASE_KEYS, `intended.cases.${id}`, reasons)
    if (row["mutant_id"] !== id) {
      reasons.push(`intended.cases.${id}: map key must equal mutant_id`)
    }
    const baselineReasons: string[] = []
    const mutatedReasons: string[] = []
    const baselineOk = isPlainConcreteValue(row["baseline"], `intended.cases.${id}.baseline`, baselineReasons)
    const mutatedOk = isPlainConcreteValue(row["mutated"], `intended.cases.${id}.mutated`, mutatedReasons)
    reasons.push(...baselineReasons, ...mutatedReasons)
    if (baselineOk && mutatedOk && isRecord(row["baseline"]) && isRecord(row["mutated"])) {
      cases[id] = {
        mutant_id: id,
        baseline: snapshotConcrete(row["baseline"]),
        mutated: snapshotConcrete(row["mutated"]),
      }
      intendedCases[id] = {
        baseline: snapshotConcrete(row["baseline"]),
        mutated: snapshotConcrete(row["mutated"]),
      }
    }
  }

  if (reasons.length > 0) return { ok: false, reasons: uniqueReasons(reasons) }
  if (typeof record["instance_id"] !== "string") return { ok: false, reasons: ["intended.instance_id is malformed"] }
  const artifact: IntendedFaithfulnessArtifact = {
    schema: INTENDED_FAITHFULNESS_SCHEMA,
    instance_id: record["instance_id"],
    protocol_sha256: FROZEN_PROTOCOL_V1_SHA256,
    provider_policy_sha256: REKOR_V1_P0_PROVIDER_POLICY_SHA256,
    invariants,
    cases,
  }
  return { ok: true, artifact, intended: { invariants: intendedInvariants, cases: intendedCases } }
}

/**
 * Accept exact intended-faithfulness bytes. Fail closed. Never throws on
 * runtime-untrusted input. Never derives intended from Object A.
 */
export function acceptIntendedFaithfulnessFromBytes(input: unknown): IntendedFaithfulnessAcceptance {
  try {
    if (!isRecord(input)) return failIntended(["malformed_intended_input"])
    if (Object.prototype.hasOwnProperty.call(input, "intended") && !Object.prototype.hasOwnProperty.call(input, "bytes")) {
      return failIntended(["caller_shaped_intended_without_bytes"])
    }
    const claimed = asExactBytes(input["bytes"], "bytes")
    if (!claimed.ok) return failIntended(claimed.reasons)
    const encoding = validateCanonicalUtf8JsonLf(claimed.bytes)
    if (!encoding.ok) return failIntended(encoding.reasons)
    let parsed: unknown
    try {
      const text = claimed.bytes.toString("utf8")
      parsed = JSON.parse(text.endsWith("\n") ? text.slice(0, -1) : text)
    } catch {
      return failIntended(["canonical_bytes_invalid_json"])
    }
    const inspectValue: string[] = []
    inspectUntrustedGraph(parsed, "intended", inspectValue, new WeakSet())
    if (inspectValue.length > 0) return failIntended(uniqueReasons(inspectValue))
    if (!isRecord(parsed)) return failIntended(["intended faithfulness is not an object"])
    const shaped = validateIntendedShape(parsed)
    if (!shaped.ok) return failIntended(shaped.reasons)
    const encoded = IndependentAuthority.encodeJsonUtf8Lf(shaped.artifact)
    if (!encoded.equals(claimed.bytes)) return failIntended(["canonical_bytes_non_canonical"])
    return {
      ok: true,
      reasons: [],
      bytes: claimed.bytes,
      digest: IndependentAuthority.sha256ExactBytes(claimed.bytes),
      artifact: deepFreeze(shaped.artifact),
      intended: deepFreeze(shaped.intended),
      production_publishable: false,
      sufficient_for_real_intended_instance: false,
    }
  } catch {
    return failIntended(["malformed_intended_input"])
  }
}

export function digestIntendedFaithfulnessBytes(bytes: Uint8Array | Buffer): string {
  return IndependentAuthority.sha256ExactBytes(bytes)
}
