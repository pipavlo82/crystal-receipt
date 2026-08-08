/** Independent verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0 package audit. No production imports. */
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE = "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0"
const VECTOR_ID = "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH"

const BASELINE_ROOT = "sha256:32423e924c8f5e540bf7a36e2e2f969eb07e537885688e1affda37b5be808e87"
const CHALLENGED_ROOT = "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

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

const sortEntryRefs = (entryRefs: string[]) =>
  [...entryRefs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

function evaluateVectorSemantics(vector: J): void {
  const expected = vector.expected as J
  const baselineVerification = expected.baseline_verification as J
  const challengedVerification = expected.challenged_verification as J

  assert(expected.baseline_local_verification_ok === true, "baseline ok")
  assert(expected.challenged_local_verification_ok === false, "challenged ok")
  assert(expected.baseline_entry_refs_canonical === true, "baseline canonical")
  assert(expected.challenged_entry_refs_canonical === true, "challenged canonical")
  assert(expected.semantic_fields_unchanged === true, "semantic unchanged")
  assert(expected.checkpoint_root_changed_only === true, "root only")
  assert(expected.baseline_root_matches === true, "baseline root matches")
  assert(expected.challenged_root_matches === false, "challenged root mismatch")
  assert(expected.challenged_recomputed_root_equals_baseline === true, "recomputed baseline")
  assert(expected.challenged_stored_root_differs_from_recomputed === true, "stored differs")
  assert(expected.non_throwing === true, "non throwing")

  assert(JSON.stringify(baselineVerification) === JSON.stringify({
    ok: true,
    checkpoint_root: BASELINE_ROOT,
    recomputed_checkpoint_root: BASELINE_ROOT,
  }), "baseline verification")
  assert(JSON.stringify(challengedVerification) === JSON.stringify({
    ok: false,
    checkpoint_root: CHALLENGED_ROOT,
    recomputed_checkpoint_root: BASELINE_ROOT,
  }), "challenged verification")

  const baseline = vector.baseline_checkpoint as J
  const challenged = vector.challenged_checkpoint as J
  const substitution = vector.substitution as J
  const baselineRefs = baseline.entry_refs as string[]
  const challengedRefs = challenged.entry_refs as string[]

  assert(JSON.stringify(baselineRefs) === JSON.stringify(challengedRefs), "entry refs identical")
  assert(baseline.checkpoint_root === substitution.baseline_checkpoint_root, "baseline root")
  assert(challenged.checkpoint_root === substitution.challenged_checkpoint_root, "challenged root")
  assert(baseline.checkpoint_root !== challenged.checkpoint_root, "root changed")

  const canonicalBaseline = sortEntryRefs(baselineRefs)
  const canonicalChallenged = sortEntryRefs(challengedRefs)
  assert(JSON.stringify(baselineRefs) === JSON.stringify(canonicalBaseline), "baseline canonical")
  assert(JSON.stringify(challengedRefs) === JSON.stringify(canonicalChallenged), "challenged canonical")

  for (const field of substitution.unchanged_fields as string[]) {
    assert(JSON.stringify(baseline[field]) === JSON.stringify(challenged[field]), field)
  }

  const rootControl = vector.root_integrity_control as J
  assert(rootControl.baseline_root === BASELINE_ROOT, "control baseline root")
  assert(rootControl.challenged_stored_root === CHALLENGED_ROOT, "control challenged root")
  assert(rootControl.baseline_root_matches === true, "control baseline matches")
  assert(rootControl.challenged_root_matches === false, "control challenged mismatch")
  assert(rootControl.challenged_recomputed_root_equals_baseline === true, "control recomputed baseline")

  const profile = vector.local_verification_profile as J
  assert(profile.ok_requires_both === true, "ok requires both")
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

  const vector = readJson(`${PACKAGE}/vectors/${VECTOR_ID}.json`)
  assert(vector.execution_class === "production-checkpoint-local-binding", "execution class")
  evaluateVectorSemantics(vector)
  const resultRow = `${VECTOR_ID}\t${shaBytes(Buffer.from(canonicalExpected(vector.expected), "utf8"))}\n`
  const resultHash = shaBytes(Buffer.from(resultRow, "utf8"))
  assert(resultHash === contract.expected_result_set_sha256, "expected-result-set digest")

  const subject = vector.subject_local_checkpoint_verifier as J
  assert(gitIndexBlobOid(String(subject.module_path)) === subject.git_blob_oid, "subject identity")
  const construction = vector.checkpoint_construction_authority as J
  assert(gitIndexBlobOid(String(construction.module_path)) === construction.git_blob_oid, "construction identity")
  const profile = vector.local_verification_profile as J
  assert(gitIndexBlobOid(String(profile.normative_spec_path)) === profile.normative_spec_git_blob_oid, "normative spec")
  const contractVerifier = contract.local_checkpoint_verifier as J
  assert(gitIndexBlobOid(String(contractVerifier.module_path)) === contractVerifier.git_blob_oid, "contract verifier")
  const normative = contract.normative_spec_identity as J
  assert(gitIndexBlobOid(String(normative.repository_path)) === normative.git_blob_oid, "contract normative spec")

  return {
    auditor: "typescript-independent-verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0",
    mode: "read-only-filesystem",
    vector_count: 1,
    package_inventory_count: files.length,
    fixture_set_sha256: manifest.fixture_set_sha256,
    expected_result_set_sha256: resultHash,
    execution_class_counts: { "production-checkpoint-local-binding": 1 },
    independence_scope: contract.independence_scope,
    production_imports: 0,
  }
}

if (import.meta.main) console.log(JSON.stringify(auditPackage(), null, 2))
