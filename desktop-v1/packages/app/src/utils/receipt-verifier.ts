import type { HandoffEvidence } from "@/pages/session/handoff"

type HandoffEvidenceWithAnchor = HandoffEvidence & {
  anchor?: {
    receipt_root?: string | null
  }
}

export type HandoffReceiptVerification = {
  ok: boolean
  receipt_root: string | null
  recomputed_root: string | null
}

function canonicalizeForReceipt(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeForReceipt).join(",")}]`
  }

  const keys = Object.keys(value)
    .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .sort()

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalizeForReceipt((value as Record<string, unknown>)[key])}`)
    .join(",")}}`
}

function stripTopLevelAnchor(evidence: HandoffEvidenceWithAnchor): Omit<HandoffEvidenceWithAnchor, "anchor"> {
  const { anchor: _anchor, ...withoutAnchor } = evidence
  return withoutAnchor
}

async function sha256Hex(value: string): Promise<string> {
  const buffer = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export async function verifyHandoffReceiptRoot(evidence: HandoffEvidenceWithAnchor): Promise<HandoffReceiptVerification> {
  const receiptRoot = evidence.anchor?.receipt_root ?? null

  if (!receiptRoot) {
    return {
      ok: false,
      receipt_root: null,
      recomputed_root: null,
    }
  }

  const recomputedRoot = `0x${await sha256Hex(canonicalizeForReceipt(stripTopLevelAnchor(evidence)))}`

  return {
    ok: receiptRoot.toLowerCase() === recomputedRoot.toLowerCase(),
    receipt_root: receiptRoot,
    recomputed_root: recomputedRoot,
  }
}
