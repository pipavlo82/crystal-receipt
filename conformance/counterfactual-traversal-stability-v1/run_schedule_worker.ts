#!/usr/bin/env bun
/**
 * Lane K v1 schedule worker — fresh process entrypoint.
 *
 * Emits exactly one validated schedule-result JSON object on stdout.
 * Does not emit raw exceptions, stacks, paths, or host diagnostics.
 */
import { resolve } from "node:path"
import {
  TraversalStabilityErrorV1,
  executeAuthenticatedScheduleInProcessV1,
} from "../../src/receiptos/challenge/counterfactual-traversal-stability-v1"
import { TraversalScheduleContractErrorV1 } from "../../src/receiptos/challenge/counterfactual-traversal-schedules-v1"

function fail(reason: string): never {
  console.log(JSON.stringify({ ok: false, reason }))
  process.exit(1)
}

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name)
  if (index < 0) return null
  const value = process.argv[index + 1]
  return typeof value === "string" && value.length > 0 ? value : null
}

const scheduleId = readArg("--schedule-id")
const repositoryRootArg = readArg("--repository-root")
if (scheduleId === null || repositoryRootArg === null) {
  fail("worker_schema_mismatch")
}

try {
  const result = await executeAuthenticatedScheduleInProcessV1({
    scheduleId,
    repositoryRoot: resolve(repositoryRootArg),
  })
  console.log(JSON.stringify(result))
  process.exit(0)
} catch (error) {
  if (
    error instanceof TraversalStabilityErrorV1 ||
    error instanceof TraversalScheduleContractErrorV1
  ) {
    fail(error.reason)
  }
  fail("schedule_execution_unresolved")
}
