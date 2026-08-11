#!/usr/bin/env bun
/**
 * Deterministic Counterfactual Traversal Stability v1 package generator.
 *
 * Usage:
 *   bun conformance/counterfactual-traversal-stability-v1/generate_package.ts --check
 *   bun conformance/counterfactual-traversal-stability-v1/generate_package.ts --write
 */
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  TraversalStabilityErrorV1,
  runTraversalStabilityPackageGeneratorV1,
} from "../../src/receiptos/challenge/counterfactual-traversal-stability-v1"

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)))

function usage(): never {
  console.error(
    "Usage: bun conformance/counterfactual-traversal-stability-v1/generate_package.ts --check|--write",
  )
  process.exit(2)
}

const modeArg = process.argv[2]
if (modeArg !== "--check" && modeArg !== "--write") usage()
const mode = modeArg === "--check" ? "check" : "write"

try {
  const result = runTraversalStabilityPackageGeneratorV1({ mode, repositoryRoot: ROOT })
  console.log(
    JSON.stringify(
      {
        mode: result.mode,
        ok: result.ok,
        schedule_set_sha256: result.schedule_set_sha256,
        fixture_set_sha256: result.fixture_set_sha256,
        drifted_paths: result.drifted_paths,
        schedules: result.schedules,
      },
      null,
      2,
    ),
  )
  process.exit(result.ok || mode === "write" ? 0 : 1)
} catch (error) {
  if (error instanceof TraversalStabilityErrorV1) {
    console.log(JSON.stringify({ ok: false, reason: error.reason }, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: false, reason: "package_materialization_failure" }, null, 2))
  process.exit(1)
}
