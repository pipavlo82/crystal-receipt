import { types } from "node:util"

export type RsfJsonValue = null | string | boolean | number | RsfJsonValue[] | { [key: string]: RsfJsonValue }

const ARRAY_INDEX_LIMIT = 2 ** 32 - 1

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`)
}

function ownKeys(value: object, path: string): PropertyKey[] {
  try { return Reflect.ownKeys(value) } catch { return fail(path, "unstable own-property reflection") }
}

function descriptor(value: object, key: PropertyKey, path: string): PropertyDescriptor {
  try {
    const result = Object.getOwnPropertyDescriptor(value, key)
    if (result === undefined) return fail(path, "property changed during snapshot")
    return result
  } catch {
    return fail(path, "unstable property descriptor")
  }
}

function prototype(value: object, path: string): object | null {
  try { return Object.getPrototypeOf(value) } catch { return fail(path, "unstable prototype") }
}

function dataValue(property: PropertyDescriptor, path: string): unknown {
  if ("get" in property || "set" in property) fail(path, "accessors are forbidden")
  if (!property.enumerable) fail(path, "non-enumerable semantic state is forbidden")
  return property.value
}

function rejectInheritedEnumerableState(valuePrototype: object | null, path: string): void {
  let current = valuePrototype
  while (current !== null) {
    for (const key of ownKeys(current, path)) {
      if (descriptor(current, key, path).enumerable) fail(path, "inherited enumerable state is forbidden")
    }
    current = prototype(current, path)
  }
}

function isArrayIndex(key: string): boolean {
  const index = Number(key)
  return Number.isInteger(index) && index >= 0 && index < ARRAY_INDEX_LIMIT && String(index) === key
}

function snapshotArray(value: unknown[], path: string, active: WeakSet<object>): RsfJsonValue[] {
  const valuePrototype = prototype(value, path)
  if (valuePrototype !== Array.prototype) fail(path, "exotic array prototype is forbidden")
  rejectInheritedEnumerableState(valuePrototype, path)
  const keys = ownKeys(value, path)
  if (keys.some(key => typeof key === "symbol")) fail(path, "symbol keys are forbidden")
  const stringKeys = keys as string[]
  const extra = stringKeys.find(key => key !== "length" && !isArrayIndex(key))
  if (extra !== undefined) fail(path, "extended arrays are forbidden")
  const lengthDescriptor = descriptor(value, "length", `${path}.length`)
  if ("get" in lengthDescriptor || "set" in lengthDescriptor || lengthDescriptor.enumerable) fail(path, "invalid array length descriptor")
  const length = lengthDescriptor.value
  if (!Number.isInteger(length) || length < 0 || length >= ARRAY_INDEX_LIMIT) fail(path, "invalid array length")
  const present = new Set(stringKeys)
  const output: RsfJsonValue[] = []
  for (let index = 0; index < length; index += 1) {
    const key = String(index)
    if (!present.has(key)) fail(`${path}[${index}]`, "sparse arrays are forbidden")
    output.push(snapshotValue(dataValue(descriptor(value, key, `${path}[${index}]`), `${path}[${index}]`), `${path}[${index}]`, active))
  }
  return output
}

function snapshotObject(value: object, path: string, active: WeakSet<object>): { [key: string]: RsfJsonValue } {
  const valuePrototype = prototype(value, path)
  if (valuePrototype !== Object.prototype && valuePrototype !== null) fail(path, "exotic object prototype is forbidden")
  rejectInheritedEnumerableState(valuePrototype, path)
  const keys = ownKeys(value, path)
  if (keys.some(key => typeof key === "symbol")) fail(path, "symbol keys are forbidden")
  const output: { [key: string]: RsfJsonValue } = Object.create(null)
  for (const key of (keys as string[]).sort()) {
    output[key] = snapshotValue(dataValue(descriptor(value, key, `${path}.${key}`), `${path}.${key}`), `${path}.${key}`, active)
  }
  return output
}

function snapshotValue(value: unknown, path: string, active: WeakSet<object>): RsfJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(path, "nonfinite numbers are forbidden")
    return value
  }
  if (typeof value !== "object") fail(path, "value is outside the JSON domain")
  // Proxy rejection must precede Array.isArray and every reflection operation.
  // Repeatedly sampling hostile traps cannot establish a stable JSON fact.
  if (types.isProxy(value)) fail(path, "Proxy values are forbidden")
  if (active.has(value)) fail(path, "cycles are forbidden")
  active.add(value)
  try { return Array.isArray(value) ? snapshotArray(value, path, active) : snapshotObject(value, path, active) }
  finally { active.delete(value) }
}

/** Reads each caller-owned data descriptor once and returns a fresh strict JSON-domain tree. */
export function snapshotRsfJson(value: unknown, path = "$rsf"): RsfJsonValue {
  return snapshotValue(value, path, new WeakSet<object>())
}
