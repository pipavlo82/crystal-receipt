/** Independent verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0 package audit. No production imports. */
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE = "conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0"

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

function findFixtureVector(fixture: J, name: string): J {
  const vectors = fixture.vectors as J[]
  const match = vectors.find((vector) => vector.name === name)
  if (!match) throw new Error(`fixture vector not found: ${name}`)
  return match
}

function evaluateVectorSemantics(vector: J): void {
  const expected = vector.expected as J
  const baselineContinuity = expected.baseline_continuity as J
  const challengedContinuity = expected.challenged_continuity as J

  assert(expected.baseline_evaluation_state === "evaluated", "baseline evaluation state")
  assert(expected.baseline_verdict === "valid", "baseline verdict")
  assert(expected.baseline_relation === "successor", "baseline relation")
  assert(expected.baseline_reason_code === "direct_successor", "baseline reason code")
  assert(expected.challenged_evaluation_state === "evaluated", "challenged evaluation state")
  assert(expected.challenged_verdict === "invalid", "challenged verdict")
  assert(expected.challenged_relation === null, "challenged relation")
  assert(expected.challenged_reason_code === "predecessor_ref_mismatch", "challenged reason code")
  assert(expected.current_checkpoint_unchanged === true, "current unchanged")
  assert(expected.baseline_predecessor_locally_valid === true, "baseline predecessor valid")
  assert(expected.challenged_predecessor_locally_valid === true, "challenged predecessor valid")
  assert(expected.current_checkpoint_locally_valid === true, "current valid")
  assert(expected.predecessor_argument_changed_only === true, "predecessor only change")
  assert(expected.predecessor_ref_mismatch_blocks_continuity === true, "ref mismatch blocks")
  assert(expected.sequence_gate_not_first_failure === true, "sequence not first failure")
  assert(expected.non_throwing === true, "non throwing")

  assert(JSON.stringify(baselineContinuity) === JSON.stringify({
    evaluation_state: "evaluated",
    verdict: "valid",
    relation: "successor",
    reason_code: "direct_successor",
  }), "baseline continuity tuple")
  assert(JSON.stringify(challengedContinuity) === JSON.stringify({
    evaluation_state: "evaluated",
    verdict: "invalid",
    relation: null,
    reason_code: "predecessor_ref_mismatch",
  }), "challenged continuity tuple")

  const profile = vector.continuity_profile as J
  assert(profile.challenged_first_failure_gate === "predecessor_ref_mismatch", "first failure gate")

  const classification = vector.field_classification as J
  assert(classification.predecessor_argument_changed_only === true, "argument changed only")
  assert(classification.current_checkpoint_unchanged === true, "current unchanged flag")
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

  const vector = readJson(`${PACKAGE}/vectors/V-CHRONICLE-PREDECESSOR-REF-MISMATCH.json`)
  assert(vector.execution_class === "production-continuity-binding", "execution class")
  evaluateVectorSemantics(vector)
  const resultRow = `V-CHRONICLE-PREDECESSOR-REF-MISMATCH\t${shaBytes(Buffer.from(canonicalExpected(vector.expected), "utf8"))}\n`
  const resultHash = shaBytes(Buffer.from(resultRow, "utf8"))
  assert(resultHash === contract.expected_result_set_sha256, "expected-result-set digest")

  const sourceFixture = vector.source_fixture as J
  assert(gitIndexBlobOid(String(sourceFixture.repository_path)) === sourceFixture.git_blob_oid, "source fixture identity")
  assert(
    gitIndexBlobOid(String((vector.subject_continuity_evaluator as J).module_path)) ===
      (vector.subject_continuity_evaluator as J).git_blob_oid,
    "subject continuity evaluator identity",
  )
  assert(
    gitIndexBlobOid(String((vector.local_checkpoint_verifier as J).module_path)) ===
      (vector.local_checkpoint_verifier as J).git_blob_oid,
    "local checkpoint verifier identity",
  )
  const profile = vector.continuity_profile as J
  assert(
    gitIndexBlobOid(String(profile.normative_spec_path)) === profile.normative_spec_git_blob_oid,
    "normative spec identity",
  )

  const fixture = readJson(String(sourceFixture.repository_path))
  const baselineVector = findFixtureVector(fixture, String(sourceFixture.baseline_vector_name))
  const precedentVector = findFixtureVector(fixture, String(sourceFixture.precedent_vector_name))
  const baselinePair = vector.baseline_pair as J
  const challengedPair = vector.challenged_pair as J

  assert(JSON.stringify(baselinePair.current) === JSON.stringify(baselineVector.current), "baseline current")
  assert(JSON.stringify(baselinePair.predecessor) === JSON.stringify(baselineVector.predecessor), "baseline predecessor")
  assert(JSON.stringify(challengedPair.current) === JSON.stringify(baselineVector.current), "challenged current")
  assert(JSON.stringify(challengedPair.predecessor) === JSON.stringify(precedentVector.predecessor), "challenged predecessor")
  assert(JSON.stringify(baselinePair.current) === JSON.stringify(challengedPair.current), "current unchanged")
  assert(JSON.stringify(baselinePair.predecessor) !== JSON.stringify(challengedPair.predecessor), "predecessor changed")

  const current = baselinePair.current as J
  const challengedPredecessor = challengedPair.predecessor as J
  assert(current.prev_checkpoint !== challengedPredecessor.checkpoint_root, "ref mismatch")
  assert(current.prev_checkpoint === (baselinePair.predecessor as J).checkpoint_root, "baseline ref match")

  const controls = vector.local_verification_controls as J
  for (const key of ["current", "baseline_predecessor", "challenged_predecessor"]) {
    const control = controls[key] as J
    assert(control.ok === true, `${key} ok`)
    assert(control.checkpoint_root === control.recomputed_checkpoint_root, `${key} roots match`)
  }

  if (Number(challengedPredecessor.sequence) === Number(current.sequence) - 1) {
    assert(profile.challenged_first_failure_gate === "predecessor_ref_mismatch", "sequence downstream")
  }

  return {
    auditor: "typescript-independent-verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0",
    mode: "read-only-filesystem",
    vector_count: 1,
    package_inventory_count: files.length,
    fixture_set_sha256: manifest.fixture_set_sha256,
    expected_result_set_sha256: resultHash,
    execution_class_counts: { "production-continuity-binding": 1 },
    independence_scope: contract.independence_scope,
    production_imports: 0,
  }
}

if (import.meta.main) console.log(JSON.stringify(auditPackage(), null, 2))
