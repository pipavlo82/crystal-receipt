import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

type JsonSchema = {
  type?: string
  const?: JsonValue
  enum?: JsonValue[]
  required?: string[]
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  minItems?: number
  pattern?: string
  additionalProperties?: boolean
  $ref?: string
  $defs?: Record<string, JsonSchema>
}

function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(resolve(import.meta.dir, path), "utf8")) as T
}

function deref(ref: string, root: JsonSchema): JsonSchema {
  const parts = ref.replace(/^#\//, "").split("/")
  let current: unknown = root
  for (const part of parts) {
    current = (current as Record<string, unknown>)?.[part]
  }
  return current as JsonSchema
}

function validate(value: unknown, schema: JsonSchema, root: JsonSchema, path = "$", errors: string[] = []): string[] {
  const resolved = schema.$ref ? deref(schema.$ref, root) : schema

  if (resolved.const !== undefined && value !== resolved.const) {
    errors.push(`${path} must equal ${JSON.stringify(resolved.const)}`)
    return errors
  }

  if (resolved.enum && !resolved.enum.includes(value as JsonValue)) {
    errors.push(`${path} must be one of ${resolved.enum.map((item) => JSON.stringify(item)).join(", ")}`)
  }

  if (resolved.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push(`${path} must be an object`)
      return errors
    }
    const record = value as Record<string, unknown>
    for (const key of resolved.required ?? []) {
      if (!(key in record)) errors.push(`${path}.${key} is required`)
    }
    if (resolved.additionalProperties === false && resolved.properties) {
      for (const key of Object.keys(record)) {
        if (!(key in resolved.properties)) errors.push(`${path}.${key} is not allowed`)
      }
    }
    for (const [key, child] of Object.entries(resolved.properties ?? {})) {
      if (key in record) validate(record[key], child, root, `${path}.${key}`, errors)
    }
    return errors
  }

  if (resolved.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path} must be an array`)
      return errors
    }
    if (resolved.minItems !== undefined && value.length < resolved.minItems) {
      errors.push(`${path} must contain at least ${resolved.minItems} items`)
    }
    if (resolved.items) {
      value.forEach((item, index) => validate(item, resolved.items as JsonSchema, root, `${path}[${index}]`, errors))
    }
    return errors
  }

  if (resolved.type === "string") {
    if (typeof value !== "string") {
      errors.push(`${path} must be a string`)
      return errors
    }
    if (resolved.pattern && !(new RegExp(resolved.pattern).test(value))) {
      errors.push(`${path} must match ${resolved.pattern}`)
    }
    return errors
  }

  if (resolved.type === "boolean") {
    if (typeof value !== "boolean") errors.push(`${path} must be a boolean`)
    return errors
  }

  return errors
}

describe("receiptos evidence capsule schema v0", () => {
  for (const file of [
    "../../examples/receiptos-capsule-demo/evidence-capsule.v0.json",
    "../../examples/receipt-examples/clean-local-proof/evidence-capsule.v0.json",
    "../../examples/receipt-examples/tampered-mismatch/evidence-capsule.v0.json",
    "../../examples/receipt-examples/anchored-proof/evidence-capsule.v0.json",
  ]) {
    test(`schema-valid substrate example validates: ${file}`, () => {
      const substrate = readJson<any>(file)
      const schema = readJson<JsonSchema>("../../schemas/evidence-capsule.v0.schema.json")

      const errors = validate(substrate, schema, schema)
      expect(errors).toEqual([])
      expect(Object.keys(substrate)).toEqual([
        "schema",
        "action",
        "evidence",
        "receipt_root",
        "proof_refs",
        "verifier_result",
        "capsule",
        "replay_manifest",
      ])
      expect(substrate.receipt_root.stored).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(substrate.receipt_root.computed).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(typeof substrate.receipt_root.match).toBe("boolean")
      expect(["verified", "mismatch", "missing"]).toContain(substrate.receipt_root.status)
      expect(substrate.capsule.sections.length).toBeGreaterThan(0)
    })
  }
})
