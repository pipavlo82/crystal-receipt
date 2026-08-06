import { canonicalize } from "../canon/canonicalize"
import { sha256 } from "../canon/receipt-root"
import { deriveSourceEntryContentCommitment } from "./source-admission-recomputation"
import type { RsfPrefixThroughPosition17Value } from "./evaluate-prefix-through-position-17"
import { snapshotRsfJson } from "./strict-json-snapshot"

const DIGEST = /^sha256:[0-9a-f]{64}$/
const FINDING_SCHEMA = "recursive_singleton_fold_finding.v0" as const

export type RsfPositions18Through28FindingCode =
  | "malformed_rsf_stage_input"
  | "singleton_policy_ineligible"
  | "singleton_class_ineligible"
  | "semantic_statement_mismatch"
  | "semantic_result_commitment_mismatch"
  | "inclusion_set_mismatch"
  | "inclusion_set_commitment_mismatch"
  | "forbidden_source_identity_reuse"
  | "no_elevation_invariant_mismatch"
  | "transition_result_mismatch"
  | "breakdown_mismatch"
  | "breakdown_commitment_mismatch"
  | "aggregate_id_mismatch"
  | "source_entry_content_commitment_mismatch"
  | "complete_aggregate_validation_mismatch"

export type RsfPositions18Through28Finding = {
  schema: typeof FINDING_SCHEMA
  code: RsfPositions18Through28FindingCode
  check_position: 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28
}

type SemanticStatement = {
  schema: string
  source_entry_schema: string
  source_entry_ref: string
  source_entry_content_commitment: string
  source_admission_state: string
  fold_policy_commitment: string
  comparability_class_commitment: string
  transition_rule_commitment: string
  singleton_transition_eligibility: string
}

type InclusionMember = {
  member_schema: string
  member_ref: string
  member_source_entry_content_commitment: string
}

type FoldPolicyClaim = {
  schema:string; policy_version:string; policy_id:string; source_object_schema:string; aggregate_object_schema:string
  member_cardinality:number; aggregation_mode:string; semantic_elevation:string; source_identity_reuse:string; multi_member_extension:string
}

type ComparabilityClassClaim = {
  schema:string; class_version:string; class_id:string; source_object_schema:string; admission_required:boolean
  cross_entry_comparability:string; cross_policy_bridge:string; cross_class_bridge:string; singleton_eligibility_rule:string
}

type TransitionRuleClaim = {
  schema:string; rule_version:string; rule_id:string; source_object_schema:string; aggregate_object_schema:string
  preserved_equality_relation:string; source_identity_reuse:string; stronger_class_creation:string; fail_closed_on_malformed_or_unknown_input:boolean
}

type Breakdown = {
  schema: string
  source_entry_ref: string
  source_entry_content_commitment: string
  source_admission_prerequisite: string
  inclusion_decision: string
  exclusion_decision: string
  comparability_evaluation: string
  policy_evaluation: string
  transition_input: { semantic_result_commitment: string }
  transition_output: { semantic_result_commitment: string }
  no_elevation_finding: string
}

type TransitionResult = {
  status: string
  semantic_equivalence_result: string
  source_identity_reuse_result: string
  stronger_semantic_class_creation_result: string
}

export type RecursiveSingletonAggregateV0 = {
  schema: string
  profile_version: string
  aggregate_id: string
  source_entry_ref: string
  source_entry_content_commitment: string
  semantic_statement: SemanticStatement
  semantic_result_commitment: string
  canonical_inclusion_set: InclusionMember[]
  inclusion_set_commitment: string
  fold_policy_declaration: FoldPolicyClaim
  fold_policy_commitment: string
  comparability_class_declaration: ComparabilityClassClaim
  comparability_class_commitment: string
  transition_rule_declaration: TransitionRuleClaim
  transition_rule_commitment: string
  pre_aggregation_breakdown: Breakdown
  pre_aggregation_breakdown_commitment: string
  transition_result: TransitionResult
  no_stronger_semantic_class_created: boolean
  profile_local_notes: string | null
}

type StageInput = {
  schema: "recursive_singleton_fold_stage_input.v0"
  claimed_input_semantic_statement: SemanticStatement
  claimed_input_semantic_result_commitment: string
  candidate_aggregate: RecursiveSingletonAggregateV0
}

export type EvaluateRsfPositions18Through28Result =
  | { kind: "verified_aggregate"; aggregate: RecursiveSingletonAggregateV0; completedThrough: 28 }
  | { kind: "finding"; finding: RsfPositions18Through28Finding; completedThrough: RsfPositions18Through28Finding["check_position"] }

const semanticStatementKeys = ["schema","source_entry_schema","source_entry_ref","source_entry_content_commitment","source_admission_state","fold_policy_commitment","comparability_class_commitment","transition_rule_commitment","singleton_transition_eligibility"] as const
const inclusionMemberKeys = ["member_schema","member_ref","member_source_entry_content_commitment"] as const
const policyKeys = ["schema","policy_version","policy_id","source_object_schema","aggregate_object_schema","member_cardinality","aggregation_mode","semantic_elevation","source_identity_reuse","multi_member_extension"] as const
const classKeys = ["schema","class_version","class_id","source_object_schema","admission_required","cross_entry_comparability","cross_policy_bridge","cross_class_bridge","singleton_eligibility_rule"] as const
const ruleKeys = ["schema","rule_version","rule_id","source_object_schema","aggregate_object_schema","preserved_equality_relation","source_identity_reuse","stronger_class_creation","fail_closed_on_malformed_or_unknown_input"] as const
const breakdownKeys = ["schema","source_entry_ref","source_entry_content_commitment","source_admission_prerequisite","inclusion_decision","exclusion_decision","comparability_evaluation","policy_evaluation","transition_input","transition_output","no_elevation_finding"] as const
const transitionKeys = ["status","semantic_equivalence_result","source_identity_reuse_result","stronger_semantic_class_creation_result"] as const
const aggregateKeys = ["schema","profile_version","aggregate_id","source_entry_ref","source_entry_content_commitment","semantic_statement","semantic_result_commitment","canonical_inclusion_set","inclusion_set_commitment","fold_policy_declaration","fold_policy_commitment","comparability_class_declaration","comparability_class_commitment","transition_rule_declaration","transition_rule_commitment","pre_aggregation_breakdown","pre_aggregation_breakdown_commitment","transition_result","no_stronger_semantic_class_created","profile_local_notes"] as const

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key))
}

function strings(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every(key => typeof value[key] === "string")
}

function digests(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every(key => typeof value[key] === "string" && DIGEST.test(value[key]))
}

function semanticStatementShape(value: unknown): value is SemanticStatement {
  return isObject(value) && exactKeys(value, semanticStatementKeys) && strings(value, semanticStatementKeys) &&
    digests(value,["source_entry_content_commitment","fold_policy_commitment","comparability_class_commitment","transition_rule_commitment"])
}

function inclusionMemberShape(value: unknown): value is InclusionMember {
  return isObject(value) && exactKeys(value,inclusionMemberKeys) && strings(value,inclusionMemberKeys) && DIGEST.test(value.member_source_entry_content_commitment as string)
}

function policyShape(value: unknown): value is FoldPolicyClaim {
  return isObject(value) && exactKeys(value,policyKeys) && strings(value,policyKeys.filter(key=>key!=="member_cardinality")) && Number.isInteger(value.member_cardinality)
}

function classShape(value: unknown): value is ComparabilityClassClaim {
  return isObject(value) && exactKeys(value,classKeys) && strings(value,classKeys.filter(key=>key!=="admission_required")) && typeof value.admission_required === "boolean"
}

function ruleShape(value: unknown): value is TransitionRuleClaim {
  return isObject(value) && exactKeys(value,ruleKeys) && strings(value,ruleKeys.filter(key=>key!=="fail_closed_on_malformed_or_unknown_input")) && typeof value.fail_closed_on_malformed_or_unknown_input === "boolean"
}

function oneDigestObject(value: unknown): value is { semantic_result_commitment: string } {
  return isObject(value) && exactKeys(value,["semantic_result_commitment"]) && typeof value.semantic_result_commitment === "string" && DIGEST.test(value.semantic_result_commitment)
}

function breakdownShape(value: unknown): value is Breakdown {
  return isObject(value) && exactKeys(value,breakdownKeys) &&
    strings(value,["schema","source_entry_ref","source_entry_content_commitment","source_admission_prerequisite","inclusion_decision","exclusion_decision","comparability_evaluation","policy_evaluation","no_elevation_finding"]) &&
    DIGEST.test(value.source_entry_content_commitment as string) && oneDigestObject(value.transition_input) && oneDigestObject(value.transition_output)
}

function transitionShape(value: unknown): value is TransitionResult {
  return isObject(value) && exactKeys(value,transitionKeys) && strings(value,transitionKeys)
}

function aggregateShape(value: unknown): value is RecursiveSingletonAggregateV0 {
  if (!isObject(value) || !exactKeys(value,aggregateKeys)) return false
  if (!strings(value,["schema","profile_version","aggregate_id","source_entry_ref","source_entry_content_commitment","semantic_result_commitment","inclusion_set_commitment","fold_policy_commitment","comparability_class_commitment","transition_rule_commitment","pre_aggregation_breakdown_commitment"])) return false
  if (!digests(value,["aggregate_id","source_entry_content_commitment","semantic_result_commitment","inclusion_set_commitment","fold_policy_commitment","comparability_class_commitment","transition_rule_commitment","pre_aggregation_breakdown_commitment"])) return false
  if (!semanticStatementShape(value.semantic_statement)) return false
  if (!Array.isArray(value.canonical_inclusion_set) || !value.canonical_inclusion_set.every(inclusionMemberShape)) return false
  if (!policyShape(value.fold_policy_declaration) || !classShape(value.comparability_class_declaration) || !ruleShape(value.transition_rule_declaration)) return false
  if (!breakdownShape(value.pre_aggregation_breakdown) || !transitionShape(value.transition_result)) return false
  if (typeof value.no_stronger_semantic_class_created !== "boolean") return false
  return value.profile_local_notes === null || typeof value.profile_local_notes === "string"
}

function stageShape(value: unknown): value is StageInput {
  return isObject(value) && exactKeys(value,["schema","claimed_input_semantic_statement","claimed_input_semantic_result_commitment","candidate_aggregate"]) &&
    value.schema === "recursive_singleton_fold_stage_input.v0" && semanticStatementShape(value.claimed_input_semantic_statement) &&
    typeof value.claimed_input_semantic_result_commitment === "string" && DIGEST.test(value.claimed_input_semantic_result_commitment) && aggregateShape(value.candidate_aggregate)
}

function semanticDigest(value: unknown): string {
  return `sha256:${sha256(canonicalize(value))}`
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  return Buffer.from(canonicalize(left),"utf8").equals(Buffer.from(canonicalize(right),"utf8"))
}

function finding(code: RsfPositions18Through28FindingCode, check_position: RsfPositions18Through28Finding["check_position"]): EvaluateRsfPositions18Through28Result {
  return {kind:"finding",finding:{schema:FINDING_SCHEMA,code,check_position},completedThrough:check_position}
}

function inputStatement(prefix: RsfPrefixThroughPosition17Value, sourceCommitment: string): SemanticStatement {
  return {schema:"chronicle_entry_singleton_semantic_statement.v0",source_entry_schema:"chronicle_entry.v0",
    source_entry_ref:prefix.verifiedSourceEntry.entry_id,source_entry_content_commitment:sourceCommitment,
    source_admission_state:"chronicle_entry_independently_admitted",fold_policy_commitment:prefix.foldPolicyCommitment,
    comparability_class_commitment:prefix.comparabilityClassCommitment,transition_rule_commitment:prefix.transitionRuleCommitment,
    singleton_transition_eligibility:"eligible_under_exact_singleton_profile_declarations"}
}

function outputStatement(prefix: RsfPrefixThroughPosition17Value, sourceCommitment: string): SemanticStatement {
  return {schema:"chronicle_entry_singleton_semantic_statement.v0",source_entry_schema:prefix.verifiedSourceEntry.schema,
    source_entry_ref:prefix.verifiedSourceEntry.entry_id,source_entry_content_commitment:sourceCommitment,
    source_admission_state:"chronicle_entry_independently_admitted",fold_policy_commitment:prefix.foldPolicyCommitment,
    comparability_class_commitment:prefix.comparabilityClassCommitment,transition_rule_commitment:prefix.transitionRuleCommitment,
    singleton_transition_eligibility:"eligible_under_exact_singleton_profile_declarations"}
}

function descriptor(statement: SemanticStatement, prefix: RsfPrefixThroughPosition17Value) {
  return {schema:"recursive_singleton_semantic_class_descriptor.v0",source_object_schema:statement.source_entry_schema,
    source_admission_state:statement.source_admission_state,fold_policy_commitment:prefix.foldPolicyCommitment,
    comparability_class_commitment:prefix.comparabilityClassCommitment,transition_rule_commitment:prefix.transitionRuleCommitment,
    singleton_transition_eligibility:statement.singleton_transition_eligibility}
}

const expectedTransition = (): TransitionResult => ({status:"singleton_transition_ok",semantic_equivalence_result:"semantic_result_commitment_preserved",
  source_identity_reuse_result:"source_identity_not_reused",stronger_semantic_class_creation_result:"no_stronger_semantic_class_created"})

/** Ordered, non-envelope stage. It emits only a position-owned finding or a mechanically verified aggregate. */
export function evaluateRsfPositions18Through28(prefixValue: RsfPrefixThroughPosition17Value, stageInput: unknown): EvaluateRsfPositions18Through28Result {
  const prefix = snapshotRsfJson(prefixValue,"$prefix") as unknown as RsfPrefixThroughPosition17Value
  let stageSnapshot: unknown
  try { stageSnapshot = snapshotRsfJson(stageInput,"$stage") } catch { return finding("malformed_rsf_stage_input",18) }

  // Position 18(a): closed JSON shape and digest syntax, deliberately without semantic literal pre-acceptance.
  if (!stageShape(stageSnapshot)) return finding("malformed_rsf_stage_input",18)
  const stage = stageSnapshot
  const candidate = stage.candidate_aggregate

  // Position 18(b): eligibility from verified local policy facts and exact singleton cardinality.
  const policyEligibility = prefix.foldPolicyDeclaration.member_cardinality === 1 && prefix.foldPolicyDeclaration.aggregation_mode === "singleton_only" &&
    prefix.foldPolicyDeclaration.semantic_elevation === "forbidden" && prefix.foldPolicyDeclaration.source_identity_reuse === "forbidden" &&
    prefix.foldPolicyDeclaration.source_object_schema === "chronicle_entry.v0" && prefix.verifiedSourceEntry.schema === "chronicle_entry.v0" &&
    candidate.canonical_inclusion_set.length === 1
  if (!policyEligibility) return finding("singleton_policy_ineligible",18)

  // Position 19: independently linked singleton comparability.
  const classEligibility = prefix.comparabilityClassDeclaration.admission_required === true &&
    prefix.comparabilityClassDeclaration.source_object_schema === "chronicle_entry.v0" &&
    prefix.comparabilityClassDeclaration.singleton_eligibility_rule === "exactly_one_independently_admitted_source_entry" &&
    candidate.canonical_inclusion_set[0].member_ref === prefix.verifiedSourceEntry.entry_id
  if (!classEligibility) return finding("singleton_class_ineligible",19)

  // Position 20: fresh input statement, then its independently derived commitment.
  const semanticSourceCommitment = deriveSourceEntryContentCommitment(prefix.verifiedSourceEntry).value.sourceEntryContentCommitment
  const verifiedInputSemanticStatement = inputStatement(prefix,semanticSourceCommitment)
  if (!canonicalEqual(stage.claimed_input_semantic_statement,verifiedInputSemanticStatement)) return finding("semantic_statement_mismatch",20)
  const verifiedInputSemanticResultCommitment = semanticDigest(verifiedInputSemanticStatement)
  if (stage.claimed_input_semantic_result_commitment !== verifiedInputSemanticResultCommitment) return finding("semantic_result_commitment_mismatch",20)

  // Position 21: fresh inclusion set, then its commitment.
  const verifiedInclusionSet: InclusionMember[] = [{member_schema:"chronicle_entry.v0",member_ref:prefix.verifiedSourceEntry.entry_id,
    member_source_entry_content_commitment:semanticSourceCommitment}]
  if (!canonicalEqual(candidate.canonical_inclusion_set,verifiedInclusionSet)) return finding("inclusion_set_mismatch",21)
  const verifiedInclusionSetCommitment = semanticDigest(verifiedInclusionSet)
  if (candidate.inclusion_set_commitment !== verifiedInclusionSetCommitment) return finding("inclusion_set_commitment_mismatch",21)

  // Position 22 model A: this proves non-reuse only; the candidate ID remains untrusted.
  const sourceIdentityNotReused = candidate.aggregate_id !== prefix.verifiedSourceEntry.entry_id
  if (!sourceIdentityNotReused) return finding("forbidden_source_identity_reuse",22)

  // Position 23: allocate a distinct output statement and verify object, stored digest, then preservation.
  const verifiedOutputSemanticStatement = outputStatement(prefix,semanticSourceCommitment)
  if (!canonicalEqual(candidate.semantic_statement,verifiedOutputSemanticStatement)) return finding("semantic_result_commitment_mismatch",23)
  const verifiedOutputSemanticResultCommitment = semanticDigest(verifiedOutputSemanticStatement)
  if (candidate.semantic_result_commitment !== verifiedOutputSemanticResultCommitment) return finding("semantic_result_commitment_mismatch",23)
  if (verifiedOutputSemanticResultCommitment !== verifiedInputSemanticResultCommitment) return finding("semantic_result_commitment_mismatch",23)

  // Position 24: the candidate boolean is read only after the complete mechanical predicate is derived.
  const inputDescriptor = descriptor(verifiedInputSemanticStatement,prefix)
  const outputDescriptor = descriptor(verifiedOutputSemanticStatement,prefix)
  const transitionRuleExact = prefix.transitionRuleDeclaration.preserved_equality_relation === "semantic_result_commitment_equality_only" &&
    prefix.transitionRuleDeclaration.source_identity_reuse === "forbidden" && prefix.transitionRuleDeclaration.stronger_class_creation === "forbidden" &&
    prefix.transitionRuleDeclaration.fail_closed_on_malformed_or_unknown_input === true
  const noStrongerSemanticClassCreated = canonicalEqual(inputDescriptor,outputDescriptor) &&
    verifiedInputSemanticResultCommitment === verifiedOutputSemanticResultCommitment && sourceIdentityNotReused &&
    transitionRuleExact && policyEligibility && classEligibility
  if (candidate.no_stronger_semantic_class_created !== noStrongerSemanticClassCreated || noStrongerSemanticClassCreated !== true) {
    return finding("no_elevation_invariant_mismatch",24)
  }

  // Position 25: labels are constructed from the facts already established at 22-24.
  const verifiedTransitionResult = expectedTransition()
  if (!canonicalEqual(candidate.transition_result,verifiedTransitionResult)) return finding("transition_result_mismatch",25)

  // Position 26: fresh breakdown, then its commitment.
  const verifiedBreakdown: Breakdown = {schema:"recursive_singleton_breakdown.v0",source_entry_ref:prefix.verifiedSourceEntry.entry_id,
    source_entry_content_commitment:semanticSourceCommitment,source_admission_prerequisite:"chronicle_entry_independently_admitted",
    inclusion_decision:"included",exclusion_decision:"none",comparability_evaluation:"singleton_class_eligible",policy_evaluation:"singleton_policy_eligible",
    transition_input:{semantic_result_commitment:verifiedInputSemanticResultCommitment},transition_output:{semantic_result_commitment:verifiedOutputSemanticResultCommitment},
    no_elevation_finding:"no_stronger_semantic_class_created"}
  if (!canonicalEqual(candidate.pre_aggregation_breakdown,verifiedBreakdown)) return finding("breakdown_mismatch",26)
  const verifiedBreakdownCommitment = semanticDigest(verifiedBreakdown)
  if (candidate.pre_aggregation_breakdown_commitment !== verifiedBreakdownCommitment) return finding("breakdown_commitment_mismatch",26)

  // Position 27: derive identity from the frozen seed, never from the candidate ID.
  const aggregateIdentitySeed = {schema:"recursive_singleton_aggregate_identity_seed.v0",aggregate_schema:"recursive_singleton_aggregate.v0",
    profile_version:"recursive-singleton-fold-profile-v0",source_entry_ref:prefix.verifiedSourceEntry.entry_id,
    source_entry_content_commitment:semanticSourceCommitment,semantic_result_commitment:verifiedOutputSemanticResultCommitment,
    inclusion_set_commitment:verifiedInclusionSetCommitment,fold_policy_commitment:prefix.foldPolicyCommitment,
    comparability_class_commitment:prefix.comparabilityClassCommitment,transition_rule_commitment:prefix.transitionRuleCommitment,
    pre_aggregation_breakdown_commitment:verifiedBreakdownCommitment}
  const verifiedAggregateId = semanticDigest(aggregateIdentitySeed)
  if (candidate.aggregate_id !== verifiedAggregateId) return finding("aggregate_id_mismatch",27)

  // Position 28(a): fresh source commitment, prefix stored value, then candidate stored value.
  const freshSourceCommitment = deriveSourceEntryContentCommitment(prefix.verifiedSourceEntry).value.sourceEntryContentCommitment
  if (prefix.sourceEntryContentCommitment !== freshSourceCommitment) return finding("source_entry_content_commitment_mismatch",28)
  if (candidate.source_entry_content_commitment !== freshSourceCommitment) return finding("source_entry_content_commitment_mismatch",28)

  // Position 28(b): exact field order and frozen comparison domains; no generic aggregate equality.
  const expected: RecursiveSingletonAggregateV0 = {schema:"recursive_singleton_aggregate.v0",profile_version:"recursive-singleton-fold-profile-v0",
    aggregate_id:verifiedAggregateId,source_entry_ref:prefix.verifiedSourceEntry.entry_id,source_entry_content_commitment:freshSourceCommitment,
    semantic_statement:verifiedOutputSemanticStatement,semantic_result_commitment:verifiedOutputSemanticResultCommitment,
    canonical_inclusion_set:verifiedInclusionSet,inclusion_set_commitment:verifiedInclusionSetCommitment,
    fold_policy_declaration:prefix.foldPolicyDeclaration,fold_policy_commitment:prefix.foldPolicyCommitment,
    comparability_class_declaration:prefix.comparabilityClassDeclaration,comparability_class_commitment:prefix.comparabilityClassCommitment,
    transition_rule_declaration:prefix.transitionRuleDeclaration,transition_rule_commitment:prefix.transitionRuleCommitment,
    pre_aggregation_breakdown:verifiedBreakdown,pre_aggregation_breakdown_commitment:verifiedBreakdownCommitment,
    transition_result:verifiedTransitionResult,no_stronger_semantic_class_created:noStrongerSemanticClassCreated,profile_local_notes:prefix.profileLocalNotes}
  const comparisons: [keyof RecursiveSingletonAggregateV0,"scalar"|"digest"|"canonical"][] = [
    ["schema","scalar"],["profile_version","scalar"],["aggregate_id","digest"],["source_entry_ref","scalar"],
    ["semantic_statement","canonical"],["semantic_result_commitment","digest"],["canonical_inclusion_set","canonical"],
    ["inclusion_set_commitment","digest"],["fold_policy_declaration","canonical"],["fold_policy_commitment","digest"],
    ["comparability_class_declaration","canonical"],["comparability_class_commitment","digest"],["transition_rule_declaration","canonical"],
    ["transition_rule_commitment","digest"],["pre_aggregation_breakdown","canonical"],["pre_aggregation_breakdown_commitment","digest"],
    ["transition_result","canonical"],["no_stronger_semantic_class_created","scalar"],["profile_local_notes","scalar"]]
  for (const [field,mode] of comparisons) {
    const same = mode === "canonical" ? canonicalEqual(candidate[field],expected[field]) : candidate[field] === expected[field]
    if (!same) return finding("complete_aggregate_validation_mismatch",28)
  }

  return {kind:"verified_aggregate",aggregate:snapshotRsfJson(candidate,"$verifiedAggregate") as unknown as RecursiveSingletonAggregateV0,completedThrough:28}
}
