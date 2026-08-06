/** Independent RSF fixture audit. No ReceiptOS or future evaluator imports. */
import { createHash } from "node:crypto"
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE = join(ROOT, "tests/fixtures/recursive-singleton-fold-v0")

function quote(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

export function canonical(value: unknown): string {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "string") return quote(value)
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort((a, b) => Buffer.from(a, "utf16le").swap16().compare(Buffer.from(b, "utf16le").swap16()))
    return `{${keys.map(key => `${quote(key)}:${canonical(record[key])}`).join(",")}}`
  }
  throw new Error(`non-canonical JSON value: ${typeof value}`)
}

function shaBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}
function digest(value: unknown): string { return `sha256:${shaBytes(Buffer.from(canonical(value), "utf8"))}` }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message) }

const EXPECTED: Record<string, [string, string | null, number | null]> = {
  "V-OK":["evaluated",null,null], "V-18M":["malformed","malformed_rsf_stage_input",18],
  "V-18P":["evaluated","singleton_policy_ineligible",18], "V-19":["evaluated","singleton_class_ineligible",19],
  "V-20A":["evaluated","semantic_statement_mismatch",20], "V-20B":["evaluated","semantic_result_commitment_mismatch",20],
  "V-21A":["evaluated","inclusion_set_mismatch",21], "V-21B":["evaluated","inclusion_set_commitment_mismatch",21],
  "V-22":["evaluated","forbidden_source_identity_reuse",22], "V-23A":["evaluated","semantic_result_commitment_mismatch",23],
  "V-23B":["evaluated","semantic_result_commitment_mismatch",23], "V-23C":["evaluated","semantic_result_commitment_mismatch",23],
  "V-24":["evaluated","no_elevation_invariant_mismatch",24], "V-25":["evaluated","transition_result_mismatch",25],
  "V-26A":["evaluated","breakdown_mismatch",26], "V-26B":["evaluated","breakdown_commitment_mismatch",26],
  "V-27":["evaluated","aggregate_id_mismatch",27], "V-28A1":["evaluated","source_entry_content_commitment_mismatch",28],
  "V-28A2":["evaluated","source_entry_content_commitment_mismatch",28], "V-28B":["evaluated","complete_aggregate_validation_mismatch",28],
  "V-ORDER":["evaluated","semantic_statement_mismatch",20], "V-ADM":["evaluated","singleton_policy_ineligible",18],
  "V-TIME":["evaluated","singleton_class_ineligible",19], "V-LABEL":["evaluated","no_elevation_invariant_mismatch",24],
  "V-NOPROOF":["malformed","malformed_rsf_stage_input",18], "V-UNVER":["unverifiable","source_admission_prerequisite_unavailable",8],
  "V-MAL-REJ":["malformed","malformed_rsf_stage_input",18], "V-INSERT":["evaluated",null,null],
  "V-ESCAPE":["evaluated",null,null], "V-SCALAR":["evaluated","complete_aggregate_validation_mismatch",28],
  "V-GIT":["not_invoked",null,null], "V-MUTATE":["evaluated",null,null],
  "V-REPLAY":["evaluated",null,null], "V-FALL":["evaluated","no_elevation_invariant_mismatch",24]
}

export function auditPackage(useBytes = (path: string) => readFileSync(join(PACKAGE, path))): Record<string, unknown> {
  const manifest = JSON.parse(useBytes("manifest.json").toString("utf8"))
  assert(manifest.schema === "recursive_singleton_fold_fixture_manifest.v0", "manifest schema")
  assert(manifest.files.length === 35 && manifest.file_count === 35, "manifest file count")
  const paths = manifest.files.map((f: any) => f.path)
  assert(JSON.stringify(paths) === JSON.stringify([...paths].sort((a,b)=>Buffer.from(a).compare(Buffer.from(b)))), "UTF-8 path order")
  const rows: string[] = []
  for (const file of manifest.files) {
    const actual = shaBytes(useBytes(file.path))
    assert(actual === file.sha256, `file digest ${file.path}`)
    rows.push(`${file.path}\t${actual}\n`)
  }
  assert(shaBytes(Buffer.from(rows.join(""), "utf8")) === manifest.fixture_set_sha256, "fixture-set digest")
  const names = readdirSync(join(PACKAGE,"vectors")).filter(x=>x.endsWith(".json")).map(x=>x.slice(0,-5)).sort()
  assert(names.length === 34 && JSON.stringify(names) === JSON.stringify(Object.keys(EXPECTED).sort()), "exact 34-case inventory")
  for (const name of names) {
    const vector = JSON.parse(useBytes(`vectors/${name}.json`).toString("utf8"))
    const [state, code, pos] = EXPECTED[name]
    assert(vector.case_id === name && vector.expected_state === state, `${name} state`)
    assert(vector.expected_code === code && vector.expected_check_position === pos, `${name} finding`)
    if (code !== null) assert(vector.expected_evaluation.aggregate === null, `${name} failure aggregate must be null`)
  }
  const ok = JSON.parse(useBytes("vectors/V-OK.json").toString("utf8"))
  const a = ok.stage_input.candidate_aggregate
  assert(digest(ok.prefix_continuation.sourceEntry) === a.source_entry_content_commitment, "source commitment")
  assert(digest(a.semantic_statement) === a.semantic_result_commitment, "semantic commitment")
  assert(digest(a.canonical_inclusion_set) === a.inclusion_set_commitment, "inclusion commitment")
  assert(digest(a.fold_policy_declaration) === a.fold_policy_commitment, "policy commitment")
  assert(digest(a.comparability_class_declaration) === a.comparability_class_commitment, "class commitment")
  assert(digest(a.transition_rule_declaration) === a.transition_rule_commitment, "rule commitment")
  assert(digest(a.pre_aggregation_breakdown) === a.pre_aggregation_breakdown_commitment, "breakdown commitment")
  const seed = {schema:"recursive_singleton_aggregate_identity_seed.v0",aggregate_schema:a.schema,profile_version:a.profile_version,
    source_entry_ref:a.source_entry_ref,source_entry_content_commitment:a.source_entry_content_commitment,
    semantic_result_commitment:a.semantic_result_commitment,inclusion_set_commitment:a.inclusion_set_commitment,
    fold_policy_commitment:a.fold_policy_commitment,comparability_class_commitment:a.comparability_class_commitment,
    transition_rule_commitment:a.transition_rule_commitment,pre_aggregation_breakdown_commitment:a.pre_aggregation_breakdown_commitment}
  assert(digest(seed) === a.aggregate_id, "aggregate ID")
  return {auditor:"typescript-independent-rsf-v0",vector_count:names.length,fixture_set_sha256:manifest.fixture_set_sha256,
    commitment_checks:8,classification_checks:names.length,production_imports:0}
}

if (import.meta.main) {
  const result = auditPackage()
  writeFileSync(join(HERE,"typescript-audit-output.json"), JSON.stringify(result,null,2)+"\n")
  console.log(JSON.stringify(result))
}
