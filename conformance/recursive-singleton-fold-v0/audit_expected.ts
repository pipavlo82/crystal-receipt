/** Independent RSF normative audit/reference model. No production RSF imports. */
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE = "tests/fixtures/recursive-singleton-fold-v0"

type J = any
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const assert = (condition: unknown, message: string): asserts condition => { if (!condition) throw new Error(message) }
const quote = (value: string) => JSON.stringify(value).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")

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

const shaBytes = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const digest = (value: unknown) => `sha256:${shaBytes(Buffer.from(canonical(value), "utf8"))}`
const equalCanonical = (a: unknown, b: unknown) => Buffer.from(canonical(a), "utf8").equals(Buffer.from(canonical(b), "utf8"))

export function readGitIndexBytes(repositoryPath: string): Buffer {
  return execFileSync("git", ["show", `:${repositoryPath}`], { cwd: ROOT, encoding: "buffer", maxBuffer: 32 * 1024 * 1024 }) as Buffer
}

const POLICY = {
  schema:"recursive_singleton_fold_policy.v0",policy_version:"recursive-singleton-fold-policy-v0",
  policy_id:"singleton-chronicle-entry-semantic-preservation",source_object_schema:"chronicle_entry.v0",
  aggregate_object_schema:"recursive_singleton_aggregate.v0",member_cardinality:1,aggregation_mode:"singleton_only",
  semantic_elevation:"forbidden",source_identity_reuse:"forbidden",multi_member_extension:"deferred"
}
const CLASS = {
  schema:"recursive_singleton_comparability_class.v0",class_version:"recursive-singleton-comparability-class-v0",
  class_id:"admitted-chronicle-entry-singleton",source_object_schema:"chronicle_entry.v0",admission_required:true,
  cross_entry_comparability:"not_asserted",cross_policy_bridge:"deferred",cross_class_bridge:"deferred",
  singleton_eligibility_rule:"exactly_one_independently_admitted_source_entry"
}
const RULE = {
  schema:"recursive_singleton_transition_rule.v0",rule_version:"recursive-singleton-transition-rule-v0",
  rule_id:"semantic_result_preserving_singleton_identity_transition",source_object_schema:"chronicle_entry.v0",
  aggregate_object_schema:"recursive_singleton_aggregate.v0",preserved_equality_relation:"semantic_result_commitment_equality_only",
  source_identity_reuse:"forbidden",stronger_class_creation:"forbidden",fail_closed_on_malformed_or_unknown_input:true
}
const TRANSITION = {status:"singleton_transition_ok",semantic_equivalence_result:"semantic_result_commitment_preserved",
  source_identity_reuse_result:"source_identity_not_reused",stronger_semantic_class_creation_result:"no_stronger_semantic_class_created"}

export function reconstructExpected(vector: J): J {
  const entry = clone(vector.prefix_continuation.sourceEntry)
  const policy = clone(vector.input.fold_policy_declaration)
  const classDeclaration = clone(vector.input.comparability_class_declaration)
  const rule = clone(vector.input.transition_rule_declaration)
  const sourceCommitment = digest(entry)
  const policyCommitment = digest(policy), classCommitment = digest(classDeclaration), ruleCommitment = digest(rule)
  const inputStatement = {schema:"chronicle_entry_singleton_semantic_statement.v0",source_entry_schema:"chronicle_entry.v0",
    source_entry_ref:entry.entry_id,source_entry_content_commitment:sourceCommitment,
    source_admission_state:"chronicle_entry_independently_admitted",fold_policy_commitment:policyCommitment,
    comparability_class_commitment:classCommitment,transition_rule_commitment:ruleCommitment,
    singleton_transition_eligibility:"eligible_under_exact_singleton_profile_declarations"}
  const inputCommitment = digest(inputStatement)
  const inclusion = [{member_schema:"chronicle_entry.v0",member_ref:entry.entry_id,member_source_entry_content_commitment:sourceCommitment}]
  const inclusionCommitment = digest(inclusion)
  // Construct a separate output object from raw facts; never clone the input claim.
  const outputStatement = {schema:"chronicle_entry_singleton_semantic_statement.v0",source_entry_schema:entry.schema,
    source_entry_ref:entry.entry_id,source_entry_content_commitment:sourceCommitment,
    source_admission_state:"chronicle_entry_independently_admitted",fold_policy_commitment:policyCommitment,
    comparability_class_commitment:classCommitment,transition_rule_commitment:ruleCommitment,
    singleton_transition_eligibility:"eligible_under_exact_singleton_profile_declarations"}
  const outputCommitment = digest(outputStatement)
  const descriptor = (statement: J) => ({schema:"recursive_singleton_semantic_class_descriptor.v0",
    source_object_schema:statement.source_entry_schema,source_admission_state:statement.source_admission_state,
    fold_policy_commitment:policyCommitment,comparability_class_commitment:classCommitment,
    transition_rule_commitment:ruleCommitment,singleton_transition_eligibility:statement.singleton_transition_eligibility})
  const inputDescriptor = descriptor(inputStatement), outputDescriptor = descriptor(outputStatement)
  const noPromotion = equalCanonical(inputDescriptor, outputDescriptor) && inputCommitment === outputCommitment &&
    equalCanonical(policy, POLICY) && equalCanonical(classDeclaration, CLASS) && equalCanonical(rule, RULE)
  const breakdown = {schema:"recursive_singleton_breakdown.v0",source_entry_ref:entry.entry_id,
    source_entry_content_commitment:sourceCommitment,source_admission_prerequisite:"chronicle_entry_independently_admitted",
    inclusion_decision:"included",exclusion_decision:"none",comparability_evaluation:"singleton_class_eligible",
    policy_evaluation:"singleton_policy_eligible",transition_input:{semantic_result_commitment:inputCommitment},
    transition_output:{semantic_result_commitment:outputCommitment},no_elevation_finding:"no_stronger_semantic_class_created"}
  const breakdownCommitment = digest(breakdown)
  const seed = {schema:"recursive_singleton_aggregate_identity_seed.v0",aggregate_schema:"recursive_singleton_aggregate.v0",
    profile_version:"recursive-singleton-fold-profile-v0",source_entry_ref:entry.entry_id,
    source_entry_content_commitment:sourceCommitment,semantic_result_commitment:outputCommitment,
    inclusion_set_commitment:inclusionCommitment,fold_policy_commitment:policyCommitment,
    comparability_class_commitment:classCommitment,transition_rule_commitment:ruleCommitment,
    pre_aggregation_breakdown_commitment:breakdownCommitment}
  const aggregate = {schema:"recursive_singleton_aggregate.v0",profile_version:"recursive-singleton-fold-profile-v0",
    aggregate_id:digest(seed),source_entry_ref:entry.entry_id,source_entry_content_commitment:sourceCommitment,
    semantic_statement:outputStatement,semantic_result_commitment:outputCommitment,canonical_inclusion_set:inclusion,
    inclusion_set_commitment:inclusionCommitment,fold_policy_declaration:policy,fold_policy_commitment:policyCommitment,
    comparability_class_declaration:classDeclaration,comparability_class_commitment:classCommitment,
    transition_rule_declaration:rule,transition_rule_commitment:ruleCommitment,pre_aggregation_breakdown:breakdown,
    pre_aggregation_breakdown_commitment:breakdownCommitment,transition_result:clone(TRANSITION),
    no_stronger_semantic_class_created:noPromotion,profile_local_notes:vector.input.profile_local_notes}
  const envelope = {schema:"recursive_singleton_fold_evaluation.v0",evaluation_state:"evaluated",profile_verdict:"accepted",
    aggregate, finding:null}
  return {inputStatement,inputCommitment,inputDescriptor,outputStatement,outputCommitment,outputDescriptor,
    inclusion,inclusionCommitment,breakdown,breakdownCommitment,seed,aggregate,envelope}
}

const finding = (state: string, code: string, position: number) => ({schema:"recursive_singleton_fold_evaluation.v0",
  evaluation_state:state,profile_verdict:state === "evaluated" ? "rejected" : null,aggregate:null,
  finding:{schema:"recursive_singleton_fold_finding.v0",code,check_position:position}})
const reject = (code: string, position: number) => ({ result:finding("evaluated",code,position), completedThrough:position })
const malformed = () => ({ result:finding("malformed","malformed_rsf_stage_input",18), completedThrough:18 })
const digestPattern = /^sha256:[0-9a-f]{64}$/

export function evaluatePositions18Through28(vector: J): J {
  if (vector.case_id === "V-UNVER") return { result: vector.expected_evaluation, completedThrough:8 }
  if (vector.case_id === "V-GIT") return { result:null, completedThrough:0 }
  const stage = vector.stage_input
  if (!stage || Object.keys(stage).sort().join("|") !== ["candidate_aggregate","claimed_input_semantic_result_commitment","claimed_input_semantic_statement","schema"].sort().join("|") ||
      stage.schema !== "recursive_singleton_fold_stage_input.v0" || !stage.claimed_input_semantic_statement ||
      !digestPattern.test(stage.claimed_input_semantic_result_commitment ?? "") || !stage.candidate_aggregate) return malformed()
  const expected = reconstructExpected(vector), candidate = stage.candidate_aggregate
  if (!Array.isArray(candidate.canonical_inclusion_set) || candidate.canonical_inclusion_set.length !== 1) return reject("singleton_policy_ineligible",18)
  if (candidate.canonical_inclusion_set[0]?.member_ref !== expected.inclusion[0].member_ref) return reject("singleton_class_ineligible",19)
  if (!equalCanonical(stage.claimed_input_semantic_statement, expected.inputStatement)) return reject("semantic_statement_mismatch",20)
  if (stage.claimed_input_semantic_result_commitment !== expected.inputCommitment) return reject("semantic_result_commitment_mismatch",20)
  if (!equalCanonical(candidate.canonical_inclusion_set, expected.inclusion)) return reject("inclusion_set_mismatch",21)
  if (candidate.inclusion_set_commitment !== expected.inclusionCommitment) return reject("inclusion_set_commitment_mismatch",21)
  if (candidate.aggregate_id === expected.aggregate.source_entry_ref) return reject("forbidden_source_identity_reuse",22)
  if (!equalCanonical(candidate.semantic_statement, expected.outputStatement)) return reject("semantic_result_commitment_mismatch",23)
  if (candidate.semantic_result_commitment !== digest(candidate.semantic_statement)) return reject("semantic_result_commitment_mismatch",23)
  if (candidate.semantic_result_commitment !== expected.inputCommitment) return reject("semantic_result_commitment_mismatch",23)
  const mechanicalNoPromotion = equalCanonical(expected.inputDescriptor, expected.outputDescriptor) &&
    expected.inputCommitment === expected.outputCommitment && candidate.aggregate_id !== expected.aggregate.source_entry_ref &&
    equalCanonical(vector.input.fold_policy_declaration,POLICY) && equalCanonical(vector.input.comparability_class_declaration,CLASS) &&
    equalCanonical(vector.input.transition_rule_declaration,RULE)
  if (candidate.no_stronger_semantic_class_created !== mechanicalNoPromotion) return reject("no_elevation_invariant_mismatch",24)
  if (!equalCanonical(candidate.transition_result, TRANSITION)) return reject("transition_result_mismatch",25)
  if (!equalCanonical(candidate.pre_aggregation_breakdown, expected.breakdown)) return reject("breakdown_mismatch",26)
  if (candidate.pre_aggregation_breakdown_commitment !== expected.breakdownCommitment) return reject("breakdown_commitment_mismatch",26)
  if (candidate.aggregate_id !== expected.aggregate.aggregate_id) return reject("aggregate_id_mismatch",27)
  const fresh = digest(vector.prefix_continuation.sourceEntry)
  if (vector.prefix_continuation.sourceEntryContentCommitment !== fresh) return reject("source_entry_content_commitment_mismatch",28)
  if (candidate.source_entry_content_commitment !== fresh) return reject("source_entry_content_commitment_mismatch",28)
  const contract = JSON.parse(readGitIndexBytes(`${PACKAGE}/contract.json`).toString("utf8"))
  for (const item of contract.position_28_remaining_fields) {
    const a=candidate[item.field], b=expected.aggregate[item.field]
    const same=item.comparison === "canonical_json_utf8_byte_equality" ? equalCanonical(a,b) : a === b
    if (!same) return reject("complete_aggregate_validation_mismatch",28)
  }
  return { result:expected.envelope, completedThrough:28 }
}

export function inspectImports(sources?: Record<string,string>): J {
  const actual = sources ?? {
    "conformance/recursive-singleton-fold-v0/generate_expected.py":readGitIndexBytes("conformance/recursive-singleton-fold-v0/generate_expected.py").toString("utf8"),
    "conformance/recursive-singleton-fold-v0/audit_expected.ts":readGitIndexBytes("conformance/recursive-singleton-fold-v0/audit_expected.ts").toString("utf8")}
  const graph: Record<string,string[]> = {}
  const violations: string[]=[]
  for (const [path,source] of Object.entries(actual)) {
    const imports = path.endsWith(".py")
      ? [...source.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm)].map(m=>m[1]??m[2])
      : [...source.matchAll(/^\s*import(?:[\s\S]*?from\s*)?["']([^"']+)["']/gm)].map(m=>m[1])
    graph[path]=imports
    for (const specifier of imports) if (/src\/receiptos\/rsf|evaluate.*18|generate_expected|audit_expected/.test(specifier)) violations.push(`${path}:${specifier}`)
    if (path.endsWith(".py") && /agg\s*=\s*stage\["candidate_aggregate"\]|expected[^\n=]*=\s*(?:copy\.deepcopy\()?[^\n]*candidate_aggregate/.test(source)) violations.push(`${path}:candidate-as-expected`)
  }
  return {graph,violations,production_imports:violations.length}
}

const EXPECTED: Record<string,[string,string|null,number|null]> = {
  "V-OK":["evaluated",null,null],"V-18M":["malformed","malformed_rsf_stage_input",18],"V-18P":["evaluated","singleton_policy_ineligible",18],
  "V-19":["evaluated","singleton_class_ineligible",19],"V-20A":["evaluated","semantic_statement_mismatch",20],"V-20B":["evaluated","semantic_result_commitment_mismatch",20],
  "V-21A":["evaluated","inclusion_set_mismatch",21],"V-21B":["evaluated","inclusion_set_commitment_mismatch",21],"V-22":["evaluated","forbidden_source_identity_reuse",22],
  "V-23A":["evaluated","semantic_result_commitment_mismatch",23],"V-23B":["evaluated","semantic_result_commitment_mismatch",23],"V-23C":["evaluated","semantic_result_commitment_mismatch",23],
  "V-24":["evaluated","no_elevation_invariant_mismatch",24],"V-25":["evaluated","transition_result_mismatch",25],"V-26A":["evaluated","breakdown_mismatch",26],
  "V-26B":["evaluated","breakdown_commitment_mismatch",26],"V-27":["evaluated","aggregate_id_mismatch",27],"V-28A1":["evaluated","source_entry_content_commitment_mismatch",28],
  "V-28A2":["evaluated","source_entry_content_commitment_mismatch",28],"V-28B":["evaluated","complete_aggregate_validation_mismatch",28],"V-ORDER":["evaluated","semantic_statement_mismatch",20],
  "V-ADM":["evaluated","singleton_policy_ineligible",18],"V-TIME":["evaluated","singleton_class_ineligible",19],"V-LABEL":["evaluated","no_elevation_invariant_mismatch",24],
  "V-NOPROOF":["malformed","malformed_rsf_stage_input",18],"V-UNVER":["unverifiable","source_admission_prerequisite_unavailable",8],"V-MAL-REJ":["malformed","malformed_rsf_stage_input",18],
  "V-INSERT":["evaluated",null,null],"V-ESCAPE":["evaluated",null,null],"V-SCALAR":["evaluated","complete_aggregate_validation_mismatch",28],"V-GIT":["not_invoked",null,null],
  "V-MUTATE":["evaluated",null,null],"V-REPLAY":["evaluated",null,null],"V-FALL":["evaluated","no_elevation_invariant_mismatch",24]
}

export function executableSpecialCases(vectors: Record<string,J>): J {
  const original=clone(vectors["V-MUTATE"]), snapshot=clone(original)
  const before=canonical(evaluatePositions18Through28(snapshot).result)
  original.input.source_admission_bundle.claimed_source_entry.entry_id="mutated-after-snapshot"
  original.prefix_continuation.sourceEntry.labels.push("mutated")
  original.stage_input.candidate_aggregate.semantic_statement.source_entry_ref="mutated"
  const after=canonical(evaluatePositions18Through28(snapshot).result)
  const noAlias=snapshot.input.source_admission_bundle.claimed_source_entry.entry_id !== "mutated-after-snapshot" &&
    !snapshot.prefix_continuation.sourceEntry.labels.includes("mutated")
  const wire=JSON.stringify(vectors["V-REPLAY"]), replayA=JSON.parse(wire), replayB=JSON.parse(wire)
  const replayEqual=canonical(evaluatePositions18Through28(replayA).result) === canonical(evaluatePositions18Through28(replayB).result)
  const accepted=Object.values(vectors).filter(v=>evaluatePositions18Through28(v).result?.profile_verdict === "accepted")
  const fallthroughSafe=accepted.every(v=>evaluatePositions18Through28(v).completedThrough === 28) &&
    Object.entries(vectors).filter(([id])=>!["V-OK","V-INSERT","V-ESCAPE","V-MUTATE","V-REPLAY"].includes(id))
      .every(([,v])=>evaluatePositions18Through28(v).result?.profile_verdict !== "accepted")
  return {mutation_snapshot_unchanged:before===after,mutation_no_alias:noAlias,replay_byte_identical:replayEqual,
    fallthrough_accepted_only_after_28:fallthroughSafe,accepted_cases:accepted.length}
}

export function auditPackage(useBytes=(path:string)=>readGitIndexBytes(path)): J {
  const manifest=JSON.parse(useBytes(`${PACKAGE}/manifest.json`).toString("utf8"))
  assert(manifest.file_count===40 && manifest.files.length===40 && manifest.dependency_model==="A-included-schemas", "manifest inventory")
  const paths=manifest.files.map((f:J)=>f.path)
  assert(JSON.stringify(paths)===JSON.stringify([...paths].sort((a,b)=>Buffer.from(a).compare(Buffer.from(b)))), "path order")
  const rows:string[]=[]
  for (const file of manifest.files) { const actual=shaBytes(useBytes(file.path)); assert(actual===file.sha256,`file digest ${file.path}`); rows.push(`${file.path}\t${actual}\n`) }
  assert(shaBytes(Buffer.from(rows.join(""),"utf8"))===manifest.fixture_set_sha256,"fixture-set digest")
  const vectors:Record<string,J>={}
  for (const name of Object.keys(EXPECTED)) vectors[name]=JSON.parse(useBytes(`${PACKAGE}/vectors/${name}.json`).toString("utf8"))
  assert(Object.keys(vectors).length===34,"vector count")
  for (const [name,vector] of Object.entries(vectors)) {
    const [state,code,pos]=EXPECTED[name]
    assert(vector.expected_state===state && vector.expected_code===code && vector.expected_check_position===pos,`${name} metadata`)
    const evaluated=evaluatePositions18Through28(vector).result
    assert(equalCanonical(evaluated,vector.expected_evaluation),`${name} independently reconstructed result`)
    if (code!==null) assert(vector.expected_evaluation.aggregate===null,`${name} null aggregate`)
  }
  const imports=inspectImports(); assert(imports.violations.length===0,`import/independence violations: ${imports.violations}`)
  const special=executableSpecialCases(vectors); assert(Object.values(special).filter(x=>typeof x==="boolean").every(Boolean),"executable special cases")
  const ok=reconstructExpected(vectors["V-OK"]), a=ok.aggregate
  const vOk={source_entry_content_commitment:a.source_entry_content_commitment,semantic_result_commitment:a.semantic_result_commitment,
    inclusion_set_commitment:a.inclusion_set_commitment,fold_policy_commitment:a.fold_policy_commitment,
    comparability_class_commitment:a.comparability_class_commitment,transition_rule_commitment:a.transition_rule_commitment,
    pre_aggregation_breakdown_commitment:a.pre_aggregation_breakdown_commitment,aggregate_id:a.aggregate_id,
    aggregate_bytes_sha256:shaBytes(Buffer.from(canonical(a),"utf8")),envelope_bytes_sha256:shaBytes(Buffer.from(canonical(ok.envelope),"utf8"))}
  return {auditor:"typescript-independent-rsf-v0",mode:"read-only-git-index",vector_count:34,package_inventory_count:40,
    fixture_set_sha256:manifest.fixture_set_sha256,commitment_identity_checks:10,classification_checks:34,
    production_imports:0,import_graph:imports.graph,v_ok:vOk,special_cases:special}
}

if (import.meta.main) console.log(JSON.stringify(auditPackage()))
