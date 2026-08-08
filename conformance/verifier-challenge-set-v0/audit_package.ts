/** Independent verifier-challenge-set-v0 aggregate index audit. No production imports. */
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE = "conformance/verifier-challenge-set-v0"

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

const canonicalJson = (value: unknown): string => {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`
  }
  throw new Error(`non-canonical json value: ${typeof value}`)
}

const childIdentitySetSha256 = (children: J[]) =>
  shaBytes(Buffer.from(canonicalJson(children), "utf8"))

function verifyChildPackage(child: J): void {
  const packagePath = String(child.package_path)
  assert(existsSync(resolve(ROOT, packagePath)), `missing child package ${packagePath}`)
  const manifest = readJson(`${packagePath}/manifest.json`)
  const contract = readJson(`${packagePath}/contract.json`)
  assert(manifest.fixture_set_sha256 === child.fixture_set_sha256, `${packagePath} fixture digest`)
  assert(
    contract.expected_result_set_sha256 === child.expected_result_set_sha256,
    `${packagePath} expected-result digest`,
  )
  assert(child.vector_count === 1, `${packagePath} vector_count`)
  assert(child.execution_class === "production-verifier-binding", `${packagePath} execution_class`)
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

  assert(contract.set_id === "verifier-challenge-set-v0", "set_id")
  assert(contract.version === "v0", "version")

  const subjectVerifier = contract.subject_verifier as J
  assert(subjectVerifier.entrypoint === "verifyHandoffReceiptRoot", "subject entrypoint")
  assert(
    gitIndexBlobOid(String(subjectVerifier.module_path)) === subjectVerifier.git_blob_oid,
    "subject verifier identity",
  )

  const children = contract.children as J[]
  assert(children.length === 3, "child count")
  const expectedOrder = [
    "observed_not_validated",
    "missing_required_input_unverifiable",
    "integrity_mismatch_rejected",
  ]
  for (let index = 0; index < children.length; index++) {
    const child = children[index]!
    assert(child.ordinal === index + 1, `child ordinal ${index + 1}`)
    assert(child.challenge_id === expectedOrder[index], `child challenge_id ${index + 1}`)
    verifyChildPackage(child)
  }

  const aggregate = contract.aggregate as J
  assert(aggregate.child_count === 3, "aggregate child_count")
  assert(aggregate.vector_count === 3, "aggregate vector_count")
  assert(
    JSON.stringify(aggregate.execution_class_counts) ===
      JSON.stringify({ "production-verifier-binding": 3 }),
    "aggregate execution_class_counts",
  )

  const identityHash = childIdentitySetSha256(children)
  assert(identityHash === aggregate.child_identity_set_sha256, "child identity set digest")

  return {
    auditor: "typescript-independent-verifier-challenge-set-v0",
    mode: "read-only-filesystem",
    set_id: contract.set_id,
    child_count: children.length,
    vector_count: aggregate.vector_count,
    package_inventory_count: files.length,
    fixture_set_sha256: manifest.fixture_set_sha256,
    child_identity_set_sha256: identityHash,
    execution_class_counts: aggregate.execution_class_counts,
    independence_scope: contract.independence_scope,
    production_imports: 0,
  }
}

if (import.meta.main) console.log(JSON.stringify(auditPackage(), null, 2))
