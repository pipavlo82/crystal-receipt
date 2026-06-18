import type { HandoffEvidence, HandoffReceiptVerification } from "../schema/types"
import { canonicalize } from "../canon/canonicalize"

type HandoffEvidenceWithAnchor = HandoffEvidence & {
  anchor?: {
    receipt_root?: string | null
  }
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

  const recomputedRoot = `0x${await sha256Hex(canonicalize(stripTopLevelAnchor(evidence)))}`

  return {
    ok: receiptRoot.toLowerCase() === recomputedRoot.toLowerCase(),
    receipt_root: receiptRoot,
    recomputed_root: recomputedRoot,
  }
}
