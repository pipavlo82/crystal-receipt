#!/usr/bin/env python3
"""
Independent blind detector for UNANCHORED_ISSUANCE_WITNESS_V0.
Built from SPEC.md + schemas/* ONLY. No vector .expected was read while
authoring this file. Maps a vector .input -> admission_result.v0.

Each nontrivial rule carries a `# SPEC section` citation so the diff is auditable.

The vector `evidence` object is a pre-digested statement of proven facts
(complete_comparable_interval, witness_live, external_observation, resolution,
publication, authority, and optional incompatible_checkpoint_pair / violations).
The detector consumes that digest; it does not re-run SHA-256/Ed25519, which the
spec leaves to the crypto profile doc. Structural crypto findings (check 3 / 11)
are only produced when a vector injects them via evidence.violations.
"""

import json
import sys

# ---------------------------------------------------------------------------
# SPEC 13.4 : closed reason-code enum, grouped by admission-check ordinal and
# with the normative within-check order. (check_ordinal, within_index)
# ---------------------------------------------------------------------------
CODE_TABLE = {
    # Check 1
    "profile_or_artifact_malformed": (1, 0),
    # Check 2
    "issuance_intent_malformed": (2, 0),
    # Check 3 (order pinned in 13.4 / 13.5)
    "witness_receipt_root_malformed": (3, 0),
    "witness_receipt_root_mismatch": (3, 1),
    "unsupported_witness_receipt_signature_profile": (3, 2),
    "malformed_witness_receipt_signature": (3, 3),
    "invalid_witness_receipt_signature": (3, 4),
    "accepted_record_ref_mismatch": (3, 5),
    # Check 4
    "missing_coverage_binding": (4, 0),
    # Check 5
    "coverage_source_authority_not_allowed": (5, 0),
    # Check 6
    "duplicate_coverage_binding": (6, 0),
    # Check 7
    "independent_completeness_unproven": (7, 0),
    # Check 8
    "issuance_stream_fork": (8, 0),
    "sequence_gap": (8, 1),
    "predecessor_ref_mismatch": (8, 2),
    # Check 9
    "issuance_position_inversion": (9, 0),
    # Check 10
    "accepted_record_not_in_witness_log": (10, 0),
    # Check 11
    "witness_checkpoint_root_malformed": (11, 0),
    "witness_checkpoint_root_mismatch": (11, 1),
    "unsupported_witness_checkpoint_signature_profile": (11, 2),
    "malformed_witness_checkpoint_signature": (11, 3),
    "invalid_witness_checkpoint_signature": (11, 4),
    "witness_checkpoint_chain_discontinuous": (11, 5),
    "witness_append_only_consistency_unproven": (11, 6),
    # Check 12
    "witness_stalled": (12, 0),
    # Check 13
    "witness_equivocation": (13, 0),
    # Check 14
    "terminal_to_intent_mismatch": (14, 0),
    # Check 15
    "late_skip": (15, 0),
    "resolution_overdue": (15, 1),
    "late_resolution": (15, 2),
    # Check 16
    "publication_overdue": (16, 0),
    "late_publication": (16, 1),
    # Check 17
    "as_of_scope_malformed": (17, 0),
    "as_of_scope_mismatch": (17, 1),
}

# SPEC 13.6 D : findings that force admission_evaluation_state = malformed
MALFORMED_CODES = {
    "profile_or_artifact_malformed",
    "issuance_intent_malformed",
    "witness_receipt_root_malformed",
    "malformed_witness_receipt_signature",
    "witness_checkpoint_root_malformed",
    "malformed_witness_checkpoint_signature",
    "as_of_scope_malformed",
}


def order_findings(codes):
    """SPEC 13.2 : sort by check ordinal, then within-check normative order."""
    uniq = list(dict.fromkeys(codes))  # dedupe, uniqueItems (schema)
    return sorted(uniq, key=lambda c: CODE_TABLE[c])


def evaluate(vin):
    art = vin["artifacts"]
    ev = vin["evidence"]
    ep = vin["evaluation_point"]

    P = ep["position"]                      # as_of position on the declared basis
    res = ev["resolution"]
    pub = ev["publication"]
    obs = ev["external_observation"]
    auth = ev["authority"]
    complete = ev["complete_comparable_interval"]   # SPEC 5/11: overdue/observation-absence
                                                    # require a proven complete interval
    terminal_present = res["terminal_present"]

    findings = []          # collected reason-code strings (proven violations)
    unverifiable = set()   # SPEC 13.1 : integers 1..17

    # -----------------------------------------------------------------
    # Identity refs (SPEC 12.1). The "accepted record under evaluation" is the
    # computation *result* (terminal commitment) once one exists, else the
    # issuance intent. [JUDGMENT CALL — spec does not name which record the
    # admission view binds to when both exist; see report.]
    # -----------------------------------------------------------------
    coverage_profile_ref = art["coverage_profile"]["coverage_profile_root"]
    intent_root = art["issuance_intent"]["issuance_root"]
    result_root = art["terminal_commitment"]["issuance_result_root"]

    def receipt_root_for(schema):
        for r in art["witness_receipts"]:
            if r["accepted_record_schema"] == schema:
                return r["witness_receipt_root"]
        return None

    if terminal_present:
        accepted_record_schema = "issuance_result_commitment.v0"
        accepted_record_ref = result_root
        witness_receipt_ref = receipt_root_for("issuance_result_commitment.v0")
    else:
        accepted_record_schema = "issuance_record.v0"
        accepted_record_ref = intent_root
        witness_receipt_ref = receipt_root_for("issuance_record.v0")

    as_of = {
        "checkpoint_ref": ep["as_of"]["checkpoint_ref"],
        "log_size": ep["as_of"]["log_size"],
    }

    # -----------------------------------------------------------------
    # Check 7 — independent completeness (SPEC 13, 13.4 check 7; matrix K1/K2)
    # proven_unavailable -> proven finding; insufficient_evidence -> unverifiable.
    # -----------------------------------------------------------------
    ic = auth.get("independent_completeness")
    if ic == "proven_unavailable":
        findings.append("independent_completeness_unproven")
    elif ic == "insufficient_evidence":
        unverifiable.add(7)
    # "proven" -> check 7 passes

    # -----------------------------------------------------------------
    # Check 12 — external observation / witness liveness (SPEC 10, 12; matrix B)
    # witness_stalled only with a proven complete comparable interval; endpoint
    # unavailability alone (incomplete interval) is unverifiable, not a finding.
    # -----------------------------------------------------------------
    if not ev["witness_live"]:
        if complete:
            findings.append("witness_stalled")   # SPEC 10: missed cadence proven
        else:
            unverifiable.add(12)                 # SPEC 10/13.1: unavailability != proven

    # -----------------------------------------------------------------
    # Check 13 — equivocation status (SPEC 14.J, 13.4 check 13)
    # An incompatible checkpoint pair is a proven check-13 violation. This is
    # distinct from append-only consistency merely being unproven (SPEC 13.5).
    # -----------------------------------------------------------------
    if "incompatible_checkpoint_pair" in ev:
        findings.append("witness_equivocation")

    # -----------------------------------------------------------------
    # Check 15 — resolution timing / progress (SPEC 5, 11)
    # -----------------------------------------------------------------
    res_deadline = res.get("deadline_position")
    if terminal_present:
        resolution_progress = "resolved"          # SPEC 11 closed domain
        tpos = res["terminal_position"]
        if tpos <= res_deadline:                  # SPEC 11: event<=deadline => on_time
            resolution_timing = "on_time"
        else:
            resolution_timing = "late"            # SPEC 11: arrives after deadline
            findings.append("late_resolution")    # finding late_resolution (check 15)
    else:
        resolution_progress = "pending"
        if complete and res_deadline is not None and P > res_deadline:
            resolution_timing = "overdue"         # SPEC 11: no terminal, as_of>deadline,
            findings.append("resolution_overdue") # complete interval proven
        elif complete and res_deadline is not None:
            resolution_timing = "not_started"     # SPEC 5/11: deadline not yet passed
        else:
            # SPEC 11/matrix C: incomplete/incomparable interval -> cannot classify;
            # represented by evaluation state + unverifiable_checks, not a timing literal.
            resolution_timing = "not_started"
            unverifiable.add(15)

    # -----------------------------------------------------------------
    # Check 16 — publication timing + publication progress (SPEC 11)
    # publication_progress "not_started" means the terminal has not entered the
    # witness path (SPEC 11). No terminal => publication axis is not_started.
    # -----------------------------------------------------------------
    pub_deadline = pub.get("deadline_position")
    observed = obs["observed"]
    obs_pos = obs.get("position")
    if not terminal_present:
        publication_progress = "not_started"
        publication_timing = "not_started"
    else:
        if observed:
            publication_progress = "externally_observed"   # SPEC 9/11
            if obs_pos <= pub_deadline:
                publication_timing = "on_time"
            else:
                publication_timing = "late"                # SPEC 11: late external obs
                findings.append("late_publication")
        else:
            published = pub.get("checkpoint_published", False)
            deadline_passed = pub_deadline is not None and P > pub_deadline
            if deadline_passed and complete:
                publication_timing = "overdue"             # SPEC 11: proven publication overdue
                findings.append("publication_overdue")
                # SPEC 11: progress axis independent of timing
                publication_progress = "published" if published else "accepted_by_witness"
            elif deadline_passed and not complete:
                # SPEC 11/matrix F: cannot prove observation absence -> external
                # observation (check 12) unverifiable; keep closed timing literal.
                publication_timing = "not_started"
                unverifiable.add(12)
                publication_progress = "published" if published else "not_started"
            else:
                # deadline not passed (SPEC 11 / matrix E): publication has not
                # started for this evaluation.
                publication_timing = "not_started"
                publication_progress = "published" if published else "not_started"

    # -----------------------------------------------------------------
    # Explicit co-occurrence injection (SPEC 13.7 co-occurrence vectors):
    # a vector may declare the exact set of proven violations to test the
    # deterministic total ordering of findings (13.2). Union with primitives.
    # -----------------------------------------------------------------
    if "violations" in ev:
        for code, on in ev["violations"].items():
            if on:
                findings.append(code)

    # -----------------------------------------------------------------
    # SPEC 13.1 : an unverifiable check MUST NOT emit a finding for that check.
    # Drop any check from unverifiable_checks that also produced a proven finding.
    # -----------------------------------------------------------------
    finding_checks = {CODE_TABLE[c][0] for c in findings}
    unverifiable = {n for n in unverifiable if n not in finding_checks}

    # -----------------------------------------------------------------
    # Assemble findings ordering + primary_reason_code (SPEC 13.2, 13.3)
    # -----------------------------------------------------------------
    ordered = order_findings(findings)
    primary_reason_code = ordered[0] if ordered else None

    # -----------------------------------------------------------------
    # Admission evaluation-state / verdict (SPEC 13.6)
    # -----------------------------------------------------------------
    if ordered:
        if any(c in MALFORMED_CODES for c in ordered):
            admission_evaluation_state = "malformed"   # 13.6 D
            admission_verdict = None
        else:
            admission_evaluation_state = "evaluated"   # 13.6 B
            admission_verdict = "invalid"
    elif unverifiable:
        admission_evaluation_state = "unverifiable"    # 13.6 C
        admission_verdict = None
    else:
        # 13.6 A vs E: a resolved/determinable case is evaluated-valid; a still
        # -pending case with nothing proven and nothing unverifiable is
        # not_evaluated (matrix A).
        if terminal_present:
            admission_evaluation_state = "evaluated"   # 13.6 A
            admission_verdict = "valid"
        else:
            admission_evaluation_state = "not_evaluated"  # matrix A / 13.6 E
            admission_verdict = None

    # -----------------------------------------------------------------
    # Predicate dimension (SPEC 12.2 — independent of admission).
    # Predicate is evaluated once a terminal (computation result) exists; while
    # pending it is not_evaluated/null (SPEC 11 resolution_overdue also pins
    # not_evaluated/null). No vector encodes an invalid/unverifiable/malformed
    # predicate, so a resolved terminal yields valid. [JUDGMENT CALL — see report.]
    # -----------------------------------------------------------------
    if terminal_present:
        predicate_evaluation_state = "evaluated"
        predicate_verdict = "valid"
    else:
        predicate_evaluation_state = "not_evaluated"
        predicate_verdict = None

    return {
        "schema": "admission_result.v0",
        "coverage_profile_ref": coverage_profile_ref,
        "accepted_record_schema": accepted_record_schema,
        "accepted_record_ref": accepted_record_ref,
        "witness_receipt_ref": witness_receipt_ref,
        "as_of": as_of,
        "predicate_evaluation_state": predicate_evaluation_state,
        "predicate_verdict": predicate_verdict,
        "admission_evaluation_state": admission_evaluation_state,
        "admission_verdict": admission_verdict,
        "resolution_progress": resolution_progress,
        "resolution_timing": resolution_timing,
        "publication_progress": publication_progress,
        "publication_timing": publication_timing,
        "findings": ordered,
        "primary_reason_code": primary_reason_code,
        "unverifiable_checks": sorted(unverifiable),
    }


if __name__ == "__main__":
    d = json.load(open(sys.argv[1]))
    print(json.dumps(evaluate(d["input"]), indent=2))
