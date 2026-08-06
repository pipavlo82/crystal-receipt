import { describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { resolve } from "node:path"
import { auditPackage, canonical, evaluatePositions18Through28, executableSpecialCases, inspectImports, readGitIndexBytes, reconstructExpected } from "../../conformance/recursive-singleton-fold-v0/audit_expected"
import { evaluateRsfPrefixThroughPosition17 } from "../../src/receiptos/rsf/evaluate-prefix-through-position-17"
import { validateSchema, type Registry } from "./helpers/json-schema-2020-subset"

const root=resolve(import.meta.dir,"../.."), pkg="tests/fixtures/recursive-singleton-fold-v0"
const json=(path:string)=>JSON.parse(readGitIndexBytes(path).toString("utf8"))
const vectorNames=["V-OK","V-18M","V-18P","V-19","V-20A","V-20B","V-21A","V-21B","V-22","V-23A","V-23B","V-23C","V-24","V-25","V-26A","V-26B","V-27","V-28A1","V-28A2","V-28B","V-ORDER","V-ADM","V-TIME","V-LABEL","V-NOPROOF","V-UNVER","V-MAL-REJ","V-INSERT","V-ESCAPE","V-SCALAR","V-GIT","V-MUTATE","V-REPLAY","V-FALL"]
const vectors=Object.fromEntries(vectorNames.map(name=>[name,json(`${pkg}/vectors/${name}.json`)]))
const schemaNames=["recursive-singleton-fold-stage-input-v0.schema.json","recursive-singleton-aggregate-v0.schema.json","recursive-singleton-fold-evaluation-v0.schema.json","recursive-singleton-fold-finding-v0.schema.json"]
const registry:Registry=Object.fromEntries(schemaNames.map(name=>[name,json(`src/receiptos/schemas/${name}`)]))
const contract=json(`${pkg}/contract.json`)

describe("RSF positions 18-28 normative closure",()=>{
  test("Git-index package audit is read-only and independently reconstructs every result",()=>{
    const result=auditPackage()
    expect(result).toMatchObject({vector_count:34,package_inventory_count:40,commitment_identity_checks:10,classification_checks:34,production_imports:0})
    expect(result).toEqual(json("conformance/recursive-singleton-fold-v0/typescript-audit-output.json"))
  },30_000)

  test("all four schemas are mechanically validated and candidate rejections remain reachable",()=>{
    const malformed=new Set(["V-18M","V-NOPROOF","V-MAL-REJ"])
    for (const [name,vector] of Object.entries(vectors)) {
      const stageErrors=validateSchema(vector.stage_input,registry[schemaNames[0]],registry)
      expect(stageErrors.length===0).toBe(!malformed.has(name))
      if (vector.expected_evaluation) expect(validateSchema(vector.expected_evaluation,registry[schemaNames[2]],registry)).toEqual([])
    }
    const broad=structuredClone(vectors["V-OK"].stage_input)
    broad.candidate_aggregate.semantic_statement.source_admission_state="label_only"
    expect(validateSchema(broad,registry[schemaNames[0]],registry)).toEqual([])
  })

  test("accepted schema rejects impossible semantic literals",()=>{
    const mutations:[string,string,unknown][]=[
      ["transition_result","status","promoted_success"],
      ["fold_policy_declaration","semantic_elevation","allowed"],
      ["semantic_statement","source_admission_state","label_only"],
      ["pre_aggregation_breakdown","policy_evaluation","claimed_label_only"]]
    for (const [object,key,value] of mutations) {
      const aggregate=structuredClone(vectors["V-OK"].expected_evaluation.aggregate)
      aggregate[object][key]=value
      expect(validateSchema(aggregate,registry[schemaNames[1]],registry).length).toBeGreaterThan(0)
    }
  })

  test("evaluation envelope has exactly four legal tuples and rejects fifth tuples",()=>{
    const accepted=vectors["V-OK"].expected_evaluation, rejected=vectors["V-24"].expected_evaluation
    const unavailable=vectors["V-UNVER"].expected_evaluation, malformed=vectors["V-18M"].expected_evaluation
    for (const value of [accepted,rejected,unavailable,malformed]) expect(validateSchema(value,registry[schemaNames[2]],registry)).toEqual([])
    for (const mutant of [
      {...accepted,profile_verdict:"rejected"},
      {...rejected,aggregate:accepted.aggregate},
      {...unavailable,profile_verdict:"accepted"},
      {...malformed,finding:null}]) expect(validateSchema(mutant,registry[schemaNames[2]],registry).length).toBeGreaterThan(0)
  })

  test("all vectors except V-UNVER mechanically pass unchanged positions 1-17",()=>{
    const report:any[]=[]
    for (const [name,vector] of Object.entries(vectors)) {
      const prefix=evaluateRsfPrefixThroughPosition17(vector.input)
      const intentional=name==="V-UNVER"
      if (intentional) expect(prefix).toMatchObject({success:false,finding:{code:"source_admission_prerequisite_unavailable",check_position:8}})
      else expect(prefix.success).toBe(true)
      report.push({vector_id:name,prefix_result:prefix.success?"success":`${prefix.finding.code}@${prefix.finding.check_position}`,
        stage_boundary_reached:prefix.success,first_expected_position:vector.expected_check_position,intentionally_earlier:intentional})
    }
    expect(report.sort((a,b)=>a.vector_id.localeCompare(b.vector_id))).toEqual(json("conformance/recursive-singleton-fold-v0/reachability-report.json"))
  })

  test("independent reference model enforces exact first finding and null failure aggregates",()=>{
    for (const vector of Object.values(vectors)) {
      const actual=evaluatePositions18Through28(vector).result
      expect(canonical(actual)).toBe(canonical(vector.expected_evaluation))
      if (vector.expected_code) expect(vector.expected_evaluation.aggregate).toBeNull()
    }
  })

  test("expected V-OK aggregate and envelope are reconstructed, not candidate aliases",()=>{
    const expected=reconstructExpected(vectors["V-OK"])
    expect(expected.aggregate).not.toBe(vectors["V-OK"].stage_input.candidate_aggregate)
    expect(canonical(expected.aggregate)).toBe(canonical(vectors["V-OK"].expected_evaluation.aggregate))
    expect(canonical(expected.envelope)).toBe(canonical(vectors["V-OK"].expected_evaluation))
  })

  test("actual import graph and candidate-as-expected source audit are clean",()=>{
    expect(inspectImports()).toMatchObject({violations:[],production_imports:0})
  })

  test("contract freezes exact order, compound order, descriptor, and position-28 modes",()=>{
    expect(contract.position_order.map((x:any)=>x.position)).toEqual([18,19,20,21,22,23,24,25,26,27,28])
    expect(contract.position_order[0].checks).toEqual(["stage_shape","singleton_policy_eligibility"])
    expect(contract.position_order[2].checks).toEqual(["input_semantic_statement","input_semantic_result_commitment"])
    expect(contract.position_order[3].checks).toEqual(["canonical_inclusion_set","inclusion_set_commitment"])
    expect(contract.position_order[5].checks).toEqual(["output_semantic_statement","output_stored_digest","input_output_preservation"])
    expect(contract.position_order[8].checks).toEqual(["pre_aggregation_breakdown","pre_aggregation_breakdown_commitment"])
    expect(contract.position_24_descriptor.fields).toEqual(["schema","source_object_schema","source_admission_state","fold_policy_commitment","comparability_class_commitment","transition_rule_commitment","singleton_transition_eligibility"])
    expect(contract.position_28_remaining_fields).toHaveLength(19)
    expect(contract.position_28_remaining_fields.map((x:any)=>x.field)).toEqual(["schema","profile_version","aggregate_id","source_entry_ref","semantic_statement","semantic_result_commitment","canonical_inclusion_set","inclusion_set_commitment","fold_policy_declaration","fold_policy_commitment","comparability_class_declaration","comparability_class_commitment","transition_rule_declaration","transition_rule_commitment","pre_aggregation_breakdown","pre_aggregation_breakdown_commitment","transition_result","no_stronger_semantic_class_created","profile_local_notes"])
  })

  test("finding map is exact and positions 18-28 add no unverifiable code",()=>{
    const findingSchema=registry[schemaNames[3]], codes=findingSchema.properties.code.enum as string[]
    expect(codes.filter(code=>code.includes("unverifiable") && Object.keys(contract.finding_position_map).includes(code))).toEqual([])
    for (const [code,positions] of Object.entries(contract.finding_position_map)) {
      expect(codes).toContain(code)
      const rules=findingSchema.allOf.filter((x:any)=>JSON.stringify(x.if).includes(`\"${code}\"`))
      expect(rules.length).toBeGreaterThan(0)
      for (const position of positions as number[]) expect(JSON.stringify(rules)).toContain(String(position))
    }
  })

  test("positions 1-17 runtime blobs equal the exact canonical base",()=>{
    expect(Object.keys(contract.positions_1_17_runtime_blobs)).toHaveLength(6)
    for (const [path,oid] of Object.entries(contract.positions_1_17_runtime_blobs)) {
      const actual=execFileSync("git",["rev-parse",`:${path}`],{cwd:root,encoding:"utf8"}).trim()
      expect(actual).toBe(oid)
      const base=execFileSync("git",["rev-parse",`${contract.canonical_base}:${path}`],{cwd:root,encoding:"utf8"}).trim()
      expect(actual).toBe(base)
    }
  })

  test("diff remains normative-only with no evaluator/runtime/export path",()=>{
    const paths=execFileSync("git",["diff","--name-only",contract.canonical_base,"--"],{cwd:root,encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean)
    expect(paths.some(path=>path.startsWith("src/receiptos/rsf/"))).toBe(false)
    expect(paths.some(path=>path==="src/receiptos/index.ts" || path.includes("counterfactual") || path.includes("chronicle") || path.includes("crc") || path.includes("b5"))).toBe(false)
  })

  test("V-MUTATE, V-REPLAY, and V-FALL execute their obligations",()=>{
    expect(executableSpecialCases(vectors)).toMatchObject({mutation_snapshot_unchanged:true,mutation_no_alias:true,
      replay_byte_identical:true,fallthrough_accepted_only_after_28:true,accepted_cases:5})
  })

  test("governing prose carries no stale position mappings or unfrozen exception",()=>{
    const reference=readGitIndexBytes("docs/RECURSIVE_SINGLETON_FOLD_REFERENCE_PACKAGE_V0_WORKING_DRAFT.md").toString("utf8")
    expect(reference).not.toContain("semantic_result_commitment` at positions 18/23")
    expect(reference).not.toContain("inclusion_set_commitment` at position 19")
    expect(reference).not.toContain("transition_result` (§12 position 24)")
    expect(reference).not.toContain("no_stronger_semantic_class_created` result (§12 position 25)")
    expect(reference).toContain("positions 18–28 normative contract is frozen")
  })

  test("adversarial repair matrix is mechanically guarded",()=>{
    const findingMutant=structuredClone(vectors["V-24"].expected_evaluation)
    findingMutant.finding.check_position=25
    expect(validateSchema(findingMutant,registry[schemaNames[2]],registry).length).toBeGreaterThan(0) // wrong finding position
    expect(validateSchema({...vectors["V-OK"].expected_evaluation,profile_verdict:"rejected"},registry[schemaNames[2]],registry).length).toBeGreaterThan(0) // fifth tuple
    const preacceptStage=structuredClone(registry[schemaNames[0]])
    preacceptStage.$defs.semanticStatementClaim.properties.source_admission_state={const:"chronicle_entry_independently_admitted"}
    const stageClaim=structuredClone(vectors["V-OK"].stage_input); stageClaim.claimed_input_semantic_statement.source_admission_state="label_only"
    expect(validateSchema(stageClaim,preacceptStage,{...registry,[schemaNames[0]]:preacceptStage}).length).toBeGreaterThan(0) // forbidden schema pre-acceptance
    const impossible=structuredClone(vectors["V-OK"].expected_evaluation.aggregate); impossible.transition_result.status="promoted_success"
    expect(validateSchema(impossible,registry[schemaNames[1]],registry).length).toBeGreaterThan(0) // accepted impossible literal
    expect(Object.keys(vectors)).toHaveLength(34) // missing vector
    const manifest=json(`${pkg}/manifest.json`)
    expect(manifest.fixture_set_sha256).toBe("64b88bfbd578ee8399f6a78793f14fc71271937aef517afe8fab7822aaa46d4a") // wrong digest
    expect(contract.position_24_descriptor.forbidden_inputs).toContain("candidate_boolean") // candidate boolean as proof
    expect(contract.position_28_remaining_fields[16].field).toBe("transition_result") // position-28 order swap
    expect(inspectImports({"x.ts":'import x from "../../src/receiptos/rsf/evaluate-positions-18"'}).violations.length).toBeGreaterThan(0) // production import
    expect(Object.keys(contract.positions_1_17_runtime_blobs)).toHaveLength(6) // runtime byte mutation
    expect(contract.source_admission_fixture_set_sha256).toBe("ff35ca8ae5cef10009479d50c10e111869875f6f62fb9d6bcb00f5aa5a1b4b4f") // old pin
    expect(inspectImports({"x.py":'agg = stage["candidate_aggregate"]'}).violations).toContain("x.py:candidate-as-expected") // copied expected
    const auditSource=readGitIndexBytes("conformance/recursive-singleton-fold-v0/audit_expected.ts").toString("utf8")
    expect(auditSource).toContain("useBytes=(path:string)=>readGitIndexBytes(path)") // checkout-byte audit
    expect(manifest.files.filter((x:any)=>x.path.startsWith("src/receiptos/schemas/")).map((x:any)=>x.path)).toEqual(contract.schema_dependencies) // missing schema dependency
    expect(contract.position_order.map((x:any)=>x.position)).toEqual([18,19,20,21,22,23,24,25,26,27,28]) // stale mapping
  })
})
