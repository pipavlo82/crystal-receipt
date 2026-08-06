import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/recursive-singleton-fold-v0/audit_expected"
import { readGitIndexBytes } from "./helpers/git-index-bytes"

const root = resolve(import.meta.dir, "../..")
const packageRoot = "tests/fixtures/recursive-singleton-fold-v0"

describe("RSF positions 18-28 normative closure", () => {
  test("independent audit verifies the exact 34-case worktree package", () => {
    expect(auditPackage()).toMatchObject({vector_count:34, commitment_checks:8, classification_checks:34, production_imports:0})
  })

  test("the four schemas are closed normative artifacts", () => {
    const names = ["recursive-singleton-fold-stage-input-v0", "recursive-singleton-fold-evaluation-v0",
      "recursive-singleton-fold-finding-v0", "recursive-singleton-aggregate-v0"]
    for (const name of names) {
      const schema = JSON.parse(readFileSync(resolve(root, `src/receiptos/schemas/${name}.schema.json`), "utf8"))
      expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema")
      expect(schema.additionalProperties).toBe(false)
    }
  })

  test("Git-index bytes, not checkout materialization, satisfy the manifest", () => {
    const manifest = JSON.parse(readGitIndexBytes(root, `${packageRoot}/manifest.json`).toString("utf8"))
    const result = auditPackage(path => readGitIndexBytes(root, `${packageRoot}/${path}`))
    expect(result.fixture_set_sha256).toBe(manifest.fixture_set_sha256)
  }, 20_000)

  test("no evaluator implementation is hidden in the conformance test", () => {
    const source = readFileSync(import.meta.path, "utf8")
    expect(source).not.toContain("evaluatePositions" + "18")
    expect(source).not.toContain("src/receiptos/" + "rsf/")
  })
})
