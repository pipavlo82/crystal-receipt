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

export function computeReceiptRoot(value: Omit<HandoffEvidence, "anchor">): string {
  return `0x${sha256(canonicalize(value))}`
}
