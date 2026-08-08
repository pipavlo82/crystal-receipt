/** Independent verifier-challenge-integrity-mismatch-rejected-v0 package audit. No production imports. */
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE = "conformance/verifier-challenge-integrity-mismatch-rejected-v0"

type J = Record<string, unknown>
const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message)
}

const shaBytes = (bytes: Uint8Array | Buffer) => createHash("sha256").update(bytes).digest("hex")
const gitIndexBlobOid = (repositoryPath: string) => {
  try {
    return execFileSync("git", ["rev-parse", `:${repositoryPath}`], { cwd: ROOT, encoding: "utf8" }).trim()
  } catch {
    throw new Error(`untracked or unresolved git blob identity: ${repositoryPath}`)
  }
}
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

function evaluateVectorSemantics(vector: J): void {
  const expected = vector.expected as J
  const baseline = expected.baseline_verification as J
  const challenged = expected.challenged_verification as J
  assert(expected.challenged_must_equal_baseline === false, "challenged must differ from baseline")
  assert(JSON.stringify(baseline) !== JSON.stringify(challenged), "verification difference")
  assert(expected.integrity_mismatch_cannot_retain_validity === true, "integrity mismatch")
  assert(expected.anchor_receipt_root_unchanged === true, "anchor root unchanged")
  assert(expected.recomputed_root_must_differ_from_anchor_root === true, "recomputed differs")
  assert(expected.challenged_ok_must_be_false === true, "challenged ok false")
  assert(expected.non_throwing === true, "non throwing")
  assert(baseline.ok === true && baseline.receipt_root === baseline.recomputed_root, "baseline validity")
  assert(challenged.ok === false, "challenged invalid")
  assert(challenged.receipt_root === baseline.receipt_root, "pinned anchor root retained")
  assert(challenged.recomputed_root !== challenged.receipt_root, "roots mismatch")
  assert(challenged.receipt_root !== null && challenged.recomputed_root !== null, "non-null roots")
  const mutation = vector.mutation as J
  assert(mutation.operation === "set" && JSON.stringify(mutation.path) === '["task","title"]', "mutation")
  const classification = vector.field_classification as J
  assert(JSON.stringify(classification.decisive_receipt_body_fields) === '["task.title"]', "decisive field")
  assert(JSON.stringify(classification.required_comparison_operand) === '["anchor.receipt_root"]', "comparison operand")
  assert(JSON.stringify(classification.excluded_from_recomputation) === '["anchor"]', "anchor excluded")
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

  const vector = readJson(`${PACKAGE}/vectors/V-INTEGRITY-MISMATCH.json`)
  evaluateVectorSemantics(vector)
  const resultRow = `V-INTEGRITY-MISMATCH\t${shaBytes(Buffer.from(canonicalExpected(vector.expected), "utf8"))}\n`
  const resultHash = shaBytes(Buffer.from(resultRow, "utf8"))
  assert(resultHash === contract.expected_result_set_sha256, "expected-result-set digest")

  const fixturePath = String((vector.source_fixture as J).repository_path)
  assert(gitIndexBlobOid(fixturePath) === (vector.source_fixture as J).git_blob_oid, "source fixture identity")
  assert(
    gitIndexBlobOid(String((vector.subject_verifier as J).module_path)) ===
      (vector.subject_verifier as J).git_blob_oid,
    "subject verifier identity",
  )
  const profile = vector.receipt_root_profile as J
  assert(
    gitIndexBlobOid(String(profile.receipt_root_module_path)) === profile.receipt_root_module_git_blob_oid,
    "receipt-root module identity",
  )
  assert(
    gitIndexBlobOid(String(profile.canonicalization_module_path)) === profile.canonicalization_module_git_blob_oid,
    "canonicalization module identity",
  )

  return {
    auditor: "typescript-independent-verifier-challenge-integrity-mismatch-rejected-v0",
    mode: "read-only-filesystem",
    vector_count: 1,
    package_inventory_count: files.length,
    fixture_set_sha256: manifest.fixture_set_sha256,
    expected_result_set_sha256: resultHash,
    execution_class_counts: { "production-verifier-binding": 1 },
    independence_scope: contract.independence_scope,
    production_imports: 0,
  }
}

if (import.meta.main) console.log(JSON.stringify(auditPackage(), null, 2))
