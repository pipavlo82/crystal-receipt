import type { HandoffEvidence } from "../schema/types"

export type ProducerAdapter<TSource = unknown> = {
  id: string
  sourceSchema: string | null
  normalize(input: TSource): HandoffEvidence
}
