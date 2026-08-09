/** Independent counterfactual-conformance-v0 umbrella audit. No production imports. */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE = "conformance/counterfactual-conformance-v0"
const PINNED_DCN_SHA256 = "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d"
const EXPECTED_CHILD_IDENTITY_SET_SHA256 =
  "7bbe7e02247e4177af954b83f7b2c4a982f6f1ef3806e623b2d847aa3089be47"
const EXPECTED_FIXTURE_SET_SHA256 = "264870b880e3b37ff8f0d9bdbaa9a4f64242e92f6485316477d32bbf9b81904a"
const EXPECTED_VECTOR_IDS = [
  "V-OBSERVED-NOT-VALIDATED",
  "V-MISSING-REQUIRED-INPUT",
  "V-INTEGRITY-MISMATCH",
  "V-CHRONICLE-PROOF-ROOT-MISMATCH",
  "V-CHRONICLE-PREDECESSOR-UNKNOWN",
  "V-CHRONICLE-SEQUENCE-GAP",
  "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
  "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
  "V-AT-NEST-OBJ",
  "V-MAN-HASH-DIFF",
] as const
const CHILD_IDENTITY_FIELDS = [
  "ordinal",
  "challenge_id",
  "package_path",
  "package_version",
  "vector_id",
  "surface",
  "vector_path",
  "execution_class",
  "fixture_set_sha256",
  "expected_result_set_sha256",
] as const
const CLOSED_INVENTORY = new Set([
  "SPEC.md",
  "contract.json",
  "manifest.json",
  "dcn/neighborhood.json",
  "generate_package.ts",
  "verify_independent.py",
  "audit_package.ts",
])

type J = Record<string, unknown>
const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message)
}

const shaBytes = (bytes: Uint8Array | Buffer) => createHash("sha256").update(bytes).digest("hex")
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
  shaBytes(
    Buffer.from(
      canonicalJson(
        children.map((child) => {
          const record: J = {}
          for (const field of CHILD_IDENTITY_FIELDS) record[field] = child[field]
          return record
        }),
      ),
      "utf8",
    ),
  )

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
  const vector = readJson(String(child.vector_path))
  assert(vector.vector_id === child.vector_id, "vector_id")
  assert(vector.package_version === child.package_version, "package_version")
}

function listFilesRecursive(dir: string, base = dir): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const absolute = join(dir, entry)
    if (statSync(absolute).isDirectory()) {
      out.push(...listFilesRecursive(absolute, base))
    } else {
      out.push(relative(base, absolute).replace(/\\/g, "/"))
    }
  }
  return out
}

export function auditPackage(): J {
  const manifest = readJson(`${PACKAGE}/manifest.json`)
  const contract = readJson(`${PACKAGE}/contract.json`)
  const files = manifest.files as J[]
  assert(manifest.file_count === files.length, "manifest inventory")
  const paths = files.map((file) => String(file.path))
  assert(
    JSON.stringify(paths) === JSON.stringify([...paths].sort((a, b) => Buffer.from(a).compare(Buffer.from(b)))),
    "path order",
  )

  const rows: string[] = []
  for (const file of files) {
    const actual = shaBytes(readBytes(String(file.path)))
    assert(actual === file.sha256, `file digest ${String(file.path)}`)
    rows.push(`${String(file.path)}\t${actual}\n`)
  }
  const fixtureHash = shaBytes(Buffer.from(rows.join(""), "utf8"))
  assert(fixtureHash === manifest.fixture_set_sha256, "fixture-set digest")
  assert(fixtureHash === EXPECTED_FIXTURE_SET_SHA256, "pinned fixture digest")
  assert(manifest.dcn_sha256 === PINNED_DCN_SHA256, "manifest dcn pin")

  assert(contract.package_id === "counterfactual-conformance-v0", "package_id")
  assert(contract.version === "v0", "version")

  const children = contract.children as J[]
  assert(children.length === 10, "child count")
  for (let index = 0; index < children.length; index++) {
    const child = children[index]!
    assert(child.ordinal === index + 1, `child ordinal ${index + 1}`)
    assert(child.vector_id === EXPECTED_VECTOR_IDS[index], `child vector ${index + 1}`)
    verifyChildPackage(child)
  }

  const aggregate = contract.aggregate as J
  const identityHash = childIdentitySetSha256(children)
  assert(identityHash === aggregate.child_identity_set_sha256, "child identity set digest")
  assert(identityHash === EXPECTED_CHILD_IDENTITY_SET_SHA256, "pinned child identity digest")

  const neighborhood = readJson(`${PACKAGE}/dcn/neighborhood.json`)
  assert(neighborhood.schema === "receiptos.counterfactual_neighborhood.v0", "dcn schema")
  const dcnSha = shaBytes(Buffer.from(canonicalJson(neighborhood), "utf8"))
  assert(dcnSha === PINNED_DCN_SHA256, "dcn digest")

  const onDisk = new Set(listFilesRecursive(resolve(ROOT, PACKAGE)))
  for (const path of onDisk) assert(CLOSED_INVENTORY.has(path), `unexpected ${path}`)
  for (const path of CLOSED_INVENTORY) assert(onDisk.has(path), `missing ${path}`)

  return {
    auditor: "typescript-independent-counterfactual-conformance-v0",
    mode: "read-only-filesystem",
    package_id: contract.package_id,
    child_count: children.length,
    package_inventory_count: files.length,
    fixture_set_sha256: fixtureHash,
    child_identity_set_sha256: identityHash,
    dcn_sha256: dcnSha,
    production_imports: 0,
  }
}

if (import.meta.main) console.log(JSON.stringify(auditPackage(), null, 2))
