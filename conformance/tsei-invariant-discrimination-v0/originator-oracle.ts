/**
 * Production Originator (internal) oracle private artifact (pre-E0).
 *
 * Semantic attribution answers are HUMAN_PRIMARY. This module is
 * MECHANICAL_ONLY: it may validate grammar/bindings and serialize exact
 * UTF-8/LF bytes. It must never infer, compare, correct, or complete
 * originator_attribution_set values. It does not evaluate invariant
 * predicates, does not read Object A cases, and does not read the filesystem.
 *
 * This artifact is not Object A, not Object B, not provider telemetry,
 * not the scaffold `{ schema, note }` example, not an E0 record, and not
 * the post-E2 publication filename `internal-oracle-reveal.json`.
 *
 * A later E0 lane may hash these exact oracle bytes with a 32-byte nonce
 * via computeOracleCommitment. This module does not mint E0.
 */

import { types } from "node:util"
import { AUTHORITY_ORACLE_SCHEMA } from "./independent-authority-model"
import * as IndependentAuthority from "./independent-authority"
import {
  INTERNAL_ORACLE_CODEC,
  encodeInternalOracleUtf8Lf,
} from "./object-a-e0-contract"

/** Frozen codec / schema identifier. Production object shape lives under this name. */
export const ORIGINATOR_ORACLE_SCHEMA = INTERNAL_ORACLE_CODEC
export const ORIGINATOR_ORACLE_PRIVATE_PRE_E0_FILENAME = "originator-oracle.private.json" as const
export const POST_E2_INTERNAL_ORACLE_REVEAL_FILENAME = "internal-oracle-reveal.json" as const
export const ORIGINATOR_ORACLE_LIFECYCLE = "PRIVATE_PRE_E0_NOT_E0" as const
export const ORIGINATOR_SEMANTIC_JUDGMENT = "HUMAN_PRIMARY" as const
export const ORIGINATOR_ASSISTANT_ROLE = "MECHANICAL_ONLY" as const
export const ORIGINATOR_ORACLE_CONSTITUTES_E0 = false as const

export const ORIGINATOR_DECLARED_INVARIANT_IDS = ["I_A", "I_B", "I_C"] as const
export const ORIGINATOR_DECLARED_CASE_IDS = [
  "c01",
  "c02",
  "c03",
  "c04",
  "c05",
  "c06",
  "c07",
  "c08",
  "c09",
  "c10",
  "c11",
  "c12",
] as const

export const ORIGINATOR_ORACLE_TOP_LEVEL_KEYS = [
  "schema",
  "instance_id",
  "problem_package_sha256",
  "declared_invariant_ids",
  "cases",
] as const

export const ORIGINATOR_ORACLE_CASE_KEYS = ["mutant_id", "originator_attribution_set"] as const

export const ORIGINATOR_ORACLE_MATERIALIZE_KEYS = [
  "instance_id",
  "problem_package_sha256",
  "cases",
] as const

const INSTANCE_ID_RE = /^[a-z0-9._-]+$/
const LOWER_HEX_64 = /^[0-9a-f]{64}$/
const MAX_GRAPH_DEPTH = 32
const ALLOWED_INVARIANT_ID = new Set<string>(ORIGINATOR_DECLARED_INVARIANT_IDS)
const DECLARED_CASE_ID = new Set<string>(ORIGINATOR_DECLARED_CASE_IDS)

export type OriginatorInvariantId = (typeof ORIGINATOR_DECLARED_INVARIANT_IDS)[number]
export type OriginatorCaseId = (typeof ORIGINATOR_DECLARED_CASE_IDS)[number]

export type OriginatorOracleCase = {
  readonly mutant_id: OriginatorCaseId
  readonly originator_attribution_set: readonly OriginatorInvariantId[]
}

export type OriginatorOracleArtifact = {
  readonly schema: typeof ORIGINATOR_ORACLE_SCHEMA
  readonly instance_id: string
  readonly problem_package_sha256: string
  readonly declared_invariant_ids: readonly ["I_A", "I_B", "I_C"]
  readonly cases: { readonly [K in OriginatorCaseId]: OriginatorOracleCase }
}

export type OriginatorOracleResult =
  | {
      readonly ok: true
      readonly reasons: readonly string[]
      readonly bytes: Buffer
      readonly digest: string
      readonly artifact: OriginatorOracleArtifact
      readonly production_publishable: false
      readonly lifecycle: typeof ORIGINATOR_ORACLE_LIFECYCLE
      readonly constitutes_e0: false
    }
  | {
      readonly ok: false
      readonly reasons: readonly string[]
      readonly bytes: null
      readonly digest: null
      readonly artifact: null
      readonly production_publishable: false
      readonly lifecycle: typeof ORIGINATOR_ORACLE_LIFECYCLE
      readonly constitutes_e0: false
    }

function failOracle(reasons: readonly string[]): OriginatorOracleResult {
  return {
    ok: false,
    reasons,
    bytes: null,
    digest: null,
    artifact: null,
    production_publishable: false,
    lifecycle: ORIGINATOR_ORACLE_LIFECYCLE,
    constitutes_e0: false,
  }
}

function succeedOracle(artifact: OriginatorOracleArtifact, bytes: Buffer, digest: string): OriginatorOracleResult {
  return {
    ok: true,
    reasons: [],
    bytes,
    digest,
    artifact,
    production_publishable: false,
    lifecycle: ORIGINATOR_ORACLE_LIFECYCLE,
    constitutes_e0: false,
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

function utf8Order(a: string, b: string): number {
  return Buffer.from(a, "utf8").compare(Buffer.from(b, "utf8"))
}

function isStrictlyAscendingUtf8(ids: readonly string[]): boolean {
  for (let i = 1; i < ids.length; i += 1) {
    if (utf8Order(ids[i - 1]!, ids[i]!) >= 0) return false
  }
  return true
}

function validateAttributionSet(
  value: unknown,
  path: string,
  reasons: string[],
): value is OriginatorInvariantId[] {
  if (!Array.isArray(value)) {
    reasons.push(`${path}: originator_attribution_set must be an array`)
    return false
  }
  let ok = true
  const seen = new Set<string>()
  for (let i = 0; i < value.length; i += 1) {
    const id = value[i]
    if (typeof id !== "string") {
      reasons.push(`${path}[${i}]: attribution id must be a string`)
      ok = false
      continue
    }
    if (!ALLOWED_INVARIANT_ID.has(id)) {
      reasons.push(`${path}[${i}]: unknown invariant id`)
      ok = false
    }
    if (seen.has(id)) {
      reasons.push(`${path}[${i}]: duplicate invariant id`)
      ok = false
    }
    seen.add(id)
  }
  if (ok && !isStrictlyAscendingUtf8(value as string[])) {
    reasons.push(`${path}: attribution ids must be in ascending UTF-8 byte order`)
    ok = false
  }
  return ok
}

function snapshotAttribution(value: readonly unknown[]): OriginatorInvariantId[] {
  return value.map((id) => id as OriginatorInvariantId)
}

function validateDeclaredInvariantIds(value: unknown, reasons: string[]): value is ["I_A", "I_B", "I_C"] {
  if (!Array.isArray(value)) {
    reasons.push("oracle.declared_invariant_ids must be an array")
    return false
  }
  const expected = ORIGINATOR_DECLARED_INVARIANT_IDS
  if (value.length !== expected.length) {
    reasons.push("oracle.declared_invariant_ids must be exactly I_A,I_B,I_C")
  }
  const seen = new Set<string>()
  let ok = value.length === expected.length
  for (let i = 0; i < value.length; i += 1) {
    const id = value[i]
    if (typeof id !== "string") {
      reasons.push(`oracle.declared_invariant_ids[${i}]: invariant id must be a string`)
      ok = false
      continue
    }
    if (!ALLOWED_INVARIANT_ID.has(id)) {
      reasons.push(`oracle.declared_invariant_ids[${i}]: unknown invariant id`)
      ok = false
    }
    if (seen.has(id)) {
      reasons.push(`oracle.declared_invariant_ids[${i}]: duplicate invariant id`)
      ok = false
    }
    seen.add(id)
    if (ok && id !== expected[i]) {
      reasons.push("oracle.declared_invariant_ids must be exactly [\"I_A\",\"I_B\",\"I_C\"] in ascending UTF-8 byte order")
      ok = false
    }
  }
  if (ok && !isStrictlyAscendingUtf8(value as string[])) {
    reasons.push("oracle.declared_invariant_ids must be in ascending UTF-8 byte order")
    ok = false
  }
  if (ok) {
    for (const id of expected) {
      if (!seen.has(id)) {
        reasons.push("oracle.declared_invariant_ids is not the frozen I_A,I_B,I_C universe")
        ok = false
      }
    }
  }
  return ok
}

function validateCases(
  casesRaw: Record<string, unknown>,
  reasons: string[],
): { readonly [K in OriginatorCaseId]: OriginatorOracleCase } | null {
  const caseIds = Object.keys(casesRaw)
  if (new Set(caseIds).size !== caseIds.length) {
    reasons.push("oracle.cases contains duplicate ids")
  }
  for (const id of ORIGINATOR_DECLARED_CASE_IDS) {
    if (!Object.prototype.hasOwnProperty.call(casesRaw, id)) {
      reasons.push(`oracle.cases.${id}: missing required case`)
    }
  }
  for (const id of caseIds) {
    if (!DECLARED_CASE_ID.has(id)) {
      reasons.push(`oracle.cases.${id}: unexpected case`)
    }
  }
  const cases = {} as { [K in OriginatorCaseId]: OriginatorOracleCase }
  for (const id of ORIGINATOR_DECLARED_CASE_IDS) {
    if (!Object.prototype.hasOwnProperty.call(casesRaw, id)) continue
    const row = casesRaw[id]
    if (!isRecord(row) || Array.isArray(row)) {
      reasons.push(`oracle.cases.${id}: case must be an object`)
      continue
    }
    missingKeys(row, ORIGINATOR_ORACLE_CASE_KEYS, `oracle.cases.${id}`, reasons)
    extraKeys(row, ORIGINATOR_ORACLE_CASE_KEYS, `oracle.cases.${id}`, reasons)
    if (row["mutant_id"] !== id) {
      reasons.push(`oracle.cases.${id}: map key must equal mutant_id`)
    }
    const setOk = validateAttributionSet(
      row["originator_attribution_set"],
      `oracle.cases.${id}.originator_attribution_set`,
      reasons,
    )
    if (typeof row["mutant_id"] === "string" && setOk && Array.isArray(row["originator_attribution_set"])) {
      cases[id] = {
        mutant_id: id,
        originator_attribution_set: snapshotAttribution(row["originator_attribution_set"]),
      }
    }
  }
  if (reasons.length > 0) return null
  return cases
}

function validateBindings(
  record: Record<string, unknown>,
  reasons: string[],
): { instance_id: string; problem_package_sha256: string } | null {
  if (typeof record["instance_id"] !== "string" || !INSTANCE_ID_RE.test(record["instance_id"])) {
    reasons.push("oracle.instance_id is malformed")
  }
  if (typeof record["problem_package_sha256"] !== "string" || !LOWER_HEX_64.test(record["problem_package_sha256"])) {
    reasons.push("oracle.problem_package_sha256 must be 64 lowercase hex characters")
  }
  if (typeof record["instance_id"] !== "string" || typeof record["problem_package_sha256"] !== "string") {
    return null
  }
  if (reasons.length > 0) return null
  return {
    instance_id: record["instance_id"],
    problem_package_sha256: record["problem_package_sha256"],
  }
}

function rejectAuthoritySubstitute(record: Record<string, unknown>, reasons: string[]): void {
  if (record["schema"] === AUTHORITY_ORACLE_SCHEMA) {
    reasons.push("oracle.schema must not be the authority-oracle schema; Object B cannot substitute")
  }
  if (Object.prototype.hasOwnProperty.call(record, "derived_attribution_set")) {
    reasons.push("oracle.derived_attribution_set is an Object B field and is forbidden")
  }
  if (Object.prototype.hasOwnProperty.call(record, "problem_package_digest")) {
    reasons.push("oracle.problem_package_digest is an Object B field and is forbidden")
  }
  if (Object.prototype.hasOwnProperty.call(record, "authority_observations")) {
    reasons.push("oracle.authority_observations is an Object B field and is forbidden")
  }
}

function encodeAccepted(artifact: OriginatorOracleArtifact): OriginatorOracleResult {
  const encoded = encodeInternalOracleUtf8Lf(artifact)
  if (!encoded.ok) return failOracle(["canonical_bytes_encode_failed", ...encoded.reasons])
  const digest = IndependentAuthority.sha256ExactBytes(encoded.bytes)
  return succeedOracle(artifact, encoded.bytes, digest)
}

function inspectInput(input: unknown, path: string): string[] {
  const reasons: string[] = []
  inspectUntrustedGraph(input, path, reasons, new WeakSet())
  return uniqueReasons(reasons)
}

/**
 * Accept a claimed production originator-oracle object. Fail closed.
 * Never throws on runtime-untrusted input. Never infers answers.
 */
export function acceptOriginatorOracle(input: unknown): OriginatorOracleResult {
  try {
    if (!isRecord(input)) return failOracle(["malformed_originator_oracle_input"])
    const inspectReasons = inspectInput(input, "oracle")
    if (inspectReasons.length > 0) return failOracle(inspectReasons)
    const reasons: string[] = []
    rejectAuthoritySubstitute(input, reasons)
    extraKeys(input, ORIGINATOR_ORACLE_TOP_LEVEL_KEYS, "oracle", reasons)
    missingKeys(input, ORIGINATOR_ORACLE_TOP_LEVEL_KEYS, "oracle", reasons)
    if (input["schema"] !== ORIGINATOR_ORACLE_SCHEMA) {
      reasons.push("oracle.schema must be tsei-invariant-discrimination-v0.internal-oracle.v0")
    }
    const bindings = validateBindings(input, reasons)
    const declaredOk = validateDeclaredInvariantIds(input["declared_invariant_ids"], reasons)
    const casesRaw = input["cases"]
    if (Array.isArray(casesRaw) || !isRecord(casesRaw)) {
      reasons.push("oracle.cases must be a map, not an array or other value")
      return failOracle(uniqueReasons(reasons))
    }
    const cases = validateCases(casesRaw, reasons)
    if (reasons.length > 0 || !bindings || !declaredOk || !cases) {
      return failOracle(uniqueReasons(reasons.length > 0 ? reasons : ["malformed_originator_oracle"]))
    }
    const artifact: OriginatorOracleArtifact = {
      schema: ORIGINATOR_ORACLE_SCHEMA,
      instance_id: bindings.instance_id,
      problem_package_sha256: bindings.problem_package_sha256,
      declared_invariant_ids: ["I_A", "I_B", "I_C"],
      cases,
    }
    return encodeAccepted(artifact)
  } catch {
    return failOracle(["malformed_originator_oracle_input"])
  }
}

/**
 * Serialize already-human-supplied answers plus instance bindings.
 * Fills only frozen protocol constants (schema, declared_invariant_ids).
 * Does not infer, compare, correct, or complete attribution sets.
 */
export function materializeOriginatorOracle(input: unknown): OriginatorOracleResult {
  try {
    if (!isRecord(input)) return failOracle(["malformed_originator_oracle_input"])
    const inspectReasons = inspectInput(input, "oracle")
    if (inspectReasons.length > 0) return failOracle(inspectReasons)
    const reasons: string[] = []
    rejectAuthoritySubstitute(input, reasons)
    extraKeys(input, ORIGINATOR_ORACLE_MATERIALIZE_KEYS, "oracle", reasons)
    missingKeys(input, ORIGINATOR_ORACLE_MATERIALIZE_KEYS, "oracle", reasons)
    const bindings = validateBindings(input, reasons)
    const casesRaw = input["cases"]
    if (Array.isArray(casesRaw) || !isRecord(casesRaw)) {
      reasons.push("oracle.cases must be a map, not an array or other value")
      return failOracle(uniqueReasons(reasons))
    }
    const cases = validateCases(casesRaw, reasons)
    if (reasons.length > 0 || !bindings || !cases) {
      return failOracle(uniqueReasons(reasons.length > 0 ? reasons : ["malformed_originator_oracle"]))
    }
    const artifact: OriginatorOracleArtifact = {
      schema: ORIGINATOR_ORACLE_SCHEMA,
      instance_id: bindings.instance_id,
      problem_package_sha256: bindings.problem_package_sha256,
      declared_invariant_ids: ["I_A", "I_B", "I_C"],
      cases,
    }
    return encodeAccepted(artifact)
  } catch {
    return failOracle(["malformed_originator_oracle_input"])
  }
}

export function digestOriginatorOracleBytes(bytes: Uint8Array | Buffer): string {
  return IndependentAuthority.sha256ExactBytes(bytes)
}
