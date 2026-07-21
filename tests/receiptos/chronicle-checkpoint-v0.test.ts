import { describe, expect, test } from "bun:test"
import { canonicalize, sha256 } from "../../src/receiptos"
import {
  createChronicleCheckpointV0,
  verifyChronicleCheckpointV0,
} from "../../src/receiptos"

function computeCheckpointRootWithEntryRefsExactlyAsStored(input: {
  schema: "chronicle_checkpoint.v0"
  checkpoint_id: string
  collection_ref: string
  entry_refs: string[]
  prev_checkpoint: string | null
  sequence: number
}) {
  return `sha256:${sha256(canonicalize({
    schema: input.schema,
    checkpoint_id: input.checkpoint_id,
    collection_ref: input.collection_ref,
    entry_refs: input.entry_refs,
    prev_checkpoint: input.prev_checkpoint,
    sequence: input.sequence,
  }))}`
}

describe("chronicle checkpoint v0", () => {
  test("empty entry_refs produces a stable root", () => {
    const checkpoint = createChronicleCheckpointV0({
      checkpointId: "checkpoint-empty",
      collectionRef: "/collection/empty",
      entryRefs: [],
      prevCheckpoint: null,
      sequence: 0,
    })

    expect(checkpoint).toEqual({
      schema: "chronicle_checkpoint.v0",
      checkpoint_id: "checkpoint-empty",
      collection_ref: "/collection/empty",
      entry_refs: [],
      prev_checkpoint: null,
      sequence: 0,
      checkpoint_root: checkpoint.checkpoint_root,
    })
    expect(checkpoint.checkpoint_root).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  test("single entry_ref produces a stable root", () => {
    const checkpoint = createChronicleCheckpointV0({
      checkpointId: "checkpoint-single",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-alpha"],
      prevCheckpoint: null,
      sequence: 0,
    })

    expect(checkpoint.entry_refs).toEqual(["entry-alpha"])
    expect(checkpoint.checkpoint_root).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  test("same entry_refs in different input order produce the same checkpoint_root", () => {
    const a = createChronicleCheckpointV0({
      checkpointId: "checkpoint-demo",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-gamma", "entry-alpha", "entry-beta"],
      prevCheckpoint: null,
      sequence: 0,
    })
    const b = createChronicleCheckpointV0({
      checkpointId: "checkpoint-demo",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-alpha", "entry-beta", "entry-gamma"],
      prevCheckpoint: null,
      sequence: 0,
    })

    expect(a.checkpoint_root).toBe(b.checkpoint_root)
    expect(a.entry_refs).toEqual(["entry-alpha", "entry-beta", "entry-gamma"])
    expect(b.entry_refs).toEqual(["entry-alpha", "entry-beta", "entry-gamma"])
  })

  test("omitting prev_checkpoint yields a different root than including it as null", () => {
    const withoutPrevCheckpoint = `sha256:${sha256(canonicalize({
      schema: "chronicle_checkpoint.v0",
      checkpoint_id: "checkpoint-demo",
      collection_ref: "/collection/demo",
      entry_refs: ["entry-alpha"],
      sequence: 0,
    }))}`
    const withNullPrevCheckpoint = createChronicleCheckpointV0({
      checkpointId: "checkpoint-demo",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-alpha"],
      prevCheckpoint: null,
      sequence: 0,
    }).checkpoint_root

    expect(withoutPrevCheckpoint).not.toBe(withNullPrevCheckpoint)
  })

  test("changing prev_checkpoint changes the root", () => {
    const a = createChronicleCheckpointV0({
      checkpointId: "checkpoint-demo",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-alpha"],
      prevCheckpoint: "sha256:1234",
      sequence: 1,
    })
    const b = createChronicleCheckpointV0({
      checkpointId: "checkpoint-demo",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-alpha"],
      prevCheckpoint: "sha256:5678",
      sequence: 1,
    })

    expect(a.checkpoint_root).not.toBe(b.checkpoint_root)
  })

  test("changing sequence changes the root", () => {
    const a = createChronicleCheckpointV0({
      checkpointId: "checkpoint-demo",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-alpha"],
      prevCheckpoint: "sha256:abcdef",
      sequence: 1,
    })
    const b = createChronicleCheckpointV0({
      checkpointId: "checkpoint-demo",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-alpha"],
      prevCheckpoint: "sha256:abcdef",
      sequence: 2,
    })

    expect(a.checkpoint_root).not.toBe(b.checkpoint_root)
  })

  test("createChronicleCheckpointV0 throws on non-integer sequence", () => {
    expect(() => createChronicleCheckpointV0({
      checkpointId: "checkpoint-demo",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-alpha"],
      prevCheckpoint: null,
      sequence: 1.5,
    })).toThrow("chronicle_checkpoint.v0 sequence must be an integer")
  })

  test("createChronicleCheckpointV0 throws on negative sequence", () => {
    expect(() => createChronicleCheckpointV0({
      checkpointId: "checkpoint-demo",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-alpha"],
      prevCheckpoint: null,
      sequence: -1,
    })).toThrow("chronicle_checkpoint.v0 sequence must be >= 0")
  })

  test("createChronicleCheckpointV0 throws on sequence 0 with non-null prev_checkpoint", () => {
    expect(() => createChronicleCheckpointV0({
      checkpointId: "checkpoint-demo",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-alpha"],
      prevCheckpoint: "sha256:abcdef",
      sequence: 0,
    })).toThrow("chronicle_checkpoint.v0 sequence 0 requires prev_checkpoint = null")
  })

  test("createChronicleCheckpointV0 throws on sequence > 0 with null prev_checkpoint", () => {
    expect(() => createChronicleCheckpointV0({
      checkpointId: "checkpoint-demo",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-alpha"],
      prevCheckpoint: null,
      sequence: 1,
    })).toThrow("chronicle_checkpoint.v0 sequence > 0 requires prev_checkpoint")
  })

  test("verify checkpoint ok=true on a well-formed checkpoint and ok=false when checkpoint_root is tampered", () => {
    const checkpoint = createChronicleCheckpointV0({
      checkpointId: "checkpoint-demo",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-alpha", "entry-beta"],
      prevCheckpoint: "sha256:abcdef",
      sequence: 2,
    })

    expect(verifyChronicleCheckpointV0(checkpoint)).toEqual({
      ok: true,
      checkpoint_root: checkpoint.checkpoint_root,
      recomputed_checkpoint_root: checkpoint.checkpoint_root,
    })

    const tampered = {
      ...checkpoint,
      checkpoint_root: `sha256:${"f".repeat(64)}`,
    }
    const result = verifyChronicleCheckpointV0(tampered)
    expect(result.ok).toBe(false)
    expect(result.checkpoint_root).toBe(tampered.checkpoint_root)
    expect(result.recomputed_checkpoint_root).toBe(checkpoint.checkpoint_root)
  })

  test("verify checkpoint fails when stored entry_refs are unsorted even if checkpoint_root matches sorted derivation", () => {
    const sortedCheckpoint = createChronicleCheckpointV0({
      checkpointId: "checkpoint-demo",
      collectionRef: "/collection/demo",
      entryRefs: ["entry-alpha", "entry-beta", "entry-gamma"],
      prevCheckpoint: "sha256:abcdef",
      sequence: 2,
    })
    const unsortedStored = {
      ...sortedCheckpoint,
      entry_refs: ["entry-gamma", "entry-alpha", "entry-beta"],
    }

    const result = verifyChronicleCheckpointV0(unsortedStored)
    expect(result.ok).toBe(false)
    expect(result.checkpoint_root).toBe(sortedCheckpoint.checkpoint_root)
    expect(result.recomputed_checkpoint_root).toBe(
      computeCheckpointRootWithEntryRefsExactlyAsStored({
        schema: unsortedStored.schema,
        checkpoint_id: unsortedStored.checkpoint_id,
        collection_ref: unsortedStored.collection_ref,
        entry_refs: unsortedStored.entry_refs,
        prev_checkpoint: unsortedStored.prev_checkpoint,
        sequence: unsortedStored.sequence,
      }),
    )
  })
})
