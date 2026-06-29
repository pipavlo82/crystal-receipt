import { createSignal, Match, Switch } from "solid-js"
import type { EvidenceCapsuleV0, PortableProofObjectV0, ProvenanceSummaryV0 } from "../../../../src/receiptos"

type LoadState = "idle" | "loading" | "loaded" | "error"
type BadgeTone = "verified" | "present" | "missing" | "failed"

type ChronicleEntryV0 = {
  schema: "chronicle_entry.v0"
  entry_id: string
  created_at: string
  relation_type: string
  project_refs: string[]
  proof_object_refs: Array<{
    proof_object_id: string
    proof_system: string
    receipt_root: string
    proof_ref: string
    replay_ref: string | null
    anchor_ref: string | null
  }>
  metadata: {
    label: string
    session_id: string
    position_id: string
    directory: string
    source_evidence_ref: string
    producer_runtime: string
    source_schema: string
  }
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function badgeStyle(tone: BadgeTone) {
  if (tone === "verified") {
    return { color: "#bbf7d0", background: "rgba(22, 163, 74, 0.18)", border: "1px solid rgba(34, 197, 94, 0.35)" }
  }
  if (tone === "present") {
    return { color: "#bfdbfe", background: "rgba(37, 99, 235, 0.18)", border: "1px solid rgba(59, 130, 246, 0.35)" }
  }
  if (tone === "failed") {
    return { color: "#fecaca", background: "rgba(220, 38, 38, 0.18)", border: "1px solid rgba(248, 113, 113, 0.35)" }
  }
  return { color: "#fde68a", background: "rgba(217, 119, 6, 0.18)", border: "1px solid rgba(245, 158, 11, 0.35)" }
}

function StatusBadge(props: { label: string, tone: BadgeTone }) {
  return (
    <span style={{ display: "inline-flex", "align-items": "center", gap: "6px", padding: "6px 10px", "border-radius": "999px", "font-size": "12px", "font-weight": "700", "letter-spacing": "0.02em", ...badgeStyle(props.tone) }}>
      {props.label}
    </span>
  )
}

function JsonSection(props: { title: string, value: unknown, open?: boolean }) {
  return (
    <details open={props.open} style={{ padding: "16px", background: "#111827", "border-radius": "16px", border: "1px solid #1f2937" }}>
      <summary style={{ cursor: "pointer", "font-weight": "700" }}>{props.title}</summary>
      <pre style={{ margin: "12px 0 0 0", "white-space": "pre-wrap", "word-break": "break-word", overflow: "auto", color: "#d1d5db", "font-size": "13px", "line-height": "1.55" }}>
        {JSON.stringify(props.value, null, 2)}
      </pre>
    </details>
  )
}

function LayerCard(props: { title: string, body: string }) {
  return (
    <div style={{ padding: "18px", background: "linear-gradient(180deg, #111827 0%, #0f172a 100%)", "border-radius": "18px", border: "1px solid #1f2937" }}>
      <div style={{ "font-size": "15px", "font-weight": "700", margin: "0 0 8px 0" }}>{props.title}</div>
      <div style={{ color: "#cbd5e1", "line-height": "1.6", "font-size": "14px" }}>{props.body}</div>
    </div>
  )
}

function createChronicleEntryV0(proofObject: PortableProofObjectV0): ChronicleEntryV0 {
  return {
    schema: "chronicle_entry.v0",
    entry_id: `entry-${proofObject.proof_object_id}`,
    created_at: proofObject.created_at,
    relation_type: proofObject.relation_type,
    project_refs: proofObject.project_refs,
    proof_object_refs: [
      {
        proof_object_id: proofObject.proof_object_id,
        proof_system: proofObject.proof_system,
        receipt_root: proofObject.receipt_root,
        proof_ref: proofObject.proof_ref,
        replay_ref: proofObject.replay_ref,
        anchor_ref: proofObject.anchor_ref,
      },
    ],
    metadata: {
      label: proofObject.metadata.label,
      session_id: proofObject.metadata.session_id,
      position_id: proofObject.metadata.position_id,
      directory: proofObject.metadata.directory,
      source_evidence_ref: proofObject.source_evidence_ref,
      producer_runtime: proofObject.producer.runtime,
      source_schema: proofObject.producer.source_schema,
    },
  }
}

function copyValue(value: string, onDone: () => void) {
  navigator.clipboard.writeText(value).then(onDone)
}

export function ProofHome() {
  const [state, setState] = createSignal<LoadState>("idle")
  const [sourceName, setSourceName] = createSignal<string>("")
  const [receiptRoot, setReceiptRoot] = createSignal<string>("")
  const [capsule, setCapsule] = createSignal<EvidenceCapsuleV0 | null>(null)
  const [provenance, setProvenance] = createSignal<ProvenanceSummaryV0 | null>(null)
  const [proofObject, setProofObject] = createSignal<PortableProofObjectV0 | null>(null)
  const [chronicleEntry, setChronicleEntry] = createSignal<ChronicleEntryV0 | null>(null)
  const [error, setError] = createSignal<string>("")
  const [copiedField, setCopiedField] = createSignal<string>("")

  const onSelectFile = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    setState("loading")
    setError("")
    setCopiedField("")

    try {
      const raw = JSON.parse(await file.text())
      const result = await window.api.processStealthEvidenceToProof(raw, file.name)
      const nextChronicleEntry = createChronicleEntryV0(result.portable_proof_object)

      setSourceName(file.name)
      setReceiptRoot(result.receipt_root)
      setCapsule(result.evidence_capsule)
      setProvenance(result.provenance_summary)
      setProofObject(result.portable_proof_object)
      setChronicleEntry(nextChronicleEntry)
      setState("loaded")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setState("error")
    } finally {
      input.value = ""
    }
  }

  const exportPortableProofObject = () => {
    const current = proofObject()
    if (!current) return
    downloadJson("portable-proof-object-v0.json", current)
  }

  const exportChronicleEntry = () => {
    const current = chronicleEntry()
    if (!current) return
    downloadJson("chronicle-entry-v0.json", current)
  }

  const capsuleStatus = () => capsule() ? "present" : "missing"
  const provenanceStatus = () => provenance() ? (provenance()?.verifier_status === "verified" ? "verified" : "present") : "missing"
  const exportStatus = () => proofObject() ? "present" : "missing"
  const chronicleStatus = () => chronicleEntry() ? "present" : "missing"
  const verificationStatus = () => {
    const current = proofObject()
    if (!current || !receiptRoot()) return "missing"
    return current.receipt_root === receiptRoot() ? "verified" : "failed"
  }

  const markCopied = (field: string) => {
    setCopiedField(field)
    setTimeout(() => setCopiedField(""), 1800)
  }

  return (
    <div style={{ padding: "28px", "font-family": "Inter, Arial, sans-serif", color: "#f8fafc", background: "radial-gradient(circle at top, #172554 0%, #0f172a 32%, #020617 100%)", height: "100vh", "box-sizing": "border-box", overflow: "auto" }}>
      <div style={{ display: "grid", gap: "20px", "max-width": "1120px", margin: "0 auto" }}>
        <section style={{ padding: "28px", background: "rgba(15, 23, 42, 0.92)", "border-radius": "24px", border: "1px solid rgba(59, 130, 246, 0.18)", "box-shadow": "0 24px 80px rgba(2, 6, 23, 0.45)" }}>
          <div style={{ display: "flex", "justify-content": "space-between", gap: "16px", "align-items": "flex-start", "flex-wrap": "wrap" }}>
            <div style={{ "max-width": "760px" }}>
              <div style={{ "font-size": "12px", "letter-spacing": "0.24em", "text-transform": "uppercase", color: "#93c5fd", "font-weight": "800", margin: "0 0 10px 0" }}>
                Crystal Receipt Desktop
              </div>
              <h1 style={{ margin: "0 0 12px 0", "font-size": "34px", "font-weight": "800", "line-height": "1.1" }}>Proof-first desktop for portable execution receipts</h1>
              <p style={{ margin: "0 0 12px 0", color: "#cbd5e1", "font-size": "16px", "line-height": "1.65" }}>
                Stealth executes. ReceiptOS proves. Crystal Receipt exports. Chronicle records history.
              </p>
              <p style={{ margin: "0", color: "#94a3b8", "font-size": "14px" }}>
                <strong>identifier → history → reputation</strong><br />
                History records facts. Reputation interprets them.
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px", "align-items": "center", "flex-wrap": "wrap" }}>
              <label style={{ display: "inline-flex", padding: "12px 16px", "border-radius": "12px", background: "#2563eb", color: "white", cursor: "pointer", "font-weight": "700", "box-shadow": "0 12px 30px rgba(37, 99, 235, 0.35)" }}>
                Open Stealth evidence JSON
                <input type="file" accept="application/json,.json" onChange={onSelectFile} style={{ display: "none" }} />
              </label>

              <button type="button" disabled={!proofObject()} onClick={exportPortableProofObject} style={{ padding: "12px 16px", "border-radius": "12px", border: "1px solid #334155", background: proofObject() ? "#0f172a" : "#1e293b", color: "white", cursor: proofObject() ? "pointer" : "not-allowed", "font-weight": "700" }}>
                Export portable proof object
              </button>

              <button type="button" disabled={!chronicleEntry()} onClick={exportChronicleEntry} style={{ padding: "12px 16px", "border-radius": "12px", border: "1px solid #334155", background: chronicleEntry() ? "#0f172a" : "#1e293b", color: "white", cursor: chronicleEntry() ? "pointer" : "not-allowed", "font-weight": "700" }}>
                Record to Chronicle
              </button>
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gap: "16px", "grid-template-columns": "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <LayerCard title="Stealth Evidence" body="Execution trace imported from Stealth." />
          <LayerCard title="ReceiptOS Proof" body="Recomputable proof artifacts: receipt_root, Evidence Capsule, Provenance Summary." />
          <LayerCard title="Chronicle History" body="Portable proof object ready to be recorded as neutral history." />
        </section>

        <Switch>
          <Match when={state() === "idle"}>
            <section style={{ padding: "20px", background: "rgba(15, 23, 42, 0.9)", "border-radius": "18px", border: "1px solid #1f2937", color: "#cbd5e1" }}>
              Choose a Stealth evidence JSON file to derive proof outputs.
            </section>
          </Match>
          <Match when={state() === "loading"}>
            <section style={{ padding: "20px", background: "rgba(15, 23, 42, 0.9)", "border-radius": "18px", border: "1px solid #1f2937", color: "#cbd5e1" }}>
              Processing evidence…
            </section>
          </Match>
          <Match when={state() === "error"}>
            <section style={{ padding: "20px", background: "rgba(15, 23, 42, 0.9)", "border-radius": "18px", border: "1px solid #7f1d1d", color: "#fecaca", "white-space": "pre-wrap" }}>
              Error: {error()}
            </section>
          </Match>
          <Match when={state() === "loaded"}>
            <section style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gap: "16px", "grid-template-columns": "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div style={{ padding: "18px", background: "#111827", "border-radius": "16px", border: "1px solid #1f2937" }}>
                  <div style={{ color: "#94a3b8", "font-size": "12px", "text-transform": "uppercase", "letter-spacing": "0.12em", margin: "0 0 8px 0" }}>Evidence source</div>
                  <div style={{ "font-weight": "700" }}>{sourceName()}</div>
                  <div style={{ margin: "12px 0 0 0" }}><StatusBadge label="present" tone="present" /></div>
                </div>
                <div style={{ padding: "18px", background: "#111827", "border-radius": "16px", border: "1px solid #1f2937" }}>
                  <div style={{ color: "#94a3b8", "font-size": "12px", "text-transform": "uppercase", "letter-spacing": "0.12em", margin: "0 0 8px 0" }}>Evidence Capsule</div>
                  <div><StatusBadge label={capsuleStatus()} tone={capsuleStatus() as BadgeTone} /></div>
                </div>
                <div style={{ padding: "18px", background: "#111827", "border-radius": "16px", border: "1px solid #1f2937" }}>
                  <div style={{ color: "#94a3b8", "font-size": "12px", "text-transform": "uppercase", "letter-spacing": "0.12em", margin: "0 0 8px 0" }}>Provenance</div>
                  <div><StatusBadge label={provenanceStatus()} tone={provenanceStatus() as BadgeTone} /></div>
                </div>
                <div style={{ padding: "18px", background: "#111827", "border-radius": "16px", border: "1px solid #1f2937" }}>
                  <div style={{ color: "#94a3b8", "font-size": "12px", "text-transform": "uppercase", "letter-spacing": "0.12em", margin: "0 0 8px 0" }}>Portable proof object</div>
                  <div><StatusBadge label={exportStatus()} tone={exportStatus() as BadgeTone} /></div>
                </div>
                <div style={{ padding: "18px", background: "#111827", "border-radius": "16px", border: "1px solid #1f2937" }}>
                  <div style={{ color: "#94a3b8", "font-size": "12px", "text-transform": "uppercase", "letter-spacing": "0.12em", margin: "0 0 8px 0" }}>Chronicle export</div>
                  <div><StatusBadge label={chronicleStatus()} tone={chronicleStatus() as BadgeTone} /></div>
                </div>
              </div>

              <div style={{ display: "grid", gap: "16px", "grid-template-columns": "1.2fr 1fr" }}>
                <div style={{ padding: "18px", background: "#111827", "border-radius": "16px", border: "1px solid #1f2937" }}>
                  <div style={{ display: "flex", "justify-content": "space-between", gap: "12px", "align-items": "center", "flex-wrap": "wrap" }}>
                    <div>
                      <div style={{ color: "#94a3b8", "font-size": "12px", "text-transform": "uppercase", "letter-spacing": "0.12em", margin: "0 0 6px 0" }}>receipt_root</div>
                      <div style={{ "font-size": "13px", color: "#e2e8f0", "word-break": "break-word" }}>{receiptRoot()}</div>
                    </div>
                    <button type="button" onClick={() => copyValue(receiptRoot(), () => markCopied("receipt_root"))} style={{ padding: "10px 12px", "border-radius": "10px", border: "1px solid #334155", background: "#0f172a", color: "white", cursor: "pointer", "font-weight": "700" }}>
                      {copiedField() === "receipt_root" ? "Copied" : "Copy receipt_root"}
                    </button>
                  </div>
                </div>

                <div style={{ padding: "18px", background: "#111827", "border-radius": "16px", border: "1px solid #1f2937" }}>
                  <div style={{ color: "#94a3b8", "font-size": "12px", "text-transform": "uppercase", "letter-spacing": "0.12em", margin: "0 0 8px 0" }}>receipt_root verification</div>
                  <div style={{ margin: "0 0 10px 0" }}><StatusBadge label={verificationStatus()} tone={verificationStatus() as BadgeTone} /></div>
                  <div style={{ color: "#cbd5e1", "font-size": "13px", "line-height": "1.6" }}>
                    Recomputed root:<br />
                    <code style={{ color: "#f8fafc" }}>{receiptRoot()}</code>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: "16px", "grid-template-columns": "repeat(auto-fit, minmax(260px, 1fr))" }}>
                <div style={{ padding: "18px", background: "#111827", "border-radius": "16px", border: "1px solid #1f2937" }}>
                  <div style={{ color: "#94a3b8", "font-size": "12px", "text-transform": "uppercase", "letter-spacing": "0.12em", margin: "0 0 8px 0" }}>proof_ref</div>
                  <div style={{ "font-size": "13px", color: "#e2e8f0", "word-break": "break-word", margin: "0 0 10px 0" }}>{proofObject()?.proof_ref ?? "n/a"}</div>
                  <button type="button" onClick={() => proofObject()?.proof_ref && copyValue(proofObject()!.proof_ref, () => markCopied("proof_ref"))} style={{ padding: "10px 12px", "border-radius": "10px", border: "1px solid #334155", background: "#0f172a", color: "white", cursor: "pointer", "font-weight": "700" }}>
                    {copiedField() === "proof_ref" ? "Copied" : "Copy proof_ref"}
                  </button>
                </div>
                <div style={{ padding: "18px", background: "#111827", "border-radius": "16px", border: "1px solid #1f2937" }}>
                  <div style={{ color: "#94a3b8", "font-size": "12px", "text-transform": "uppercase", "letter-spacing": "0.12em", margin: "0 0 8px 0" }}>replay_ref</div>
                  <div style={{ "font-size": "13px", color: "#e2e8f0", "word-break": "break-word", margin: "0 0 10px 0" }}>{proofObject()?.replay_ref ?? "n/a"}</div>
                  <button type="button" onClick={() => proofObject()?.replay_ref && copyValue(proofObject()!.replay_ref!, () => markCopied("replay_ref"))} style={{ padding: "10px 12px", "border-radius": "10px", border: "1px solid #334155", background: "#0f172a", color: "white", cursor: proofObject()?.replay_ref ? "pointer" : "not-allowed", "font-weight": "700" }}>
                    {copiedField() === "replay_ref" ? "Copied" : "Copy replay_ref"}
                  </button>
                </div>
              </div>

              <JsonSection title="Evidence Capsule v0" value={capsule()} open />
              <JsonSection title="Provenance Summary v0" value={provenance()} open />
              <JsonSection title="portable_proof_object.v0" value={proofObject()} />
              <JsonSection title="chronicle_entry.v0" value={chronicleEntry()} />
            </section>
          </Match>
        </Switch>

        <footer style={{ padding: "18px 22px", background: "rgba(15, 23, 42, 0.88)", "border-radius": "18px", border: "1px solid #1f2937", color: "#cbd5e1", "line-height": "1.75" }}>
          <strong>No scoring.</strong> No reputation baked in. No ownership or NFT logic. Facts first. Interpretation later.
        </footer>
      </div>
    </div>
  )
}
