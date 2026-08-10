#!/usr/bin/env bun
/**
 * Lane K schedule worker — fresh process entrypoint.
 *
 * Emits exactly one validated schedule-result JSON object on stdout.
 * Does not emit raw exceptions, stacks, paths, or host diagnostics.
 */
import { resolve } from "node:path"
import {
  TraversalStabilityError,
  executeAuthenticatedScheduleInProcess,
} from "../../src/receiptos/challenge/counterfactual-traversal-stability"
import { TraversalScheduleContractError } from "../../src/receiptos/challenge/counterfactual-traversal-schedules"

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
  const result = await executeAuthenticatedScheduleInProcess({
    scheduleId,
    repositoryRoot: resolve(repositoryRootArg),
  })
  console.log(JSON.stringify(result))
  process.exit(0)
} catch (error) {
  if (error instanceof TraversalStabilityError || error instanceof TraversalScheduleContractError) {
    fail(error.reason)
  }
  fail("schedule_execution_unresolved")
}
