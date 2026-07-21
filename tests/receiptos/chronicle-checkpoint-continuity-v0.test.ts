import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { canonicalize } from "../../src/receiptos"
import { evaluateChronicleCheckpointContinuityV0, type ChronicleCheckpointContinuityResultV0 } from "../../src/receiptos"
import type { ChronicleCheckpointV0 } from "../../src/receiptos"

type ContinuityVector = {
  name: string
  current: ChronicleCheckpointV0
  predecessor: ChronicleCheckpointV0 | null
  expected: ChronicleCheckpointContinuityResultV0
}
type ContinuityFixture = { profile: string; description: string; vectors: ContinuityVector[] }

const fixturePath = resolve(import.meta.dir, "../fixtures/chronicle-checkpoint-continuity-v0.json")
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as ContinuityFixture

if (!Array.isArray(fixture.vectors) || fixture.vectors.length !== 17) {
  throw new Error(`chronicle checkpoint continuity fixture must include exactly 17 vectors, found ${fixture.vectors?.length ?? 0}`)
}

describe("chronicle checkpoint continuity v0 conformance vectors", () => {
  for (const vector of fixture.vectors) {
    test(vector.name, () => {
      const result = evaluateChronicleCheckpointContinuityV0(vector.current, vector.predecessor)

      expect(canonicalize(result)).toBe(canonicalize(vector.expected))
      expect(result).toStrictEqual(vector.expected)
    })
  }

  test("current with sequence 0 and an omitted prev_checkpoint is current_shape_malformed (absent is not normalized to null)", () => {
    const current = {
      schema: "chronicle_checkpoint.v0",
      checkpoint_id: "current-omitted-prev",
      collection_ref: "/collection/demo",
      entry_refs: ["entry-alpha"],
      sequence: 0,
      checkpoint_root: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    } as unknown as ChronicleCheckpointV0

    const result = evaluateChronicleCheckpointContinuityV0(current, null)

    expect(result).toStrictEqual({
      evaluation_state: "malformed",
      verdict: null,
      relation: null,
      reason_code: "current_shape_malformed",
    })
  })

  test("predecessor with sequence 0 and an omitted prev_checkpoint is predecessor_shape_malformed after current passes local verification", () => {
    const successorVector = fixture.vectors.find((vector) => vector.name === "valid_successor")
    if (!successorVector) {
      throw new Error("expected fixture to contain the valid_successor vector")
    }

    const predecessor = {
      schema: "chronicle_checkpoint.v0",
      checkpoint_id: "predecessor-omitted-prev",
      collection_ref: "/collection/demo",
      entry_refs: ["entry-alpha"],
      sequence: 0,
      checkpoint_root: successorVector.current.prev_checkpoint,
    } as unknown as ChronicleCheckpointV0

    const result = evaluateChronicleCheckpointContinuityV0(successorVector.current, predecessor)

    expect(result).toStrictEqual({
      evaluation_state: "malformed",
      verdict: null,
      relation: null,
      reason_code: "predecessor_shape_malformed",
    })
  })
})
