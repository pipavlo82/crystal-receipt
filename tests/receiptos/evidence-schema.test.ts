import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { HandoffEvidenceSchema } from "../../src/receiptos/schema/evidence"

describe("receiptos evidence schema", () => {
  test("sample fixture validates", () => {
    const sample = JSON.parse(
      readFileSync(resolve(import.meta.dir, "../../src/receiptos/fixtures/session-evidence.sample.json"), "utf8"),
    )

    const result = HandoffEvidenceSchema.validate(sample)
    expect(result.success).toBe(true)
  })

  test("missing required fields fail", () => {
    const sample = JSON.parse(
      readFileSync(resolve(import.meta.dir, "../../src/receiptos/fixtures/session-evidence.sample.json"), "utf8"),
    )
    delete sample.session_id

    const result = HandoffEvidenceSchema.validate(sample)
    expect(result.success).toBe(false)
  })

  test("schema string is exactly stealth.session.evidence.v1", () => {
    expect(HandoffEvidenceSchema.schema).toBe("stealth.session.evidence.v1")
  })
})
