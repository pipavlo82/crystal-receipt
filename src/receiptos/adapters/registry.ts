import { externalCodingRunAdapter } from "./external-coding-run"
import { genericAdapter } from "./generic"
import { githubActionsAdapter } from "./github-actions"
import type { ProducerAdapter } from "./types"

export const adapters: ProducerAdapter[] = [
  genericAdapter,
  externalCodingRunAdapter,
  githubActionsAdapter,
]

export function resolveProducerAdapter(producerId: string): ProducerAdapter {
  const adapter = adapters.find((candidate) => candidate.id === producerId)
  if (!adapter) {
    throw new Error(`Unknown producer adapter: ${producerId}`)
  }
  return adapter
}
