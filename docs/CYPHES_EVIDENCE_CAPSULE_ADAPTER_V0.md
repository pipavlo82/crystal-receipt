# CYPHES Evidence Capsule Adapter v0

## 1. Purpose

This document defines the **adapter boundary** for mapping CYPHES Node workflow objects into Crystal Receipt's `receiptos.evidence_capsule.v0` artifact model.

The purpose of this document is to make the boundary explicit before any runtime integration work begins, so CYPHES workflow semantics and ReceiptOS proof semantics stay aligned.

This adapter specification is intended to:
- preserve existing CYPHES workflow ownership
- preserve existing Evidence Capsule v0 schema and proof semantics
- map CYPHES workflow evidence into a portable execution provenance artifact
- avoid coupling workflow orchestration decisions to proof presentation
- keep Crystal Receipt focused on independently inspectable execution provenance

## 2. Boundary statement

This is a **docs-only boundary definition**.

It does **not** change:
- schema
- runtime
- verifier logic
- proof semantics
- receipt root derivation
- on-chain assumptions
- renderer behavior

CYPHES Node remains the system of record for workflow state and workflow decisions.
ReceiptOS / Evidence Capsule remains the portable proof presentation layer for evidence already produced elsewhere.

The adapter boundary is therefore:

- **CYPHES produces workflow objects and workflow decisions**
- **ReceiptOS records evidence about those objects and decisions**
- **Evidence Capsule presents proof-carrying evidence without becoming the workflow engine**

## 3. CYPHES owns workflow decisions

CYPHES owns the operational meaning of its workflow objects.

That includes:
- campaign definition
- work unit creation and routing
- claim creation and state transitions
- contribution submission and acceptance/rejection
- verification policy and final verification decision
- credit policy and credit allocation decisions
- report generation and summarization rules

The adapter must not reinterpret CYPHES workflow state into new operational semantics.

In particular, the adapter must not:
- decide whether a contribution should count
- decide whether a claim is valid
- decide whether verification is sufficient
- decide whether credit should be issued
- derive reputation from historical workflow state
- infer missing workflow transitions as if they happened

If CYPHES marks a decision as missing, pending, rejected, disputed, or incomplete, the Evidence Capsule should reflect that state as evidence rather than overwrite it with a cleaner interpretation.

## 4. ReceiptOS / Evidence Capsule owns proof presentation

ReceiptOS / Evidence Capsule owns how source evidence is packaged into a portable execution provenance artifact.

That includes:
- receipt-shaped evidence presentation
- `receipt_root` presentation and comparison
- Merkle proof packaging
- anchor state presentation
- verifier presentation
- existing Evidence Capsule section structure
- replay / manifest summary generation

ReceiptOS does **not** own CYPHES workflow logic.

Its role is limited to:
- capturing source evidence references
- presenting portable proof-oriented summaries
- exposing verification-relevant artifacts for an independent consumer
- showing whether the evidence set is internally consistent

The verifier remains the source of truth for proof validity.
The producer remains the source of truth for workflow intent.

## 5. Explicit mapping table

The table below defines the intended v0 mapping from CYPHES workflow objects into existing Evidence Capsule / ReceiptOS sections and concepts.

| CYPHES object | Source evidence path | Evidence Capsule target section / field | Notes |
|---|---|---|---|
| `campaign` | `campaign.id`, `campaign.name`, `campaign.scope`, `campaign.policy_ref`, `campaign.created_at` | `payload`, `policy_boundary`, `replay_manifest` | Campaign provides workflow context and scope, not proof truth by itself |
| `work_unit` | `work_unit.id`, `work_unit.campaign_id`, `work_unit.instructions`, `work_unit.inputs`, `work_unit.constraints`, `work_unit.created_at` | `payload`, `authorization`, `execution`, `replay_manifest` | Work unit maps to the unit of requested or authorized work |
| `claim` | `claim.id`, `claim.work_unit_id`, `claim.actor`, `claim.status`, `claim.timestamps`, `claim.references` | `decision_trace`, `evidence`, `replay_manifest` | Claim is workflow evidence about asserted work, not proof of correctness on its own |
| `contribution` | `contribution.id`, `contribution.claim_id`, `contribution.hash`, `contribution.artifact_refs`, `contribution.summary`, `contribution.submitted_at` | `evidence`, `execution`, `result`, `replay_manifest` | Contribution is the primary submitted evidence payload |
| `verification` | `verification.id`, `verification.target_id`, `verification.decision`, `verification.reason`, `verification.verifier`, `verification.timestamp`, `verification.evidence_refs` | `decision_trace`, `verifier`, `evidence`, `result` | ReceiptOS records the decision and related evidence; it does not invent the decision |
| `credit` | `credit.id`, `credit.subject`, `credit.amount`, `credit.reason`, `credit.verification_ref`, `credit.timestamp` | `decision_trace`, `evidence`, `result` | Credit is recorded as workflow evidence only; not computed by Evidence Capsule |
| `report` | `report.id`, `report.scope`, `report.summary`, `report.contribution_refs`, `report.verification_refs`, `report.generated_at` | `result`, `evidence`, `replay_manifest` | Report summary must remain traceable to referenced evidence |
| workflow receipt envelope | workflow-derived canonical evidence bundle | `payload`, `evidence`, `result`, `receipt` | The final receipt object is the portable artifact containing the mapped proof presentation |
| canonical evidence bundle root | canonicalized mapped evidence set | `receipt_root` | Preserve existing receipt root semantics; do not redefine derivation |
| Merkle inclusion material | proof bundle or leaf inclusion references associated with canonical evidence | `merkle` | Must only present proof material already produced or derivable within current semantics |
| anchor material | anchor status, tx ref, chain/network ref, anchor timestamp | `anchor` | Anchor indicates commitment state, not workflow completion |

### Mapping interpretation notes

- `receipt` is the container artifact that presents the mapped CYPHES evidence in Evidence Capsule form.
- `payload` carries the portable description of the workflow object set being presented.
- `policy_boundary`, `authorization`, and `decision_trace` are presentation sections for workflow constraints and decisions already made by CYPHES, not new decision engines.
- `execution`, `evidence`, and `result` package the submitted work, supporting artifacts, and outcome-oriented summaries.
- `receipt_root` is derived from the canonical mapped evidence bundle under existing semantics only.
- `merkle` and `anchor` carry portable proof references, not business logic.
- Merkle proof data should be treated as inclusion evidence for the mapped receipt payload, not as a substitute for workflow review.
- `verifier` expresses the proof verification result over the receipt/evidence package, distinct from CYPHES workflow approval logic.
- `replay_manifest` should stay minimal and reconstruction-oriented rather than becoming a second workflow database.

## 6. Credit boundary

Credit is explicitly outside ReceiptOS decision-making.

### Rules

- **CYPHES decides credit**
- **ReceiptOS only records the credit decision as evidence**
- **Evidence Capsule MUST NOT compute credit, aggregate credit, or present reputation/scoring**

That means the adapter may:
- record that a credit decision exists
- record the referenced verification object or decision that justified the credit
- record timestamps, identifiers, and source refs
- present credit as part of the evidence trail

But the adapter must not:
- recalculate credit amounts
- total credit across multiple contributions
- create rankings, scores, or trust metrics
- infer deserved credit from contribution hashes alone
- present credit as if it were proof validity

Credit is a workflow outcome.
Proof validity is a provenance property.
They must remain separate.

## 7. Negative / tamper cases

The adapter must make failure and tamper states legible rather than smoothing them over.

### Modified contribution hash

If a `contribution.hash` does not match the referenced contribution artifact or canonicalized evidence bundle:
- mark the related verification state as inconsistent or failed in `verifier` when applicable
- reflect the mismatch in `evidence`
- do not silently replace the stored hash with a recomputed one

### Missing verifier decision

If contribution or claim evidence exists but `verification.decision` is missing:
- do not manufacture a verifier result equivalent to approval
- preserve the state as missing, pending, or incomplete
- if proof verification can still run over the receipt package, keep that distinct from workflow verification absence

### Credit present without verification

If `credit` is present but no corresponding `verification` decision is present:
- treat the credit record as workflow evidence only
- surface the inconsistency in capsule summary or evidence notes
- do not imply that credit proves validity

### Report summary not matching contribution evidence

If a `report.summary` conflicts with the referenced `contribution` evidence:
- preserve both the summary and the underlying evidence references
- mark the summary as unsupported, inconsistent, or needing review where presentation allows
- do not collapse the report into the underlying evidence or vice versa

### Anchor missing

If no anchor state exists:
- `anchor` should remain `missing`, `pending`, or equivalent existing semantics
- do not imply on-chain finality or publication
- local receipt verification may still succeed independently of anchor presence

### receipt_root mismatch

If stored and computed `receipt_root` values differ:
- expose the mismatch explicitly
- fail or downgrade proof validity according to existing verifier semantics
- do not rewrite the stored value in presentation

## 8. On-chain boundary

The on-chain boundary remains intentionally narrow.

The adapter should assume:
- do not put full workflow objects on-chain
- do not put full reports on-chain
- do not put full contribution payloads on-chain
- do not put full claim or verification histories on-chain

On-chain material should remain limited to:
- anchor commitments
- `receipt_root`
- proof refs or chain references needed to resolve those commitments

This preserves:
- portability
- privacy and minimization
- proof-oriented verification
- separation between workflow systems and chain settlement surfaces

The chain is a commitment surface, not the full workflow database.

## 9. Non-goals

This adapter spec does **not** include:
- runtime integration
- schema changes
- verifier changes
- reputation / scoring
- settlement changes
- Crystal visual changes

It also does not include:
- CYPHES workflow redesign
- new claim lifecycle semantics
- new contribution hashing rules
- new report generation rules
- new chain commitment format
- adapter implementation code

## 10. Open questions

1. What is the minimum canonical source bundle required to map CYPHES objects into a stable `receipt_root` without over-encoding workflow internals?
2. Which CYPHES object identifiers should be treated as stable public references versus local workflow IDs?
3. How should optional or pending workflow states be normalized into portable evidence summaries without implying stronger certainty than the source provides?
4. Should `report` objects enter the capsule as summary-only evidence, or should they always include explicit references to the exact contributing objects they summarize?
5. What is the minimal Merkle proof packaging needed for portable verification across viewers without introducing new proof semantics?
6. Which negative states should be elevated into top-level capsule warnings versus left as source-level evidence inconsistencies?
7. What subset of anchor metadata is required for cross-environment portability while preserving the current on-chain assumptions?
8. If CYPHES later introduces downstream handoff/provenance chains, what exact boundary keeps those chains as a separate future layer rather than folding them into Evidence Capsule v0?

## Summary boundary

The intended v0 alignment is simple:

- **Receipt = substrate**
- **Evidence Capsule = portable boundary object**
- **CYPHES = workflow system of record**
- **handoff / provenance chains = downstream future layer, not v0**

That keeps the present discussion focused on a narrow adapter boundary: packaging CYPHES workflow evidence into a portable execution provenance artifact without changing what the workflow means or how the proof substrate verifies it.
