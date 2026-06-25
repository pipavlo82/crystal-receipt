import { createHash } from "node:crypto"
import type { HandoffEvidence } from "../schema/types"
import { canonicalize } from "./canonicalize"

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

export function stripAnchor<T extends { anchor?: unknown }>(value: T): Omit<T, "anchor"> {
  const clone = { ...value } as Record<string, unknown>
  delete clone.anchor
  return clone as Omit<T, "anchor">
}

type ReceiptRootInput = HandoffEvidence | Omit<HandoffEvidence, "anchor">

// computeReceiptRoot() always ignores the top-level anchor field.
// This prevents receipt_root from depending on its own anchored value.
export function computeReceiptRoot(value: ReceiptRootInput): string {
  return `0x${sha256(canonicalize(stripAnchor(value)))}`
}
