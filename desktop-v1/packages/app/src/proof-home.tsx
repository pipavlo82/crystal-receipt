import { createSignal, Match, Switch } from "solid-js"
import type { EvidenceCapsuleV0, PortableProofObjectV0, ProvenanceSummaryV0 } from "../../../../src/receiptos"

type LoadState = "idle" | "loading" | "loaded" | "error"

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ProofHome() {
  const [state, setState] = createSignal<LoadState>("idle")
  const [sourceName, setSourceName] = createSignal<string>("")
  const [receiptRoot, setReceiptRoot] = createSignal<string>("")
  const [capsule, setCapsule] = createSignal<EvidenceCapsuleV0 | null>(null)
  const [provenance, setProvenance] = createSignal<ProvenanceSummaryV0 | null>(null)
  const [proofObject, setProofObject] = createSignal<PortableProofObjectV0 | null>(null)
  const [error, setError] = createSignal<string>("")

  const onSelectFile = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    setState("loading")
    setError("")

    try {
      const raw = JSON.parse(await file.text())
      const result = await window.api.processStealthEvidenceToProof(raw, file.name)

      setSourceName(file.name)
      setReceiptRoot(result.receipt_root)
      setCapsule(result.evidence_capsule)
      setProvenance(result.provenance_summary)
      setProofObject(result.portable_proof_object)
      setState("loaded")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setState("error")
    } finally {
      input.value = ""
    }
  }

  return (
    <div
      style={{
        padding: "24px",
        "font-family": "Inter, Arial, sans-serif",
        color: "white",
        "background-color": "#0f1115",
        height: "100vh",
        "box-sizing": "border-box",
        overflow: "auto",
      }}
    >
      <h1 style={{ margin: "0 0 12px 0", "font-size": "28px", "font-weight": "700" }}>Crystal Receipt Desktop v1</h1>
      <p style={{ margin: "0 0 12px 0", opacity: "0.85" }}>
        Minimal proof desktop: import Stealth evidence, derive ReceiptOS proof outputs, export Chronicle-ready portable proof objects.
      </p>
      <p style={{ margin: "0 0 20px 0", opacity: "0.75" }}>
        Stealth executes. ReceiptOS proves. Chronicle records history.
      </p>

      <div style={{ display: "flex", gap: "12px", "align-items": "center", "margin-bottom": "20px", "flex-wrap": "wrap" }}>
        <label
          style={{
            display: "inline-flex",
            padding: "10px 14px",
            "border-radius": "10px",
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
            "font-weight": "600",
          }}
        >
          Open Stealth evidence JSON
          <input type="file" accept="application/json,.json" onChange={onSelectFile} style={{ display: "none" }} />
        </label>

        <button
          type="button"
          disabled={!proofObject()}
          onClick={() => proofObject() && downloadJson("portable-proof-object-v0.json", proofObject())}
          style={{
            padding: "10px 14px",
            "border-radius": "10px",
            border: "1px solid #374151",
            background: proofObject() ? "#111827" : "#1f2937",
            color: "white",
            cursor: proofObject() ? "pointer" : "not-allowed",
          }}
        >
          Export portable proof object
        </button>
      </div>

      <Switch>
        <Match when={state() === "idle"}>
          <div style={{ opacity: 0.75 }}>Choose a Stealth evidence JSON file to derive proof outputs.</div>
        </Match>
        <Match when={state() === "loading"}>
          <div style={{ opacity: 0.75 }}>Processing evidence…</div>
        </Match>
        <Match when={state() === "error"}>
          <div style={{ color: "#fca5a5", "white-space": "pre-wrap" }}>Error: {error()}</div>
        </Match>
        <Match when={state() === "loaded"}>
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ padding: "16px", background: "#111827", "border-radius": "12px", border: "1px solid #1f2937" }}>
              <strong>Source file</strong>
              <div style={{ opacity: 0.85, "margin-top": "6px" }}>{sourceName()}</div>
            </div>

            <div style={{ padding: "16px", background: "#111827", "border-radius": "12px", border: "1px solid #1f2937" }}>
              <strong>receipt_root</strong>
              <pre style={{ margin: "8px 0 0 0", "white-space": "pre-wrap", "word-break": "break-word" }}>{receiptRoot()}</pre>
            </div>

            <div style={{ padding: "16px", background: "#111827", "border-radius": "12px", border: "1px solid #1f2937" }}>
              <strong>Evidence Capsule v0</strong>
              <pre style={{ margin: "8px 0 0 0", "white-space": "pre-wrap", "word-break": "break-word", overflow: "auto" }}>
                {JSON.stringify(capsule(), null, 2)}
              </pre>
            </div>

            <div style={{ padding: "16px", background: "#111827", "border-radius": "12px", border: "1px solid #1f2937" }}>
              <strong>Provenance Summary v0</strong>
              <pre style={{ margin: "8px 0 0 0", "white-space": "pre-wrap", "word-break": "break-word", overflow: "auto" }}>
                {JSON.stringify(provenance(), null, 2)}
              </pre>
            </div>

            <div style={{ padding: "16px", background: "#111827", "border-radius": "12px", border: "1px solid #1f2937" }}>
              <strong>portable_proof_object.v0</strong>
              <pre style={{ margin: "8px 0 0 0", "white-space": "pre-wrap", "word-break": "break-word", overflow: "auto" }}>
                {JSON.stringify(proofObject(), null, 2)}
              </pre>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  )
}
