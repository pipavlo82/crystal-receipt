/** Independent counterfactual-audit-boundary-v0 package audit. No production imports. */
import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE_DIR = "conformance/counterfactual-audit-boundary-v0"
const PACKAGE = `${PACKAGE_DIR}`

type J = Record<string, unknown>
const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message)
}

const shaBytes = (bytes: Uint8Array | Buffer) => createHash("sha256").update(bytes).digest("hex")
const readBytes = (repositoryPath: string) => readFileSync(resolve(ROOT, repositoryPath))
const readJson = (repositoryPath: string) => JSON.parse(readBytes(repositoryPath).toString("utf8")) as J
const canonicalExpected = (value: unknown): string => {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return `[${value.map(canonicalExpected).join(",")}]`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalExpected(record[key])}`).join(",")}}`
  }
  throw new Error(`non-canonical expected value: ${typeof value}`)
}

const RESERVED = "audit_timestamp"
const PATH_PREFIX = "$semantic_artifact"

class SnapshotError extends Error {
  constructor(
    readonly path: string,
    readonly detail: string,
  ) {
    super(`${path}: ${detail}`)
  }
}

function snapshotJson(value: unknown, path = PATH_PREFIX): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new SnapshotError(path, "numbers must be finite")
    return value
  }
  if (Array.isArray(value)) return value.map((item, index) => snapshotJson(item, `${path}[${index}]`))
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const out: Record<string, unknown> = Object.create(null)
    for (const key of Object.keys(record).sort()) {
      const childPath = `${path}[${JSON.stringify(key)}]`
      if (key === RESERVED) throw new SnapshotError(childPath, "non-semantic audit metadata is forbidden in semantic input")
      out[key] = snapshotJson(record[key], childPath)
    }
    return out
  }
  throw new SnapshotError(path, "value is outside the JSON domain")
}

function manifestHash(input: J): string {
  const encoding = input.encoding
  if (encoding === "utf8_string") return shaBytes(Buffer.from(String(input.value), "utf8"))
  if (encoding === "uint8_array") {
    if (Array.isArray(input.bytes)) return shaBytes(Uint8Array.from(input.bytes as number[]))
    if (typeof input.utf8_bytes_of === "string") return shaBytes(Buffer.from(input.utf8_bytes_of, "utf8"))
    throw new Error("uint8_array input requires bytes or utf8_bytes_of")
  }
  throw new Error(`unknown encoding: ${String(encoding)}`)
}

function evaluateSemanticVector(vector: J): void {
  const expected = vector.expected as J
  if (vector.runtime_construction) return

  if (Array.isArray(vector.input_variants)) {
    const errors = (vector.input_variants as unknown[]).map((variant) => {
      try {
        snapshotJson(variant)
        return null
      } catch (error) {
        return error instanceof Error ? error.message : String(error)
      }
    })
    assert(errors.every(Boolean), "variants must reject")
    assert(new Set(errors).size === 1, "variants must match")
    const message = errors[0] as string
    assert(message.includes(String(expected.error_path)), "error path")
    assert(message.includes(String(expected.error_message_contains)), "error message")
    return
  }

  if (vector.manifest_variants) {
    const artifact = vector.semantic_artifact
    const canonicals = (vector.manifest_variants as unknown[]).map(() => canonicalExpected(snapshotJson(artifact)))
    assert(new Set(canonicals).size === 1, "manifest variants must preserve semantic snapshot")
    assert(canonicals[0] === expected.canonical_snapshot_json, "canonical snapshot")
    return
  }

  if (vector.baseline_semantic_artifact) {
    const base = canonicalExpected(snapshotJson(vector.baseline_semantic_artifact))
    const mutated = canonicalExpected(snapshotJson(vector.mutated_semantic_artifact))
    assert(base !== mutated, "semantic mutation must differ")
    return
  }

  if (vector.input) {
    try {
      const snap = snapshotJson(vector.input)
      assert(expected.outcome === "accepted_snapshot", "accepted outcome")
      if (expected.canonical_snapshot_json) assert(canonicalExpected(snap) === expected.canonical_snapshot_json)
    } catch (error) {
      assert(expected.outcome === "rejected", "rejected outcome")
      const message = error instanceof Error ? error.message : String(error)
      assert(message.includes(String(expected.error_path)), "error path")
      assert(message.includes(String(expected.error_message_contains)), "error message")
    }
    return
  }

  throw new Error(`unsupported semantic vector: ${String(vector.vector_id)}`)
}

function evaluateManifestVector(vector: J): void {
  const expected = vector.expected as J
  const hashes = (vector.inputs as J[]).map(manifestHash)
  if (expected.outcome === "manifest_hash_differs") assert(hashes[0] !== hashes[1])
  else if (expected.outcome === "manifest_hash_equals") assert(hashes[0] === hashes[1])
  else if (expected.outcome === "manifest_hash_value") assert(hashes[0] === expected.sha256_hex)
  else throw new Error(`unknown manifest outcome: ${String(expected.outcome)}`)
}

function evaluateVector(vector: J): void {
  if (vector.operation === "semantic_snapshot") evaluateSemanticVector(vector)
  else if (vector.operation === "manifest_file_sha256") evaluateManifestVector(vector)
  else throw new Error(`unknown operation: ${String(vector.operation)}`)
}

export function auditPackage(): J {
  const manifest = readJson(`${PACKAGE}/manifest.json`)
  const contract = readJson(`${PACKAGE}/contract.json`)
  const files = manifest.files as J[]
  assert(manifest.file_count === files.length, "manifest inventory")
  const paths = files.map((file) => String(file.path))
  assert(JSON.stringify(paths) === JSON.stringify([...paths].sort((a, b) => Buffer.from(a).compare(Buffer.from(b)))), "path order")
  const rows: string[] = []
  for (const file of files) {
    const actual = shaBytes(readBytes(String(file.path)))
    assert(actual === file.sha256, `file digest ${String(file.path)}`)
    rows.push(`${String(file.path)}\t${actual}\n`)
  }
  assert(shaBytes(Buffer.from(rows.join(""), "utf8")) === manifest.fixture_set_sha256, "fixture-set digest")

  const vectorIds = readdirSync(resolve(ROOT, `${PACKAGE}/vectors`))
    .filter((name) => name.startsWith("V-") && name.endsWith(".json"))
    .map((name) => name.slice(0, -5))
    .sort()
  assert(JSON.stringify(vectorIds) === JSON.stringify([...(contract.vector_inventory as string[])].sort()), "vector inventory")
  const resultRows: string[] = []
  let evaluated = 0
  let runtimeOnly = 0
  for (const vectorId of vectorIds) {
    const vector = readJson(`${PACKAGE}/vectors/${vectorId}.json`)
    assert(vector.vector_id === vectorId, "vector id")
    if (vector.runtime_construction) runtimeOnly += 1
    else {
      evaluateVector(vector)
      evaluated += 1
    }
    resultRows.push(`${vectorId}\t${shaBytes(Buffer.from(canonicalExpected(vector.expected), "utf8"))}\n`)
  }
  const resultHash = shaBytes(Buffer.from(resultRows.join(""), "utf8"))
  assert(resultHash === contract.expected_result_set_sha256, "expected-result-set digest")

  const classes = contract.vector_execution_classes as J
  const table = classes.vectors as Record<string, J>
  assert(Object.keys(table).sort().join() === vectorIds.join(), "execution-class completeness")
  const counts = { "semantic-snapshot": 0, "manifest-file-hash": 0, "runtime-binding-required": 0 }
  for (const vectorId of vectorIds) {
    const vector = readJson(`${PACKAGE}/vectors/${vectorId}.json`)
    const actual = vector.runtime_construction ? "runtime-binding-required" : String(vector.execution_class)
    assert(table[vectorId].execution_class === actual, `${vectorId} execution class`)
    counts[actual as keyof typeof counts] += 1
  }

  return {
    auditor: "typescript-independent-counterfactual-audit-boundary-v0",
    mode: "read-only-filesystem",
    vector_count: vectorIds.length,
    package_inventory_count: files.length,
    fixture_set_sha256: manifest.fixture_set_sha256,
    expected_result_set_sha256: resultHash,
    independently_evaluated_vectors: evaluated,
    runtime_binding_vectors: runtimeOnly,
    execution_class_counts: counts,
    production_imports: 0,
  }
}

if (import.meta.main) console.log(JSON.stringify(auditPackage(), null, 2))
