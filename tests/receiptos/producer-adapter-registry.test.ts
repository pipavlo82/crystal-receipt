import { describe, expect, test } from "bun:test"
import { resolveProducerAdapter } from "../../src/receiptos/adapters/registry"

describe("producer adapter registry", () => {
  test("resolves known producer adapters by id", () => {
    expect(resolveProducerAdapter("generic").id).toBe("generic")
    expect(resolveProducerAdapter("external-coding-run").id).toBe("external-coding-run")
    expect(resolveProducerAdapter("github-actions").id).toBe("github-actions")
    expect(resolveProducerAdapter("cursor-session").id).toBe("cursor-session")
  })

  test("throws a clear error for unknown producers", () => {
    expect(() => resolveProducerAdapter("unknown-producer")).toThrow("Unknown producer adapter: unknown-producer")
  })
})
