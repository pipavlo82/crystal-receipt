import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

type JsonSchema = {
  $ref?: string
  $defs?: Record<string, JsonSchema>
  type?: string
  const?: unknown
  enum?: unknown[]
  oneOf?: JsonSchema[]
  required?: string[]
  properties?: Record<string, JsonSchema>
  additionalProperties?: boolean
  items?: JsonSchema
  uniqueItems?: boolean
  minLength?: number
  minimum?: number
  maximum?: number
  pattern?: string
}

const repo = resolve(import.meta.dir, "../..")
const fixtureRoot = resolve(repo, "tests/fixtures/unanchored-issuance-witness-v0")
const vectorRoot = resolve(fixtureRoot, "vectors")
const readJson = <T = any>(path: string): T => JSON.parse(readFileSync(path, "utf8"))
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex")

function deref(schema: JsonSchema, root: JsonSchema): JsonSchema {
  if (!schema.$ref) return schema
  let current: any = root
  for (const part of schema.$ref.replace(/^#\//, "").split("/")) current = current[part]
  return current
}

function validate(value: unknown, inputSchema: JsonSchema, root: JsonSchema, path = "$", errors: string[] = []): string[] {
  const schema = deref(inputSchema, root)
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((candidate) => validate(value, candidate, root, path, []).length === 0)
    if (matches.length !== 1) errors.push(`${path} must match exactly one oneOf branch`)
    return errors
  }
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path} must equal ${JSON.stringify(schema.const)}`)
  if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) errors.push(`${path} is outside the enum`)
  if (schema.type === "null" && value !== null) errors.push(`${path} must be null`)
  if (schema.type === "string") {
    if (typeof value !== "string") return [...errors, `${path} must be a string`]
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} is too short`)
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path} does not match ${schema.pattern}`)
  }
  if (schema.type === "integer") {
    if (!Number.isSafeInteger(value)) return [...errors, `${path} must be a safe integer`]
    if (schema.minimum !== undefined && (value as number) < schema.minimum) errors.push(`${path} is below minimum`)
    if (schema.maximum !== undefined && (value as number) > schema.maximum) errors.push(`${path} is above maximum`)
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return [...errors, `${path} must be an array`]
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${path} must be unique`)
    value.forEach((item, index) => schema.items && validate(item, schema.items, root, `${path}[${index}]`, errors))
  }
  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [...errors, `${path} must be an object`]
    const record = value as Record<string, unknown>
    for (const key of schema.required ?? []) if (!(key in record)) errors.push(`${path}.${key} is required`)
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(record)) if (!(key in schema.properties)) errors.push(`${path}.${key} is not allowed`)
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in record) validate(record[key], child, root, `${path}.${key}`, errors)
    }
  }
  return errors
}

const manifest = readJson(resolve(fixtureRoot, "manifest.json"))
const vectorSchema = readJson<JsonSchema>(resolve(fixtureRoot, "unanchored-witness-vector-v0.schema.json"))
const admissionSchema = readJson<JsonSchema>(resolve(repo, "src/receiptos/schemas/admission-result-v0.schema.json"))
const vectorFiles = readdirSync(vectorRoot).filter((name) => name.endsWith(".json")).sort()
const vectors = vectorFiles.map((name) => readJson(resolve(vectorRoot, name)))
const byId = new Map(vectors.map((vector) => [vector.case_id, vector]))

const reasonOrder = [
  "profile_or_artifact_malformed",
  "issuance_intent_malformed",
  "witness_receipt_root_malformed",
  "witness_receipt_root_mismatch",
  "unsupported_witness_receipt_signature_profile",
  "malformed_witness_receipt_signature",
  "invalid_witness_receipt_signature",
  "accepted_record_ref_mismatch",
  "missing_coverage_binding",
  "coverage_source_authority_not_allowed",
  "duplicate_coverage_binding",
  "independent_completeness_unproven",
  "issuance_stream_fork",
  "sequence_gap",
  "predecessor_ref_mismatch",
  "issuance_position_inversion",
  "accepted_record_not_in_witness_log",
  "witness_checkpoint_root_malformed",
  "witness_checkpoint_root_mismatch",
  "unsupported_witness_checkpoint_signature_profile",
  "malformed_witness_checkpoint_signature",
  "invalid_witness_checkpoint_signature",
  "witness_checkpoint_chain_discontinuous",
  "witness_append_only_consistency_unproven",
  "witness_stalled",
  "witness_equivocation",
  "terminal_to_intent_mismatch",
  "late_skip",
  "resolution_overdue",
  "late_resolution",
  "publication_overdue",
  "late_publication",
  "as_of_scope_malformed",
  "as_of_scope_mismatch",
]

describe("unanchored issuance witness normative vectors", () => {
  test("frozen specification hash is byte-exact", () => {
    const bytes = readFileSync(resolve(repo, "docs/UNANCHORED_ISSUANCE_WITNESS_V0.md"))
    expect(sha256(bytes)).toBe("24fdf071008638c5c0198dc80d94be4ae3a8e31f072b41009ded71ea7d49ffa4")
  })

  test("complete A-K matrix and required subcases exist exactly once", () => {
    const expected = ["A", "B", "C", "D", "E", "F", "G1", "G2", "H", "I", "J", "K1", "K2"]
    expect(vectors.filter((vector) => vector.classification === "matrix").map((vector) => vector.case_id).sort()).toEqual(expected.sort())
    for (const id of expected) expect(vectors.filter((vector) => vector.case_id === id)).toHaveLength(1)
  })

  test("all required co-occurrence cases exist exactly once", () => {
    const expected = ["CO-LATE-TERMINAL-AFTER-OVERDUE", "CO-EQUIVOCATION-PREFIX", "CO-MULTIPLE-VIOLATIONS"]
    expect(vectors.filter((vector) => vector.classification === "co_occurrence").map((vector) => vector.case_id).sort()).toEqual(expected.sort())
    for (const id of expected) expect(vectors.filter((vector) => vector.case_id === id)).toHaveLength(1)
  })

  test("every vector and expected admission result validates against its schema", () => {
    for (const vector of vectors) {
      expect(validate(vector, vectorSchema, vectorSchema), vector.case_id).toEqual([])
      expect(validate(vector.expected.admission_result, admissionSchema, admissionSchema), vector.case_id).toEqual([])
    }
  })

  test("every embedded normative input artifact validates against its existing schema", () => {
    const schemas = {
      coverage_profile: readJson<JsonSchema>(resolve(repo, "src/receiptos/schemas/issuance-coverage-profile-v0.schema.json")),
      issuance_intent: readJson<JsonSchema>(resolve(repo, "src/receiptos/schemas/issuance-record-v0.schema.json")),
      terminal_commitment: readJson<JsonSchema>(resolve(repo, "src/receiptos/schemas/issuance-result-commitment-v0.schema.json")),
      witness_receipt: readJson<JsonSchema>(resolve(repo, "src/receiptos/schemas/witness-receipt-v0.schema.json")),
      witness_checkpoint: readJson<JsonSchema>(resolve(repo, "src/receiptos/schemas/witness-log-checkpoint-v0.schema.json")),
    }
    for (const vector of vectors) {
      const artifacts = vector.input.artifacts
      expect(validate(artifacts.coverage_profile, schemas.coverage_profile, schemas.coverage_profile), vector.case_id).toEqual([])
      expect(validate(artifacts.issuance_intent, schemas.issuance_intent, schemas.issuance_intent), vector.case_id).toEqual([])
      expect(validate(artifacts.terminal_commitment, schemas.terminal_commitment, schemas.terminal_commitment), vector.case_id).toEqual([])
      for (const receipt of artifacts.witness_receipts) {
        expect(validate(receipt, schemas.witness_receipt, schemas.witness_receipt), vector.case_id).toEqual([])
      }
      for (const checkpoint of artifacts.witness_checkpoints) {
        expect(validate(checkpoint, schemas.witness_checkpoint, schemas.witness_checkpoint), vector.case_id).toEqual([])
      }
    }
  })

  test("findings are complete ordered lists and primary_reason_code is findings[0]", () => {
    for (const vector of vectors) {
      const result = vector.expected.admission_result
      expect(Array.isArray(result.findings), vector.case_id).toBe(true)
      expect(new Set(result.findings).size, vector.case_id).toBe(result.findings.length)
      expect(result.findings.map((code: string) => reasonOrder.indexOf(code)), vector.case_id)
        .toEqual(result.findings.map((code: string) => reasonOrder.indexOf(code)).sort((a: number, b: number) => a - b))
      expect(result.primary_reason_code, vector.case_id).toBe(result.findings[0] ?? null)
      expect(result.unverifiable_checks, vector.case_id).toEqual([...result.unverifiable_checks].sort((a: number, b: number) => a - b))
    }
  })

  test("late terminal retains overdue and late facts without supersession", () => {
    const vector = byId.get("CO-LATE-TERMINAL-AFTER-OVERDUE")
    expect(vector.expected.admission_result.resolution_progress).toBe("resolved")
    expect(vector.expected.admission_result.resolution_timing).toBe("late")
    expect(vector.expected.admission_result.admission_verdict).toBe("invalid")
    expect(vector.expected.admission_result.findings).toEqual(["resolution_overdue", "late_resolution"])
    expect(vector.expected.assertions).toMatchObject({ overdue_interval_retained: true, supersession: false })
  })

  test("equivocation prefix includes last clean checkpoint and excludes the incompatible pair and successors", () => {
    const vector = byId.get("CO-EQUIVOCATION-PREFIX")
    const prefix = vector.expected.assertions.admissible_prefix
    const pair = vector.input.evidence.incompatible_checkpoint_pair
    expect(prefix.included_checkpoint_refs.at(-1)).toBe(prefix.last_included_checkpoint_ref)
    expect(prefix.excluded_checkpoint_refs).toEqual(expect.arrayContaining(pair))
    expect(prefix.included_checkpoint_refs.some((ref: string) => pair.includes(ref))).toBe(false)
    expect(prefix.excluded_checkpoint_refs).toHaveLength(3)
  })

  test("multiple violations pin total ordering and primary reason", () => {
    const result = byId.get("CO-MULTIPLE-VIOLATIONS").expected.admission_result
    expect(result.findings).toEqual([
      "witness_receipt_root_mismatch",
      "unsupported_witness_receipt_signature_profile",
      "duplicate_coverage_binding",
      "witness_checkpoint_root_mismatch",
      "witness_stalled",
      "late_resolution",
      "late_publication",
      "as_of_scope_mismatch",
    ])
    expect(result.primary_reason_code).toBe("witness_receipt_root_mismatch")
  })

  test("manifest pins sorted byte hashes and deterministic fixture-set hash", () => {
    const sorted = [...manifest.files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    expect(manifest.files).toEqual(sorted)
    for (const file of manifest.files) {
      expect(sha256(readFileSync(resolve(repo, file.path))), file.path).toBe(file.sha256)
    }
    const aggregate = manifest.files.map((file) => `${file.path}\t${file.sha256}\n`).join("")
    expect(sha256(aggregate)).toBe(manifest.fixture_set_sha256)
  })

  test("manifest binds every vector and normative schema dependency", () => {
    const paths = manifest.files.map((file) => file.path)
    for (const name of vectorFiles) expect(paths).toContain(`tests/fixtures/unanchored-issuance-witness-v0/vectors/${name}`)
    for (const name of [
      "admission-result-v0",
      "issuance-coverage-profile-v0",
      "issuance-record-v0",
      "issuance-result-commitment-v0",
      "witness-log-checkpoint-v0",
      "witness-receipt-v0",
    ]) expect(paths).toContain(`src/receiptos/schemas/${name}.schema.json`)
  })

  test("no production witness evaluator or findings detector was added", () => {
    const changed = execFileSync("git", ["diff", "--name-only", "origin/main"], { cwd: repo, encoding: "utf8" })
      .trim().split(/\r?\n/).filter(Boolean)
    expect(changed.filter((path) => path.startsWith("src/receiptos/") && !path.endsWith(".schema.json"))).toEqual([])
  })
})
