#!/usr/bin/env python3
"""Independent RSF v0 normative-vector generator.

This script intentionally imports no ReceiptOS or future RSF evaluator helper.
It owns a small RFC-8785-compatible canonicalizer for the JSON domain used by
these fixtures (objects, arrays, strings, booleans, null, and integers).
"""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "tests/fixtures/recursive-singleton-fold-v0"
VECTORS = OUT / "vectors"
SOURCE = ROOT / "tests/fixtures/receiptos-chronicle-admission-v0/vectors/01-clean-admitted.json"
ZERO = "sha256:" + "0" * 64

def canonical(value):
    if value is None: return "null"
    if value is True: return "true"
    if value is False: return "false"
    if isinstance(value, int): return str(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, list): return "[" + ",".join(canonical(v) for v in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value, key=lambda k: k.encode("utf-16-be"))
        return "{" + ",".join(canonical(k) + ":" + canonical(value[k]) for k in keys) + "}"
    raise TypeError(f"unsupported JSON value: {type(value)!r}")

def digest(value):
    return "sha256:" + hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()

POLICY = {
    "schema":"recursive_singleton_fold_policy.v0","policy_version":"recursive-singleton-fold-policy-v0",
    "policy_id":"singleton-chronicle-entry-semantic-preservation","source_object_schema":"chronicle_entry.v0",
    "aggregate_object_schema":"recursive_singleton_aggregate.v0","member_cardinality":1,
    "aggregation_mode":"singleton_only","semantic_elevation":"forbidden","source_identity_reuse":"forbidden",
    "multi_member_extension":"deferred"
}
CLASS = {
    "schema":"recursive_singleton_comparability_class.v0","class_version":"recursive-singleton-comparability-class-v0",
    "class_id":"admitted-chronicle-entry-singleton","source_object_schema":"chronicle_entry.v0",
    "admission_required":True,"cross_entry_comparability":"not_asserted","cross_policy_bridge":"deferred",
    "cross_class_bridge":"deferred","singleton_eligibility_rule":"exactly_one_independently_admitted_source_entry"
}
RULE = {
    "schema":"recursive_singleton_transition_rule.v0","rule_version":"recursive-singleton-transition-rule-v0",
    "rule_id":"semantic_result_preserving_singleton_identity_transition","source_object_schema":"chronicle_entry.v0",
    "aggregate_object_schema":"recursive_singleton_aggregate.v0",
    "preserved_equality_relation":"semantic_result_commitment_equality_only","source_identity_reuse":"forbidden",
    "stronger_class_creation":"forbidden","fail_closed_on_malformed_or_unknown_input":True
}
TRANSITION = {
    "status":"singleton_transition_ok","semantic_equivalence_result":"semantic_result_commitment_preserved",
    "source_identity_reuse_result":"source_identity_not_reused",
    "stronger_semantic_class_creation_result":"no_stronger_semantic_class_created"
}

def source_input():
    shared = json.loads(SOURCE.read_text(encoding="utf-8"))
    options = shared["input"]["options"]
    bundle = {
        "schema":"recursive_singleton_fold_source_admission_bundle.v0",
        "bundle_version":"recursive-singleton-fold-source-admission-bundle-v0",
        "admission_profile_id":"receiptos-chronicle-admission-v0",
        "admission_fixture_set_sha256":"ff35ca7a2ef40670c9b08bdbb6838dc675a97f920f3824a6033e9709be639f1d",
        "source_evidence":shared["input"]["evidence"],
        "source_proof_object":shared["input"]["proof_object"],
        "source_entry_construction_options":{
            "entry_id":options["entryId"],"evidence_capsule_ref":options["evidenceCapsuleRef"],
            "provenance_summary_ref":options["provenanceSummaryRef"],"created_from":options["createdFrom"],
            "labels":options["labels"],"notes":options["notes"]
        },
        "claimed_source_entry":shared["expected"]["chronicle_entry"]
    }
    return {
        "schema":"recursive_singleton_fold_evaluation_input.v0",
        "profile_id":"recursive-singleton-fold-profile-v0",
        "source_admission_bundle":bundle,
        "fold_policy_declaration":copy.deepcopy(POLICY),
        "comparability_class_declaration":copy.deepcopy(CLASS),
        "transition_rule_declaration":copy.deepcopy(RULE),
        "profile_local_notes":None
    }

def baseline(notes=None, entry_id=None):
    inp = source_input()
    if entry_id is not None:
        inp["source_admission_bundle"]["source_entry_construction_options"]["entry_id"] = entry_id
        inp["source_admission_bundle"]["claimed_source_entry"]["entry_id"] = entry_id
    inp["profile_local_notes"] = notes
    entry = inp["source_admission_bundle"]["claimed_source_entry"]
    source_commit = digest(entry)
    pc, cc, rc = digest(POLICY), digest(CLASS), digest(RULE)
    statement = {
        "schema":"chronicle_entry_singleton_semantic_statement.v0","source_entry_schema":"chronicle_entry.v0",
        "source_entry_ref":entry["entry_id"],"source_entry_content_commitment":source_commit,
        "source_admission_state":"chronicle_entry_independently_admitted","fold_policy_commitment":pc,
        "comparability_class_commitment":cc,"transition_rule_commitment":rc,
        "singleton_transition_eligibility":"eligible_under_exact_singleton_profile_declarations"
    }
    sem = digest(statement)
    inclusion = [{"member_schema":"chronicle_entry.v0","member_ref":entry["entry_id"],
                  "member_source_entry_content_commitment":source_commit}]
    inc = digest(inclusion)
    breakdown = {
        "schema":"recursive_singleton_breakdown.v0","source_entry_ref":entry["entry_id"],
        "source_entry_content_commitment":source_commit,
        "source_admission_prerequisite":"chronicle_entry_independently_admitted",
        "inclusion_decision":"included","exclusion_decision":"none",
        "comparability_evaluation":"singleton_class_eligible","policy_evaluation":"singleton_policy_eligible",
        "transition_input":{"semantic_result_commitment":sem},
        "transition_output":{"semantic_result_commitment":sem},
        "no_elevation_finding":"no_stronger_semantic_class_created"
    }
    bd = digest(breakdown)
    seed = {
        "schema":"recursive_singleton_aggregate_identity_seed.v0",
        "aggregate_schema":"recursive_singleton_aggregate.v0",
        "profile_version":"recursive-singleton-fold-profile-v0","source_entry_ref":entry["entry_id"],
        "source_entry_content_commitment":source_commit,"semantic_result_commitment":sem,
        "inclusion_set_commitment":inc,"fold_policy_commitment":pc,
        "comparability_class_commitment":cc,"transition_rule_commitment":rc,
        "pre_aggregation_breakdown_commitment":bd
    }
    aggregate = {
        "schema":"recursive_singleton_aggregate.v0","profile_version":"recursive-singleton-fold-profile-v0",
        "aggregate_id":digest(seed),"source_entry_ref":entry["entry_id"],
        "source_entry_content_commitment":source_commit,"semantic_statement":copy.deepcopy(statement),
        "semantic_result_commitment":sem,"canonical_inclusion_set":inclusion,"inclusion_set_commitment":inc,
        "fold_policy_declaration":copy.deepcopy(POLICY),"fold_policy_commitment":pc,
        "comparability_class_declaration":copy.deepcopy(CLASS),"comparability_class_commitment":cc,
        "transition_rule_declaration":copy.deepcopy(RULE),"transition_rule_commitment":rc,
        "pre_aggregation_breakdown":breakdown,"pre_aggregation_breakdown_commitment":bd,
        "transition_result":copy.deepcopy(TRANSITION),"no_stronger_semantic_class_created":True,
        "profile_local_notes":notes
    }
    prefix = {
        "sourceEntry":copy.deepcopy(entry),"sourceEntryContentCommitment":source_commit,
        "foldPolicyDeclaration":copy.deepcopy(POLICY),"foldPolicyCommitment":pc,
        "comparabilityClassDeclaration":copy.deepcopy(CLASS),"comparabilityClassCommitment":cc,
        "transitionRuleDeclaration":copy.deepcopy(RULE),"transitionRuleCommitment":rc,
        "profileLocalNotes":notes,"sourceAdmissionPrerequisite":"chronicle_entry_independently_admitted"
    }
    stage = {"schema":"recursive_singleton_fold_stage_input.v0",
             "claimed_input_semantic_statement":copy.deepcopy(statement),
             "claimed_input_semantic_result_commitment":sem,"candidate_aggregate":aggregate}
    return inp, prefix, stage

def envelope(state, code=None, pos=None, aggregate=None):
    finding = None if code is None else {"schema":"recursive_singleton_fold_finding.v0","code":code,"check_position":pos}
    return {"schema":"recursive_singleton_fold_evaluation.v0","evaluation_state":state,
            "profile_verdict":"accepted" if state == "evaluated" and aggregate is not None else ("rejected" if state == "evaluated" else None),
            "aggregate":aggregate,"finding":finding}

def vector(case_id, state="evaluated", code=None, pos=None, mutate=None, notes=None, entry_id=None,
           scope="positions_18_28", context=None):
    inp, prefix, stage = baseline(notes, entry_id)
    if mutate: mutate(inp, prefix, stage)
    agg = stage["candidate_aggregate"] if state == "evaluated" and code is None else None
    expected = envelope(state, code, pos, agg)
    return {"schema":"recursive_singleton_fold_vector.v0","case_id":case_id,"scope":scope,
            "input":inp,"prefix_continuation":prefix,"stage_input":stage,"expected_evaluation":expected,
            "expected_state":state,"expected_code":code,"expected_check_position":pos,
            "expected_aggregate_presence":agg is not None,"context":context or {}}

def reject(case, code, pos, fn, **kw): return vector(case, "evaluated", code, pos, fn, **kw)
def malformed(case, fn): return vector(case, "malformed", "malformed_rsf_stage_input", 18, fn)

def build_vectors():
    v = {}
    v["V-OK"] = vector("V-OK")
    v["V-18M"] = malformed("V-18M", lambda i,p,s: s.pop("claimed_input_semantic_statement"))
    v["V-18P"] = reject("V-18P","singleton_policy_ineligible",18,
        lambda i,p,s: s["candidate_aggregate"]["canonical_inclusion_set"].append(copy.deepcopy(s["candidate_aggregate"]["canonical_inclusion_set"][0])))
    v["V-19"] = reject("V-19","singleton_class_ineligible",19,
        lambda i,p,s: s["candidate_aggregate"]["canonical_inclusion_set"][0].update(member_ref="other-entry"))
    v["V-20A"] = reject("V-20A","semantic_statement_mismatch",20,
        lambda i,p,s: s["claimed_input_semantic_statement"].update(source_entry_ref="other-entry"))
    v["V-20B"] = reject("V-20B","semantic_result_commitment_mismatch",20,
        lambda i,p,s: s.update(claimed_input_semantic_result_commitment=ZERO))
    v["V-21A"] = reject("V-21A","inclusion_set_mismatch",21,
        lambda i,p,s: s["candidate_aggregate"]["canonical_inclusion_set"][0].update(member_source_entry_content_commitment=ZERO))
    v["V-21B"] = reject("V-21B","inclusion_set_commitment_mismatch",21,
        lambda i,p,s: s["candidate_aggregate"].update(inclusion_set_commitment=ZERO))
    reused = "sha256:" + "1"*64
    v["V-22"] = reject("V-22","forbidden_source_identity_reuse",22,
        lambda i,p,s: s["candidate_aggregate"].update(aggregate_id=reused), entry_id=reused)
    v["V-23A"] = reject("V-23A","semantic_result_commitment_mismatch",23,
        lambda i,p,s: s["candidate_aggregate"]["semantic_statement"].update(source_entry_ref="other-entry"))
    v["V-23B"] = reject("V-23B","semantic_result_commitment_mismatch",23,
        lambda i,p,s: s["candidate_aggregate"].update(semantic_result_commitment=ZERO))
    def p23c(i,p,s):
        a=s["candidate_aggregate"]; a["semantic_statement"]["source_entry_ref"]="other-entry"; a["semantic_result_commitment"]=digest(a["semantic_statement"])
    v["V-23C"] = reject("V-23C","semantic_result_commitment_mismatch",23,p23c)
    v["V-24"] = reject("V-24","no_elevation_invariant_mismatch",24,
        lambda i,p,s: s["candidate_aggregate"].update(no_stronger_semantic_class_created=False))
    v["V-25"] = reject("V-25","transition_result_mismatch",25,
        lambda i,p,s: s["candidate_aggregate"]["transition_result"].update(status="claimed_success_only"))
    v["V-26A"] = reject("V-26A","breakdown_mismatch",26,
        lambda i,p,s: s["candidate_aggregate"]["pre_aggregation_breakdown"].update(policy_evaluation="claimed_label_only"))
    v["V-26B"] = reject("V-26B","breakdown_commitment_mismatch",26,
        lambda i,p,s: s["candidate_aggregate"].update(pre_aggregation_breakdown_commitment=ZERO))
    v["V-27"] = reject("V-27","aggregate_id_mismatch",27,
        lambda i,p,s: s["candidate_aggregate"].update(aggregate_id=ZERO))
    v["V-28A1"] = reject("V-28A1","source_entry_content_commitment_mismatch",28,
        lambda i,p,s: p.update(sourceEntryContentCommitment=ZERO), scope="position_28_prefix_preservation")
    v["V-28A2"] = reject("V-28A2","source_entry_content_commitment_mismatch",28,
        lambda i,p,s: s["candidate_aggregate"].update(source_entry_content_commitment=ZERO))
    v["V-28B"] = reject("V-28B","complete_aggregate_validation_mismatch",28,
        lambda i,p,s: s["candidate_aggregate"].update(profile_local_notes="different"))
    def order(i,p,s):
        s["claimed_input_semantic_statement"]["source_entry_ref"]="first-defect"
        s["candidate_aggregate"]["transition_result"]["status"]="later-defect"
    v["V-ORDER"] = reject("V-ORDER","semantic_statement_mismatch",20,order)
    v["V-ADM"] = reject("V-ADM","singleton_policy_ineligible",18,
        lambda i,p,s: s["candidate_aggregate"]["canonical_inclusion_set"].append(copy.deepcopy(s["candidate_aggregate"]["canonical_inclusion_set"][0])),
        context={"admission_label_is_data_only":True})
    v["V-TIME"] = reject("V-TIME","singleton_class_ineligible",19,
        lambda i,p,s: s["candidate_aggregate"]["canonical_inclusion_set"][0].update(member_ref="not-admitted"),
        context={"timing":"on_time","timing_is_data_only":True})
    v["V-LABEL"] = reject("V-LABEL","no_elevation_invariant_mismatch",24,
        lambda i,p,s: s["candidate_aggregate"].update(no_stronger_semantic_class_created=False),
        context={"success_labels_are_data_only":True})
    v["V-NOPROOF"] = malformed("V-NOPROOF", lambda i,p,s: s.pop("claimed_input_semantic_result_commitment"))
    v["V-UNVER"] = vector("V-UNVER","unverifiable","source_admission_prerequisite_unavailable",8,
        lambda i,p,s: i["source_admission_bundle"]["source_evidence"]["anchor"].update(receipt_root=None), scope="prefix_and_stage")
    v["V-MAL-REJ"] = malformed("V-MAL-REJ", lambda i,p,s: s.update(claimed_input_semantic_result_commitment="not-a-digest"))
    def reverse_keys(i,p,s):
        a=s["candidate_aggregate"]; s["candidate_aggregate"]={k:a[k] for k in reversed(list(a))}
    v["V-INSERT"] = vector("V-INSERT", mutate=reverse_keys, context={"object_insertion_order_is_not_semantic":True})
    v["V-ESCAPE"] = vector("V-ESCAPE", notes="Δ", context={"wire_equivalence":["{\"profile_local_notes\":\"Δ\"}","{\"profile_local_notes\":\"\\u0394\"}"]})
    v["V-SCALAR"] = reject("V-SCALAR","complete_aggregate_validation_mismatch",28,
        lambda i,p,s: s["candidate_aggregate"].update(profile_local_notes="é"), notes="e\u0301",
        context={"unicode_normalization":"forbidden"})
    v["V-MUTATE"] = vector("V-MUTATE", context={"post_snapshot_mutation":"mutate caller trees after independent snapshots; result MUST remain V-OK"})
    v["V-REPLAY"] = vector("V-REPLAY", context={"replay_count":2,"expected_canonical_evaluation_bytes_equal":True})
    v["V-FALL"] = reject("V-FALL","no_elevation_invariant_mismatch",24,
        lambda i,p,s: s["candidate_aggregate"].update(no_stronger_semantic_class_created=False),
        context={"forbidden_fallback":"success literals do not prove carrier validity"})
    git = vector("V-GIT", scope="package_integrity")
    git["expected_evaluation"] = None; git["expected_state"] = "not_invoked"; git["expected_aggregate_presence"] = False
    git["context"]={"byte_domain":"Git index blobs","manifest_self_excluded":True}
    v["V-GIT"] = git
    return v

README = """# Recursive Singleton Fold v0 normative fixtures

These 34 vectors freeze the adopted positions 18–28 contract. They are
normative data, not a production evaluator. Expected commitments are generated
by `conformance/recursive-singleton-fold-v0/generate_expected.py`, which does
not import ReceiptOS implementation helpers, and are independently audited by
the TypeScript script beside it.

The manifest hashes exact LF UTF-8 Git candidate bytes. Its `fixture_set_sha256`
is SHA-256 over sorted `<path>\\t<file-sha256>\\n` records and excludes the
manifest itself. Semantic commitments hash independently canonicalized JSON,
never checkout or file bytes.
"""

def main():
    VECTORS.mkdir(parents=True, exist_ok=True)
    (OUT/"README.md").write_text(README, encoding="utf-8", newline="\n")
    vectors=build_vectors()
    for case in sorted(vectors, key=lambda x:x.encode("utf-8")):
        (VECTORS/f"{case}.json").write_text(json.dumps(vectors[case],ensure_ascii=False,indent=2)+"\n",encoding="utf-8",newline="\n")
    files=["README.md"]+[f"vectors/{c}.json" for c in sorted(vectors,key=lambda x:x.encode("utf-8"))]
    rows=[]; entries=[]
    for rel in files:
        raw=(OUT/rel).read_bytes(); h=hashlib.sha256(raw).hexdigest()
        entries.append({"path":rel,"sha256":h}); rows.append(f"{rel}\t{h}\n")
    fixture_hash=hashlib.sha256("".join(rows).encode("utf-8")).hexdigest()
    manifest={"schema":"recursive_singleton_fold_fixture_manifest.v0","package_version":"recursive-singleton-fold-v0",
              "file_count":len(entries),"files":entries,"fixture_set_sha256":fixture_hash,
              "manifest_self_excluded":True,"path_order":"ascending UTF-8 bytes"}
    (OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8",newline="\n")
    result={"generator":"python-independent-rsf-v0","vector_count":len(vectors),"fixture_set_sha256":fixture_hash,
            "canonicalizer":"local recursive JSON canonicalizer; no production imports"}
    (Path(__file__).parent/"python-generator-output.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8",newline="\n")
    print(json.dumps(result,sort_keys=True))

if __name__ == "__main__": main()
