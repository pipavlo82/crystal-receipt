/** Independent verifier-challenge-chronicle-sequence-gap-rejected-v0 package audit. No production imports. */
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE = "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0"

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
  assert(expected.challenged_reason_code === "sequence_gap", "challenged reason code")
  assert(expected.baseline_current_locally_valid === true, "baseline current valid")
  assert(expected.challenged_current_locally_valid === true, "challenged current valid")
  assert(expected.predecessor_locally_valid === true, "predecessor valid")
  assert(expected.predecessor_unchanged === true, "predecessor unchanged")
  assert(expected.current_argument_changed_only === true, "current only change")
  assert(expected.challenged_predecessor_ref_matches === true, "ref match")
  assert(expected.sequence_adjacency_fails === true, "adjacency fails")
  assert(expected.sequence_gap_blocks_continuity === true, "gap blocks")
  assert(expected.predecessor_ref_gate_passes === true, "ref gate passes")
  assert(expected.sequence_gate_is_first_classifying_failure === true, "sequence first failure")
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
    reason_code: "sequence_gap",
  }), "challenged continuity tuple")

  const profile = vector.continuity_profile as J
  assert(profile.challenged_first_classifying_gate === "sequence_gap", "first classifying gate")

  const classification = vector.field_classification as J
  assert(classification.current_argument_changed_only === true, "current changed only")
  assert(classification.predecessor_unchanged === true, "predecessor unchanged flag")
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

  const vector = readJson(`${PACKAGE}/vectors/V-CHRONICLE-SEQUENCE-GAP.json`)
  assert(vector.execution_class === "production-continuity-binding", "execution class")
  evaluateVectorSemantics(vector)
  const resultRow = `V-CHRONICLE-SEQUENCE-GAP\t${shaBytes(Buffer.from(canonicalExpected(vector.expected), "utf8"))}\n`
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
  assert(JSON.stringify(challengedPair.current) === JSON.stringify(precedentVector.current), "challenged current")
  assert(JSON.stringify(challengedPair.predecessor) === JSON.stringify(baselineVector.predecessor), "predecessor unchanged")
  assert(JSON.stringify(baselinePair.predecessor) === JSON.stringify(challengedPair.predecessor), "predecessor identical")
  assert(JSON.stringify(baselinePair.current) !== JSON.stringify(challengedPair.current), "current changed")

  const challengedCurrent = challengedPair.current as J
  const predecessor = baselinePair.predecessor as J
  assert(challengedCurrent.prev_checkpoint === predecessor.checkpoint_root, "ref match")
  assert(Number(predecessor.sequence) < Number(challengedCurrent.sequence) - 1, "sequence gap")

  const refControl = vector.reference_binding_control as J
  assert(refControl.challenged_ref_matches === true, "ref control")
  assert(refControl.challenged_prev_checkpoint === predecessor.checkpoint_root, "prev checkpoint")

  const seqControl = vector.sequence_relation_control as J
  assert(seqControl.sequence_adjacency_fails === true, "adjacency control")

  const controls = vector.local_verification_controls as J
  for (const key of ["baseline_current", "challenged_current", "predecessor"]) {
    const control = controls[key] as J
    assert(control.ok === true, `${key} ok`)
    assert(control.checkpoint_root === control.recomputed_checkpoint_root, `${key} roots match`)
  }

  return {
    auditor: "typescript-independent-verifier-challenge-chronicle-sequence-gap-rejected-v0",
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
