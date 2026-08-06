#!/usr/bin/env python3
"""Independent RSF v0 normative-vector generator.

This script intentionally imports no ReceiptOS or future RSF evaluator helper.
It owns a small RFC-8785-compatible canonicalizer for the JSON domain used by
these fixtures (objects, arrays, strings, booleans, null, and integers).
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import subprocess
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
        "admission_fixture_set_sha256":"ff35ca8ae5cef10009479d50c10e111869875f6f62fb9d6bcb00f5aa5a1b4b4f",
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

def reconstruct_expected(prefix, input_value):
    """Reconstruct accepted facts without reading any candidate value or ID."""
    entry = copy.deepcopy(prefix["sourceEntry"])
    notes = input_value["profile_local_notes"]
    policy = copy.deepcopy(input_value["fold_policy_declaration"])
    class_decl = copy.deepcopy(input_value["comparability_class_declaration"])
    rule = copy.deepcopy(input_value["transition_rule_declaration"])
    source_commit, pc, cc, rc = digest(entry), digest(policy), digest(class_decl), digest(rule)
    input_statement = {
        "schema":"chronicle_entry_singleton_semantic_statement.v0","source_entry_schema":"chronicle_entry.v0",
        "source_entry_ref":entry["entry_id"],"source_entry_content_commitment":source_commit,
        "source_admission_state":"chronicle_entry_independently_admitted","fold_policy_commitment":pc,
        "comparability_class_commitment":cc,"transition_rule_commitment":rc,
        "singleton_transition_eligibility":"eligible_under_exact_singleton_profile_declarations"
    }
    input_commit = digest(input_statement)
    inclusion = [{"member_schema":"chronicle_entry.v0","member_ref":entry["entry_id"],
                  "member_source_entry_content_commitment":source_commit}]
    inclusion_commit = digest(inclusion)
    # A distinct output reconstruction; never alias or copy the input claim.
    output_statement = {
        "schema":"chronicle_entry_singleton_semantic_statement.v0","source_entry_schema":entry["schema"],
        "source_entry_ref":entry["entry_id"],"source_entry_content_commitment":source_commit,
        "source_admission_state":"chronicle_entry_independently_admitted","fold_policy_commitment":pc,
        "comparability_class_commitment":cc,"transition_rule_commitment":rc,
        "singleton_transition_eligibility":"eligible_under_exact_singleton_profile_declarations"
    }
    output_commit = digest(output_statement)
    input_descriptor = {
        "schema":"recursive_singleton_semantic_class_descriptor.v0",
        "source_object_schema":input_statement["source_entry_schema"],
        "source_admission_state":input_statement["source_admission_state"],"fold_policy_commitment":pc,
        "comparability_class_commitment":cc,"transition_rule_commitment":rc,
        "singleton_transition_eligibility":input_statement["singleton_transition_eligibility"]
    }
    output_descriptor = {
        "schema":"recursive_singleton_semantic_class_descriptor.v0",
        "source_object_schema":output_statement["source_entry_schema"],
        "source_admission_state":output_statement["source_admission_state"],"fold_policy_commitment":pc,
        "comparability_class_commitment":cc,"transition_rule_commitment":rc,
        "singleton_transition_eligibility":output_statement["singleton_transition_eligibility"]
    }
    no_promotion = (canonical(input_descriptor) == canonical(output_descriptor)
                    and input_commit == output_commit and policy == POLICY and class_decl == CLASS and rule == RULE)
    breakdown = {
        "schema":"recursive_singleton_breakdown.v0","source_entry_ref":entry["entry_id"],
        "source_entry_content_commitment":source_commit,"source_admission_prerequisite":"chronicle_entry_independently_admitted",
        "inclusion_decision":"included","exclusion_decision":"none","comparability_evaluation":"singleton_class_eligible",
        "policy_evaluation":"singleton_policy_eligible","transition_input":{"semantic_result_commitment":input_commit},
        "transition_output":{"semantic_result_commitment":output_commit},"no_elevation_finding":"no_stronger_semantic_class_created"
    }
    bd = digest(breakdown)
    seed = {"schema":"recursive_singleton_aggregate_identity_seed.v0","aggregate_schema":"recursive_singleton_aggregate.v0",
            "profile_version":"recursive-singleton-fold-profile-v0","source_entry_ref":entry["entry_id"],
            "source_entry_content_commitment":source_commit,"semantic_result_commitment":output_commit,
            "inclusion_set_commitment":inclusion_commit,"fold_policy_commitment":pc,
            "comparability_class_commitment":cc,"transition_rule_commitment":rc,
            "pre_aggregation_breakdown_commitment":bd}
    aggregate = {
        "schema":"recursive_singleton_aggregate.v0","profile_version":"recursive-singleton-fold-profile-v0",
        "aggregate_id":digest(seed),"source_entry_ref":entry["entry_id"],"source_entry_content_commitment":source_commit,
        "semantic_statement":output_statement,"semantic_result_commitment":output_commit,"canonical_inclusion_set":inclusion,
        "inclusion_set_commitment":inclusion_commit,"fold_policy_declaration":policy,"fold_policy_commitment":pc,
        "comparability_class_declaration":class_decl,"comparability_class_commitment":cc,
        "transition_rule_declaration":rule,"transition_rule_commitment":rc,"pre_aggregation_breakdown":breakdown,
        "pre_aggregation_breakdown_commitment":bd,"transition_result":copy.deepcopy(TRANSITION),
        "no_stronger_semantic_class_created":no_promotion,"profile_local_notes":notes
    }
    return {"input_statement":input_statement,"input_commitment":input_commit,"input_descriptor":input_descriptor,
            "output_descriptor":output_descriptor,"aggregate":aggregate,
            "envelope":envelope("evaluated", aggregate=aggregate)}

def envelope(state, code=None, pos=None, aggregate=None):
    finding = None if code is None else {"schema":"recursive_singleton_fold_finding.v0","code":code,"check_position":pos}
    return {"schema":"recursive_singleton_fold_evaluation.v0","evaluation_state":state,
            "profile_verdict":"accepted" if state == "evaluated" and aggregate is not None else ("rejected" if state == "evaluated" else None),
            "aggregate":aggregate,"finding":finding}

def vector(case_id, state="evaluated", code=None, pos=None, mutate=None, notes=None, entry_id=None,
           scope="positions_18_28", context=None):
    inp, prefix, stage = baseline(notes, entry_id)
    if mutate: mutate(inp, prefix, stage)
    reconstructed = reconstruct_expected(prefix, inp)
    agg = reconstructed["aggregate"] if state == "evaluated" and code is None else None
    expected = reconstructed["envelope"] if agg is not None else envelope(state, code, pos, None)
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
        lambda i,p,s: i["source_admission_bundle"]["source_evidence"]["anchor"].update(receipt_root=""), scope="prefix_and_stage")
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

This legacy template is retained only for source-history readability and is
never emitted. `README_V2` below is the sole generated package README.
"""

README_V2 = """# Recursive Singleton Fold v0 normative fixtures

These 34 vectors freeze the adopted positions 18–28 contract. They are
normative data, not a production evaluator. Python and TypeScript independently
reconstruct expected facts without production helpers or candidate-as-expected
copying.

The manifest hashes exact Git-index/blob bytes. Package model A owns 40
repository-relative artifacts: this README, `contract.json`, four schemas, and
34 vectors. `fixture_set_sha256` is SHA-256 over sorted
`<repository-path>\\t<file-sha256>\\n` records and excludes the manifest itself.
Semantic commitments hash canonical JSON, never file or checkout bytes.
Verification is read-only; only `--generate` intentionally writes artifacts.

`contract.json` is the sole machine-readable authority for vector execution
classes. Exactly 32 vectors use the public complete entrypoint, V-28A1 uses the
stage-continuation invariant seam, and V-GIT is package-integrity-only. Equal
public `input` and `stage_input` bytes always imply equal canonical public
evaluation bytes; fixture-only continuation data cannot change that result.
"""

SCHEMA_PATHS = [
    "src/receiptos/schemas/recursive-singleton-aggregate-v0.schema.json",
    "src/receiptos/schemas/recursive-singleton-fold-evaluation-v0.schema.json",
    "src/receiptos/schemas/recursive-singleton-fold-finding-v0.schema.json",
    "src/receiptos/schemas/recursive-singleton-fold-stage-input-v0.schema.json",
]

def git_index_bytes(path):
    return subprocess.check_output(["git", "show", f":{path}"], cwd=ROOT)

def package_paths(vectors):
    prefix = "tests/fixtures/recursive-singleton-fold-v0"
    return sorted(SCHEMA_PATHS + [f"{prefix}/README.md", f"{prefix}/contract.json"] +
                  [f"{prefix}/vectors/{case}.json" for case in vectors], key=lambda x:x.encode("utf-8"))

EXECUTION_CLASSES = ("public-complete-entrypoint", "stage-continuation-invariant", "package-integrity-only")

def derived_execution_class(vector):
    if vector["expected_evaluation"] is None:
        return "package-integrity-only"
    prefix=vector["prefix_continuation"]
    fresh=digest(prefix["sourceEntry"])
    if prefix["sourceEntryContentCommitment"] != fresh:
        return "stage-continuation-invariant"
    return "public-complete-entrypoint"

def validate_execution_classes(vectors, contract):
    scope=contract["f02_normative_amendment_scope"]
    assert scope["base"] == "d3bc93ffdf5e13ed56d988634afcdde943966058"
    assert len(scope["paths"]) == 13 and not any(path.startswith(("src/",".github/")) for path in scope["paths"])
    assert scope["only_allowed_production_related_test"] == "tests/receiptos/rsf-positions-18-through-28.test.ts"
    assert scope["production_source_forbidden"] is True
    section=contract["vector_execution_classes"]
    assert tuple(section["allowed"]) == EXECUTION_CLASSES
    table=section["vectors"]
    assert set(table) == set(vectors)
    counts={name:0 for name in EXECUTION_CLASSES}
    public_results={}
    for case,vector in vectors.items():
        actual=table[case]["execution_class"]
        expected=derived_execution_class(vector)
        assert actual == expected, f"{case}: {actual} != mechanically derived {expected}"
        counts[actual]+=1
        if actual == "public-complete-entrypoint":
            public_key=canonical({"input":vector["input"],"stage_input":vector["stage_input"]})
            result_bytes=canonical(vector["expected_evaluation"])
            previous=public_results.setdefault(public_key,result_bytes)
            assert previous == result_bytes, f"{case}: equal public arguments have unequal expected bytes"
    assert counts == {"public-complete-entrypoint":32,"stage-continuation-invariant":1,"package-integrity-only":1}
    invariant=table["V-28A1"]
    assert invariant == {
        "execution_class":"stage-continuation-invariant",
        "public_input_representable":False,
        "injected_continuation_field":"prefix_continuation.sourceEntryContentCommitment",
        "fresh_recomputation_source":"canonical_json_utf8_sha256(prefix_continuation.sourceEntry)",
        "non_public_reason":"The public evaluator recomputes the position-14 commitment from raw input and accepts no caller-supplied prefix continuation; V-28A1 and V-OK therefore have byte-identical public arguments.",
        "owned_position":28,
        "owned_subcheck":"28a.1",
        "expected_finding":{"code":"source_entry_content_commitment_mismatch","check_position":28},
    }
    assert canonical(vectors["V-OK"]["input"]) == canonical(vectors["V-28A1"]["input"])
    assert canonical(vectors["V-OK"]["stage_input"]) == canonical(vectors["V-28A1"]["stage_input"])
    assert vectors["V-28A1"]["expected_evaluation"]["aggregate"] is None
    assert table["V-28A2"] == {"execution_class":"public-complete-entrypoint","owned_position":28,"owned_subcheck":"28a.2",
        "public_operand_field":"stage_input.candidate_aggregate.source_entry_content_commitment",
        "expected_finding":{"code":"source_entry_content_commitment_mismatch","check_position":28}}
    rows=[]
    for case in sorted(vectors):
        expected_hash=hashlib.sha256(canonical(vectors[case]["expected_evaluation"]).encode("utf-8")).hexdigest()
        rows.append(f"{case}\t{expected_hash}\n")
    expected_set_hash=hashlib.sha256("".join(rows).encode("utf-8")).hexdigest()
    assert expected_set_hash == section["expected_evaluation_set_sha256"]
    return counts

def result_record(vectors, fixture_hash, contract):
    class_counts=validate_execution_classes(vectors,contract)
    reconstructed = reconstruct_expected(vectors["V-OK"]["prefix_continuation"], vectors["V-OK"]["input"])
    aggregate = reconstructed["aggregate"]
    return {"generator":"python-independent-rsf-v0","mode":"independent_reconstruction",
            "vector_count":len(vectors),"package_inventory_count":40,"fixture_set_sha256":fixture_hash,
            "canonicalizer":"local recursive JSON canonicalizer; no production imports",
            "execution_class_counts":class_counts,
            "public_determinism_checks":32,
            "v_ok_v_28a1_public_arguments_byte_identical":True,
            "v_ok":{"source_entry_content_commitment":aggregate["source_entry_content_commitment"],
                    "semantic_result_commitment":aggregate["semantic_result_commitment"],
                    "inclusion_set_commitment":aggregate["inclusion_set_commitment"],
                    "fold_policy_commitment":aggregate["fold_policy_commitment"],
                    "comparability_class_commitment":aggregate["comparability_class_commitment"],
                    "transition_rule_commitment":aggregate["transition_rule_commitment"],
                    "pre_aggregation_breakdown_commitment":aggregate["pre_aggregation_breakdown_commitment"],
                    "aggregate_id":aggregate["aggregate_id"],
                    "aggregate_bytes_sha256":hashlib.sha256(canonical(aggregate).encode("utf-8")).hexdigest(),
                    "envelope_bytes_sha256":hashlib.sha256(canonical(reconstructed["envelope"]).encode("utf-8")).hexdigest()}}

def reachability_record(vectors, contract):
    rows=[]
    for case in sorted(vectors):
        vector=vectors[case]
        intentional=case == "V-UNVER"
        rows.append({"vector_id":case,
            "prefix_result":"source_admission_prerequisite_unavailable@8" if intentional else "success",
            "stage_boundary_reached":not intentional,
            "first_expected_position":vector["expected_check_position"],
            "intentionally_earlier":intentional,
            "execution_class":contract["vector_execution_classes"]["vectors"][case]["execution_class"]})
    return rows

def generate():
    VECTORS.mkdir(parents=True, exist_ok=True)
    (OUT/"README.md").write_text(README_V2, encoding="utf-8", newline="\n")
    vectors=build_vectors()
    for case in sorted(vectors, key=lambda x:x.encode("utf-8")):
        (VECTORS/f"{case}.json").write_text(json.dumps(vectors[case],ensure_ascii=False,indent=2)+"\n",encoding="utf-8",newline="\n")
    rows=[]; entries=[]
    for rel in package_paths(vectors):
        # Generation records the already-staged candidate bytes. This keeps
        # checkout CRLF materialization outside normative package identity.
        raw=git_index_bytes(rel); h=hashlib.sha256(raw).hexdigest()
        entries.append({"path":rel,"sha256":h}); rows.append(f"{rel}\t{h}\n")
    fixture_hash=hashlib.sha256("".join(rows).encode("utf-8")).hexdigest()
    manifest={"schema":"recursive_singleton_fold_fixture_manifest.v0","package_version":"recursive-singleton-fold-v0",
              "dependency_model":"A-included-schemas","file_count":len(entries),"files":entries,
              "fixture_set_sha256":fixture_hash,"manifest_self_excluded":True,
              "path_order":"ascending UTF-8 bytes","byte_domain":"Git-index/blob bytes"}
    (OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8",newline="\n")
    contract=json.loads(git_index_bytes("tests/fixtures/recursive-singleton-fold-v0/contract.json"))
    result=result_record(vectors, fixture_hash, contract)
    (Path(__file__).parent/"python-generator-output.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8",newline="\n")
    (Path(__file__).parent/"reachability-report.json").write_text(json.dumps(reachability_record(vectors,contract),indent=2)+"\n",encoding="utf-8",newline="\n")
    return result

def verify():
    vectors=build_vectors()
    contract=json.loads(git_index_bytes("tests/fixtures/recursive-singleton-fold-v0/contract.json"))
    manifest=json.loads(git_index_bytes("tests/fixtures/recursive-singleton-fold-v0/manifest.json"))
    expected_paths=package_paths(vectors)
    assert manifest["file_count"] == 40 and [x["path"] for x in manifest["files"]] == expected_paths
    rows=[]
    for item in manifest["files"]:
        actual=hashlib.sha256(git_index_bytes(item["path"])).hexdigest()
        assert actual == item["sha256"], item["path"]
        rows.append(f'{item["path"]}\t{actual}\n')
    fixture_hash=hashlib.sha256("".join(rows).encode("utf-8")).hexdigest()
    assert fixture_hash == manifest["fixture_set_sha256"]
    for case, expected in vectors.items():
        actual=json.loads(git_index_bytes(f"tests/fixtures/recursive-singleton-fold-v0/vectors/{case}.json"))
        assert actual == expected, case
    result=result_record(vectors, fixture_hash, contract)
    committed_reachability=json.loads(git_index_bytes("conformance/recursive-singleton-fold-v0/reachability-report.json"))
    assert committed_reachability == reachability_record(vectors,contract)
    committed=json.loads(git_index_bytes("conformance/recursive-singleton-fold-v0/python-generator-output.json"))
    assert committed == result
    return result

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true", help="intentionally rewrite generated fixtures")
    args=parser.parse_args()
    result=generate() if args.generate else verify()
    print(json.dumps(result,sort_keys=True))

if __name__ == "__main__": main()
