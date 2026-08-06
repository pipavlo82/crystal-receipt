import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { canonicalize } from "../../src/receiptos/canon/canonicalize"
import { evaluateCompleteRsf, evaluateCompleteRsfFromPrefix } from "../../src/receiptos/rsf/evaluate-complete-rsf"
import { evaluateRsfPositions18Through28 } from "../../src/receiptos/rsf/evaluate-positions-18-through-28"

const root=resolve(import.meta.dir,"../..")
const vectorIds=["V-OK","V-18M","V-18P","V-19","V-20A","V-20B","V-21A","V-21B","V-22","V-23A","V-23B","V-23C","V-24","V-25","V-26A","V-26B","V-27","V-28A1","V-28A2","V-28B","V-ORDER","V-ADM","V-TIME","V-LABEL","V-NOPROOF","V-UNVER","V-MAL-REJ","V-INSERT","V-ESCAPE","V-SCALAR","V-GIT","V-MUTATE","V-REPLAY","V-FALL"] as const
const read=(path:string)=>JSON.parse(readFileSync(resolve(root,path),"utf8"))
const vectors=Object.fromEntries(vectorIds.map(id=>[id,read(`tests/fixtures/recursive-singleton-fold-v0/vectors/${id}.json`)])) as Record<typeof vectorIds[number],any>
const contract=read("tests/fixtures/recursive-singleton-fold-v0/contract.json")
type ExecutionClass="public-complete-entrypoint"|"stage-continuation-invariant"|"package-integrity-only"
const executionClassOf=(id:typeof vectorIds[number])=>contract.vector_execution_classes.vectors[id]?.execution_class as ExecutionClass|undefined
const canonicalBytes=(value:unknown)=>Buffer.from(canonicalize(value),"utf8")
const prefixOf=(vector:any)=>({
  verifiedSourceEntry:vector.prefix_continuation.sourceEntry,
  sourceEntryContentCommitment:vector.prefix_continuation.sourceEntryContentCommitment,
  foldPolicyDeclaration:vector.prefix_continuation.foldPolicyDeclaration,
  foldPolicyCommitment:vector.prefix_continuation.foldPolicyCommitment,
  comparabilityClassDeclaration:vector.prefix_continuation.comparabilityClassDeclaration,
  comparabilityClassCommitment:vector.prefix_continuation.comparabilityClassCommitment,
  transitionRuleDeclaration:vector.prefix_continuation.transitionRuleDeclaration,
  transitionRuleCommitment:vector.prefix_continuation.transitionRuleCommitment,
  profileLocalNotes:vector.prefix_continuation.profileLocalNotes,
})

function executeVector(id:typeof vectorIds[number]) {
  const vector=vectors[id]
  switch(executionClassOf(id)){
    case "public-complete-entrypoint": return evaluateCompleteRsf(vector.input,vector.stage_input)
    case "stage-continuation-invariant": return evaluateCompleteRsfFromPrefix(prefixOf(vector),vector.stage_input)
    case "package-integrity-only": throw new Error(`${id} is package-integrity-only and MUST NOT execute an RSF evaluator`)
    default: throw new Error(`${id} has no closed execution class`)
  }
}

describe("production RSF positions 18 through 28",()=>{
  test("the closed execution-class table routes all 34 vectors through exactly one allowed seam",()=>{
    expect(vectorIds).toHaveLength(34)
    expect(Object.keys(contract.vector_execution_classes.vectors).sort()).toEqual([...vectorIds].sort())
    expect(contract.vector_execution_classes.allowed).toEqual(["public-complete-entrypoint","stage-continuation-invariant","package-integrity-only"])
    expect(vectorIds.map(executionClassOf).reduce((counts:Record<string,number>,value)=>({...counts,[value!]:1+(counts[value!]??0)}),{})).toEqual({
      "public-complete-entrypoint":32,
      "stage-continuation-invariant":1,
      "package-integrity-only":1,
    })
    for(const id of vectorIds){
      const vector=vectors[id]
      const executionClass=executionClassOf(id)
      expect(contract.vector_execution_classes.allowed).toContain(executionClass)
      if(executionClass==="package-integrity-only"){
        expect(id).toBe("V-GIT")
        expect(vector.expected_state).toBe("not_invoked")
        expect(vector.expected_evaluation).toBeNull()
        expect(()=>executeVector(id)).toThrow("MUST NOT execute an RSF evaluator")
        continue
      }
      if(executionClass==="stage-continuation-invariant") expect(id).toBe("V-28A1")
      const actual=executeVector(id)
      expect(canonicalize(actual),id).toBe(canonicalize(vector.expected_evaluation))
      expect(actual.evaluation_state).toBe(vector.expected_state)
      expect(actual.profile_verdict).toBe(vector.expected_evaluation.profile_verdict)
      expect(actual.finding?.code??null).toBe(vector.expected_code)
      expect(actual.finding?.check_position??null).toBe(vector.expected_check_position)
      expect(actual.aggregate!==null).toBe(vector.expected_aggregate_presence)
      if(actual.aggregate) expect(canonicalBytes(actual.aggregate)).toEqual(canonicalBytes(vector.expected_evaluation.aggregate))
      else expect(actual.aggregate).toBeNull()
    }
  })

  test("V-28A1 is a position-28 continuation invariant and cannot change public evaluation",()=>{
    const ok=vectors["V-OK"], invariant=vectors["V-28A1"], classification=contract.vector_execution_classes.vectors["V-28A1"]
    expect(classification).toMatchObject({execution_class:"stage-continuation-invariant",public_input_representable:false,
      injected_continuation_field:"prefix_continuation.sourceEntryContentCommitment",owned_position:28,owned_subcheck:"28a.1",
      expected_finding:{code:"source_entry_content_commitment_mismatch",check_position:28}})
    expect(canonicalBytes(invariant.input)).toEqual(canonicalBytes(ok.input))
    expect(canonicalBytes(invariant.stage_input)).toEqual(canonicalBytes(ok.stage_input))
    const publicOk=evaluateCompleteRsf(ok.input,ok.stage_input)
    const publicInvariant=evaluateCompleteRsf(invariant.input,invariant.stage_input)
    expect(canonicalBytes(publicInvariant)).toEqual(canonicalBytes(publicOk))
    expect(publicInvariant.profile_verdict).toBe("accepted")
    const stageInvariant=executeVector("V-28A1")
    expect(stageInvariant).toMatchObject({evaluation_state:"evaluated",profile_verdict:"rejected",aggregate:null,
      finding:{code:"source_entry_content_commitment_mismatch",check_position:28}})
    expect(canonicalBytes(stageInvariant)).toEqual(canonicalBytes(invariant.expected_evaluation))
  })

  test("the complete evaluator alone emits exactly the four frozen envelope tuples",()=>{
    const accepted=evaluateCompleteRsf(vectors["V-OK"].input,vectors["V-OK"].stage_input)
    const rejected=evaluateCompleteRsf(vectors["V-24"].input,vectors["V-24"].stage_input)
    const unavailable=executeVector("V-UNVER"), malformed=evaluateCompleteRsf(vectors["V-18M"].input,vectors["V-18M"].stage_input)
    expect(canonicalize(accepted)).toBe(canonicalize(vectors["V-OK"].expected_evaluation))
    expect([accepted.evaluation_state,accepted.profile_verdict,accepted.aggregate!==null,accepted.finding]).toEqual(["evaluated","accepted",true,null])
    expect([rejected.evaluation_state,rejected.profile_verdict,rejected.aggregate,rejected.finding!==null]).toEqual(["evaluated","rejected",null,true])
    expect([unavailable.evaluation_state,unavailable.profile_verdict,unavailable.aggregate,unavailable.finding!==null]).toEqual(["unverifiable",null,null,true])
    expect([malformed.evaluation_state,malformed.profile_verdict,malformed.aggregate,malformed.finding!==null]).toEqual(["malformed",null,null,true])
  })

  test("first finding and every compound subcheck retain the frozen order",()=>{
    for(const id of ["V-18M","V-18P","V-20A","V-20B","V-21A","V-21B","V-23A","V-23B","V-23C","V-26A","V-26B","V-28A1","V-28A2","V-28B","V-ORDER"] as const){
      const actual=executeVector(id)
      expect([actual.finding?.code,actual.finding?.check_position]).toEqual([vectors[id].expected_code,vectors[id].expected_check_position])
    }
  })

  test("admission, timing, labels, and candidate booleans never establish local validity",()=>{
    for(const id of ["V-ADM","V-TIME","V-LABEL","V-FALL"] as const){
      const actual=executeVector(id)
      expect(actual.profile_verdict).toBe("rejected")
      expect(actual.finding?.check_position).toBe(vectors[id].expected_check_position)
    }
    const mutant=structuredClone(vectors["V-OK"])
    mutant.stage_input.candidate_aggregate.aggregate_id=`sha256:${"1".repeat(64)}`
    expect(evaluateCompleteRsfFromPrefix(prefixOf(mutant),mutant.stage_input).finding).toMatchObject({code:"aggregate_id_mismatch",check_position:27})
  })

  test("positions 18 through 28 introduce no unavailable result and acceptance completes only at 28",()=>{
    for(const id of vectorIds.filter(id=>id!=="V-GIT"&&id!=="V-UNVER")){
      const result=evaluateRsfPositions18Through28(prefixOf(vectors[id]),vectors[id].stage_input)
      if(result.kind==="finding") expect(result.finding.code).not.toContain("unverifiable")
      else expect(result.completedThrough).toBe(28)
    }
  })

  test("input and stage snapshots reject accessors without invoking them",()=>{
    let calls=0
    const input=structuredClone(vectors["V-OK"].input)
    Object.defineProperty(input,"schema",{enumerable:true,get(){calls+=1;return "recursive_singleton_fold_evaluation_input.v0"}})
    expect(evaluateCompleteRsf(input,vectors["V-OK"].stage_input)).toMatchObject({evaluation_state:"malformed",finding:{check_position:1}})
    const stage=structuredClone(vectors["V-OK"].stage_input)
    Object.defineProperty(stage,"schema",{enumerable:true,get(){calls+=1;return "recursive_singleton_fold_stage_input.v0"}})
    expect(evaluateCompleteRsfFromPrefix(prefixOf(vectors["V-OK"]),stage)).toMatchObject({evaluation_state:"malformed",finding:{check_position:18}})
    expect(calls).toBe(0)
  })

  test("sparse arrays, extended arrays, exotic objects, cycles, symbols, hidden state, unstable reflection, and nonfinite numbers are malformed",()=>{
    const cases:any[]=[]
    const sparse=structuredClone(vectors["V-OK"].stage_input); sparse.candidate_aggregate.canonical_inclusion_set=Array(1); cases.push(sparse)
    const extended=structuredClone(vectors["V-OK"].stage_input); extended.candidate_aggregate.canonical_inclusion_set.extra=true; cases.push(extended)
    const exotic=structuredClone(vectors["V-OK"].stage_input); exotic.candidate_aggregate.transition_result=Object.create({inherited:true}); cases.push(exotic)
    const cyclic=structuredClone(vectors["V-OK"].stage_input); cyclic.candidate_aggregate.transition_result.self=cyclic.candidate_aggregate.transition_result; cases.push(cyclic)
    const symbolic=structuredClone(vectors["V-OK"].stage_input); symbolic[Symbol("semantic")]=true; cases.push(symbolic)
    const hidden=structuredClone(vectors["V-OK"].stage_input); Object.defineProperty(hidden,"hidden",{value:true,enumerable:false}); cases.push(hidden)
    const unstable=new Proxy(structuredClone(vectors["V-OK"].stage_input),{ownKeys(){throw new Error("unstable")}}); cases.push(unstable)
    const nonfinite=structuredClone(vectors["V-OK"].stage_input); nonfinite.candidate_aggregate.fold_policy_declaration.member_cardinality=Infinity; cases.push(nonfinite)
    for(const stage of cases) expect(evaluateCompleteRsfFromPrefix(prefixOf(vectors["V-OK"]),stage)).toMatchObject({evaluation_state:"malformed",finding:{code:"malformed_rsf_stage_input",check_position:18}})
  })

  test("accepted output owns fresh operands and ignores later caller mutation",()=>{
    const vector=structuredClone(vectors["V-MUTATE"]), before=executeVector("V-MUTATE")
    const actual=evaluateCompleteRsfFromPrefix(prefixOf(vector),vector.stage_input)
    expect(actual.aggregate).not.toBe(vector.stage_input.candidate_aggregate)
    expect(actual.aggregate?.semantic_statement).not.toBe(vector.stage_input.claimed_input_semantic_statement)
    expect(actual.aggregate?.semantic_statement).not.toBe(vector.stage_input.candidate_aggregate.semantic_statement)
    vector.prefix_continuation.sourceEntry.labels.push("mutated")
    vector.stage_input.candidate_aggregate.semantic_statement.source_entry_ref="mutated"
    expect(canonicalBytes(actual)).toEqual(canonicalBytes(before))
  })

  test("replay, insertion order, escapes, scalar sequences, and profile notes preserve byte domains",()=>{
    expect(canonicalBytes(executeVector("V-REPLAY"))).toEqual(canonicalBytes(executeVector("V-REPLAY")))
    expect(executeVector("V-INSERT").profile_verdict).toBe("accepted")
    expect(executeVector("V-ESCAPE").profile_verdict).toBe("accepted")
    expect(executeVector("V-SCALAR").finding).toMatchObject({code:"complete_aggregate_validation_mismatch",check_position:28})
    const vector=structuredClone(vectors["V-OK"])
    vector.prefix_continuation.profileLocalNotes=""
    vector.stage_input.candidate_aggregate.profile_local_notes=""
    const empty=evaluateCompleteRsfFromPrefix(prefixOf(vector),vector.stage_input)
    expect(empty).toMatchObject({profile_verdict:"accepted",aggregate:{profile_local_notes:""}})
    expect(canonicalBytes(empty)).not.toEqual(canonicalBytes(executeVector("V-OK")))
  })

  test("production evaluator imports no conformance, expected output, audit, or test helper",()=>{
    const paths=["src/receiptos/rsf/evaluate-positions-18-through-28.ts","src/receiptos/rsf/evaluate-complete-rsf.ts","src/receiptos/rsf/strict-json-snapshot.ts"]
    for(const path of paths){
      const source=readFileSync(resolve(root,path),"utf8")
      expect(source).not.toMatch(/conformance|expected_evaluation|generate_expected|audit_expected|tests\/receiptos/)
    }
    const stageSource=readFileSync(resolve(root,paths[0]),"utf8")
    expect(stageSource).not.toContain("profile_verdict")
    expect(stageSource).not.toContain("evaluation_state")
    expect(stageSource).not.toContain("JSON.stringify(candidate)")
  })
})
