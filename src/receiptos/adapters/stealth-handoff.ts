import type { HandoffEvidence } from "../schema/types"
import type { ProducerAdapter } from "./types"

export type StealthHandoffOutput = HandoffEvidence

export function normalizeStealthHandoffOutput(source: StealthHandoffOutput): HandoffEvidence {
  if (source.schema !== "stealth.session.evidence.v1") {
    throw new Error(`Expected stealth.session.evidence.v1, got ${String(source.schema)}`)
  }
  return source
}

export const stealthHandoffAdapter: ProducerAdapter<StealthHandoffOutput> = {
  id: "stealth-handoff",
  sourceSchema: "stealth.session.evidence.v1",
  normalize: normalizeStealthHandoffOutput,
}
