import { createHash } from "node:crypto"

export type CounterfactualSemanticJson =
  | null
  | string
  | boolean
  | number
  | CounterfactualSemanticJson[]
  | { [key: string]: CounterfactualSemanticJson }

const AUDIT_TIMESTAMP = "audit_timestamp"
const ARRAY_INDEX_LIMIT = 2 ** 32 - 1

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`)
}

function inspectOwnKeys(value: object, path: string): PropertyKey[] {
  try {
    return Reflect.ownKeys(value)
  } catch {
    return fail(path, "unable to obtain a stable own-property snapshot")
  }
}

function inspectDescriptor(value: object, key: PropertyKey, path: string): PropertyDescriptor {
  let descriptor: PropertyDescriptor | undefined
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key)
  } catch {
    return fail(path, "unable to obtain a stable own-property descriptor")
  }
  if (descriptor === undefined) return fail(path, "own-property snapshot changed during inspection")
  return descriptor
}

function inspectPrototype(value: object, path: string): object | null {
  try {
    return Object.getPrototypeOf(value)
  } catch {
    return fail(path, "unable to inspect prototype")
  }
}

function rejectSymbols(keys: PropertyKey[], path: string): void {
  if (keys.some((key) => typeof key === "symbol")) {
    fail(path, "symbol-keyed own properties are forbidden")
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
  if (hasInheritedSymbol) fail(path, "inherited enumerable symbol properties are forbidden")
  inheritedStringKeys.sort()
  if (inheritedStringKeys.length > 0) {
    fail(path, `inherited enumerable property ${JSON.stringify(inheritedStringKeys[0])} is forbidden`)
  }
}

function dataValue(descriptor: PropertyDescriptor, path: string): unknown {
  if ("get" in descriptor || "set" in descriptor) fail(path, "accessor properties are forbidden")
  if (!descriptor.enumerable) fail(path, "non-enumerable properties are forbidden")
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
  if (prototype !== Array.prototype) fail(path, "arrays must use Array.prototype")
  rejectInheritedEnumerableState(prototype, path)

  const keys = inspectOwnKeys(value, path)
  rejectSymbols(keys, path)
  const stringKeys = (keys as string[]).sort()
  const extraKey = stringKeys.find((key) => key !== "length" && !isCanonicalArrayIndex(key))
  if (extraKey !== undefined) fail(`${path}[${JSON.stringify(extraKey)}]`, "extra array properties are forbidden")

  const lengthDescriptor = inspectDescriptor(value, "length", `${path}.length`)
  if ("get" in lengthDescriptor || "set" in lengthDescriptor || lengthDescriptor.enumerable) {
    fail(`${path}.length`, "array length must be an ordinary non-enumerable data property")
  }
  const length = lengthDescriptor.value
  if (!Number.isInteger(length) || length < 0 || length >= ARRAY_INDEX_LIMIT) {
    fail(`${path}.length`, "array length is invalid")
  }

  const keySet = new Set(stringKeys)
  for (let index = 0; index < length; index += 1) {
    if (!keySet.has(String(index))) fail(`${path}[${index}]`, "sparse arrays are forbidden")
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
    fail(path, "objects must use Object.prototype or null")
  }
  rejectInheritedEnumerableState(prototype, path)

  const keys = inspectOwnKeys(value, path)
  rejectSymbols(keys, path)
  const stringKeys = (keys as string[]).sort()
  const out: { [key: string]: CounterfactualSemanticJson } = Object.create(null)
  for (const key of stringKeys) {
    const childPath = `${path}[${JSON.stringify(key)}]`
    if (key === AUDIT_TIMESTAMP) {
      fail(childPath, "non-semantic audit metadata is forbidden in semantic input")
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
    if (!Number.isFinite(value)) fail(path, "numbers must be finite")
    return value
  }
  if (typeof value !== "object") fail(path, "value is outside the JSON domain")
  if (active.has(value)) fail(path, "cyclic values are forbidden")

  active.add(value)
  try {
    let isArray: boolean
    try {
      isArray = Array.isArray(value)
    } catch {
      return fail(path, "unable to determine a stable JSON container type")
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
