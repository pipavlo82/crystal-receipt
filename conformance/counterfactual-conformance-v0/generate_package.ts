#!/usr/bin/env bun
/**
 * Deterministic Counterfactual Conformance v0 umbrella package generator.
 *
 * Usage:
 *   bun conformance/counterfactual-conformance-v0/generate_package.ts --check
 *   bun conformance/counterfactual-conformance-v0/generate_package.ts --write
 */
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  DcnGeneratorError,
  runCounterfactualConformancePackageGenerator,
} from "../../src/receiptos/challenge/counterfactual-dcn-generator"

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)))

function usage(): never {
  console.error("Usage: bun conformance/counterfactual-conformance-v0/generate_package.ts --check|--write")
  process.exit(2)
}

const modeArg = process.argv[2]
if (modeArg !== "--check" && modeArg !== "--write") usage()
const mode = modeArg === "--check" ? "check" : "write"

try {
  const result = runCounterfactualConformancePackageGenerator({ mode, repositoryRoot: ROOT })
  console.log(
    JSON.stringify(
      {
        mode: result.mode,
        ok: result.ok,
        dcn_sha256: result.dcn_sha256,
        child_identity_set_sha256: result.child_identity_set_sha256,
        fixture_set_sha256: result.fixture_set_sha256,
        drifted_paths: result.drifted_paths,
      },
      null,
      2,
    ),
  )
  process.exit(0)
} catch (error) {
  if (error instanceof DcnGeneratorError) {
    console.log(JSON.stringify({ ok: false, reason: error.reason }, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: false, reason: "package_materialization_failure" }, null, 2))
  process.exit(1)
}
