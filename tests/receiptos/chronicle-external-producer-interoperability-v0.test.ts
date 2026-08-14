import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  deriveCollectionRefFromChronicleCollection,
  sortArtifactRefs,
  sortCollectionRefs,
  sortEntryRefs,
  verifyChronicleCheckpointV0,
  verifyChronicleCollectionV0,
  verifyChroniclePortfolioV0,
  type ChronicleCheckpointV0,
  type ChronicleCollectionV0,
  type ChroniclePortfolioV0,
} from "../../src/receiptos/capsule/chronicle-portfolio-v0"

const root = resolve(import.meta.dir, "../..")
const PACKAGE = "interoperability/chronicle-external-producer-v0"
const PACKAGE_ABS = resolve(root, PACKAGE)

const readJson = (relativePath: string) => JSON.parse(readFileSync(resolve(root, relativePath), "utf8"))

// ---------------------------------------------------------------------------
// Strict, duplicate-key-detecting, integer-only JSON reader. Independently
// hand-rolled here (not reused from producer_reference.py / verify_output.py)
// so the ReceiptOS-side acceptance path enforces the exact same portable
// parsing boundary the two Python implementations enforce -- otherwise a
// duplicate-key or float-typed-integer mutant could pass through the TS
// side silently while both Python implementations correctly reject it.
// ---------------------------------------------------------------------------

class StrictJsonError extends Error {}

function strictJsonParse(text: string): unknown {
  let i = 0
  const n = text.length

  function skipWs() {
    while (i < n && (text[i] === " " || text[i] === "\t" || text[i] === "\n" || text[i] === "\r")) i += 1
  }

  function parseValue(depth: number): unknown {
    if (depth > 8) throw new StrictJsonError("json_nesting_depth_exceeded")
    skipWs()
    const c = text[i]
    if (c === "{") return parseObject(depth)
    if (c === "[") return parseArray(depth)
    if (c === '"') return parseString()
    if (c === "t") {
      expectLiteral("true")
      return true
    }
    if (c === "f") {
      expectLiteral("false")
      return false
    }
    if (c === "n") {
      expectLiteral("null")
      return null
    }
    if (c === "-" || (c !== undefined && c >= "0" && c <= "9")) return parseNumber()
    throw new StrictJsonError(`unexpected_token_at_${i}`)
  }

  function expectLiteral(literal: string) {
    if (text.slice(i, i + literal.length) !== literal) throw new StrictJsonError(`invalid_json_constant_at_${i}`)
    i += literal.length
  }

  function parseNumber(): number {
    const start = i
    if (text[i] === "-") i += 1
    while (i < n && text[i] >= "0" && text[i] <= "9") i += 1
    if (text[i] === "." || text[i] === "e" || text[i] === "E") {
      throw new StrictJsonError("non_integer_json_number")
    }
    const raw = text.slice(start, i)
    if (raw === "" || raw === "-") throw new StrictJsonError(`invalid_number_at_${start}`)
    return Number(raw)
  }

  function parseString(): string {
    i += 1 // opening quote
    let out = ""
    while (true) {
      if (i >= n) throw new StrictJsonError("unterminated_string")
      const c = text[i]
      if (c === '"') {
        i += 1
        return out
      }
      if (c === "\\") {
        const esc = text[i + 1]
        const map: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" }
        if (esc !== undefined && esc in map) {
          out += map[esc]
          i += 2
        } else if (esc === "u") {
          const hex = text.slice(i + 2, i + 6)
          out += String.fromCharCode(Number.parseInt(hex, 16))
          i += 6
        } else {
          throw new StrictJsonError(`invalid_escape_at_${i}`)
        }
      } else {
        out += c
        i += 1
      }
    }
  }

  function parseArray(depth: number): unknown[] {
    i += 1
    const out: unknown[] = []
    skipWs()
    if (text[i] === "]") {
      i += 1
      return out
    }
    while (true) {
      out.push(parseValue(depth + 1))
      skipWs()
      if (text[i] === ",") {
        i += 1
        continue
      }
      if (text[i] === "]") {
        i += 1
        return out
      }
      throw new StrictJsonError(`expected_comma_or_bracket_at_${i}`)
    }
  }

  function parseObject(depth: number): Record<string, unknown> {
    i += 1
    const out: Record<string, unknown> = {}
    skipWs()
    if (text[i] === "}") {
      i += 1
      return out
    }
    while (true) {
      skipWs()
      if (text[i] !== '"') throw new StrictJsonError(`expected_key_at_${i}`)
      const key = parseString()
      if (Object.prototype.hasOwnProperty.call(out, key)) throw new StrictJsonError(`duplicate_object_key:${key}`)
      skipWs()
      if (text[i] !== ":") throw new StrictJsonError(`expected_colon_at_${i}`)
      i += 1
      out[key] = parseValue(depth + 1)
      skipWs()
      if (text[i] === ",") {
        i += 1
        continue
      }
      if (text[i] === "}") {
        i += 1
        return out
      }
      throw new StrictJsonError(`expected_comma_or_brace_at_${i}`)
    }
  }

  const value = parseValue(0)
  skipWs()
  if (i !== n) throw new StrictJsonError("trailing_content")
  return value
}

// ---------------------------------------------------------------------------
// Producer / independent-verifier process helpers.
// ---------------------------------------------------------------------------

function runProducer(scenario: string, outDir: string) {
  const result = spawnSync(
    "python",
    [`${PACKAGE}/producer_reference.py`, "--seed", `${PACKAGE}/fixtures/input-seed.json`, "--scenario", scenario, "--out", outDir],
    { cwd: root, encoding: "utf8" },
  )
  if (result.status !== 0) throw new Error(`producer failed for ${scenario}: ${result.stdout}${result.stderr}`)
  return JSON.parse(result.stdout)
}

function runIndependentVerifier(packageDir: string) {
  const result = spawnSync("python", [`${PACKAGE}/verify_output.py`, "--package", packageDir], { cwd: root, encoding: "utf8" })
  return { status: result.status, parsed: JSON.parse(result.stdout) }
}

const REQUIRED_FILES = ["producer-manifest.json", "collections.json", "portfolio.json", "checkpoint.json"]

type AcceptanceResult = {
  classification: "stable" | "violation" | "out_of_domain" | "unresolved"
  reason: string | null
  collections?: Array<{ collection_id: string; claimed_root: string; recomputed_root: string; ok: boolean }>
  portfolio?: { claimed_root: string; recomputed_root: string; ok: boolean }
  checkpoint?: { claimed_root: string; recomputed_root: string; ok: boolean }
  derived_collection_refs?: string[]
  stored_collection_refs?: string[]
  portfolio_link_valid?: boolean
  checkpoint_membership_valid?: boolean
}

// The direct ReceiptOS acceptance predicate. This is the PRIMARY gate.
// It never routes through the transformation-stability flat evaluator's
// identity-roundtrip classification -- that evaluator only compares
// source vs. target, and an identity transform makes source === target by
// construction, so every internal validity boolean trivially "matches"
// itself regardless of whether it is true or false. An identity-transform
// "stable" result therefore proves nothing about standalone artifact
// validity; using it as the acceptance predicate would silently accept
// every negative case in this matrix. See the "supplementary evidence"
// test below for a concrete demonstration of exactly this.
function acceptChronicleExternalProducerBundle(dir: string): AcceptanceResult {
  const onDisk = readdirSync(dir).sort()
  const missing = REQUIRED_FILES.filter((f) => !onDisk.includes(f))
  const extra = onDisk.filter((f) => !REQUIRED_FILES.includes(f))
  if (missing.length > 0) throw new Error(`missing_files:${missing.join(",")}`)
  if (extra.length > 0) throw new Error(`extra_files:${extra.join(",")}`)

  const raw: Record<string, Buffer> = {}
  for (const name of REQUIRED_FILES) {
    const bytes = readFileSync(join(dir, name))
    if (bytes.includes(0x0d)) throw new Error(`crlf_or_cr_byte_drift:${name}`)
    raw[name] = bytes
  }

  const manifest = strictJsonParse(raw["producer-manifest.json"]!.toString("utf8")) as {
    files: Array<{ path: string; sha256: string }>
    claims?: Record<string, unknown>
  }
  for (const entry of manifest.files) {
    if (!REQUIRED_FILES.includes(entry.path) || entry.path === "producer-manifest.json") {
      throw new Error(`manifest_path_not_allowed:${entry.path}`)
    }
    const actual = createHash("sha256").update(raw[entry.path]!).digest("hex")
    if (actual !== entry.sha256) throw new Error(`manifest_digest_mismatch:${entry.path}`)
  }

  const collections = strictJsonParse(raw["collections.json"]!.toString("utf8")) as ChronicleCollectionV0[]
  const portfolio = strictJsonParse(raw["portfolio.json"]!.toString("utf8")) as ChroniclePortfolioV0
  const checkpoint = strictJsonParse(raw["checkpoint.json"]!.toString("utf8")) as ChronicleCheckpointV0

  // NOTE: manifest.claims is read here only to prove it is never used below
  // -- it is intentionally never inspected in the acceptance logic that
  // follows.
  void manifest.claims

  if (!Array.isArray(collections) || collections.length === 0) {
    return { classification: "out_of_domain", reason: "chronicle_collections_portfolio_empty" }
  }

  const sequence = (checkpoint as unknown as { sequence: unknown }).sequence
  const prevCheckpoint = (checkpoint as unknown as { prev_checkpoint: unknown }).prev_checkpoint
  const shapeInvalid =
    typeof sequence !== "number" ||
    !Number.isInteger(sequence) ||
    sequence < 0 ||
    (sequence === 0 && prevCheckpoint !== null) ||
    (sequence > 0 && prevCheckpoint === null)
  if (shapeInvalid) {
    return { classification: "out_of_domain", reason: "chronicle_checkpoint_shape_invalid" }
  }

  try {
    const collectionResults = collections.map((collection) => {
      const verification = verifyChronicleCollectionV0(collection)
      return {
        collection_id: collection.collection_id,
        claimed_root: verification.collection_root,
        recomputed_root: verification.recomputed_collection_root,
        ok: verification.ok,
      }
    })
    const portfolioVerification = verifyChroniclePortfolioV0(portfolio)
    const checkpointVerification = verifyChronicleCheckpointV0(checkpoint)

    const derivedRefs = sortCollectionRefs(collections.map(deriveCollectionRefFromChronicleCollection))
    const storedRefs = sortCollectionRefs(portfolio.collection_refs)
    const portfolioLinkValid =
      derivedRefs.length === storedRefs.length && derivedRefs.every((ref, index) => ref === storedRefs[index])
    const checkpointMembershipValid = derivedRefs.includes(checkpoint.collection_ref)

    const allLocalValid =
      collectionResults.every((r) => r.ok) && portfolioVerification.ok && checkpointVerification.ok
    const accepted = allLocalValid && portfolioLinkValid && checkpointMembershipValid

    return {
      classification: accepted ? "stable" : "violation",
      reason: accepted ? null : "normative_projection_mismatch",
      collections: collectionResults,
      portfolio: {
        claimed_root: portfolioVerification.portfolio_root,
        recomputed_root: portfolioVerification.recomputed_portfolio_root,
        ok: portfolioVerification.ok,
      },
      checkpoint: {
        claimed_root: checkpointVerification.checkpoint_root,
        recomputed_root: checkpointVerification.recomputed_checkpoint_root,
        ok: checkpointVerification.ok,
      },
      derived_collection_refs: derivedRefs,
      stored_collection_refs: storedRefs,
      portfolio_link_valid: portfolioLinkValid,
      checkpoint_membership_valid: checkpointMembershipValid,
    }
  } catch {
    return { classification: "unresolved", reason: "chronicle_external_producer_recompute_failed" }
  }
}

function isThenable(value: unknown): value is Promise<unknown> {
  return typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function"
}

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "chronicle-ext-producer-"))
  const cleanup = () => rmSync(dir, { recursive: true, force: true })
  let result: T
  try {
    result = fn(dir)
  } catch (error) {
    cleanup()
    throw error
  }
  if (isThenable(result)) {
    return (result as Promise<unknown>).then(
      (value) => {
        cleanup()
        return value
      },
      (error) => {
        cleanup()
        throw error
      },
    ) as T
  }
  cleanup()
  return result
}

const contract = readJson(`${PACKAGE}/contract.json`)
const POSITIVE_CASES: string[] = contract.positive_matrix.cases
const NEGATIVE_CASES: string[] = contract.negative_matrix.cases
const SCENARIO_MAP: Record<string, string> = contract.positive_matrix.scenario_map

describe("chronicle external producer interoperability v0", () => {
  test("portable package member files exist and are LF-only", () => {
    const manifest = readJson(`${PACKAGE}/manifest.json`)
    for (const file of manifest.files as Array<{ path: string }>) {
      const bytes = readFileSync(resolve(root, file.path))
      expect(bytes.includes(0x0d)).toBe(false)
    }
  })

  test("positive matrix: every case is accepted by the real ReceiptOS primitives", () => {
    for (const caseId of POSITIVE_CASES) {
      const scenario = SCENARIO_MAP[caseId]!
      withTempDir((dir) => {
        runProducer(scenario, dir)
        const result = acceptChronicleExternalProducerBundle(dir)
        expect(result.classification).toBe("stable")
        expect(result.reason).toBeNull()
      })
    }
  }, 15000)

  test("negative matrix: every case is rejected with the exact pinned classification and reason", () => {
    for (const caseId of NEGATIVE_CASES) {
      const expected = contract.negative_matrix.expected[caseId]
      withTempDir((dir) => {
        runProducer(caseId, dir)
        const result = acceptChronicleExternalProducerBundle(dir)
        expect(result.classification).toBe(expected.classification)
        expect(result.reason).toBe(expected.reason)
      })
    }
  }, 15000)

  test("a false producer valid claim changes nothing: identical outcome to the underlying wrong_collection_root case", () => {
    withTempDir((falseClaimDir) => {
      withTempDir((baseDir) => {
        runProducer("producer_false_valid_claim", falseClaimDir)
        runProducer("wrong_collection_root", baseDir)

        const manifest = strictJsonParse(readFileSync(join(falseClaimDir, "producer-manifest.json"), "utf8")) as {
          claims: Record<string, unknown>
        }
        expect(manifest.claims.producer_believes_locally_valid).toBe(true)
        expect(manifest.claims.producer_believes_cross_link_valid).toBe(true)

        const falseClaimResult = acceptChronicleExternalProducerBundle(falseClaimDir)
        const baseResult = acceptChronicleExternalProducerBundle(baseDir)
        expect(falseClaimResult.classification).toBe("violation")
        expect(falseClaimResult.classification).toBe(baseResult.classification)
        expect(falseClaimResult.reason).toBe(baseResult.reason)
      })
    })
  })

  test("duplicate_multiplicity_mismatch: same two Collections, Portfolio stores the ref once, rejected", () => {
    withTempDir((duplicateDir) => {
      withTempDir((mismatchDir) => {
        runProducer("duplicate", duplicateDir)
        runProducer("duplicate_multiplicity_mismatch", mismatchDir)

        const duplicateCollections = JSON.parse(readFileSync(join(duplicateDir, "collections.json"), "utf8")) as ChronicleCollectionV0[]
        const mismatchCollections = JSON.parse(readFileSync(join(mismatchDir, "collections.json"), "utf8")) as ChronicleCollectionV0[]
        expect(duplicateCollections.length).toBe(2)
        expect(duplicateCollections[0]!.collection_id).toBe(duplicateCollections[1]!.collection_id)
        expect(mismatchCollections.length).toBe(2)

        const duplicatePortfolio = JSON.parse(readFileSync(join(duplicateDir, "portfolio.json"), "utf8")) as ChroniclePortfolioV0
        const mismatchPortfolio = JSON.parse(readFileSync(join(mismatchDir, "portfolio.json"), "utf8")) as ChroniclePortfolioV0
        expect(duplicatePortfolio.collection_refs.length).toBe(2)
        expect(mismatchPortfolio.collection_refs.length).toBe(1)
        expect(duplicatePortfolio.collection_refs[0]).toBe(mismatchPortfolio.collection_refs[0])

        const duplicateResult = acceptChronicleExternalProducerBundle(duplicateDir)
        const mismatchResult = acceptChronicleExternalProducerBundle(mismatchDir)
        expect(duplicateResult.classification).toBe("stable")
        expect(mismatchResult.classification).toBe("violation")
        expect(mismatchResult.reason).toBe("normative_projection_mismatch")
      })
    })
  })

  test("stale_checkpoint_ref: the headline locally-valid/globally-invalid case -- every local verifier ok, only the link fails", () => {
    withTempDir((dir) => {
      runProducer("stale_checkpoint_ref", dir)
      const result = acceptChronicleExternalProducerBundle(dir)
      expect(result.classification).toBe("violation")
      expect(result.collections!.every((c) => c.ok)).toBe(true)
      expect(result.portfolio!.ok).toBe(true)
      expect(result.checkpoint!.ok).toBe(true)
      expect(result.checkpoint_membership_valid).toBe(false)
    })
  })

  test("agreement with the independent Python verifier: full agreement tuple matches exactly, for every case", () => {
    // 16 cases, two subprocess spawns each -- generously timed.
    for (const caseId of [...POSITIVE_CASES.map((c) => SCENARIO_MAP[c]!), ...NEGATIVE_CASES]) {
      withTempDir((dir) => {
        runProducer(caseId, dir)
        const receiptos = acceptChronicleExternalProducerBundle(dir)
        const { parsed: independent } = runIndependentVerifier(dir)

        expect(independent.classification).toBe(receiptos.classification)
        expect(independent.reason ?? null).toBe(receiptos.reason)
        if (receiptos.classification === "stable" || receiptos.classification === "violation") {
          expect(independent.derived_collection_refs).toEqual(receiptos.derived_collection_refs)
          expect(independent.stored_collection_refs).toEqual(receiptos.stored_collection_refs)
          expect(independent.portfolio_link_valid).toBe(receiptos.portfolio_link_valid)
          expect(independent.checkpoint_membership_valid).toBe(receiptos.checkpoint_membership_valid)
          for (let i = 0; i < receiptos.collections!.length; i += 1) {
            expect(independent.collections[i].claimed_root).toBe(receiptos.collections![i]!.claimed_root)
            expect(independent.collections[i].recomputed_root).toBe(receiptos.collections![i]!.recomputed_root)
            expect(independent.collections[i].ok).toBe(receiptos.collections![i]!.ok)
          }
          expect(independent.portfolio.claimed_root).toBe(receiptos.portfolio!.claimed_root)
          expect(independent.portfolio.recomputed_root).toBe(receiptos.portfolio!.recomputed_root)
          expect(independent.checkpoint.claimed_root).toBe(receiptos.checkpoint!.claimed_root)
          expect(independent.checkpoint.recomputed_root).toBe(receiptos.checkpoint!.recomputed_root)
        }
      })
    }
  }, 30000)

  test("supplementary evidence only: identity-transform 'stable' classification does not, by itself, reject any negative case", async () => {
    // This is a deliberate, documented demonstration of why the identity
    // transform is not used as the acceptance predicate: source === target
    // by construction for an identity transform, so every internal
    // validity boolean trivially matches ITSELF between source and target,
    // regardless of whether that boolean is true or false. A wrong-root
    // bundle therefore also reports normative_match: true here.
    const { evaluateChronicleCollectionsPortfolioTransformationVectorV0 } = await import(
      "../../src/receiptos/challenge/transformation-stability-chronicle-collection-portfolio"
    )
    withTempDir((dir) => {
      runProducer("wrong_portfolio_root", dir)
      const collections = JSON.parse(readFileSync(join(dir, "collections.json"), "utf8")) as ChronicleCollectionV0[]
      const portfolio = JSON.parse(readFileSync(join(dir, "portfolio.json"), "utf8")) as ChroniclePortfolioV0
      return evaluateChronicleCollectionsPortfolioTransformationVectorV0("stable_canonical_roundtrip", {
        collections,
        portfolio,
      }).then((identityResult) => {
        // The real acceptance predicate correctly rejects this bundle...
        const accepted = acceptChronicleExternalProducerBundle(dir)
        expect(accepted.classification).toBe("violation")
        // ...but the identity-transform evaluator, used alone, would not.
        expect(identityResult.classification).toBe("stable")
      })
    })
  })

  test("comparator agreement: every normative string sorts identically under a plain codepoint order and the real sortArtifactRefs/sortCollectionRefs/sortEntryRefs", () => {
    const strings: string[] = contract.comparators.normative_strings
    const plainOrder = [...strings].sort()
    expect(sortArtifactRefs(strings)).toEqual(plainOrder)
    expect(sortCollectionRefs(strings)).toEqual(plainOrder)
    expect(sortEntryRefs(strings)).toEqual(plainOrder)
  })

  test("escaping self-test: Collection-ref derivation matches the real deriveCollectionRefFromChronicleCollection for the design-gap string", () => {
    const selfTest = contract.collection_ref_derivation.self_test
    const derived = deriveCollectionRefFromChronicleCollection({
      schema: "chronicle.collection.v0",
      collection_version: "chronicle.collection.v0",
      collection_id: selfTest.input,
      artifact_refs: [],
      collection_root: "",
    } as unknown as ChronicleCollectionV0)
    expect(derived).toBe(`/collection/${selfTest.expected_output}`)

    // Cross-check the Python encode_uri_component independently, run as a
    // one-line subprocess against producer_reference.py's own function.
    const result = spawnSync(
      "python",
      [
        "-c",
        `import sys; sys.path.insert(0, "${PACKAGE}"); from producer_reference import encode_uri_component; print(encode_uri_component(${JSON.stringify(selfTest.input)}))`,
      ],
      { cwd: root, encoding: "utf8" },
    )
    expect(result.stdout.trim()).toBe(selfTest.expected_output)
  })

  test("expected/positive/ matches a fresh --scenario main run byte-for-byte (fixed point)", () => {
    withTempDir((dir) => {
      runProducer("main", dir)
      for (const name of REQUIRED_FILES) {
        const fresh = readFileSync(join(dir, name))
        const frozen = readFileSync(resolve(PACKAGE_ABS, "expected/positive", name))
        expect(fresh.equals(frozen)).toBe(true)
      }
    })
  })

  test("repeated production is byte-identical", () => {
    withTempDir((dirA) => {
      withTempDir((dirB) => {
        runProducer("main", dirA)
        runProducer("main", dirB)
        for (const name of REQUIRED_FILES) {
          expect(readFileSync(join(dirA, name)).equals(readFileSync(join(dirB, name)))).toBe(true)
        }
      })
    })
  })

  test("independent verifier rejects a corrupted manifest digest (transport-integrity check)", () => {
    withTempDir((dir) => {
      runProducer("main", dir)
      const manifestPath = join(dir, "producer-manifest.json")
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
      manifest.files[0].sha256 = "0".repeat(64)
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      const { status, parsed } = runIndependentVerifier(dir)
      expect(status).not.toBe(0)
      expect(parsed.ok).toBe(false)
      expect(parsed.reason).toContain("manifest_digest_mismatch")
    })
  })

  test("independent verifier rejects an extra file in the package", () => {
    withTempDir((dir) => {
      runProducer("main", dir)
      writeFileSync(join(dir, "extra-file.json"), "{}\n")
      const { status, parsed } = runIndependentVerifier(dir)
      expect(status).not.toBe(0)
      expect(parsed.reason).toContain("extra_files")
    })
  })

  test("independent verifier rejects a missing required file", () => {
    withTempDir((dir) => {
      runProducer("main", dir)
      rmSync(join(dir, "checkpoint.json"))
      const { status, parsed } = runIndependentVerifier(dir)
      expect(status).not.toBe(0)
      expect(parsed.reason).toContain("missing_files")
    })
  })

  test("independent verifier rejects CRLF/package-byte drift, even digest-consistent", () => {
    withTempDir((dir) => {
      runProducer("main", dir)
      const path = join(dir, "checkpoint.json")
      const original = readFileSync(path, "utf8")
      const crlf = original.replace(/\n/g, "\r\n")
      writeFileSync(path, crlf)
      const newDigest = createHash("sha256").update(crlf, "utf8").digest("hex")
      const manifestPath = join(dir, "producer-manifest.json")
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
      manifest.files.find((f: { path: string }) => f.path === "checkpoint.json").sha256 = newDigest
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

      const { status, parsed } = runIndependentVerifier(dir)
      expect(status).not.toBe(0)
      expect(parsed.reason).toContain("crlf_or_cr_byte_drift")

      expect(() => acceptChronicleExternalProducerBundle(dir)).toThrow(/crlf_or_cr_byte_drift/)
    })
  })

  test("independent verifier rejects duplicate JSON object keys (digest re-signed, so detection is genuinely structural, not a checksum side-effect)", () => {
    withTempDir((dir) => {
      runProducer("main", dir)
      const path = join(dir, "collections.json")
      const original = readFileSync(path, "utf8")
      const corrupted = original.replace(
        '"collection_id": "collection-ext-alpha"',
        '"collection_id": "collection-ext-alpha", "collection_id": "collection-ext-alpha-2"',
      )
      writeFileSync(path, corrupted)
      const manifestPath = join(dir, "producer-manifest.json")
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
      const newDigest = createHash("sha256").update(corrupted, "utf8").digest("hex")
      manifest.files.find((f: { path: string }) => f.path === "collections.json").sha256 = newDigest
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

      const { status, parsed } = runIndependentVerifier(dir)
      expect(status).not.toBe(0)
      expect(parsed.reason).toContain("duplicate_object_key")
    })
  })

  test("ReceiptOS-side strict parser also rejects duplicate JSON object keys (parity with the independent verifier)", () => {
    expect(() => strictJsonParse('{"a": 1, "a": 2}')).toThrow(/duplicate_object_key/)
  })

  test("ReceiptOS-side strict parser rejects non-integer JSON numbers", () => {
    expect(() => strictJsonParse('{"sequence": 1.0}')).toThrow(/non_integer_json_number/)
  })

  test("metadata absence vs explicit null are distinct at the parsing boundary", () => {
    const withNull = strictJsonParse('{"metadata": null}') as Record<string, unknown>
    const withoutKey = strictJsonParse("{}") as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(withNull, "metadata")).toBe(true)
    expect(withNull.metadata).toBeNull()
    expect(Object.prototype.hasOwnProperty.call(withoutKey, "metadata")).toBe(false)
  })

  test("producer and verifier are genuinely independent: zero ReceiptOS imports, no cross-import between them", () => {
    const producerSource = readFileSync(resolve(PACKAGE_ABS, "producer_reference.py"), "utf8")
    const verifierSource = readFileSync(resolve(PACKAGE_ABS, "verify_output.py"), "utf8")
    // Comments/docstrings may name ReceiptOS in prose (they do, explaining
    // independence); what must never appear is an actual import reaching
    // into the repository's production source.
    const importsProduction = (source: string) => /^\s*(import|from)\s+.*(src\.receiptos|receiptos\.)/m.test(source)
    expect(importsProduction(producerSource)).toBe(false)
    expect(importsProduction(verifierSource)).toBe(false)
    const importsModule = (source: string, moduleName: string) =>
      new RegExp(`^\\s*(import\\s+${moduleName}\\b|from\\s+${moduleName}\\s+import)`, "m").test(source)
    expect(importsModule(verifierSource, "producer_reference")).toBe(false)
    expect(importsModule(producerSource, "verify_output")).toBe(false)
  })
})
