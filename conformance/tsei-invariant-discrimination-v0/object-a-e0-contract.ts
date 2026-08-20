/**
 * Object A + Originator E0 contract scaffold (PR #204).
 *
 * Methodology only. This module does not create a real Object A instance,
 * does not generate a nonce, does not materialize E0/E1/E2, and cannot mint
 * PROVEN, independent grounding, a selected-provider PASS, or
 * production_publishable evidence.
 *
 * Role split (comments/constants only; not provenance):
 *   Pavlo (Originator) — E0 hiding commitment and later E2 reveal
 *   Tiago (Authority)  — E1 freeze of Object B
 *
 * Dummy D0/D1/D2 codecs and fixtures are not reused here. Object A / E0
 * encoding is encodeJsonUtf8Lf (sorted-key UTF-8 JSON + exactly one trailing
 * LF), never dummy-gate JCS.
 *
 * sufficient_for_real_object_a remains false: there is no real instance.
 */

import { types } from "node:util"
import {
  AUTHORITY_RELATIONSHIP_CLASS,
  BLIND_PROBLEM_SCHEMA,
  OBJECT_A_CASE_KEYS,
  OBJECT_A_INVARIANT_KEYS,
  OBJECT_A_TOP_LEVEL_KEYS,
  type BlindProblemCase,
  type BlindProblemPackage,
  type ConcreteCaseValue,
  type NormativeInvariant,
} from "./independent-authority-model"
import * as IndependentAuthority from "./independent-authority"
import type { IntendedFaithfulness } from "./independent-authority"
import { FROZEN_PROTOCOL_V1_SHA256, acceptIntendedFaithfulnessFromBytes } from "./intended-faithfulness"
import { REKOR_V1_P0_PROVIDER_POLICY_SHA256 } from "./rekor-v1-verifier"

/** Originator (Pavlo): E0 commitment and E2 reveal. This scaffold performs neither publication. */
export const E0_E2_ORIGINATOR = "Pavlo" as const
/** Authority (Tiago): E1 freeze. This scaffold does not mint E1. */
export const E1_AUTHORITY = "Tiago" as const

/**
 * Frozen SHA-256 of INDEPENDENT_AUTHORITY_BLIND_GROUNDING_PROTOCOL_V0.md
 * on origin/main. Pinned so this module never reads the filesystem.
 */
export const FROZEN_PROTOCOL_SHA256 =
  "8f2cf22d77b5476c0619a186d4a889c428fc5565f3d838f88d57b3c6fc806301" as const

/** Frozen originator-oracle codec name. Production object shape: originator-oracle.ts. */
export const INTERNAL_ORACLE_CODEC = "tsei-invariant-discrimination-v0.internal-oracle.v0" as const

export const E0_RECORD_KEYS = [
  "protocol_sha256",
  "provider_policy_sha256",
  "instance_id",
  "problem_package_sha256",
  "authority_relationship_class",
  "oracle_commitment",
] as const

export const E0_RECORD_V1_SCHEMA = "tsei-invariant-discrimination-v0.e0-record.v1" as const

export const E0_RECORD_V1_KEYS = [
  "schema",
  "protocol_sha256",
  "provider_policy_sha256",
  "instance_id",
  "problem_package_sha256",
  "intended_faithfulness_sha256",
  "authority_relationship_class",
  "oracle_commitment",
] as const

/** Matches independent-authority.ts / protocol §8.3. Not re-exported from that file. */
const INSTANCE_ID_RE = /^[a-z0-9._-]+$/
const LOWER_HEX_64 = /^[0-9a-f]{64}$/
/** Object A / E0 graphs are shallow; this caps hostile nesting before the stack. */
const MAX_GRAPH_DEPTH = 32
const E0_FORBIDDEN_KEYS = [
  "nonce",
  "oracle",
  "oracle_bytes",
  "internal_oracle",
  "internal_oracle_bytes",
  "answer",
  "answers",
  "derived_attribution_set",
  "expected_attribution",
] as const

export type ObjectAAcceptanceResult =
  | {
      readonly ok: true
      readonly reasons: readonly string[]
      readonly bytes: Buffer
      readonly digest: string
      readonly package: BlindProblemPackage
      readonly production_publishable: false
      readonly sufficient_for_real_object_a: false
    }
  | {
      readonly ok: false
      readonly reasons: readonly string[]
      readonly bytes: null
      readonly digest: null
      readonly package: null
      readonly production_publishable: false
      readonly sufficient_for_real_object_a: false
    }

export type E0Record = {
  readonly protocol_sha256: typeof FROZEN_PROTOCOL_SHA256
  readonly provider_policy_sha256: typeof IndependentAuthority.REKOR_V1_PROVIDER_POLICY_SHA256
  readonly instance_id: string
  readonly problem_package_sha256: string
  readonly authority_relationship_class: typeof AUTHORITY_RELATIONSHIP_CLASS
  readonly oracle_commitment: string
}

export type E0RecordV1 = {
  readonly schema: typeof E0_RECORD_V1_SCHEMA
  readonly protocol_sha256: typeof FROZEN_PROTOCOL_V1_SHA256
  readonly provider_policy_sha256: typeof REKOR_V1_P0_PROVIDER_POLICY_SHA256
  readonly instance_id: string
  readonly problem_package_sha256: string
  readonly intended_faithfulness_sha256: string
  readonly authority_relationship_class: typeof AUTHORITY_RELATIONSHIP_CLASS
  readonly oracle_commitment: string
}

export type E0ContractResult =
  | {
      readonly ok: true
      readonly reasons: readonly string[]
      readonly record: E0Record
      readonly bytes: Buffer
      readonly production_publishable: false
      readonly sufficient_for_real_object_a: false
    }
  | {
      readonly ok: false
      readonly reasons: readonly string[]
      readonly record: null
      readonly bytes: null
      readonly production_publishable: false
      readonly sufficient_for_real_object_a: false
    }

export type E0V1ContractResult =
  | {
      readonly ok: true
      readonly reasons: readonly string[]
      readonly record: E0RecordV1
      readonly bytes: Buffer
      readonly production_publishable: false
      readonly sufficient_for_real_object_a: false
    }
  | {
      readonly ok: false
      readonly reasons: readonly string[]
      readonly record: null
      readonly bytes: null
      readonly production_publishable: false
      readonly sufficient_for_real_object_a: false
    }

function failObjectA(reasons: readonly string[]): ObjectAAcceptanceResult {
  return {
    ok: false,
    reasons,
    bytes: null,
    digest: null,
    package: null,
    production_publishable: false,
    sufficient_for_real_object_a: false,
  }
}

function failE0(reasons: readonly string[]): E0ContractResult {
  return {
    ok: false,
    reasons,
    record: null,
    bytes: null,
    production_publishable: false,
    sufficient_for_real_object_a: false,
  }
}

function failE0V1(reasons: readonly string[]): E0V1ContractResult {
  return {
    ok: false,
    reasons,
    record: null,
    bytes: null,
    production_publishable: false,
    sufficient_for_real_object_a: false,
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
  // Proxy rejection must precede Array.isArray and other reflection: a Proxy of a
  // plain object still has Object.prototype, so prototype checks cannot see it.
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

function validateObjectAShape(
  pkg: Record<string, unknown>,
): { ok: true; snapshot: BlindProblemPackage } | { ok: false; reasons: string[] } {
  const reasons: string[] = []
  missingKeys(pkg, OBJECT_A_TOP_LEVEL_KEYS, "A", reasons)
  extraKeys(pkg, OBJECT_A_TOP_LEVEL_KEYS, "A", reasons)
  if (pkg["schema"] !== BLIND_PROBLEM_SCHEMA) {
    reasons.push("A.schema must be the blind-problem schema")
  }
  if (typeof pkg["instance_id"] !== "string" || !INSTANCE_ID_RE.test(pkg["instance_id"])) {
    reasons.push("A.instance_id is malformed")
  }
  if (typeof pkg["evaluation_instruction"] !== "string" || pkg["evaluation_instruction"].trim().length === 0) {
    reasons.push("A.evaluation_instruction must be a non-empty string")
  }
  const invariantsRaw = pkg["invariants"]
  const casesRaw = pkg["cases"]
  if (Array.isArray(invariantsRaw) || !isRecord(invariantsRaw)) {
    reasons.push("A.invariants must be a map, not an array or other value")
  }
  if (Array.isArray(casesRaw) || !isRecord(casesRaw)) {
    reasons.push("A.cases must be a map, not an array or other value")
  }
  if (reasons.length > 0 || !isRecord(invariantsRaw) || !isRecord(casesRaw)) {
    return { ok: false, reasons: uniqueReasons(reasons) }
  }

  const invariants: { [id: string]: NormativeInvariant } = {}
  const invariantIds = Object.keys(invariantsRaw)
  if (new Set(invariantIds).size !== invariantIds.length) {
    reasons.push("A.invariants contains duplicate ids")
  }
  for (const id of invariantIds) {
    const row = invariantsRaw[id]
    if (!isRecord(row)) {
      reasons.push(`A.invariants.${id}: invariant must be an object`)
      continue
    }
    missingKeys(row, OBJECT_A_INVARIANT_KEYS, `A.invariants.${id}`, reasons)
    extraKeys(row, OBJECT_A_INVARIANT_KEYS, `A.invariants.${id}`, reasons)
    if (row["invariant_id"] !== id) {
      reasons.push(`A.invariants.${id}: map key must equal invariant_id`)
    }
    if (typeof row["normative_definition"] !== "string") {
      reasons.push(`A.invariants.${id}.normative_definition must be a string`)
    }
    if (typeof row["normative_definition_identity"] !== "string" || !LOWER_HEX_64.test(row["normative_definition_identity"])) {
      reasons.push(`A.invariants.${id}.normative_definition_identity must be 64 lowercase hex characters`)
    }
    if (typeof row["invariant_id"] === "string" && typeof row["normative_definition"] === "string" && typeof row["normative_definition_identity"] === "string") {
      invariants[id] = {
        invariant_id: row["invariant_id"],
        normative_definition: row["normative_definition"],
        normative_definition_identity: row["normative_definition_identity"],
      }
    }
  }

  const cases: { [id: string]: BlindProblemCase } = {}
  const caseIds = Object.keys(casesRaw)
  if (new Set(caseIds).size !== caseIds.length) {
    reasons.push("A.cases contains duplicate ids")
  }
  for (const id of caseIds) {
    const row = casesRaw[id]
    if (!isRecord(row)) {
      reasons.push(`A.cases.${id}: case must be an object`)
      continue
    }
    missingKeys(row, OBJECT_A_CASE_KEYS, `A.cases.${id}`, reasons)
    extraKeys(row, OBJECT_A_CASE_KEYS, `A.cases.${id}`, reasons)
    if (row["mutant_id"] !== id) {
      reasons.push(`A.cases.${id}: map key must equal mutant_id`)
    }
    const baselineReasons: string[] = []
    const mutatedReasons: string[] = []
    const baselineOk = isPlainConcreteValue(row["baseline"], `A.cases.${id}.baseline`, baselineReasons)
    const mutatedOk = isPlainConcreteValue(row["mutated"], `A.cases.${id}.mutated`, mutatedReasons)
    reasons.push(...baselineReasons, ...mutatedReasons)
    if (typeof row["mutant_id"] === "string" && baselineOk && mutatedOk && isRecord(row["baseline"]) && isRecord(row["mutated"])) {
      cases[id] = {
        mutant_id: row["mutant_id"],
        baseline: snapshotConcrete(row["baseline"]),
        mutated: snapshotConcrete(row["mutated"]),
      }
    }
  }

  if (reasons.length > 0) return { ok: false, reasons: uniqueReasons(reasons) }
  if (typeof pkg["instance_id"] !== "string" || typeof pkg["evaluation_instruction"] !== "string") {
    return { ok: false, reasons: ["A is malformed"] }
  }
  return {
    ok: true,
    snapshot: {
      schema: BLIND_PROBLEM_SCHEMA,
      instance_id: pkg["instance_id"],
      evaluation_instruction: pkg["evaluation_instruction"],
      invariants,
      cases,
    },
  }
}

function validateIntended(intended: unknown): { ok: true; intended: IntendedFaithfulness } | { ok: false; reasons: string[] } {
  if (!isRecord(intended)) return { ok: false, reasons: ["intended faithfulness is not an object"] }
  if (!isRecord(intended["invariants"]) || Array.isArray(intended["invariants"])) {
    return { ok: false, reasons: ["intended.invariants must be a map"] }
  }
  if (!isRecord(intended["cases"]) || Array.isArray(intended["cases"])) {
    return { ok: false, reasons: ["intended.cases must be a map"] }
  }
  return { ok: true, intended: intended as IntendedFaithfulness }
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

/**
 * Pure Object A acceptance gate.
 *
 * Strict order: leakCheckBlindPackage -> checkBlindPackageFaithfulness ->
 * canonical encode/freeze -> digest. Fail closed; never throws on
 * runtime-untrusted input. Bytes and digest are absent unless every prior
 * step passed.
 */
export function acceptObjectA(input: unknown): ObjectAAcceptanceResult {
  try {
    if (!isRecord(input)) return failObjectA(["malformed_object_a_input"])
    const pkg = input["pkg"]
    const intendedRaw = input["intended"]
    const leak = IndependentAuthority.leakCheckBlindPackage(pkg)
    if (!leak.clean) {
      return failObjectA(["object_a_leak", ...leak.violations])
    }
    const inspectReasons: string[] = []
    inspectUntrustedGraph(pkg, "A", inspectReasons, new WeakSet())
    if (inspectReasons.length > 0) return failObjectA(uniqueReasons(inspectReasons))
    if (!isRecord(pkg)) return failObjectA(["object_a_leak", "package is not an object"])
    const shaped = validateObjectAShape(pkg)
    if (!shaped.ok) return failObjectA(shaped.reasons)
    const intended = validateIntended(intendedRaw)
    if (!intended.ok) return failObjectA(intended.reasons)
    const faith = IndependentAuthority.checkBlindPackageFaithfulness(shaped.snapshot, intended.intended)
    if (!faith.faithful) {
      return failObjectA(["object_a_not_faithful", ...faith.violations])
    }
    const frozen = deepFreeze(shaped.snapshot)
    const bytes = IndependentAuthority.encodeJsonUtf8Lf(frozen)
    const encoding = validateCanonicalUtf8JsonLf(bytes)
    if (!encoding.ok) return failObjectA(encoding.reasons)
    if (Object.prototype.hasOwnProperty.call(input, "claimed_bytes")) {
      const claimed = asExactBytes(input["claimed_bytes"], "claimed_bytes")
      if (!claimed.ok) return failObjectA(claimed.reasons)
      const claimedEncoding = validateCanonicalUtf8JsonLf(claimed.bytes)
      if (!claimedEncoding.ok) return failObjectA(claimedEncoding.reasons)
      if (!bytes.equals(claimed.bytes)) return failObjectA(["claimed_bytes_not_canonical"])
    }
    const digest = IndependentAuthority.digestBlindProblemBytes(bytes)
    return {
      ok: true,
      reasons: [],
      bytes,
      digest,
      package: frozen,
      production_publishable: false,
      sufficient_for_real_object_a: false,
    }
  } catch {
    return failObjectA(["malformed_object_a_input"])
  }
}

/**
 * Byte-first Object A acceptance. BOM/CR/NUL/LF/canonical failures never
 * return transmittable bytes or a digest.
 */
export function acceptObjectAFromBytes(input: unknown): ObjectAAcceptanceResult {
  try {
    if (!isRecord(input)) return failObjectA(["malformed_object_a_input"])
    const claimed = asExactBytes(input["bytes"], "bytes")
    if (!claimed.ok) return failObjectA(claimed.reasons)
    const encoding = validateCanonicalUtf8JsonLf(claimed.bytes)
    if (!encoding.ok) return failObjectA(encoding.reasons)
    let parsed: unknown
    try {
      const text = claimed.bytes.toString("utf8")
      parsed = JSON.parse(text.endsWith("\n") ? text.slice(0, -1) : text)
    } catch {
      return failObjectA(["canonical_bytes_invalid_json"])
    }
    return acceptObjectA({ pkg: parsed, intended: input["intended"], claimed_bytes: claimed.bytes })
  } catch {
    return failObjectA(["malformed_object_a_input"])
  }
}

/**
 * Codec name/version freeze only. Does not include any oracle values and
 * does not validate the production originator-oracle object shape.
 * Production fields, filename, and HUMAN_PRIMARY materialize live in
 * originator-oracle.ts. Callers supply contents; this only applies
 * encodeJsonUtf8Lf after a fail-closed graph inspect.
 */
export function encodeInternalOracleUtf8Lf(
  value: unknown,
): { ok: true; bytes: Buffer } | { ok: false; bytes: null; reasons: readonly string[] } {
  try {
    const inspectReasons: string[] = []
    inspectUntrustedGraph(value, "oracle", inspectReasons, new WeakSet())
    if (inspectReasons.length > 0) return { ok: false, bytes: null, reasons: uniqueReasons(inspectReasons) }
    const bytes = IndependentAuthority.encodeJsonUtf8Lf(value)
    const encoding = validateCanonicalUtf8JsonLf(bytes)
    if (!encoding.ok) return { ok: false, bytes: null, reasons: encoding.reasons }
    return { ok: true, bytes }
  } catch {
    return { ok: false, bytes: null, reasons: ["malformed_internal_oracle"] }
  }
}

export function bindOracleCommitment(
  input: unknown,
): { ok: true; commitment: string } | { ok: false; reasons: readonly string[]; commitment: null } {
  try {
    const computed = IndependentAuthority.computeOracleCommitment(input)
    if (!computed.ok) return { ok: false, reasons: computed.reasons, commitment: null }
    return { ok: true, commitment: computed.commitment }
  } catch {
    return { ok: false, reasons: ["malformed_commitment_input"], commitment: null }
  }
}

function snapshotE0Record(record: Record<string, unknown>): E0Record | null {
  if (record["protocol_sha256"] !== FROZEN_PROTOCOL_SHA256) return null
  if (record["provider_policy_sha256"] !== IndependentAuthority.REKOR_V1_PROVIDER_POLICY_SHA256) return null
  if (typeof record["instance_id"] !== "string" || !INSTANCE_ID_RE.test(record["instance_id"])) return null
  if (typeof record["problem_package_sha256"] !== "string" || !LOWER_HEX_64.test(record["problem_package_sha256"])) return null
  if (record["authority_relationship_class"] !== AUTHORITY_RELATIONSHIP_CLASS) return null
  if (typeof record["oracle_commitment"] !== "string" || !LOWER_HEX_64.test(record["oracle_commitment"])) return null
  return {
    protocol_sha256: FROZEN_PROTOCOL_SHA256,
    provider_policy_sha256: IndependentAuthority.REKOR_V1_PROVIDER_POLICY_SHA256,
    instance_id: record["instance_id"],
    problem_package_sha256: record["problem_package_sha256"],
    authority_relationship_class: AUTHORITY_RELATIONSHIP_CLASS,
    oracle_commitment: record["oracle_commitment"],
  }
}

/**
 * Validate a claimed public E0 record. Never accepts nonce or oracle bytes.
 */
export function acceptE0Record(input: unknown): E0ContractResult {
  try {
    if (!isRecord(input)) return failE0(["malformed_e0_input"])
    const inspectReasons: string[] = []
    inspectUntrustedGraph(input, "E0", inspectReasons, new WeakSet())
    if (inspectReasons.length > 0) return failE0(uniqueReasons(inspectReasons))
    extraKeys(input, E0_RECORD_KEYS, "E0", inspectReasons)
    missingKeys(input, E0_RECORD_KEYS, "E0", inspectReasons)
    for (const key of E0_FORBIDDEN_KEYS) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        inspectReasons.push(`E0.${key}: nonce/oracle/answer fields are forbidden on the public E0 record`)
      }
    }
    if (inspectReasons.length > 0) return failE0(uniqueReasons(inspectReasons))
    if (input["protocol_sha256"] !== FROZEN_PROTOCOL_SHA256) inspectReasons.push("E0.protocol_sha256 mismatch")
    if (input["provider_policy_sha256"] !== IndependentAuthority.REKOR_V1_PROVIDER_POLICY_SHA256) {
      inspectReasons.push("E0.provider_policy_sha256 mismatch")
    }
    if (input["authority_relationship_class"] !== AUTHORITY_RELATIONSHIP_CLASS) {
      inspectReasons.push("E0.authority_relationship_class mismatch")
    }
    const snapshot = snapshotE0Record(input)
    if (!snapshot || inspectReasons.length > 0) {
      return failE0(uniqueReasons(inspectReasons.length > 0 ? inspectReasons : ["malformed_e0_record"]))
    }
    const bytes = IndependentAuthority.encodeJsonUtf8Lf(snapshot)
    const encoding = validateCanonicalUtf8JsonLf(bytes)
    if (!encoding.ok) return failE0(encoding.reasons)
    return {
      ok: true,
      reasons: [],
      record: deepFreeze(snapshot),
      bytes,
      production_publishable: false,
      sufficient_for_real_object_a: false,
    }
  } catch {
    return failE0(["malformed_e0_input"])
  }
}

/**
 * Bind a public Originator E0 record from an accepted Object A, a
 * caller-supplied exactly-32-byte nonce, and caller-supplied internal-oracle
 * bytes. Does not generate a nonce, read env/fs/network/clock, sign, or
 * publish. The returned record never includes nonce or oracle bytes.
 */
export function commitOriginatorE0(input: unknown): E0ContractResult {
  try {
    if (!isRecord(input)) return failE0(["malformed_e0_input"])
    const accepted = acceptObjectA({ pkg: input["pkg"], intended: input["intended"] })
    if (!accepted.ok) return failE0(["object_a_not_accepted", ...accepted.reasons])
    if (Object.prototype.hasOwnProperty.call(input, "protocol_sha256") && input["protocol_sha256"] !== FROZEN_PROTOCOL_SHA256) {
      return failE0(["protocol_sha256_mismatch"])
    }
    if (
      Object.prototype.hasOwnProperty.call(input, "provider_policy_sha256") &&
      input["provider_policy_sha256"] !== IndependentAuthority.REKOR_V1_PROVIDER_POLICY_SHA256
    ) {
      return failE0(["provider_policy_sha256_mismatch"])
    }
    const bound = bindOracleCommitment({
      instance_id: accepted.package.instance_id,
      problem_package_sha256: accepted.digest,
      nonce: input["nonce"],
      oracle_bytes: input["oracle_bytes"],
    })
    if (!bound.ok) return failE0(["oracle_commitment_failed", ...bound.reasons])
    return acceptE0Record({
      protocol_sha256: FROZEN_PROTOCOL_SHA256,
      provider_policy_sha256: IndependentAuthority.REKOR_V1_PROVIDER_POLICY_SHA256,
      instance_id: accepted.package.instance_id,
      problem_package_sha256: accepted.digest,
      authority_relationship_class: AUTHORITY_RELATIONSHIP_CLASS,
      oracle_commitment: bound.commitment,
    })
  } catch {
    return failE0(["malformed_e0_input"])
  }
}

function snapshotE0RecordV1(record: Record<string, unknown>): E0RecordV1 | null {
  if (record["schema"] !== E0_RECORD_V1_SCHEMA) return null
  if (record["protocol_sha256"] !== FROZEN_PROTOCOL_V1_SHA256) return null
  if (record["provider_policy_sha256"] !== REKOR_V1_P0_PROVIDER_POLICY_SHA256) return null
  if (typeof record["instance_id"] !== "string" || !INSTANCE_ID_RE.test(record["instance_id"])) return null
  if (typeof record["problem_package_sha256"] !== "string" || !LOWER_HEX_64.test(record["problem_package_sha256"])) return null
  if (typeof record["intended_faithfulness_sha256"] !== "string" || !LOWER_HEX_64.test(record["intended_faithfulness_sha256"])) {
    return null
  }
  if (record["authority_relationship_class"] !== AUTHORITY_RELATIONSHIP_CLASS) return null
  if (typeof record["oracle_commitment"] !== "string" || !LOWER_HEX_64.test(record["oracle_commitment"])) return null
  return {
    schema: E0_RECORD_V1_SCHEMA,
    protocol_sha256: FROZEN_PROTOCOL_V1_SHA256,
    provider_policy_sha256: REKOR_V1_P0_PROVIDER_POLICY_SHA256,
    instance_id: record["instance_id"],
    problem_package_sha256: record["problem_package_sha256"],
    intended_faithfulness_sha256: record["intended_faithfulness_sha256"],
    authority_relationship_class: AUTHORITY_RELATIONSHIP_CLASS,
    oracle_commitment: record["oracle_commitment"],
  }
}

/**
 * Validate a claimed future-run E0 v1 record. Historical six-key E0 is not
 * an alias and cannot satisfy this gate. Never accepts nonce or oracle bytes.
 */
export function acceptE0RecordV1(input: unknown): E0V1ContractResult {
  try {
    if (!isRecord(input)) return failE0V1(["malformed_e0_input"])
    const inspectReasons: string[] = []
    inspectUntrustedGraph(input, "E0", inspectReasons, new WeakSet())
    if (inspectReasons.length > 0) return failE0V1(uniqueReasons(inspectReasons))
    extraKeys(input, E0_RECORD_V1_KEYS, "E0", inspectReasons)
    missingKeys(input, E0_RECORD_V1_KEYS, "E0", inspectReasons)
    for (const key of E0_FORBIDDEN_KEYS) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        inspectReasons.push(`E0.${key}: nonce/oracle/answer fields are forbidden on the public E0 record`)
      }
    }
    if (inspectReasons.length > 0) return failE0V1(uniqueReasons(inspectReasons))
    if (input["schema"] !== E0_RECORD_V1_SCHEMA) inspectReasons.push("E0.schema mismatch")
    if (input["protocol_sha256"] !== FROZEN_PROTOCOL_V1_SHA256) inspectReasons.push("E0.protocol_sha256 mismatch")
    if (input["provider_policy_sha256"] !== REKOR_V1_P0_PROVIDER_POLICY_SHA256) {
      inspectReasons.push("E0.provider_policy_sha256 mismatch")
    }
    if (input["authority_relationship_class"] !== AUTHORITY_RELATIONSHIP_CLASS) {
      inspectReasons.push("E0.authority_relationship_class mismatch")
    }
    const snapshot = snapshotE0RecordV1(input)
    if (!snapshot || inspectReasons.length > 0) {
      return failE0V1(uniqueReasons(inspectReasons.length > 0 ? inspectReasons : ["malformed_e0_record"]))
    }
    const bytes = IndependentAuthority.encodeJsonUtf8Lf(snapshot)
    const encoding = validateCanonicalUtf8JsonLf(bytes)
    if (!encoding.ok) return failE0V1(encoding.reasons)
    return {
      ok: true,
      reasons: [],
      record: deepFreeze(snapshot),
      bytes,
      production_publishable: false,
      sufficient_for_real_object_a: false,
    }
  } catch {
    return failE0V1(["malformed_e0_input"])
  }
}

/**
 * Bind a future-run E0 v1 record from independently accepted intended bytes
 * and Object A. Does not generate a nonce, sign, or publish.
 */
export function commitOriginatorE0V1(input: unknown): E0V1ContractResult {
  try {
    if (!isRecord(input)) return failE0V1(["malformed_e0_input"])
    const intendedAccepted = acceptIntendedFaithfulnessFromBytes({ bytes: input["intended_faithfulness_bytes"] })
    if (!intendedAccepted.ok) return failE0V1(["intended_not_accepted", ...intendedAccepted.reasons])
    const accepted = acceptObjectA({ pkg: input["pkg"], intended: intendedAccepted.intended })
    if (!accepted.ok) return failE0V1(["object_a_not_accepted", ...accepted.reasons])
    if (accepted.package.instance_id !== intendedAccepted.artifact.instance_id) {
      return failE0V1(["instance_id_mismatch"])
    }
    if (Object.prototype.hasOwnProperty.call(input, "protocol_sha256") && input["protocol_sha256"] !== FROZEN_PROTOCOL_V1_SHA256) {
      return failE0V1(["protocol_sha256_mismatch"])
    }
    if (
      Object.prototype.hasOwnProperty.call(input, "provider_policy_sha256") &&
      input["provider_policy_sha256"] !== REKOR_V1_P0_PROVIDER_POLICY_SHA256
    ) {
      return failE0V1(["provider_policy_sha256_mismatch"])
    }
    const bound = bindOracleCommitment({
      instance_id: accepted.package.instance_id,
      problem_package_sha256: accepted.digest,
      nonce: input["nonce"],
      oracle_bytes: input["oracle_bytes"],
    })
    if (!bound.ok) return failE0V1(["oracle_commitment_failed", ...bound.reasons])
    return acceptE0RecordV1({
      schema: E0_RECORD_V1_SCHEMA,
      protocol_sha256: FROZEN_PROTOCOL_V1_SHA256,
      provider_policy_sha256: REKOR_V1_P0_PROVIDER_POLICY_SHA256,
      instance_id: accepted.package.instance_id,
      problem_package_sha256: accepted.digest,
      intended_faithfulness_sha256: intendedAccepted.digest,
      authority_relationship_class: AUTHORITY_RELATIONSHIP_CLASS,
      oracle_commitment: bound.commitment,
    })
  } catch {
    return failE0V1(["malformed_e0_input"])
  }
}

export {
  AUTHORITY_RELATIONSHIP_CLASS,
  BLIND_PROBLEM_SCHEMA,
  FROZEN_PROTOCOL_V1_SHA256,
  REKOR_V1_P0_PROVIDER_POLICY_SHA256,
}
