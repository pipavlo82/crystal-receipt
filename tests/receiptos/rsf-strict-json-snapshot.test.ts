import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { evaluateCompleteRsf, evaluateCompleteRsfFromPrefix } from "../../src/receiptos/rsf/evaluate-complete-rsf"
import { evaluateRsfPositions18Through28 } from "../../src/receiptos/rsf/evaluate-positions-18-through-28"
import { snapshotRsfJson } from "../../src/receiptos/rsf/strict-json-snapshot"

const root=resolve(import.meta.dir,"../..")
const vector=JSON.parse(readFileSync(resolve(root,"tests/fixtures/recursive-singleton-fold-v0/vectors/V-OK.json"),"utf8"))
const prefixOf=(source:any)=>({
  verifiedSourceEntry:source.prefix_continuation.sourceEntry,
  sourceEntryContentCommitment:source.prefix_continuation.sourceEntryContentCommitment,
  foldPolicyDeclaration:source.prefix_continuation.foldPolicyDeclaration,
  foldPolicyCommitment:source.prefix_continuation.foldPolicyCommitment,
  comparabilityClassDeclaration:source.prefix_continuation.comparabilityClassDeclaration,
  comparabilityClassCommitment:source.prefix_continuation.comparabilityClassCommitment,
  transitionRuleDeclaration:source.prefix_continuation.transitionRuleDeclaration,
  transitionRuleCommitment:source.prefix_continuation.transitionRuleCommitment,
  profileLocalNotes:source.prefix_continuation.profileLocalNotes,
})
const stageMalformed={evaluation_state:"malformed",profile_verdict:null,aggregate:null,
  finding:{schema:"recursive_singleton_fold_finding.v0",code:"malformed_rsf_stage_input",check_position:18}}
const inputMalformed={evaluation_state:"malformed",profile_verdict:null,aggregate:null,
  finding:{schema:"recursive_singleton_fold_finding.v0",code:"malformed_evaluation_input",check_position:1}}

describe("RSF strict JSON snapshot Proxy boundary",()=>{
  test("rejects top-level and recursively nested raw-input Proxies before traps or semantic evaluation",()=>{
    const cases:{name:string;value:unknown;trapCalls:()=>number}[]=[]
    {
      let calls=0
      const target=structuredClone(vector.input)
      Object.defineProperty(target,"trap_probe",{enumerable:true,get(){calls+=1;return true}})
      cases.push({name:"top-level",value:new Proxy(target,{ownKeys(t){calls+=1;return Reflect.ownKeys(t)}}),trapCalls:()=>calls})
    }
    {
      let calls=0
      const input=structuredClone(vector.input)
      input.source_admission_bundle=new Proxy(input.source_admission_bundle,{getOwnPropertyDescriptor(t,k){calls+=1;return Reflect.getOwnPropertyDescriptor(t,k)}})
      cases.push({name:"nested object",value:input,trapCalls:()=>calls})
    }
    {
      let calls=0
      const input=structuredClone(vector.input)
      input.source_admission_bundle.claimed_source_entry.labels=new Proxy(input.source_admission_bundle.claimed_source_entry.labels,{ownKeys(t){calls+=1;return Reflect.ownKeys(t)}})
      cases.push({name:"nested array",value:input,trapCalls:()=>calls})
    }
    for(const item of cases){
      const actual=evaluateCompleteRsf(item.value,vector.stage_input)
      expect(actual,item.name).toMatchObject(inputMalformed)
      expect(item.trapCalls(),item.name).toBe(0)
    }
  })

  test("rejects stage Proxies at every governed nesting boundary with exact malformed@18",()=>{
    const cases:{name:string;stage:any}[]=[]
    cases.push({name:"top-level",stage:new Proxy(structuredClone(vector.stage_input),{})})
    { const stage=structuredClone(vector.stage_input); stage.candidate_aggregate=new Proxy(stage.candidate_aggregate,{}); cases.push({name:"candidate aggregate",stage}) }
    { const stage=structuredClone(vector.stage_input); stage.claimed_input_semantic_statement=new Proxy(stage.claimed_input_semantic_statement,{}); cases.push({name:"claimed semantic statement",stage}) }
    { const stage=structuredClone(vector.stage_input); stage.candidate_aggregate.semantic_statement=new Proxy(stage.candidate_aggregate.semantic_statement,{}); cases.push({name:"output semantic statement",stage}) }
    { const stage=structuredClone(vector.stage_input); stage.candidate_aggregate.canonical_inclusion_set=new Proxy(stage.candidate_aggregate.canonical_inclusion_set,{}); cases.push({name:"nested array",stage}) }
    { const stage=structuredClone(vector.stage_input); stage.candidate_aggregate.profile_local_notes=new Proxy({},{}); cases.push({name:"profile local notes",stage}) }
    for(const item of cases){
      const actual=evaluateCompleteRsfFromPrefix(prefixOf(vector),item.stage)
      expect(actual,item.name).toMatchObject(stageMalformed)
    }
  })

  test("rejects changing and throwing Proxy traps without invoking any trap",()=>{
    const handlers:{name:string;handler:ProxyHandler<any>;calls:{value:number}}[]=[]
    for(const name of ["changing ownKeys","changing descriptor","throwing ownKeys","throwing descriptor"]){
      const calls={value:0}
      const handler:ProxyHandler<any>=name==="changing ownKeys" ? {ownKeys(t){calls.value+=1;return calls.value===1?Reflect.ownKeys(t):[]}} :
        name==="changing descriptor" ? {getOwnPropertyDescriptor(t,k){calls.value+=1;return calls.value===1?Reflect.getOwnPropertyDescriptor(t,k):undefined}} :
        name==="throwing ownKeys" ? {ownKeys(){calls.value+=1;throw new Error("trap")}} :
        {getOwnPropertyDescriptor(){calls.value+=1;throw new Error("trap")}}
      handlers.push({name,handler,calls})
    }
    for(const item of handlers){
      const actual=evaluateCompleteRsfFromPrefix(prefixOf(vector),new Proxy(structuredClone(vector.stage_input),item.handler))
      expect(actual,item.name).toMatchObject(stageMalformed)
      expect(item.calls.value,item.name).toBe(0)
    }
  })

  test("blocks the exact invalid-to-valid audit exploit and its valid-to-invalid mirror",()=>{
    for(const direction of ["invalid-to-valid","valid-to-invalid"] as const){
      const target=structuredClone(vector.stage_input)
      target.schema=direction==="invalid-to-valid"?"initially_invalid":"recursive_singleton_fold_stage_input.v0"
      let trapCalls=0
      const proxy=new Proxy(target,{
        getOwnPropertyDescriptor(current,key){
          trapCalls+=1
          if(key==="candidate_aggregate") current.schema=direction==="invalid-to-valid"?"recursive_singleton_fold_stage_input.v0":"mutated_invalid"
          return Reflect.getOwnPropertyDescriptor(current,key)
        }
      })
      const actual=evaluateCompleteRsf(vector.input,proxy)
      expect(actual,direction).toMatchObject(stageMalformed)
      expect(trapCalls,direction).toBe(0)
      expect(actual.profile_verdict,direction).not.toBe("accepted")
    }
  })

  test("rejects live and revoked revocable Proxies before reflection",()=>{
    const live=Proxy.revocable(structuredClone(vector.stage_input),{})
    expect(evaluateCompleteRsfFromPrefix(prefixOf(vector),live.proxy)).toMatchObject(stageMalformed)
    const revoked=Proxy.revocable(structuredClone(vector.stage_input),{})
    revoked.revoke()
    expect(evaluateCompleteRsfFromPrefix(prefixOf(vector),revoked.proxy)).toMatchObject(stageMalformed)
    expect(()=>snapshotRsfJson(revoked.proxy)).toThrow("Proxy values are forbidden")
  })

  test("rejects a Proxy in the internal prefix continuation before any stage position or reconstruction",()=>{
    const prefix=prefixOf(vector)
    prefix.verifiedSourceEntry=new Proxy(prefix.verifiedSourceEntry,{})
    const entered:number[]=[], reconstructed:string[]=[]
    const actual=evaluateRsfPositions18Through28(prefix,vector.stage_input,{enteredPosition:p=>entered.push(p),reconstructedSemanticStatement:s=>reconstructed.push(s)})
    expect(actual).toMatchObject({kind:"finding",completedThrough:18,finding:{code:"malformed_rsf_stage_input",check_position:18}})
    expect(entered).toEqual([])
    expect(reconstructed).toEqual([])
  })

  test("Proxy rejection invokes no getter, setter, iterator, toJSON, or coercion hook",()=>{
    const counters={getter:0,setter:0,iterator:0,toJSON:0,coercion:0}
    const target=structuredClone(vector.stage_input)
    Object.defineProperties(target,{
      getter_probe:{enumerable:true,get(){counters.getter+=1;return true}},
      setter_probe:{enumerable:true,set(){counters.setter+=1}},
      toJSON:{enumerable:true,value(){counters.toJSON+=1;return {}}},
      valueOf:{enumerable:true,value(){counters.coercion+=1;return 1}},
      [Symbol.iterator]:{value(){counters.iterator+=1;return [][Symbol.iterator]()}}
    })
    expect(evaluateCompleteRsfFromPrefix(prefixOf(vector),new Proxy(target,{}))).toMatchObject(stageMalformed)
    expect(counters).toEqual({getter:0,setter:0,iterator:0,toJSON:0,coercion:0})
  })
})
