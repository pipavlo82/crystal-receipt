import { For, Show, createMemo, createSignal } from "solid-js"
import { Dialog } from "@opencode-ai/ui/dialog"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import type { HandoffEvidence, HandoffReceiptSummary } from "@/pages/session/handoff"
import { copyText } from "@/utils/copy"
import { applyLocalMerkleProofToEvidence, attachLocalMerkleProof, verifyLocalMerkleProof } from "@/utils/merkle-proof"
import { verifyHandoffReceiptRoot } from "@/utils/receipt-verifier"
import { prepareSepoliaAnchorPayload } from "@/utils/sepolia-anchor-payload"
import { importSepoliaAnchorResult } from "@/utils/sepolia-anchor-result"

type AnchorProofEvidence = HandoffEvidence & {
  anchor?: {
    receipt_root?: string | null
    merkle_proof_status?: string | null
    merkle_root?: string | null
    merkle_leaf_index?: number | null
    merkle_proof?: string[]
    onchain_anchor_status?: string | null
    network?: string | null
    contract?: string | null
    tx_hash?: string | null
    verifier_status?: string | null
    proof_json?: unknown
  }
  proof?: AnchorProofEvidence["anchor"]
}

function evidenceToJson(evidence: HandoffEvidence) {
  return JSON.stringify(evidence, null, 2)
}

export function DialogReceiptExplorer(props: {
  evidence: HandoffEvidence
  summary: HandoffReceiptSummary
}) {
  const dialog = useDialog()
  const language = useLanguage()

  const changedFiles = createMemo(() => {
    const evidenceFiles = props.evidence.changes?.files_changed
    return evidenceFiles && evidenceFiles.length > 0 ? evidenceFiles : props.summary.changedFiles
  })
  const resolvedDiffHash = createMemo(() => {
    const evidenceDiffHash = props.evidence.changes?.diff_sha256
    return evidenceDiffHash && evidenceDiffHash.length > 0 ? evidenceDiffHash : props.summary.diffSha256 ?? "none"
  })
  const [localMerkleProof, setLocalMerkleProof] = createSignal<ReturnType<typeof attachLocalMerkleProof> | null>(null)
  const [localMerkleVerification, setLocalMerkleVerification] = createSignal<ReturnType<typeof verifyLocalMerkleProof> | null>(null)
  const [sepoliaPayload, setSepoliaPayload] = createSignal<ReturnType<typeof prepareSepoliaAnchorPayload> | null>(null)
  const [importedAnchorResult, setImportedAnchorResult] = createSignal<ReturnType<typeof importSepoliaAnchorResult> | null>(null)
  const [showSepoliaAnchorImport, setShowSepoliaAnchorImport] = createSignal(false)
  const [anchorImportText, setAnchorImportText] = createSignal("")
  const [anchorImportStatus, setAnchorImportStatus] = createSignal<string | null>(null)

  const effectiveEvidence = createMemo(() => {
    const evidence = props.evidence as AnchorProofEvidence
    const proof = localMerkleProof()
    const proofApplied = proof ? applyLocalMerkleProofToEvidence(evidence, proof) : evidence
    const imported = importedAnchorResult()
    if (!imported) return proofApplied
    return {
      ...proofApplied,
      anchor: {
        ...(proofApplied.anchor ?? {}),
        onchain_anchor_status: imported.onchain_anchor_status,
        network: imported.network,
        contract: imported.contract,
        tx_hash: imported.tx_hash,
      },
    }
  })
  const anchorProof = createMemo(() => {
    const evidence = effectiveEvidence() as AnchorProofEvidence
    return evidence.anchor ?? evidence.proof
  })
  const receiptRoot = createMemo(() => anchorProof()?.receipt_root ?? resolvedDiffHash())
  const merkleProofStatus = createMemo(() => anchorProof()?.merkle_proof_status ?? "not attached")
  const merkleRoot = createMemo(() => anchorProof()?.merkle_root ?? null)
  const merkleLeafIndex = createMemo(() => anchorProof()?.merkle_leaf_index ?? null)
  const merkleProofEntries = createMemo(() => anchorProof()?.merkle_proof ?? [])
  const onchainAnchorStatus = createMemo(() => anchorProof()?.onchain_anchor_status ?? "not anchored")
  const anchorNetwork = createMemo(() => anchorProof()?.network ?? "unknown")
  const anchorContract = createMemo(() => anchorProof()?.contract ?? "not attached")
  const anchorTxHash = createMemo(() => anchorProof()?.tx_hash ?? "not attached")
  const anchorVerifierStatus = createMemo(() => anchorProof()?.verifier_status ?? props.summary.verifierStatus ?? "not verified")
  const hasAttachedMerkleProof = createMemo(() => {
    const root = merkleRoot()
    return merkleProofStatus() === "attached" && typeof root === "string" && root.length > 0
  })
  const anchorProofJson = createMemo(() =>
    JSON.stringify(
      {
        receipt_root: receiptRoot(),
        merkle_proof_status: merkleProofStatus(),
        merkle_root: merkleRoot(),
        merkle_leaf_index: merkleLeafIndex(),
        merkle_proof: merkleProofEntries(),
        onchain_anchor_status: onchainAnchorStatus(),
        network: anchorNetwork(),
        contract: anchorContract(),
        tx_hash: anchorTxHash(),
        verifier_status: anchorVerifierStatus(),
      },
      null,
      2,
    ),
  )
  const sepoliaPayloadJson = createMemo(() => (sepoliaPayload() ? JSON.stringify(sepoliaPayload(), null, 2) : null))
  const commands = createMemo(() => (props.evidence.commands ?? []).filter((item) => !!item.command))
  const evidenceJson = createMemo(() => evidenceToJson(effectiveEvidence()))
  const scopedLease = createMemo(() => props.evidence.scope?.lease)
  const [localVerification, setLocalVerification] = createSignal<{
    ok: boolean
    receipt_root: string | null
    recomputed_root: string | null
  } | null>(null)
  const permissionJson = createMemo(() => {
    const permission = props.evidence.scope?.permission
    if (permission === undefined || permission === null) return null
    try {
      return JSON.stringify(permission, null, 2)
    } catch {
      return String(permission)
    }
  })
  const scopeStatus = createMemo(() =>
    props.evidence.scope && props.evidence.scope.permission !== undefined && props.evidence.scope.permission !== null
      ? "within captured scope"
      : "scope not fully specified",
  )

  const copyAnchorProofJson = () => {
    void copyText(anchorProofJson())
      .then(() => {
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("session.share.copy.copied"),
          description: "Receipt anchor proof path copied to clipboard",
        })
      })
      .catch((error: unknown) => {
        showToast({
          title: language.t("common.requestFailed"),
          description: error instanceof Error ? error.message : String(error),
        })
      })
  }

  const copyJson = () => {
    void copyText(evidenceJson())
      .then(() => {
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("session.share.copy.copied"),
          description: "Receipt JSON copied to clipboard",
        })
      })
      .catch((error: unknown) => {
        showToast({
          title: language.t("common.requestFailed"),
          description: error instanceof Error ? error.message : String(error),
        })
      })
  }

  const copySepoliaPayload = () => {
    const payload = sepoliaPayload()
    if (!payload) {
      showToast({
        title: language.t("common.requestFailed"),
        description: "Prepare Sepolia anchor payload first.",
      })
      return
    }

    void copyText(JSON.stringify(payload, null, 2))
      .then(() => {
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("session.share.copy.copied"),
          description: "Sepolia anchor payload copied to clipboard",
        })
      })
      .catch((error: unknown) => {
        showToast({
          title: language.t("common.requestFailed"),
          description: error instanceof Error ? error.message : String(error),
        })
      })
  }

  const prepareSepoliaPayload = () => {
    try {
      if (!hasAttachedMerkleProof()) {
        showToast({
          title: "Attach local Merkle proof first",
          description: "Step 2 must be completed before preparing a Sepolia payload.",
        })
        return
      }

      const payload = prepareSepoliaAnchorPayload(effectiveEvidence() as AnchorProofEvidence)
      setSepoliaPayload(payload)
      showToast({
        variant: "success",
        icon: "circle-check",
        title: "Sepolia payload ready",
        description: "Prepared locally only. Use Copy Sepolia payload to export it.",
      })
    } catch (error) {
      showToast({
        title: language.t("common.requestFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const importAnchorResult = () => {
    try {
      if (!hasAttachedMerkleProof()) {
        const message = "Step 2 required: attach local Merkle proof first."
        setAnchorImportStatus(message)
        showToast({
          title: "Attach local Merkle proof first",
          description: "The imported Sepolia receiptRoot must match anchor.merkle_root.",
        })
        return
      }

      const raw = anchorImportText().trim()
      if (!raw) {
        setAnchorImportStatus("Paste Sepolia anchor result JSON first.")
        return
      }
      const parsed = JSON.parse(raw)
      const imported = importSepoliaAnchorResult(effectiveEvidence() as AnchorProofEvidence, parsed)
      setImportedAnchorResult(imported)
      setAnchorImportStatus("Sepolia anchor result imported.")
      showToast({
        variant: "success",
        icon: "circle-check",
        title: "Sepolia anchor result imported",
        description: "Imported locally only. On-chain anchor status updated from pasted result.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAnchorImportStatus(message)
      showToast({
        title: language.t("common.requestFailed"),
        description: message,
      })
    }
  }

  const verifyReceipt = () => {
    void verifyHandoffReceiptRoot(props.evidence)
      .then((result) => {
        setLocalVerification(result)
        showToast({
          variant: result.ok ? "success" : "error",
          title: result.ok ? "Receipt verified" : "Receipt verification failed",
          description: result.ok
            ? "Local receipt root matches anchor.receipt_root"
            : "Local receipt root does not match anchor.receipt_root",
        })
      })
      .catch((error: unknown) => {
        showToast({
          title: language.t("common.requestFailed"),
          description: error instanceof Error ? error.message : String(error),
        })
      })
  }

  const attachMerkleProof = () => {
    try {
      const proof = attachLocalMerkleProof(props.evidence as AnchorProofEvidence)
      const verification = verifyLocalMerkleProof(proof)
      setLocalMerkleProof(proof)
      setLocalMerkleVerification(verification)
      showToast({
        variant: verification.ok ? "success" : "error",
        title: verification.ok ? "Local Merkle proof attached" : "Local Merkle proof failed",
        description: verification.ok
          ? "One-leaf local Merkle proof attached. This is not on-chain verified."
          : "Local Merkle proof did not verify.",
      })
    } catch (error) {
      showToast({
        title: language.t("common.requestFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <Dialog
      title="Receipt details"
      size="x-large"
      class="w-[min(calc(100vw-40px),920px)] h-[min(calc(100vh-40px),760px)] min-h-0 overflow-hidden"
    >
      <div class="flex h-full min-h-0 flex-col gap-3 p-1">
        <div class="flex items-center justify-between gap-3 rounded-md border border-border-weak-base bg-surface-panel px-3 py-2">
          <div class="min-w-0">
            <div class="text-13-semibold text-text-base">Receipt Explorer</div>
            <div class="text-11-regular text-text-weak">
              Compatible with the ReceiptOS-PQ verifier flow.
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded border border-border-weak-base px-2 py-1 text-11-regular text-text-weak hover:text-text-base"
              onClick={verifyReceipt}
            >
              1. Verify receipt
            </button>
            <button
              type="button"
              class="rounded border border-border-weak-base px-2 py-1 text-11-regular text-text-weak hover:text-text-base"
              onClick={attachMerkleProof}
            >
              2. Attach local Merkle proof
            </button>
            <button
              type="button"
              class="rounded border border-border-weak-base px-2 py-1 text-11-regular text-text-weak hover:text-text-base"
              onClick={prepareSepoliaPayload}
            >
              3. Prepare Sepolia payload
            </button>
            <button
              type="button"
              class="rounded border border-border-weak-base px-2 py-1 text-11-regular text-text-weak hover:text-text-base"
              onClick={copySepoliaPayload}
            >
              4. Copy Sepolia payload
            </button>
            <button
              type="button"
              class="rounded border border-border-weak-base px-2 py-1 text-11-regular text-text-weak hover:text-text-base"
              onClick={() => {
                setAnchorImportStatus(null)
                setShowSepoliaAnchorImport(true)
                if (!hasAttachedMerkleProof()) {
                  setAnchorImportStatus("Step 2 required: attach local Merkle proof first.")
                }
              }}
            >
              5. Import Sepolia result
            </button>
            <button
              type="button"
              class="rounded border border-border-weak-base px-2 py-1 text-11-regular text-text-weak hover:text-text-base"
              onClick={copyJson}
            >
              6. Copy final JSON
            </button>
            <button
              type="button"
              class="rounded border border-border-weak-base px-2 py-1 text-11-regular text-text-weak hover:text-text-base"
              onClick={() => dialog.close()}
            >
              Close
            </button>
          </div>
        </div>

        <div class="rounded-md border border-border-weak-base bg-background-base p-3 text-11-regular text-text-weak">
          <div class="mb-1 text-12-semibold text-text-base">Guided receipt anchor flow</div>
          <div>Order: [1] -&gt; [2] -&gt; [3] -&gt; [4] -&gt; [5] -&gt; [6]</div>
          <div class="mt-1">[1] Verify receipt</div>
          <div>[2] Attach local Merkle proof</div>
          <div>[3] Prepare Sepolia payload</div>
          <div>[4] Copy Sepolia payload</div>
          <div>[5] Import Sepolia result</div>
          <div>[6] Copy final JSON</div>
          <div class="mt-2">
            current requirement: {hasAttachedMerkleProof() ? "Merkle proof attached - Sepolia result can be imported." : "Attach local Merkle proof first."}
          </div>
        </div>

        <Show when={showSepoliaAnchorImport()}>
          <div class="rounded-md border border-border-weak-base bg-background-base p-3">
            <div class="mb-2 text-12-semibold text-text-base">Import Sepolia anchor result</div>
            <div class="mb-2 text-11-regular text-text-weak">anchor import panel: open</div>
            <textarea
              class="mb-2 h-32 w-full resize-y rounded border border-border-weak-base bg-surface-panel p-2 font-mono text-10-regular text-text-base"
              value={anchorImportText()}
              onInput={(event) => setAnchorImportText(event.currentTarget.value)}
              placeholder="Paste Sepolia anchor result JSON here"
            />
            <div class="mb-2 flex items-center gap-2">
              <button
                type="button"
                class="rounded border border-border-weak-base px-2 py-1 text-11-regular text-text-weak hover:text-text-base"
                onClick={importAnchorResult}
              >
                Import
              </button>
              <button
                type="button"
                class="rounded border border-border-weak-base px-2 py-1 text-11-regular text-text-weak hover:text-text-base"
                onClick={() => {
                  setAnchorImportText("")
                  setAnchorImportStatus(null)
                  setShowSepoliaAnchorImport(false)
                }}
              >
                Cancel
              </button>
            </div>
            <Show when={anchorImportStatus()}>
              <div class="mb-2 whitespace-pre-wrap text-11-regular text-text-weak">{anchorImportStatus()}</div>
            </Show>
            <Show when={importedAnchorResult()}>
              <div class="space-y-1 rounded border border-border-weak-base bg-surface-panel p-2 text-11-regular text-text-weak">
                <div>anchor result: imported</div>
                <div>on-chain anchor: anchored</div>
                <div>network: sepolia</div>
                <div>contract: {importedAnchorResult()?.contract}</div>
                <div>tx hash: {importedAnchorResult()?.tx_hash}</div>
              </div>
            </Show>
          </div>
        </Show>

        <div class="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
          <div class="min-h-0 space-y-3 overflow-auto pr-1">
            <div class="rounded-md border border-border-weak-base bg-background-base p-3">
              <div class="mb-2 text-12-semibold text-text-base">Receipt summary</div>
              <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-11-regular text-text-weak">
                <span>session: {props.evidence.session_id ?? props.summary.sessionID}</span>
                <span>schema: {props.evidence.schema ?? props.summary.schema}</span>
                <span>agent: {props.evidence.agent?.id ?? "unknown"}</span>
                <span>runtime: {props.evidence.agent?.runtime ?? "unknown"}</span>
                <Show when={props.evidence.agent?.model}>
                  <span>model: {props.evidence.agent?.model}</span>
                </Show>
                <span>messages: {props.evidence.metadata?.message_count ?? 0}</span>
                <span>diffs: {props.evidence.metadata?.diff_count ?? 0}</span>
                <span>generator: {props.evidence.metadata?.generated_by ?? "unknown"}</span>
              </div>
            </div>

            <Show when={props.evidence.task?.title || props.evidence.task?.prompt}>
              <div class="rounded-md border border-border-weak-base bg-background-base p-3">
                <div class="mb-2 text-12-semibold text-text-base">Task</div>
                <Show when={props.evidence.task?.title}>
                  <div class="mb-2">
                    <div class="text-11-medium text-text-base">Title</div>
                    <div class="break-words text-11-regular text-text-weak">{props.evidence.task?.title}</div>
                  </div>
                </Show>
                <Show when={props.evidence.task?.prompt}>
                  <div>
                    <div class="text-11-medium text-text-base">Prompt</div>
                    <div class="max-h-32 overflow-auto whitespace-pre-wrap rounded border border-border-weak-base bg-surface-panel p-2 font-mono text-10-regular text-text-weak">
                      {props.evidence.task?.prompt}
                    </div>
                  </div>
                </Show>
              </div>
            </Show>

            <div class="rounded-md border border-border-weak-base bg-background-base p-3">
              <div class="mb-2 text-12-semibold text-text-base">Authority / Scope</div>
              <div class="mb-3 grid grid-cols-2 gap-x-3 gap-y-2 text-11-regular text-text-weak">
                <span>workspace: {props.evidence.directory ?? "unknown"}</span>
                <span>network: unknown</span>
                <span>command count: {commands().length}</span>
                <span>changed files: {changedFiles().length}</span>
              </div>

              <div class="mb-3">
                <div class="mb-1 flex items-center justify-between gap-2">
                  <div class="text-11-medium text-text-base">Scope status</div>
                  <span class="rounded-full border border-border-weak-base px-2 py-0.5 text-10-regular text-text-weak">
                    {scopeStatus()}
                  </span>
                </div>
                <div class="text-10-regular text-text-weak">
                  {scopeStatus() === "within captured scope"
                    ? "Scope data is present in captured evidence."
                    : "Scope evidence is missing or incomplete, so authority boundaries are not fully specified here."}
                </div>
              </div>

              <div class="mb-3">
                <div class="text-11-medium text-text-base">Scoped lease</div>
                <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 rounded border border-border-weak-base bg-surface-panel p-2 text-10-regular text-text-weak">
                  <span>status: {scopedLease()?.status ?? "missing"}</span>
                  <span>mode: {scopedLease()?.mode ?? "unknown"}</span>
                  <span class="col-span-2 truncate">target: {scopedLease()?.target ?? props.evidence.directory ?? "unknown"}</span>
                  <span>allowed actions: {scopedLease()?.allowed_actions?.length ?? 0}</span>
                  <span>expires: {scopedLease()?.expires_at ?? "none"}</span>
                </div>
              </div>

              <div class="mb-3">
                <div class="text-11-medium text-text-base">Captured permissions</div>
                <div class="mt-1 max-h-32 overflow-auto rounded border border-border-weak-base bg-surface-panel p-2">
                  <Show
                    when={permissionJson()}
                    fallback={<div class="text-10-regular text-text-weak">No scope permission captured.</div>}
                  >
                    <pre class="whitespace-pre-wrap break-words font-mono text-10-regular text-text-weak">
                      {permissionJson()}
                    </pre>
                  </Show>
                </div>
              </div>

              <div>
                <div class="text-11-medium text-text-base">Changed files</div>
                <div class="mt-1 max-h-40 overflow-auto rounded border border-border-weak-base bg-surface-panel p-2">
                  <Show
                    when={changedFiles().length}
                    fallback={<div class="text-10-regular text-text-weak">No changed files captured.</div>}
                  >
                    <For each={changedFiles()}>
                      {(file) => <div class="truncate font-mono text-10-regular text-text-weak">{file}</div>}
                    </For>
                  </Show>
                </div>
              </div>
            </div>

            <div class="rounded-md border border-border-weak-base bg-background-base p-3">
              <div class="mb-2 text-12-semibold text-text-base">Changes</div>
              <div class="mb-3">
                <div class="text-11-medium text-text-base">Diff hash</div>
                <div class="mt-1 break-all rounded border border-border-weak-base bg-surface-panel p-2 font-mono text-10-regular text-text-weak">
                  {resolvedDiffHash()}
                </div>
              </div>
              <div>
                <div class="text-11-medium text-text-base">Changed files</div>
                <div class="mt-1 max-h-40 overflow-auto rounded border border-border-weak-base bg-surface-panel p-2">
                  <Show
                    when={changedFiles().length}
                    fallback={<div class="text-10-regular text-text-weak">No changed files captured.</div>}
                  >
                    <For each={changedFiles()}>
                      {(file) => <div class="truncate font-mono text-10-regular text-text-weak">{file}</div>}
                    </For>
                  </Show>
                </div>
              </div>
            </div>

            <div class="rounded-md border border-border-weak-base bg-background-base p-3">
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="text-12-semibold text-text-base">Receipt Anchor Proof Path</div>
                <button
                  type="button"
                  class="rounded border border-border-weak-base px-2 py-1 text-10-regular text-text-weak hover:text-text-base"
                  onClick={copyAnchorProofJson}
                >
                  Copy proof path
                </button>
              </div>
              <div class="mb-3 text-10-regular text-text-weak">
                Execution receipt &rarr; Merkle proof &rarr; on-chain anchor
              </div>
              <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-11-regular text-text-weak">
                <span>receipt root</span>
                <span class="break-all font-mono">{receiptRoot()}</span>
                <span>local Merkle proof</span>
                <span>{merkleProofStatus()}</span>
                <span>merkle root</span>
                <span class="break-all font-mono">{merkleRoot() ?? "not attached"}</span>
                <span>merkle leaf index</span>
                <span>{merkleLeafIndex() ?? "not attached"}</span>
                <span>proof entries</span>
                <span>{merkleProofEntries().length}</span>
                <span>merkle verifier</span>
                <span>{localMerkleVerification() ? (localMerkleVerification()!.ok ? "passed" : "failed") : "not run"}</span>
                <span>on-chain anchor</span>
                <span>{onchainAnchorStatus()}</span>
                <span>network</span>
                <span>{anchorNetwork()}</span>
                <span>contract</span>
                <span class="break-all font-mono">{anchorContract()}</span>
                <span>tx</span>
                <span class="break-all font-mono">{anchorTxHash()}</span>
                <span>anchor verifier</span>
                <span>{anchorVerifierStatus()}</span>
                <span>anchor result</span>
                <span>{importedAnchorResult() ? "imported" : "not imported"}</span>
                <span>Sepolia payload</span>
                <span>{sepoliaPayload() ? "ready" : "not prepared"}</span>
                <span>submit status</span>
                <span>{sepoliaPayload() ? "not submitted" : "not prepared"}</span>
                <span>local verifier</span>
                <span>{localVerification() ? (localVerification()!.ok ? "passed" : "failed") : "not run"}</span>
              </div>

              <Show when={localVerification()}>
                {(result) => (
                  <div class="mt-3 rounded border border-border-weak-base bg-surface-panel p-2 text-10-regular text-text-weak">
                    <div class="mb-1 text-11-medium text-text-base">Local verification details</div>
                    <div class="grid grid-cols-2 gap-x-3 gap-y-1">
                      <span>expected root</span>
                      <span class="break-all font-mono">{result().receipt_root ?? "missing"}</span>
                      <span>recomputed root</span>
                      <span class="break-all font-mono">{result().recomputed_root ?? "missing"}</span>
                    </div>
                  </div>
                )}
              </Show>

              <Show when={localMerkleVerification()}>
                {(result) => (
                  <div class="mt-3 rounded border border-border-weak-base bg-surface-panel p-2 text-10-regular text-text-weak">
                    <div class="mb-1 text-11-medium text-text-base">Local Merkle proof details</div>
                    <div class="mb-1 text-10-regular text-text-weak">This is a local/off-chain one-leaf proof. It is not on-chain verified.</div>
                    <div class="grid grid-cols-2 gap-x-3 gap-y-1">
                      <span>merkle root</span>
                      <span class="break-all font-mono">{result().merkle_root ?? "missing"}</span>
                      <span>recomputed root</span>
                      <span class="break-all font-mono">{result().recomputed_root ?? "missing"}</span>
                      <span>leaf index</span>
                      <span>{result().merkle_leaf_index ?? "missing"}</span>
                      <span>proof entries</span>
                      <span>{result().merkle_proof_count}</span>
                    </div>
                  </div>
                )}
              </Show>

              <Show when={sepoliaPayload()}>
                {(payload) => (
                  <div class="mt-3 rounded border border-border-weak-base bg-surface-panel p-2 text-10-regular text-text-weak">
                    <div class="mb-1 text-11-medium text-text-base">Sepolia anchor payload</div>
                    <div class="mb-1 text-10-regular text-text-weak">Prepared locally only. Not submitted, not anchored, not on-chain verified.</div>
                    <div class="grid grid-cols-2 gap-x-3 gap-y-1">
                      <span>schema</span>
                      <span class="break-all font-mono">{payload().schema}</span>
                      <span>anchor target</span>
                      <span>{payload().anchor_target}</span>
                      <span>network</span>
                      <span>{payload().network}</span>
                      <span>receipt root</span>
                      <span class="break-all font-mono">{payload().receipt_root}</span>
                      <span>merkle root</span>
                      <span class="break-all font-mono">{payload().merkle_root}</span>
                      <span>leaf index</span>
                      <span>{payload().merkle_leaf_index}</span>
                      <span>proof entries</span>
                      <span>{payload().merkle_proof.length}</span>
                    </div>
                  </div>
                )}
              </Show>

              <div class="mt-3">
                <div class="mb-1 text-11-medium text-text-base">Copy payload preview</div>
                <pre class="max-h-40 overflow-auto rounded border border-border-weak-base bg-surface-panel p-2 font-mono text-10-regular text-text-weak">
                  {anchorProofJson()}
                </pre>
              </div>
            </div>
            <div class="rounded-md border border-border-weak-base bg-background-base p-3">
              <div class="mb-2 text-12-semibold text-text-base">Command summary</div>
              <div class="max-h-56 space-y-2 overflow-auto rounded border border-border-weak-base bg-surface-panel p-2">
                <Show
                  when={commands().length}
                  fallback={<div class="text-10-regular text-text-weak">No command evidence captured.</div>}
                >
                  <For each={commands()}>
                    {(command, index) => (
                      <div class="space-y-1 text-10-regular text-text-weak">
                        <div class="font-mono break-all text-text-base">{index() + 1}. {command.command}</div>
                        <div>exit: {typeof command.exit_code === "number" ? command.exit_code : "n/a"}</div>
                        <Show when={command.stdout_summary}>
                          <div class="whitespace-pre-wrap break-words">{command.stdout_summary}</div>
                        </Show>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>
          </div>

          <div class="min-h-0 overflow-hidden rounded-md border border-border-weak-base bg-background-base p-3">
            <div class="mb-2 flex items-center justify-between gap-2">
              <div class="text-12-semibold text-text-base">Full evidence JSON</div>
              <span class="rounded-full border border-border-weak-base px-2 py-0.5 text-10-regular text-text-weak">
                ReceiptOS-PQ-ready
              </span>
            </div>
            <pre class="h-full max-h-full overflow-auto rounded border border-border-weak-base bg-surface-panel p-2 text-10-regular text-text-weak">
              {evidenceJson()}
            </pre>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
