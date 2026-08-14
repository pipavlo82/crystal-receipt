#!/usr/bin/env bun
/**
 * Second independent external Chronicle producer, v0 -- JavaScript/Bun.
 *
 * Derived only from this package's frozen documents: SPEC.md, contract.json,
 * fixtures/input-seed.json, and the committed expected/positive/*.json
 * baseline. producer_reference.py is treated strictly as an existing
 * black-box implementation -- this file does not read, import, invoke, or
 * structurally reuse it in any way; every algorithm below is derived from
 * the frozen prose/data contract and written fresh in idiomatic JS.
 *
 * Zero ReceiptOS imports. No Git, network, subprocess, or npm dependency --
 * standalone JavaScript plus Bun/Node built-in modules only. Dual-purpose:
 * runnable as a CLI (bun producer_reference_js.mjs --seed ... --scenario
 * main --out <dir>) and importable as a plain ES module for direct
 * unit-level verification of its exported primitives.
 *
 * Usage:
 *   bun producer_reference_js.mjs --seed fixtures/input-seed.json --scenario main --out <dir>
 */
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

// ---------------------------------------------------------------------------
// Portable v0 bounds (contract.json -> portable_bounds). Package-local only.
// ---------------------------------------------------------------------------

export const MAX_FILE_BYTES = 65536
export const MAX_COLLECTIONS_COUNT = 16
export const MAX_ARRAY_LENGTH = 64
export const MAX_STRING_LENGTH = 256
export const MAX_JSON_DEPTH = 8
export const MAX_SAFE_INT = Number.MAX_SAFE_INTEGER // 9007199254740991

export const IDENTIFIER_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/

const CHRONICLE_COLLECTION_VERSION_V0 = "chronicle.collection.v0"
const CHRONICLE_PORTFOLIO_VERSION_V0 = "chronicle_portfolio.v0"
const CHRONICLE_CHECKPOINT_VERSION_V0 = "chronicle_checkpoint.v0"

export class PortableInputError extends Error {}

// ---------------------------------------------------------------------------
// Strict JSON reader.
//
// A hand-rolled recursive-descent parser -- native JSON.parse is not used
// for untrusted input, for two reasons contract.json requires and that
// Python's own type system did not need to surface as separately as JS
// does:
//
//  1. Duplicate object keys: JSON.parse silently keeps the last value.
//  2. Unsafe IEEE-754 integers -- the JS-specific hazard: Python's `json`
//     module parses a JSON integer token into an arbitrary-precision
//     native `int`, so a 20-digit integer round-trips exactly and only
//     needed a fractional/exponent-form check. JavaScript has no such
//     type -- every JSON number, once handed to the native parser,
//     collapses into the same IEEE-754 double, and an integer literal
//     above Number.MAX_SAFE_INTEGER (2^53 - 1) SILENTLY loses precision
//     (e.g. the literal 9007199254740993 parses to the double value
//     9007199254740992 -- a different integer, with no parse error at
//     all). Catching this requires inspecting the RAW number token text,
//     not the parsed value, which is what this reader does below.
// ---------------------------------------------------------------------------

export function strictJsonParse(text) {
  let i = 0
  const n = text.length

  const skipWs = () => {
    while (i < n && (text[i] === " " || text[i] === "\t" || text[i] === "\n" || text[i] === "\r")) i += 1
  }

  const expectLiteral = (literal) => {
    if (text.slice(i, i + literal.length) !== literal) throw new PortableInputError(`invalid_json_constant_at_${i}`)
    i += literal.length
  }

  const parseNumber = () => {
    const start = i
    if (text[i] === "-") i += 1
    while (i < n && text[i] >= "0" && text[i] <= "9") i += 1
    if (text[i] === "." || text[i] === "e" || text[i] === "E") {
      throw new PortableInputError("non_integer_json_number")
    }
    const raw = text.slice(start, i)
    if (raw === "" || raw === "-") throw new PortableInputError(`invalid_number_at_${start}`)
    const value = Number(raw)
    // Unsafe-integer guard: the parsed double must round-trip back to the
    // exact same digit string the source declared. This is the check
    // Python's arbitrary-precision int type made unnecessary.
    if (!Number.isSafeInteger(value) || String(value) !== raw) {
      throw new PortableInputError(`unsafe_ieee754_integer:${raw}`)
    }
    return value
  }

  const parseString = () => {
    i += 1
    let out = ""
    while (true) {
      if (i >= n) throw new PortableInputError("unterminated_string")
      const c = text[i]
      if (c === '"') {
        i += 1
        return out
      }
      if (c === "\\") {
        const esc = text[i + 1]
        const map = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" }
        if (esc !== undefined && esc in map) {
          out += map[esc]
          i += 2
        } else if (esc === "u") {
          const hex = text.slice(i + 2, i + 6)
          out += String.fromCharCode(Number.parseInt(hex, 16))
          i += 6
        } else {
          throw new PortableInputError(`invalid_escape_at_${i}`)
        }
      } else {
        out += c
        i += 1
      }
    }
  }

  const parseArray = (depth) => {
    i += 1
    const out = []
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
      throw new PortableInputError(`expected_comma_or_bracket_at_${i}`)
    }
  }

  const parseObject = (depth) => {
    i += 1
    const out = {}
    skipWs()
    if (text[i] === "}") {
      i += 1
      return out
    }
    while (true) {
      skipWs()
      if (text[i] !== '"') throw new PortableInputError(`expected_key_at_${i}`)
      const key = parseString()
      if (Object.prototype.hasOwnProperty.call(out, key)) throw new PortableInputError(`duplicate_object_key:${key}`)
      skipWs()
      if (text[i] !== ":") throw new PortableInputError(`expected_colon_at_${i}`)
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
      throw new PortableInputError(`expected_comma_or_brace_at_${i}`)
    }
  }

  function parseValue(depth) {
    if (depth > MAX_JSON_DEPTH) throw new PortableInputError("json_nesting_depth_exceeded")
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
    throw new PortableInputError(`unexpected_token_at_${i}`)
  }

  const value = parseValue(0)
  skipWs()
  if (i !== n) throw new PortableInputError("trailing_content")
  return value
}

export function strictJsonLoadBytes(bytes, label) {
  if (bytes.length > MAX_FILE_BYTES) throw new PortableInputError(`file_too_large:${label}`)
  return strictJsonParse(bytes.toString("utf8"))
}

// ---------------------------------------------------------------------------
// Canonical JSON. Object keys sorted, array order preserved (including
// duplicates), UTF-8, no Unicode normalization performed anywhere.
// ---------------------------------------------------------------------------

export function canonicalize(value) {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new PortableInputError("non_finite_number")
    return String(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`
  if (typeof value === "object") {
    const keys = Object.keys(value).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(",")}}`
  }
  throw new PortableInputError(`unsupported_canonical_value:${typeof value}`)
}

export function sha256Canonical(value) {
  return `sha256:${createHash("sha256").update(canonicalize(value), "utf8").digest("hex")}`
}

// ---------------------------------------------------------------------------
// Collection-ref derivation, implemented manually from the frozen
// unreserved-character table (contract.json -> collection_ref_derivation).
// Deliberately NOT delegated to the native encodeURIComponent -- this
// implements the byte-level rule itself so the algorithm, not a borrowed
// platform function, is what is under test.
// ---------------------------------------------------------------------------

const UNRESERVED = new Set(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()".split(""),
)

export function encodeUriComponentEquivalent(value) {
  const bytes = Buffer.from(value, "utf8")
  let out = ""
  for (const byte of bytes) {
    const char = String.fromCharCode(byte)
    if (byte < 128 && UNRESERVED.has(char)) {
      out += char
    } else {
      out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`
    }
  }
  return out
}

export function deriveCollectionRef(collectionId) {
  return `/collection/${encodeUriComponentEquivalent(collectionId)}`
}

// ---------------------------------------------------------------------------
// Duplicate-preserving multiset ordering. contract.json's
// portable_v0_substitute is Python's plain sorted() (codepoint order); the
// JS equivalent is the default Array.prototype.sort() with no comparator,
// which orders by UTF-16 code unit -- identical to codepoint order for the
// ASCII-bounded v0 identifier grammar this package's matrix is restricted
// to (contract.json -> comparators). Never deduplicates.
// ---------------------------------------------------------------------------

export function sortRefs(refs) {
  return [...refs].sort()
}

// ---------------------------------------------------------------------------
// Root formulas -- exact frozen preimages (contract.json -> root_formulas).
// ---------------------------------------------------------------------------

export function computeCollectionRoot(collectionVersion, collectionId, artifactRefs) {
  return sha256Canonical({
    collection_version: collectionVersion,
    collection_id: collectionId,
    artifact_refs: sortRefs(artifactRefs),
  })
}

export function computePortfolioRoot(portfolioVersion, portfolioId, collectionRefs) {
  return sha256Canonical({
    portfolio_version: portfolioVersion,
    portfolio_id: portfolioId,
    collection_refs: sortRefs(collectionRefs),
  })
}

export function computeCheckpointRoot(schema, checkpointId, collectionRef, entryRefs, prevCheckpoint, sequence) {
  return sha256Canonical({
    schema,
    checkpoint_id: checkpointId,
    collection_ref: collectionRef,
    // Stored order, never re-sorted -- matches the frozen preimage exactly.
    entry_refs: [...entryRefs],
    prev_checkpoint: prevCheckpoint,
    sequence,
  })
}

// ---------------------------------------------------------------------------
// Applicability rules (contract.json -> applicability_rules). Documented,
// not invented; this package changes none of them.
// ---------------------------------------------------------------------------

export function checkCollectionsApplicability(collections) {
  if (collections.length === 0) throw new PortableInputError("chronicle_collections_portfolio_empty")
}

export function checkCheckpointApplicability(sequence, prevCheckpoint) {
  if (typeof sequence !== "number" || !Number.isInteger(sequence) || sequence < 0) {
    throw new PortableInputError("chronicle_checkpoint_shape_invalid")
  }
  if (sequence === 0 && prevCheckpoint !== null) throw new PortableInputError("chronicle_checkpoint_shape_invalid")
  if (sequence > 0 && prevCheckpoint === null) throw new PortableInputError("chronicle_checkpoint_shape_invalid")
}

export function validateIdentifier(value, label) {
  if (value.length > MAX_STRING_LENGTH) throw new PortableInputError(`${label}_exceeds_max_string_length`)
  if (!IDENTIFIER_RE.test(value)) throw new PortableInputError(`${label}_outside_normative_grammar`)
}

// ---------------------------------------------------------------------------
// Object builders.
// ---------------------------------------------------------------------------

export function buildCollection(collectionId, artifactRefs) {
  return {
    schema: CHRONICLE_COLLECTION_VERSION_V0,
    collection_version: CHRONICLE_COLLECTION_VERSION_V0,
    collection_id: collectionId,
    artifact_refs: [...artifactRefs],
    collection_root: computeCollectionRoot(CHRONICLE_COLLECTION_VERSION_V0, collectionId, artifactRefs),
  }
}

export function buildPortfolio(portfolioId, collectionRefs) {
  return {
    schema: CHRONICLE_PORTFOLIO_VERSION_V0,
    portfolio_version: CHRONICLE_PORTFOLIO_VERSION_V0,
    portfolio_id: portfolioId,
    collection_refs: [...collectionRefs],
    portfolio_root: computePortfolioRoot(CHRONICLE_PORTFOLIO_VERSION_V0, portfolioId, collectionRefs),
  }
}

export function buildCheckpoint(checkpointId, collectionRef, entryRefs, prevCheckpoint, sequence) {
  checkCheckpointApplicability(sequence, prevCheckpoint)
  return {
    schema: CHRONICLE_CHECKPOINT_VERSION_V0,
    checkpoint_id: checkpointId,
    collection_ref: collectionRef,
    entry_refs: [...entryRefs],
    prev_checkpoint: prevCheckpoint,
    sequence,
    checkpoint_root: computeCheckpointRoot(
      CHRONICLE_CHECKPOINT_VERSION_V0,
      checkpointId,
      collectionRef,
      entryRefs,
      prevCheckpoint,
      sequence,
    ),
  }
}

// ---------------------------------------------------------------------------
// Scenario: main only (this producer's minimum required scope). The
// underlying builders above are duplicate-preserving and metadata-neutral
// by construction, independent of which scenario exercises them.
// ---------------------------------------------------------------------------

function dumpLf(doc) {
  return Buffer.from(`${JSON.stringify(doc, null, 2)}\n`, "utf8")
}

export function buildMainScenario(seed) {
  for (const entry of seed.collections) {
    validateIdentifier(entry.collection_id, "collection_id")
    for (const ref of entry.artifact_refs) validateIdentifier(ref, "artifact_ref")
  }
  checkCollectionsApplicability(seed.collections)

  const collections = seed.collections.map((c) => buildCollection(c.collection_id, c.artifact_refs))
  const collectionRefs = seed.collections.map((c) => deriveCollectionRef(c.collection_id))
  const portfolio = buildPortfolio(seed.portfolio.portfolio_id, collectionRefs)
  const checkpointRef = deriveCollectionRef(seed.checkpoint.references_collection_id)
  const checkpoint = buildCheckpoint(
    seed.checkpoint.checkpoint_id,
    checkpointRef,
    seed.checkpoint.entry_refs,
    null,
    0,
  )

  return { collections, portfolio, checkpoint }
}

export function writePackage(outDir, scenario, collections, portfolio, checkpoint, claims) {
  mkdirSync(outDir, { recursive: true })

  const collectionsBytes = dumpLf(collections)
  const portfolioBytes = dumpLf(portfolio)
  const checkpointBytes = dumpLf(checkpoint)

  writeFileSync(resolve(outDir, "collections.json"), collectionsBytes)
  writeFileSync(resolve(outDir, "portfolio.json"), portfolioBytes)
  writeFileSync(resolve(outDir, "checkpoint.json"), checkpointBytes)

  const manifest = {
    schema: "chronicle_external_producer_manifest.v0",
    scenario,
    // Pinned to the frozen expected/positive/producer-manifest.json values
    // for the `main` scenario specifically -- contract.json marks these
    // fields non-normative for verification purposes, but reproducing the
    // committed baseline byte-for-byte (this package's actual claim) means
    // this JS producer's `main` output must match the exact strings the
    // Python producer already froze, not invent its own.
    producer_id: "chronicle-external-producer-reference-v0",
    producer_version: "0.1.0",
    files: [
      { path: "collections.json", sha256: createHash("sha256").update(collectionsBytes).digest("hex") },
      { path: "portfolio.json", sha256: createHash("sha256").update(portfolioBytes).digest("hex") },
      { path: "checkpoint.json", sha256: createHash("sha256").update(checkpointBytes).digest("hex") },
    ],
    claims,
  }
  writeFileSync(resolve(outDir, "producer-manifest.json"), dumpLf(manifest))
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--seed") args.seed = argv[i + 1]
    if (argv[i] === "--scenario") args.scenario = argv[i + 1]
    if (argv[i] === "--out") args.out = argv[i + 1]
  }
  if (!args.seed || !args.scenario || !args.out) {
    throw new Error("Usage: bun producer_reference_js.mjs --seed <path> --scenario main --out <dir>")
  }
  return args
}

export function main(argv) {
  const { seed: seedPath, scenario, out } = parseArgs(argv)
  if (scenario !== "main") {
    throw new PortableInputError(`unsupported_scenario:${scenario}`)
  }
  const seed = strictJsonLoadBytes(readFileSync(resolve(seedPath)), seedPath)
  const { collections, portfolio, checkpoint } = buildMainScenario(seed)
  writePackage(resolve(out), scenario, collections, portfolio, checkpoint, {
    producer_believes_locally_valid: true,
    producer_believes_cross_link_valid: true,
  })
  console.log(JSON.stringify({ ok: true, scenario, out: resolve(out) }))
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.log(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : String(error) }))
    process.exit(1)
  }
}
