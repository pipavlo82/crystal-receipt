# Producer Adapters

Producers attach to ReceiptOS through adapters: translation surfaces that map a runtime's native evidence into the capsule's evidence object. After that point, derivation proceeds identically regardless of origin.

Two invariants, stated once:
1. No adapter — including the design partner's — participates in receipt_root derivation. The root depends only on the canonicalized, anchor-stripped evidence object. An adapter shapes what enters the evidence object; it can never make an inadmissible record admissible or vice versa.
2. Depth of integration documentation varies with collaboration history, as it does for any substrate with early partners. Constitutive role in the receipt does not vary, because there is none. Any runtime reaches the same standing by writing an adapter — see EXTERNAL_PRODUCER_INTEGRATION_GUIDE.md.

| Runtime | Role | Surfaces in this repo |
|---|---|---|
| Stealth / CYPHES | Design partner | docs/STEALTH_EVIDENCE_CAPSULE_ADAPTER_V0.md, docs/CYPHES_EVIDENCE_CAPSULE_ADAPTER_V0.md, docs/CYPHES_RECEIPTOS_INTEGRATION_STATUS.md, src/receiptos/adapters/stealth-handoff.ts, tests/receiptos/stealth-handoff-import-cli.test.ts, tests/receiptos/cyphes-evidence-capsule.test.ts, src/receiptos/fixtures/session-evidence.cyphes-workflow.sample.json (+ three cyphes negative fixtures alongside it), docs/receipt-examples/stealth-handoff/, examples/receipt-examples/stealth-handoff/ |
| Claude Code sessions | Unaffiliated | src/receiptos/adapters/claude-code-session.ts, tests/receiptos/claude-code-session-import-cli.test.ts, tests/receiptos/claude-code-session-jsonl-import-cli.test.ts, src/receiptos/fixtures/claude-code-session.sample.json + .jsonl, docs/receipt-examples/claude-code-session/ |
| Codex sessions | Unaffiliated | src/receiptos/adapters/codex-session.ts, tests/receiptos/codex-session-import-cli.test.ts, src/receiptos/fixtures/codex-session.sample.json, docs/receipt-examples/codex-session/ |
| Cursor sessions | Unaffiliated | src/receiptos/adapters/cursor-session.ts, tests/receiptos/cursor-session-import-cli.test.ts, src/receiptos/fixtures/cursor-session.sample.json, docs/receipt-examples/cursor-session/ |
| GitHub Actions runs | Unaffiliated | src/receiptos/adapters/github-actions.ts, tests/receiptos/github-actions-run-import-cli.test.ts, src/receiptos/fixtures/github-actions-run.sample.json, scripts/export-github-actions-run.mjs, docs/receipt-examples/github-actions-run/ |
| External coding run | Unaffiliated | src/receiptos/adapters/external-coding-run.ts, tests/receiptos/external-coding-run-import-cli.test.ts, src/receiptos/fixtures/external-coding-run.sample.json, docs/receipt-examples/external-coding-run/ |
| Generic producer | Unaffiliated | src/receiptos/adapters/generic.ts, tests/receiptos/generic-producer-import-cli.test.ts, src/receiptos/fixtures/generic-producer-output.sample.json, docs/receipt-examples/generic-producer/ |

Shared plumbing: src/receiptos/adapters/registry.ts (adapter registration), tests/receiptos/multi-producer-proof-boundary.test.ts (cross-producer boundary test). See also docs/PRODUCER_SUPPORT_MATRIX.md and docs/EXTERNAL_PRODUCER_INTEGRATION_GUIDE.md.

This table mirrors §4.5 of the ReceiptOS preprint and must stay in sync with it.
