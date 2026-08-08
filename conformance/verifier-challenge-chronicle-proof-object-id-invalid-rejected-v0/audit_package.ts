/** Independent verifier-challenge-chronicle-proof-object-id-invalid-rejected-v0 package audit. No production imports. */
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE = "conformance/verifier-challenge-chronicle-proof-object-id-invalid-rejected-v0"

const VERIFIED_ROOT = "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc"
const CANONICAL_ID = "proofobj-687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc"

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

const deriveProofObjectId = (receiptRoot: string) => `proofobj-${receiptRoot.replace(/^0x/, "")}`

function evaluateVectorSemantics(vector: J): void {
  const expected = vector.expected as J
  const baselineAdmission = expected.baseline_admission as J
  const challengedAdmission = expected.challenged_admission as J
  const receiptRootControl = expected.receipt_root_control as J

  assert(expected.baseline_admitted === true, "baseline admitted")
  assert(expected.challenged_admitted === false, "challenged rejected")
  assert(expected.evidence_receipt_verification_unchanged === true, "evidence unchanged")
  assert(expected.evidence_receipt_verification_ok === true, "receipt root ok")
  assert(expected.proof_object_receipt_root_unchanged === true, "receipt root unchanged")
  assert(expected.proof_object_id_changed_only === true, "single field mutation")
  assert(expected.cross_object_gates_pass === true, "cross object gates pass")
  assert(expected.reported_state_gates_pass === true, "reported state gates pass")
  assert(expected.identity_binding_blocks_admission === true, "identity blocks")
  assert(expected.failure_class_exact === "identity_inconsistency", "failure class")
  assert(expected.reason_code_exact === "proof_object_id_invalid", "reason code")
  assert(expected.non_throwing === true, "non throwing")

  assert(baselineAdmission.success === true, "baseline success")
  assert((baselineAdmission.value as J).schema === "chronicle_entry.v0", "entry schema")
  assert(challengedAdmission.success === false, "challenged failure")
  assert((challengedAdmission.failure as J).failure_class === "identity_inconsistency", "challenged failure class")
  assert((challengedAdmission.failure as J).reason_code === "proof_object_id_invalid", "challenged reason code")

  assert(receiptRootControl.ok === true, "control ok")
  assert(receiptRootControl.receipt_root === receiptRootControl.recomputed_root, "control roots match")
  assert(receiptRootControl.receipt_root === VERIFIED_ROOT, "verified root")

  const mutation = vector.mutation as J
  assert(mutation.operation === "set", "mutation operation")
  assert(JSON.stringify(mutation.path) === '["proof_object","proof_object_id"]', "mutation path")
  assert(mutation.from === CANONICAL_ID, "mutation from")
  assert(mutation.to === "proofobj-invalid", "mutation to")

  const identity = vector.identity_derivation_authority as J
  assert(identity.entrypoint === "deriveProofObjectId", "identity entrypoint")
  assert((vector.baseline_input as J).canonical_proof_object_id === CANONICAL_ID, "canonical id")
  assert(deriveProofObjectId(VERIFIED_ROOT) === CANONICAL_ID, "derivation rule")

  const profile = vector.admission_profile as J
  assert(profile.challenged_first_failure_gate === "proof_object_id_invalid", "first failure gate")

  const classification = vector.field_classification as J
  assert(classification.unchanged_handoff_evidence === true, "evidence unchanged flag")
  assert(classification.unchanged_proof_object_receipt_root === true, "proof root unchanged flag")
  assert(JSON.stringify(classification.identity_admission_binding) === '["proof_object.proof_object_id"]', "binding field")
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

  const vector = readJson(`${PACKAGE}/vectors/V-CHRONICLE-PROOF-OBJECT-ID-INVALID.json`)
  assert(vector.execution_class === "production-admission-binding", "execution class")
  evaluateVectorSemantics(vector)
  const resultRow = `V-CHRONICLE-PROOF-OBJECT-ID-INVALID\t${shaBytes(Buffer.from(canonicalExpected(vector.expected), "utf8"))}\n`
  const resultHash = shaBytes(Buffer.from(resultRow, "utf8"))
  assert(resultHash === contract.expected_result_set_sha256, "expected-result-set digest")

  const fixturePath = String((vector.source_fixture as J).repository_path)
  assert(gitIndexBlobOid(fixturePath) === (vector.source_fixture as J).git_blob_oid, "source fixture identity")
  assert(
    gitIndexBlobOid(String((vector.subject_admission_verifier as J).module_path)) ===
      (vector.subject_admission_verifier as J).git_blob_oid,
    "subject admission verifier identity",
  )
  assert(
    gitIndexBlobOid(String((vector.identity_derivation_authority as J).module_path)) ===
      (vector.identity_derivation_authority as J).git_blob_oid,
    "identity derivation authority",
  )
  const profile = vector.admission_profile as J
  assert(
    gitIndexBlobOid(String(profile.receipt_root_recomputation_module_path)) ===
      profile.receipt_root_recomputation_module_git_blob_oid,
    "receipt-root module identity",
  )

  return {
    auditor: "typescript-independent-verifier-challenge-chronicle-proof-object-id-invalid-rejected-v0",
    mode: "read-only-filesystem",
    vector_count: 1,
    package_inventory_count: files.length,
    fixture_set_sha256: manifest.fixture_set_sha256,
    expected_result_set_sha256: resultHash,
    execution_class_counts: { "production-admission-binding": 1 },
    independence_scope: contract.independence_scope,
    production_imports: 0,
  }
}

if (import.meta.main) console.log(JSON.stringify(auditPackage(), null, 2))
