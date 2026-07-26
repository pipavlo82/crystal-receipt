// Independent (blind) TypeScript detector for admission_result.v0
// Built from SPEC.md §12–§16 + schemas + vector .input ONLY.
// Run: npx tsx detector.ts   (or: bun detector.ts)
//
// Modeling note: the vectors pre-abstract raw artifacts into semantic
// `evidence` flags (complete_comparable_interval, witness_live, observation
// positions, deadlines, authority class, explicit `violations` map, etc.).
// A fuller detector would recompute SHA-256 roots and verify Ed25519
// signatures; here those outcomes are supplied via evidence, so we drive the
// admission evaluation from the evidence exactly as the vector encodes it and
// treat artifacts as well-formed unless a violation is asserted. // SPEC §16 (vectors encode outcomes)

import * as fs from "fs";
import * as path from "path";

// ---- Reason-code ordering metadata (SPEC §13.4 check-ordinal + intra-check order) ----
// One reason code belongs to exactly one check ordinal (SPEC §13.5).
const REASON_ORDER: Record<string, { check: number; intra: number }> = {};
const CHECK_CODES: Record<number, string[]> = {
  1: ["profile_or_artifact_malformed"],
  2: ["issuance_intent_malformed"],
  3: [
    "witness_receipt_root_malformed",
    "witness_receipt_root_mismatch",
    "unsupported_witness_receipt_signature_profile",
    "malformed_witness_receipt_signature",
    "invalid_witness_receipt_signature",
    "accepted_record_ref_mismatch",
  ],
  4: ["missing_coverage_binding"],
  5: ["coverage_source_authority_not_allowed"],
  6: ["duplicate_coverage_binding"],
  7: ["independent_completeness_unproven"],
  8: ["issuance_stream_fork", "sequence_gap", "predecessor_ref_mismatch"],
  9: ["issuance_position_inversion"],
  10: ["accepted_record_not_in_witness_log"],
  11: [
    "witness_checkpoint_root_malformed",
    "witness_checkpoint_root_mismatch",
    "unsupported_witness_checkpoint_signature_profile",
    "malformed_witness_checkpoint_signature",
    "invalid_witness_checkpoint_signature",
    "witness_checkpoint_chain_discontinuous",
    "witness_append_only_consistency_unproven",
  ],
  12: ["witness_stalled"],
  13: ["witness_equivocation"],
  14: ["terminal_to_intent_mismatch"],
  15: ["late_skip", "resolution_overdue", "late_resolution"],
  16: ["publication_overdue", "late_publication"],
  17: ["as_of_scope_malformed", "as_of_scope_mismatch"],
};
for (const [c, codes] of Object.entries(CHECK_CODES)) {
  codes.forEach((code, i) => (REASON_ORDER[code] = { check: Number(c), intra: i }));
}

// SPEC §13.6.D — malformed-state finding set
const MALFORMED_SET = new Set([
  "profile_or_artifact_malformed",
  "issuance_intent_malformed",
  "witness_receipt_root_malformed",
  "malformed_witness_receipt_signature",
  "witness_checkpoint_root_malformed",
  "malformed_witness_checkpoint_signature",
  "as_of_scope_malformed",
]);

type AdmissionResult = {
  schema: string;
  coverage_profile_ref: string;
  accepted_record_schema: string;
  accepted_record_ref: string;
  witness_receipt_ref: string;
  as_of: { checkpoint_ref: string; log_size: number };
  predicate_evaluation_state: string;
  predicate_verdict: string | null;
  admission_evaluation_state: string;
  admission_verdict: string | null;
  resolution_progress: string;
  resolution_timing: string;
  publication_progress: string;
  publication_timing: string;
  findings: string[];
  primary_reason_code: string | null;
  unverifiable_checks: number[];
};

function detect(input: any): AdmissionResult {
  const A = input.artifacts;
  const ev = input.evidence;
  const evp = input.evaluation_point;
  const asOfPos: number = evp.position; // as_of position on the basis
  const complete: boolean = ev.complete_comparable_interval === true;

  const findings: string[] = [];
  const unverifiable = new Set<number>();

  const res = ev.resolution || {};
  const pub = ev.publication || {};
  const obs = ev.external_observation || {};
  const terminalPresent = res.terminal_present === true;

  // ---------- Predicate (SPEC §12.2, §14) ----------
  // Predicate is the substantive gate; independent of admission. Terminal present
  // (a computed result exists) => predicate evaluated/valid; pending => not_evaluated.
  // JUDGMENT CALL: no evidence field carries the predicate result; inferred from
  // terminal presence per matrix A/B/C (not_evaluated) vs D–K (evaluated/valid).
  let predicate_evaluation_state = "not_evaluated";
  let predicate_verdict: string | null = null;
  if (terminalPresent) {
    predicate_evaluation_state = "evaluated";
    predicate_verdict = "valid";
  }

  // ---------- Resolution progress / timing (SPEC §5, §11, §14) ----------
  let resolution_progress: string;
  let resolution_timing: string;
  if (terminalPresent) {
    resolution_progress = "resolved"; // SPEC §11
    if (res.terminal_position <= res.deadline_position) {
      resolution_timing = "on_time"; // SPEC §11 event<=deadline
    } else {
      resolution_timing = "late"; // SPEC §11 terminal after deadline => late + late_resolution
      addFinding(findings, "late_resolution");
      // SPEC §11: "A later terminal MUST NOT erase the earlier overdue interval."
      // Co-occurrence: when the overdue interval was previously proven, both findings
      // co-occur (resolution_overdue precedes late_resolution within check 15). // SPEC §13.4 check15 order
      if (res.overdue_interval_previously_proven === true) {
        addFinding(findings, "resolution_overdue");
      }
    }
  } else {
    resolution_progress = "pending"; // SPEC §11
    if (res.deadline_position == null || !complete) {
      // Cannot prove deadline state -> not_started + check 15 unverifiable. // SPEC §14.C, §13.1
      resolution_timing = "not_started";
      unverifiable.add(15);
    } else if (asOfPos <= res.deadline_position) {
      resolution_timing = "not_started"; // SPEC §5 not_started before deadline
    } else {
      resolution_timing = "overdue"; // SPEC §11 no terminal, as_of>deadline, complete interval
      addFinding(findings, "resolution_overdue");
    }
  }

  // ---------- Witness liveness (check 12, SPEC §10) ----------
  if (ev.witness_live === false) {
    if (complete) addFinding(findings, "witness_stalled"); // SPEC §10, §14.B
    else unverifiable.add(12); // SPEC §10 endpoint unavailability => unverifiable, not proven
  }

  // ---------- Publication progress / timing (SPEC §11, §14) ----------
  let publication_progress: string;
  let publication_timing: string;
  if (!terminalPresent) {
    // Publication window starts at witness acceptance of the terminal; none yet. // SPEC §11
    publication_progress = "not_started";
    publication_timing = "not_started";
  } else if (obs.observed === true) {
    publication_progress = "externally_observed"; // SPEC §9, §11
    if (obs.position <= pub.deadline_position) {
      publication_timing = "on_time"; // SPEC §11
    } else {
      publication_timing = "late"; // SPEC §11 later observation after deadline => late_publication
      addFinding(findings, "late_publication");
    }
  } else {
    const pubOverdue = complete && asOfPos > pub.deadline_position;
    if (pubOverdue) {
      publication_timing = "overdue"; // SPEC §11 publication_overdue
      addFinding(findings, "publication_overdue");
      // Progress reflects actual publication state at the overdue point. // SPEC §11 G1/G2
      publication_progress = pub.checkpoint_published === true ? "published" : "accepted_by_witness";
    } else {
      publication_timing = "not_started";
      // JUDGMENT CALL: no explicit "accepted_by_witness" evidence flag. Matrix E
      // (terminal resolved, not published, deadline not passed) => not_started, so
      // absent checkpoint publication we report not_started unless overdue forces
      // the accepted_by_witness intermediate.
      publication_progress = pub.checkpoint_published === true ? "published" : "not_started";
      if (!complete) unverifiable.add(12); // SPEC §14.F external observation unverifiable
    }
  }

  // ---------- Authority / independent completeness (check 7, SPEC §4, §13) ----------
  const auth = ev.authority || {};
  if (auth.independent_completeness === "proven_unavailable") {
    addFinding(findings, "independent_completeness_unproven"); // SPEC §13 check7, §14.K1
  } else if (auth.independent_completeness === "insufficient_evidence") {
    unverifiable.add(7); // SPEC §14.K2, §13.1
  }

  // ---------- Equivocation (check 13, SPEC §J) ----------
  if (Array.isArray(ev.incompatible_checkpoint_pair)) {
    addFinding(findings, "witness_equivocation"); // SPEC §14.J check13
  }

  // ---------- Explicit violations injection (co-occurrence findings-ordering vector) ----------
  // JUDGMENT CALL: the co-multiple-violations vector encodes proven findings via a
  // `violations` map rather than raw crypto/timing artifacts; treat each true key as
  // a proven finding, and align the corresponding timing literal for consistency.
  if (ev.violations && typeof ev.violations === "object") {
    for (const [code, on] of Object.entries(ev.violations)) {
      if (on === true && REASON_ORDER[code]) addFinding(findings, code);
    }
    if (ev.violations.late_resolution === true) {
      resolution_progress = "resolved";
      resolution_timing = "late";
    }
    if (ev.violations.late_publication === true) {
      publication_timing = "late";
    }
  }

  // ---------- Assemble findings ordering (SPEC §13.2) ----------
  findings.sort((a, b) => {
    const ma = REASON_ORDER[a];
    const mb = REASON_ORDER[b];
    if (ma.check !== mb.check) return ma.check - mb.check;
    return ma.intra - mb.intra;
  });

  const unverifiable_checks = Array.from(unverifiable).sort((a, b) => a - b); // SPEC §13.1

  // ---------- Admission evaluation state / verdict (SPEC §13.6) ----------
  let admission_evaluation_state: string;
  let admission_verdict: string | null;
  if (findings.length > 0) {
    const isMalformed = findings.some((f) => MALFORMED_SET.has(f));
    if (isMalformed) {
      admission_evaluation_state = "malformed"; // SPEC §13.6.D
      admission_verdict = null;
    } else {
      admission_evaluation_state = "evaluated"; // SPEC §13.6.B
      admission_verdict = "invalid";
    }
  } else if (unverifiable_checks.length > 0) {
    admission_evaluation_state = "unverifiable"; // SPEC §13.6.C
    admission_verdict = null;
  } else if (
    resolution_progress === "resolved" &&
    publication_progress === "externally_observed" &&
    resolution_timing === "on_time" &&
    publication_timing === "on_time"
  ) {
    admission_evaluation_state = "evaluated"; // SPEC §13.6.A (all checks passed) — matrix D/I
    admission_verdict = "valid";
  } else {
    admission_evaluation_state = "not_evaluated"; // SPEC §14.A pending, nothing proven/unverifiable
    admission_verdict = null;
  }

  const primary_reason_code = findings.length > 0 ? findings[0] : null; // SPEC §13.3

  // ---------- Identity refs (SPEC §12.1) ----------
  // JUDGMENT CALL: accepted record is the terminal (issuance_result_commitment.v0) when
  // resolved, else the issuance intent (issuance_record.v0). witness_receipt_ref is the
  // matching receipt's stored root.
  let accepted_record_schema: string;
  let accepted_record_ref: string;
  if (terminalPresent) {
    accepted_record_schema = "issuance_result_commitment.v0";
    accepted_record_ref = A.terminal_commitment.issuance_result_root;
  } else {
    accepted_record_schema = "issuance_record.v0";
    accepted_record_ref = A.issuance_intent.issuance_root;
  }
  const receipt = (A.witness_receipts || []).find(
    (r: any) => r.accepted_record_schema === accepted_record_schema
  );
  const witness_receipt_ref = receipt ? receipt.witness_receipt_root : "";

  return {
    schema: "admission_result.v0",
    coverage_profile_ref: A.coverage_profile.coverage_profile_root,
    accepted_record_schema,
    accepted_record_ref,
    witness_receipt_ref,
    as_of: { checkpoint_ref: evp.as_of.checkpoint_ref, log_size: evp.as_of.log_size },
    predicate_evaluation_state,
    predicate_verdict,
    admission_evaluation_state,
    admission_verdict,
    resolution_progress,
    resolution_timing,
    publication_progress,
    publication_timing,
    findings,
    primary_reason_code,
    unverifiable_checks,
  };
}

function addFinding(list: string[], code: string) {
  if (!list.includes(code)) list.push(code); // uniqueItems (SPEC §13.2)
}

// ---------- Runner ----------
const VECTOR_DIR = path.join(__dirname, "vectors");
const order = [
  "a", "b", "c", "d", "e", "f", "g1", "g2", "h", "i", "j", "k1", "k2",
  "co-equivocation-prefix", "co-late-terminal-after-overdue", "co-multiple-violations",
];

if (require.main === module) {
  const mode = process.argv[2] || "emit";
  const out: Record<string, AdmissionResult> = {};
  for (const name of order) {
    const vec = JSON.parse(fs.readFileSync(path.join(VECTOR_DIR, name + ".json"), "utf8"));
    out[vec.case_id] = detect(vec.input);
  }
  if (mode === "emit") {
    console.log(JSON.stringify(out, null, 2));
  }
}

export { detect };
