import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "bun:test"
import {
  ENCODE_JSON_UTF8_LF_V0_CONTRACT_ID,
  ENCODE_JSON_UTF8_LF_V0_SPEC_SHA256,
  ENCODE_JSON_UTF8_LF_V0_VECTORS_SHA256,
  EncodeJsonUtf8LfV0Error,
  encodeJsonUtf8LfV0,
  encodeJsonUtf8LfV0Transport,
  type EncodeJsonUtf8LfV0ErrorCategory,
  type EncodeJsonUtf8LfV0Transport,
} from "../../conformance/tsei-invariant-discrimination-v0/encode-json-utf8-lf-v0"
import { encodeJsonUtf8Lf } from "../../conformance/tsei-invariant-discrimination-v0/independent-authority"

const REPO_ROOT = resolve(import.meta.dir, "..", "..")
const CONTRACT_DIR = resolve(REPO_ROOT, "conformance", "tsei-invariant-discrimination-v0")
const SPEC_PATH = resolve(CONTRACT_DIR, "fixtures", "encode-json-utf8-lf-v0.spec.md")
const VECTORS_PATH = resolve(CONTRACT_DIR, "fixtures", "encode-json-utf8-lf-v0.vectors.json")

type Expected =
  | { status: "success"; bytes_hex: string; byte_length: number; sha256: string }
  | { status: "rejection"; error: EncodeJsonUtf8LfV0ErrorCategory }

type VectorDocument = {
  contract_id: string
  vectors: Array<{ id: string; input: EncodeJsonUtf8LfV0Transport; expect: Expected }>
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function expectCategory(run: () => unknown, category: EncodeJsonUtf8LfV0ErrorCategory): void {
  try {
    run()
    throw new Error(`expected ${category}`)
  } catch (error) {
    expect(error).toBeInstanceOf(EncodeJsonUtf8LfV0Error)
    expect((error as EncodeJsonUtf8LfV0Error).category).toBe(category)
  }
}

const HISTORICAL_CANONICAL_ARTIFACTS = [
  ["fixtures/authority-object-b-template-v1.json", 278, "c35e5d499e864ee7f2fb0c69b9103779e16d0630a33173a4010ca28d6488122d"],
  ["fixtures/authority-object-b-valid-v1.json", 228, "0ef9ee8f579b091d7287f05955661b04c386726e1b38c2009fa46005a09e0107"],
  ["fixtures/rekor-v1-dummy-gate/d0.entry.json", 5104, "69337f55509e4d5cd15fac0685e0330ddd864d1e69ea287dbc711f7d96d8d5f2"],
  ["fixtures/rekor-v1-dummy-gate/d1.entry.json", 5168, "65ed503545c1e93a96ae521be48c24dde13307cef2f2ba8a67756687fb5e2849"],
  ["fixtures/rekor-v1-dummy-gate/d2.entry.json", 5104, "5a93d4d2b7a2fc81c6025f93dc54ae7384e107b339a0835b322c2fd96c0cecd7"],
  ["fixtures/rekor-v1-real-run-public-evidence/e0-record.json", 468, "b8a41ce2a76a12aefceaab5e89127238e6a6dfcdfbb3a44b3c3572bb661cada7"],
  ["fixtures/rekor-v1-real-run-public-evidence/e0.entry.json", 5175, "425092fcea9a4f984f36808bbbb3ad8873e4d9f8636baa397d877d2d54e97441"],
  ["fixtures/rekor-v1-real-run-public-evidence/e1.entry.json", 5235, "3ae30246d1e18c45c272575cc41eafde3130e02ea3dca07d745c052209bb9cc5"],
  ["fixtures/rekor-v1-real-run-public-evidence/e2.entry.json", 5171, "8895e5187889dc5c988ca0bc74bfb9ed1f6e0c591d387f9ec7541839344aac59"],
  ["fixtures/rekor-v1-real-run-public-evidence/public-evidence.json", 4959, "da3103fcb5b3c99fa1c64ffc7eaf0539642760c7cbac9982862682729c43a2f4"],
  ["protocol-v2-ratification.1.json", 864, "2f4d456b71fdec4247118d0251b5a03feda55d55dc7a204b0fcfbcaea3a0968e"],
  ["protocol-v2-ratification.json", 864, "329db5bf7659ffc8a093812be0780eff697266a60b3dc68be9a0426a91c73320"],
  ["provider-policy.rekor-v1.json", 1884, "9efefd8e00950e21c121a88a0886b20eb6bc8b1ee04737f1d69c96e4b02ffd77"],
  ["provider-policy.rekor-v1.p0-e0-e1-e2.json", 1905, "a047d4a41515d3982f6ba00bb3304f3e40e0fc46ba10f6c61092c3219bbb4862"],
  ["provider-policy.rekor-v1.p0-e0-e1-e2.v1.json", 1905, "744d024586c983f8bb6c1dd10209aeb0354b65a5121af0ef6580ea2fd8aa8e56"],
  ["public-receipts/tsei-ia-real-v2-20260824-02.production-grounding.json", 3841, "09349e8257da2b94227f7af7f8e4dcdcca9e715dc460e1f419e53a14a22e5a07"],
] as const

describe("TSEI encode-json-utf8-lf.v0 producer adoption", () => {
  test("pins the exact owner-neutral specification and complete vector corpus", () => {
    const specBytes = readFileSync(SPEC_PATH)
    const vectorBytes = readFileSync(VECTORS_PATH)
    const document = JSON.parse(vectorBytes.toString("utf8")) as VectorDocument

    expect(sha256(specBytes)).toBe(ENCODE_JSON_UTF8_LF_V0_SPEC_SHA256)
    expect(sha256(vectorBytes)).toBe(ENCODE_JSON_UTF8_LF_V0_VECTORS_SHA256)
    expect(document.contract_id).toBe(ENCODE_JSON_UTF8_LF_V0_CONTRACT_ID)
    expect(document.vectors).toHaveLength(48)
  })

  test("reproduces all 48 normative success and rejection vectors", () => {
    const document = JSON.parse(readFileSync(VECTORS_PATH, "utf8")) as VectorDocument
    for (const vector of document.vectors) {
      if (vector.expect.status === "rejection") {
        expectCategory(() => encodeJsonUtf8LfV0Transport(vector.input), vector.expect.error)
        continue
      }
      const bytes = encodeJsonUtf8LfV0Transport(vector.input)
      expect(bytes.toString("hex"), vector.id).toBe(vector.expect.bytes_hex)
      expect(bytes.byteLength, vector.id).toBe(vector.expect.byte_length)
      expect(sha256(bytes), vector.id).toBe(vector.expect.sha256)
    }
  })

  test("makes every v0 production-domain rejection fail closed", () => {
    expectCategory(() => encodeJsonUtf8Lf(-0), "NEGATIVE_ZERO")
    expectCategory(() => encodeJsonUtf8Lf(Number.NaN), "NON_FINITE_NUMBER")
    expectCategory(() => encodeJsonUtf8Lf(Number.POSITIVE_INFINITY), "NON_FINITE_NUMBER")
    expectCategory(() => encodeJsonUtf8Lf(9007199254740992), "INTEGER_OUT_OF_RANGE")
    expectCategory(() => encodeJsonUtf8Lf("\ud800"), "NON_SCALAR_STRING")
    expectCategory(() => encodeJsonUtf8Lf({ ["\udc00"]: true }), "NON_SCALAR_KEY")
  })

  test("orders keys by UTF-16 code units and emits compact UTF-8 plus one LF", () => {
    const bytes = encodeJsonUtf8Lf({ "\uffff": 1, "😀": 2, nested: { b: 1, a: 2 } })
    expect(bytes.toString("utf8")).toBe('{"nested":{"a":2,"b":1},"😀":2,"￿":1}\n')
    expect(bytes.includes(Buffer.from("\r"))).toBe(false)
    expect(bytes.subarray(-1).equals(Buffer.from("\n"))).toBe(true)
    expect(bytes.subarray(-2).equals(Buffer.from("\n\n"))).toBe(false)
  })

  test("rejects host-language shapes that cannot silently enter the JSON domain", () => {
    expectCategory(() => encodeJsonUtf8Lf({ value: undefined }), "UNSUPPORTED_HOST_VALUE")
    expectCategory(() => encodeJsonUtf8Lf([, 1]), "UNSUPPORTED_HOST_VALUE")
    expectCategory(() => encodeJsonUtf8Lf(new Date(0)), "UNSUPPORTED_HOST_VALUE")
    expectCategory(() => encodeJsonUtf8Lf(new Proxy({ value: 1 }, {})), "UNSUPPORTED_HOST_VALUE")
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expectCategory(() => encodeJsonUtf8Lf(cyclic), "CYCLIC_HOST_VALUE")
  })

  test("preserves every explicitly inventoried historical canonical artifact byte-for-byte", () => {
    for (const [relativePath, expectedLength, expectedSha256] of HISTORICAL_CANONICAL_ARTIFACTS) {
      const historicalBytes = readFileSync(resolve(CONTRACT_DIR, relativePath))
      expect(historicalBytes.byteLength, relativePath).toBe(expectedLength)
      expect(sha256(historicalBytes), relativePath).toBe(expectedSha256)
      const reproduced = encodeJsonUtf8LfV0(JSON.parse(historicalBytes.toString("utf8")))
      expect(reproduced.equals(historicalBytes), relativePath).toBe(true)
    }
  })
})
