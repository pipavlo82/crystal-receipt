import { claudeCodeSessionAdapter } from "./claude-code-session"
import { cursorSessionAdapter } from "./cursor-session"
import { externalCodingRunAdapter } from "./external-coding-run"
import { genericAdapter } from "./generic"
import { githubActionsAdapter } from "./github-actions"
import { stealthHandoffAdapter } from "./stealth-handoff"
import type { ProducerAdapter } from "./types"

export const adapters: ProducerAdapter[] = [
  genericAdapter,
  externalCodingRunAdapter,
  githubActionsAdapter,
  stealthHandoffAdapter,
  claudeCodeSessionAdapter,
  cursorSessionAdapter,
]

export function resolveProducerAdapter(producerId: string): ProducerAdapter {
  const adapter = adapters.find((candidate) => candidate.id === producerId)
  if (!adapter) {
    throw new Error(`Unknown producer adapter: ${producerId}`)
  }
  return adapter
}
