import { createHash } from "node:crypto"

export type CounterfactualSemanticJson =
  | null
  | string
  | boolean
  | number
  | CounterfactualSemanticJson[]
  | { [key: string]: CounterfactualSemanticJson }

/**
 * Closed v0 CAB semantic-snapshot contract rejection codes.
 * Derived from exact production control-flow branches in this module.
 */
export const COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT_CODES = [
  "reserved_audit_timestamp",
  "unstable_own_keys_snapshot",
  "unstable_property_descriptor",
  "property_snapshot_changed",
  "unstable_prototype",
  "symbol_keyed_property_forbidden",
  "inherited_enumerable_symbol_forbidden",
  "inherited_enumerable_property_forbidden",
  "accessor_property_forbidden",
  "non_enumerable_property_forbidden",
  "array_prototype_required",
  "extra_array_property_forbidden",
  "invalid_array_length_descriptor",
  "invalid_array_length",
  "sparse_array_forbidden",
  "object_prototype_required",
  "non_finite_number",
  "value_outside_json_domain",
  "cyclic_value_forbidden",
  "unstable_container_type",
] as const

export type CounterfactualAuditBoundaryContractCodeV0 =
  (typeof COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT_CODES)[number]

export const COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT =
  "counterfactual_audit_boundary.semantic_snapshot.v0" as const

/**
 * Bounded typed CAB rejection evidence extracted for runner consumption.
 * Immutable; carries no Error.message / stack.
 */
export type CabContractRejectionEvidenceV0 = {
  readonly contract: typeof COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT
  readonly code: CounterfactualAuditBoundaryContractCodeV0
  readonly path: string | null
}

const CAB_CONTRACT_CODE_SET = new Set<CounterfactualAuditBoundaryContractCodeV0>(
  COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT_CODES,
)

/** Private minting authority: only this module's fail() path may create instances. */
const CAB_CONTRACT_ERROR_INSTANCES = new WeakSet<object>()

/**
 * Module-private typed CAB subject-contract rejection.
 * Not exported — callers must not mint recognized rejections.
 * Machine identity is `code` + `path`; message text remains for human tests only.
 */
class CounterfactualAuditBoundaryContractError extends Error {
  readonly contract = COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT
  readonly code: CounterfactualAuditBoundaryContractCodeV0
  readonly path: string | null

  constructor(
    code: CounterfactualAuditBoundaryContractCodeV0,
    path: string | null,
    detail: string,
  ) {
    super(path === null ? detail : `${path}: ${detail}`)
    this.name = "CounterfactualAuditBoundaryContractError"
    this.code = code
    this.path = path
    CAB_CONTRACT_ERROR_INSTANCES.add(this)
  }
}

/**
 * Opaque read-only extractor for private authentic CAB contract errors.
 * Returns frozen bounded rejection evidence or null.
 * Cannot mint, register, mutate, or promote arbitrary values.
 */
export function extractCabContractRejection(thrown: unknown): CabContractRejectionEvidenceV0 | null {
  if (!(thrown instanceof CounterfactualAuditBoundaryContractError)) return null
  if (!CAB_CONTRACT_ERROR_INSTANCES.has(thrown)) return null
  if (thrown.contract !== COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT) return null
  if (!CAB_CONTRACT_CODE_SET.has(thrown.code)) return null
  if (!(thrown.path === null || typeof thrown.path === "string")) return null
  return Object.freeze({
    contract: COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT,
    code: thrown.code,
    path: thrown.path,
  })
}

const AUDIT_TIMESTAMP = "audit_timestamp"
const ARRAY_INDEX_LIMIT = 2 ** 32 - 1

function fail(
  code: CounterfactualAuditBoundaryContractCodeV0,
  path: string | null,
  detail: string,
): never {
  throw new CounterfactualAuditBoundaryContractError(code, path, detail)
}

function inspectOwnKeys(value: object, path: string): PropertyKey[] {
  try {
    return Reflect.ownKeys(value)
  } catch {
    return fail("unstable_own_keys_snapshot", path, "unable to obtain a stable own-property snapshot")
  }
}

function inspectDescriptor(value: object, key: PropertyKey, path: string): PropertyDescriptor {
  let descriptor: PropertyDescriptor | undefined
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key)
  } catch {
    return fail("unstable_property_descriptor", path, "unable to obtain a stable own-property descriptor")
  }
  if (descriptor === undefined) {
    return fail("property_snapshot_changed", path, "own-property snapshot changed during inspection")
  }
  return descriptor
}

function inspectPrototype(value: object, path: string): object | null {
  try {
    return Object.getPrototypeOf(value)
  } catch {
    return fail("unstable_prototype", path, "unable to inspect prototype")
  }
}

function rejectSymbols(keys: PropertyKey[], path: string): void {
  if (keys.some((key) => typeof key === "symbol")) {
    fail("symbol_keyed_property_forbidden", path, "symbol-keyed own properties are forbidden")
  }
}

function rejectInheritedEnumerableState(prototype: object | null, path: string): void {
  const inheritedStringKeys: string[] = []
  let hasInheritedSymbol = false
  let current = prototype
  while (current !== null) {
    for (const key of inspectOwnKeys(current, path)) {
      const descriptor = inspectDescriptor(current, key, path)
      if (!descriptor.enumerable) continue
      if (typeof key === "symbol") hasInheritedSymbol = true
      else inheritedStringKeys.push(key)
    }
    current = inspectPrototype(current, path)
  }
  if (hasInheritedSymbol) {
    fail("inherited_enumerable_symbol_forbidden", path, "inherited enumerable symbol properties are forbidden")
  }
  inheritedStringKeys.sort()
  if (inheritedStringKeys.length > 0) {
    fail(
      "inherited_enumerable_property_forbidden",
      path,
      `inherited enumerable property ${JSON.stringify(inheritedStringKeys[0])} is forbidden`,
    )
  }
}

function dataValue(descriptor: PropertyDescriptor, path: string): unknown {
  if ("get" in descriptor || "set" in descriptor) {
    fail("accessor_property_forbidden", path, "accessor properties are forbidden")
  }
  if (!descriptor.enumerable) {
    fail("non_enumerable_property_forbidden", path, "non-enumerable properties are forbidden")
  }
  return descriptor.value
}

function isCanonicalArrayIndex(key: string): boolean {
  const index = Number(key)
  return Number.isInteger(index) && index >= 0 && index < ARRAY_INDEX_LIMIT && String(index) === key
}

function snapshotArray(
  value: unknown[],
  path: string,
  active: WeakSet<object>,
): CounterfactualSemanticJson[] {
  const prototype = inspectPrototype(value, path)
  if (prototype !== Array.prototype) {
    fail("array_prototype_required", path, "arrays must use Array.prototype")
  }
  rejectInheritedEnumerableState(prototype, path)

  const keys = inspectOwnKeys(value, path)
  rejectSymbols(keys, path)
  const stringKeys = (keys as string[]).sort()
  const extraKey = stringKeys.find((key) => key !== "length" && !isCanonicalArrayIndex(key))
  if (extraKey !== undefined) {
    fail(
      "extra_array_property_forbidden",
      `${path}[${JSON.stringify(extraKey)}]`,
      "extra array properties are forbidden",
    )
  }

  const lengthDescriptor = inspectDescriptor(value, "length", `${path}.length`)
  if ("get" in lengthDescriptor || "set" in lengthDescriptor || lengthDescriptor.enumerable) {
    fail(
      "invalid_array_length_descriptor",
      `${path}.length`,
      "array length must be an ordinary non-enumerable data property",
    )
  }
  const length = lengthDescriptor.value
  if (!Number.isInteger(length) || length < 0 || length >= ARRAY_INDEX_LIMIT) {
    fail("invalid_array_length", `${path}.length`, "array length is invalid")
  }

  const keySet = new Set(stringKeys)
  for (let index = 0; index < length; index += 1) {
    if (!keySet.has(String(index))) {
      fail("sparse_array_forbidden", `${path}[${index}]`, "sparse arrays are forbidden")
    }
  }
  const out: CounterfactualSemanticJson[] = []
  for (let index = 0; index < length; index += 1) {
    const indexPath = `${path}[${index}]`
    const descriptor = inspectDescriptor(value, String(index), indexPath)
    const child = dataValue(descriptor, indexPath)
    out.push(snapshotValue(child, indexPath, active))
  }
  return out
}

function snapshotObject(
  value: object,
  path: string,
  active: WeakSet<object>,
): { [key: string]: CounterfactualSemanticJson } {
  const prototype = inspectPrototype(value, path)
  if (prototype !== Object.prototype && prototype !== null) {
    fail("object_prototype_required", path, "objects must use Object.prototype or null")
  }
  rejectInheritedEnumerableState(prototype, path)

  const keys = inspectOwnKeys(value, path)
  rejectSymbols(keys, path)
  const stringKeys = (keys as string[]).sort()
  const out: { [key: string]: CounterfactualSemanticJson } = Object.create(null)
  for (const key of stringKeys) {
    const childPath = `${path}[${JSON.stringify(key)}]`
    if (key === AUDIT_TIMESTAMP) {
      fail(
        "reserved_audit_timestamp",
        childPath,
        "non-semantic audit metadata is forbidden in semantic input",
      )
    }
    const descriptor = inspectDescriptor(value, key, childPath)
    const child = dataValue(descriptor, childPath)
    out[key] = snapshotValue(child, childPath, active)
  }
  return out
}

function snapshotValue(value: unknown, path: string, active: WeakSet<object>): CounterfactualSemanticJson {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("non_finite_number", path, "numbers must be finite")
    return value
  }
  if (typeof value !== "object") {
    fail("value_outside_json_domain", path, "value is outside the JSON domain")
  }
  if (active.has(value)) fail("cyclic_value_forbidden", path, "cyclic values are forbidden")

  active.add(value)
  try {
    let isArray: boolean
    try {
      isArray = Array.isArray(value)
    } catch {
      return fail("unstable_container_type", path, "unable to determine a stable JSON container type")
    }
    return isArray
      ? snapshotArray(value, path, active)
      : snapshotObject(value, path, active)
  } finally {
    active.delete(value)
  }
}

/**
 * Capture semantic input as newly allocated strict JSON data while rejecting
 * reserved audit metadata. Accepted property values are taken once from data
 * descriptors; downstream code must use only the returned snapshot.
 */
export function snapshotCounterfactualSemanticJson(value: unknown): CounterfactualSemanticJson {
  return snapshotValue(value, "$semantic_artifact", new WeakSet<object>())
}

/**
 * Hash a manifest string after one explicit UTF-8 encoding, or hash the exact
 * bytes of a supplied Uint8Array. This is a file-byte hash, not semantic identity.
 */
export function computeCounterfactualManifestFileSha256(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input
  return createHash("sha256").update(bytes).digest("hex")
}

/**
 * Finite mapping from typed CAB rejection codes to frozen expected
 * `error_message_contains` semantic tokens. Used by Lane E without reading
 * runtime Error.message.
 */
export const CAB_CONTRACT_CODE_TO_EXPECTED_MESSAGE_TOKEN = Object.freeze({
  reserved_audit_timestamp: "non-semantic audit metadata is forbidden in semantic input",
  accessor_property_forbidden: "accessor properties are forbidden",
} as const satisfies Partial<
  Record<CounterfactualAuditBoundaryContractCodeV0, string>
>)

export type CabExpectedMessageTokenV0 =
  (typeof CAB_CONTRACT_CODE_TO_EXPECTED_MESSAGE_TOKEN)[keyof typeof CAB_CONTRACT_CODE_TO_EXPECTED_MESSAGE_TOKEN]
