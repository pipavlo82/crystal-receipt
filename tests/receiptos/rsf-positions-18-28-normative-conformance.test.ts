import { describe, expect, test } from "bun:test"
import { Buffer } from "node:buffer"
import { resolve } from "node:path"
import { auditPackage, canonical, evaluatePositions18Through28, executableSpecialCases, inspectImports, readGitIndexBytes, reconstructExpected } from "../../conformance/recursive-singleton-fold-v0/audit_expected"
import { evaluateRsfPrefixThroughPosition17 } from "../../src/receiptos/rsf/evaluate-prefix-through-position-17"
import { validateSchema, type Registry } from "./helpers/json-schema-2020-subset"
import { filesystemRuntimeEvidence, gitBlobOid, resolveChangedPathEvidence, selectChangedPathEvidence, validateChangedPaths, verifyPinnedRuntimeBlobs } from "./helpers/rsf-normative-ci-evidence"

const root=resolve(import.meta.dir,"../.."), pkg="tests/fixtures/recursive-singleton-fold-v0"
const json=(path:string)=>JSON.parse(readGitIndexBytes(path).toString("utf8"))
const vectorNames=["V-OK","V-18M","V-18P","V-19","V-20A","V-20B","V-21A","V-21B","V-22","V-23A","V-23B","V-23C","V-24","V-25","V-26A","V-26B","V-27","V-28A1","V-28A2","V-28B","V-ORDER","V-ADM","V-TIME","V-LABEL","V-NOPROOF","V-UNVER","V-MAL-REJ","V-INSERT","V-ESCAPE","V-SCALAR","V-GIT","V-MUTATE","V-REPLAY","V-FALL"]
const vectors=Object.fromEntries(vectorNames.map(name=>[name,json(`${pkg}/vectors/${name}.json`)]))
const schemaNames=["recursive-singleton-fold-stage-input-v0.schema.json","recursive-singleton-aggregate-v0.schema.json","recursive-singleton-fold-evaluation-v0.schema.json","recursive-singleton-fold-finding-v0.schema.json"]
const registry:Registry=Object.fromEntries(schemaNames.map(name=>[name,json(`src/receiptos/schemas/${name}`)]))
const contract=json(`${pkg}/contract.json`)
const frozenNormativeMerge="985eee7d14d93589585d4d9364a1563b81684564"

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
        stage_boundary_reached:prefix.success,first_expected_position:vector.expected_check_position,intentionally_earlier:intentional,
        execution_class:contract.vector_execution_classes.vectors[name].execution_class})
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

  test("all vectors have one closed execution class and public determinism cannot be changed by fixture-only continuation",()=>{
    const section=contract.vector_execution_classes, table=section.vectors
    expect(section.allowed).toEqual(["public-complete-entrypoint","stage-continuation-invariant","package-integrity-only"])
    expect(Object.keys(table).sort()).toEqual([...vectorNames].sort())
    expect(Object.values(table).reduce((counts:any,item:any)=>({...counts,[item.execution_class]:(counts[item.execution_class]??0)+1}),{})).toEqual({
      "public-complete-entrypoint":32,"stage-continuation-invariant":1,"package-integrity-only":1})
    expect(Object.entries(table).filter(([,item]:any)=>item.execution_class==="stage-continuation-invariant").map(([id])=>id)).toEqual(["V-28A1"])
    expect(Object.entries(table).filter(([,item]:any)=>item.execution_class==="package-integrity-only").map(([id])=>id)).toEqual(["V-GIT"])
    expect(table["V-28A1"]).toEqual({execution_class:"stage-continuation-invariant",public_input_representable:false,
      injected_continuation_field:"prefix_continuation.sourceEntryContentCommitment",
      fresh_recomputation_source:"canonical_json_utf8_sha256(prefix_continuation.sourceEntry)",owned_position:28,owned_subcheck:"28a.1",
      non_public_reason:"The public evaluator recomputes the position-14 commitment from raw input and accepts no caller-supplied prefix continuation; V-28A1 and V-OK therefore have byte-identical public arguments.",
      expected_finding:{code:"source_entry_content_commitment_mismatch",check_position:28}})
    expect(canonical(vectors["V-OK"].input)).toBe(canonical(vectors["V-28A1"].input))
    expect(canonical(vectors["V-OK"].stage_input)).toBe(canonical(vectors["V-28A1"].stage_input))
    expect(vectors["V-28A1"].expected_evaluation).toMatchObject({evaluation_state:"evaluated",profile_verdict:"rejected",aggregate:null,
      finding:{code:"source_entry_content_commitment_mismatch",check_position:28}})
    expect(table["V-28A2"]).toEqual({execution_class:"public-complete-entrypoint",owned_position:28,owned_subcheck:"28a.2",
      public_operand_field:"stage_input.candidate_aggregate.source_entry_content_commitment",
      expected_finding:{code:"source_entry_content_commitment_mismatch",check_position:28}})
    expect(section.public_determinism_rule).toContain("Byte-identical public input and stage_input arguments MUST produce byte-identical canonical evaluation bytes")
    expect(section.expected_evaluation_set_sha256).toBe("ecc1f4072e635c913343e017c59eb74094290537fe16c6b4e8a85fb5e36e6531")
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
    const result=verifyPinnedRuntimeBlobs(contract.positions_1_17_runtime_blobs,filesystemRuntimeEvidence(root))
    expect(result).toEqual({source:"git-index-blob",paths:Object.keys(contract.positions_1_17_runtime_blobs).sort()})
  })

  test("the public API and production evaluator architecture are byte-identical to the production merge",()=>{
    expect(Object.keys(contract.production_architecture_blobs)).toHaveLength(4)
    expect(verifyPinnedRuntimeBlobs(contract.production_architecture_blobs,filesystemRuntimeEvidence(root))).toEqual({
      source:"git-index-blob",paths:Object.keys(contract.production_architecture_blobs).sort()})
  })

  test("the F-02 amendment has a closed normative/test/conformance-only path inventory",()=>{
    const scope=contract.f02_normative_amendment_scope, paths=Object.keys(scope.paths)
    expect(scope.base).toBe("d3bc93ffdf5e13ed56d988634afcdde943966058")
    expect(paths).toHaveLength(13)
    expect(scope.only_allowed_production_related_test).toBe("tests/receiptos/rsf-positions-18-through-28.test.ts")
    expect(scope.production_source_forbidden).toBe(true)
    expect(paths.filter((path:string)=>path.startsWith("src/")||path.startsWith(".github/")||path.includes("package.json"))).toEqual([])
    expect(new Set(Object.values(scope.paths))).toEqual(new Set(["audit_record","independent_audit","independent_generator","generator_record",
      "reachability_and_classification_record","normative_document","fixture_readme","normative_contract_metadata","fixture_manifest",
      "normative_conformance_test","production_conformance_test"]))
  })

  test("diff remains normative-only with no evaluator/runtime/export path",()=>{
    const result=resolveChangedPathEvidence(root,contract.canonical_base,contract.changed_path_policy,process.env,frozenNormativeMerge)
    expect(result.paths).toEqual([...contract.changed_path_policy.exact_paths].sort())
    expect(result.source).toBe("frozen-two-tree-diff")
  })

  test("runtime-blob evidence is exact-byte, topology-independent, and fail-closed",()=>{
    const bytes=Buffer.from("exact canonical runtime bytes\n","utf8"), oid=gitBlobOid(bytes), pins={"src/receiptos/rsf/example.ts":oid}
    const unavailable=()=>undefined
    expect(verifyPinnedRuntimeBlobs(pins,{indexOid:()=>oid,headOid:unavailable,checkoutBytes:unavailable}).source).toBe("git-index-blob")
    expect(verifyPinnedRuntimeBlobs(pins,{indexOid:unavailable,headOid:()=>oid,checkoutBytes:unavailable}).source).toBe("head-tree-blob")
    expect(verifyPinnedRuntimeBlobs(pins,{indexOid:unavailable,headOid:unavailable,checkoutBytes:()=>bytes}).source).toBe("checked-out-exact-byte-git-blob")
    expect(()=>verifyPinnedRuntimeBlobs(pins,{indexOid:unavailable,headOid:unavailable,checkoutBytes:()=>Buffer.from(bytes.toString().replace("bytes","byteX"))})).toThrow("runtime blob mismatch")
    expect(()=>verifyPinnedRuntimeBlobs(pins,{indexOid:unavailable,headOid:unavailable,checkoutBytes:unavailable})).toThrow("no trustworthy runtime-blob evidence")
    for (const [path,pin] of Object.entries(contract.positions_1_17_runtime_blobs) as [string,string][]) {
      const mutant=Buffer.from(readGitIndexBytes(path)); mutant[mutant.length-1]^=1
      expect(()=>verifyPinnedRuntimeBlobs({[path]:pin},{indexOid:unavailable,headOid:unavailable,checkoutBytes:()=>mutant})).toThrow(`runtime blob mismatch (${path})`)
    }
  })

  test("changed-path evidence covers CI topologies and rejects forbidden or unclassified paths",()=>{
    const policy=contract.changed_path_policy, exact=[...policy.exact_paths]
    const cases=[
      ["detached PR head with base object",{existingTwoTreePaths:exact},"existing-two-tree-diff"],
      ["synthetic merge with event pair",{githubEventPaths:exact},"github-event-two-tree-diff"],
      ["shallow history after exact-object fetch",{githubEventPaths:exact},"github-event-two-tree-diff"],
      ["canonical base and origin unavailable",{pinnedInventoryPaths:exact},"pinned-changed-path-inventory"],
      ["source artifact without .git",{pinnedInventoryPaths:exact},"pinned-changed-path-inventory"]] as const
    for (const [,candidate,source] of cases) expect(selectChangedPathEvidence(policy,candidate).source).toBe(source)
    expect(()=>selectChangedPathEvidence(policy,{})).toThrow("no trustworthy changed-path evidence")
    expect(()=>validateChangedPaths([...exact,"src/receiptos/rsf/evaluate-positions-18-through-28.ts"],policy)).toThrow("forbidden changed-path prefix")
    expect(()=>validateChangedPaths([...exact,"src/receiptos/index.ts"],policy)).toThrow("forbidden changed path")
    expect(()=>validateChangedPaths([...exact,"notes/unknown-rsf-change.md"],policy)).toThrow("changed-path inventory mismatch")
    expect(()=>validateChangedPaths(exact.filter((path:string)=>path!=="tests/fixtures/recursive-singleton-fold-v0/contract.json"),policy)).toThrow("changed-path inventory mismatch")
    expect(()=>validateChangedPaths(exact,{...policy,exact_paths:[...exact,"tests/receiptos/fake-allowed-path.ts"]})).toThrow("changed-path inventory mismatch")
    expect(validateChangedPaths(exact,policy)).toEqual(exact.sort())
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
    expect(manifest.fixture_set_sha256).toBe("879e0caa5d26643755b5a0e4b8836f0215dec3463cb1fa9ab44a82aefe618ee7") // wrong digest
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
