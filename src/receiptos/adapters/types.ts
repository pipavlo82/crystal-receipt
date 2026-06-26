import type { HandoffEvidence } from "../schema/types"

export type ProducerAdapter<TSource = unknown> = {
  id: string
  sourceSchema: string | null
  matches(input: unknown): boolean
  normalize(input: TSource): HandoffEvidence
}
