import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export type RuntimeBlobEvidenceSource = "git-index-blob" | "head-tree-blob" | "checked-out-exact-byte-git-blob"
export type ChangedPathEvidenceSource = "frozen-two-tree-diff" | "github-event-two-tree-diff" | "existing-two-tree-diff" | "pinned-changed-path-inventory"

export type RuntimeEvidence = {
  indexOid(path: string): string | undefined
  headOid(path: string): string | undefined
  checkoutBytes(path: string): Buffer | undefined
}

export type ChangedPathPolicy = {
  exact_paths: string[]
  forbidden_prefixes: string[]
  forbidden_paths: string[]
  forbidden_path_patterns: string[]
}

const runGit = (root: string, args: string[]) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  } catch {
    return undefined
  }
}

export const gitBlobOid = (bytes: Uint8Array) => {
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8")
  return createHash("sha1").update(header).update(bytes).digest("hex")
}

export const filesystemRuntimeEvidence = (root: string): RuntimeEvidence => ({
  indexOid: path => runGit(root, ["rev-parse", `:${path}`]),
  headOid: path => runGit(root, ["rev-parse", `HEAD:${path}`]),
  checkoutBytes: path => {
    try { return readFileSync(resolve(root, path)) } catch { return undefined }
  }
})

export function verifyPinnedRuntimeBlobs(
  pins: Record<string, string>,
  evidence: RuntimeEvidence
): { source: RuntimeBlobEvidenceSource, paths: string[] } {
  const paths = Object.keys(pins).sort()
  if (paths.length === 0) throw new Error("runtime blob pins are empty")

  const index = paths.map(path => evidence.indexOid(path))
  if (index.every(Boolean)) {
    for (let i = 0; i < paths.length; i++) {
      if (index[i] !== pins[paths[i]]) throw new Error(`runtime blob mismatch (${paths[i]}): ${index[i]} != ${pins[paths[i]]}`)
    }
    return { source: "git-index-blob", paths }
  }

  const head = paths.map(path => evidence.headOid(path))
  if (head.every(Boolean)) {
    for (let i = 0; i < paths.length; i++) {
      if (head[i] !== pins[paths[i]]) throw new Error(`runtime blob mismatch (${paths[i]}): ${head[i]} != ${pins[paths[i]]}`)
    }
    return { source: "head-tree-blob", paths }
  }

  const checkout = paths.map(path => evidence.checkoutBytes(path))
  if (checkout.every(value => value !== undefined)) {
    for (let i = 0; i < paths.length; i++) {
      const actual = gitBlobOid(checkout[i]!)
      if (actual !== pins[paths[i]]) throw new Error(`runtime blob mismatch (${paths[i]}): ${actual} != ${pins[paths[i]]}`)
    }
    return { source: "checked-out-exact-byte-git-blob", paths }
  }

  throw new Error("no trustworthy runtime-blob evidence source is available")
}

const parseLines = (value: string | undefined) => value?.split(/\r?\n/).filter(Boolean).sort()
const objectExists = (root: string, sha: string) => runGit(root, ["cat-file", "-e", `${sha}^{commit}`]) !== undefined

const exactDiff = (root: string, base: string, head: string) => {
  const output = runGit(root, ["diff", "--name-only", base, head, "--"])
  return output === undefined ? undefined : parseLines(output) ?? []
}

const eventPair = (event: any, canonicalBase: string) => {
  if (event?.pull_request?.base?.sha && event?.pull_request?.head?.sha) {
    return { base: String(event.pull_request.base.sha), head: String(event.pull_request.head.sha) }
  }
  if (event?.after) return { base: canonicalBase, head: String(event.after) }
  return undefined
}

function fetchExactPair(root: string, base: string, head: string) {
  try {
    execFileSync("git", ["fetch", "--no-tags", "--no-recurse-submodules", "--depth=1", "origin",
      `+${base}:refs/rsf-normative/base`, `+${head}:refs/rsf-normative/head`],
    { cwd: root, stdio: ["ignore", "ignore", "ignore"] })
    return true
  } catch {
    return false
  }
}

export function validateChangedPaths(paths: string[], policy: ChangedPathPolicy) {
  const actual = [...new Set(paths)].sort()
  for (const path of actual) {
    if (policy.forbidden_prefixes.some(prefix => path.startsWith(prefix))) throw new Error(`forbidden changed-path prefix: ${path}`)
    if (policy.forbidden_paths.includes(path)) throw new Error(`forbidden changed path: ${path}`)
    if (policy.forbidden_path_patterns.some(pattern => new RegExp(pattern, "i").test(path))) throw new Error(`forbidden changed-path pattern: ${path}`)
  }
  const expected = [...policy.exact_paths].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const missing = expected.filter(path => !actual.includes(path))
    const extra = actual.filter(path => !expected.includes(path))
    throw new Error(`changed-path inventory mismatch; missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}`)
  }
  return actual
}

export function selectChangedPathEvidence(
  policy: ChangedPathPolicy,
  candidates: {
    githubEventPaths?: string[]
    existingTwoTreePaths?: string[]
    pinnedInventoryPaths?: string[]
  }
): { source: ChangedPathEvidenceSource, paths: string[] } {
  if (candidates.githubEventPaths) return { source: "github-event-two-tree-diff", paths: validateChangedPaths(candidates.githubEventPaths, policy) }
  if (candidates.existingTwoTreePaths) return { source: "existing-two-tree-diff", paths: validateChangedPaths(candidates.existingTwoTreePaths, policy) }
  if (candidates.pinnedInventoryPaths) return { source: "pinned-changed-path-inventory", paths: validateChangedPaths(candidates.pinnedInventoryPaths, policy) }
  throw new Error("no trustworthy changed-path evidence source is available")
}

export function resolveChangedPathEvidence(
  root: string,
  canonicalBase: string,
  policy: ChangedPathPolicy,
  environment: NodeJS.ProcessEnv = process.env,
  frozenHead?: string,
): { source: ChangedPathEvidenceSource, paths: string[] } {
  if (frozenHead) {
    if ((!objectExists(root, canonicalBase) || !objectExists(root, frozenHead)) && !fetchExactPair(root, canonicalBase, frozenHead)) {
      throw new Error("frozen normative base/head objects are unavailable")
    }
    const paths = exactDiff(root, canonicalBase, frozenHead)
    if (!paths) throw new Error("frozen normative two-tree diff is unavailable")
    return { source: "frozen-two-tree-diff", paths: validateChangedPaths(paths, policy) }
  }

  const eventPath = environment.GITHUB_EVENT_PATH
  if (eventPath && existsSync(eventPath)) {
    const pair = eventPair(JSON.parse(readFileSync(eventPath, "utf8")), canonicalBase)
    if (pair) {
      if ((!objectExists(root, pair.base) || !objectExists(root, pair.head)) && !fetchExactPair(root, pair.base, pair.head)) {
        // Fall through to an explicitly supplied source-artifact inventory.
      } else {
        const paths = exactDiff(root, pair.base, pair.head)
        if (paths) return selectChangedPathEvidence(policy, { githubEventPaths: paths })
      }
    }
  }

  const head = runGit(root, ["rev-parse", "HEAD"])
  if (head && objectExists(root, canonicalBase)) {
    const paths = exactDiff(root, canonicalBase, head)
    if (paths) return selectChangedPathEvidence(policy, { existingTwoTreePaths: paths })
  }

  const inventoryPath = environment.RSF_NORMATIVE_CHANGED_PATHS_FILE
  if (inventoryPath && existsSync(inventoryPath)) {
    const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"))
    if (inventory.canonical_base !== canonicalBase || !Array.isArray(inventory.paths)) throw new Error("untrusted changed-path inventory metadata")
    return selectChangedPathEvidence(policy, { pinnedInventoryPaths: inventory.paths })
  }

  throw new Error("no trustworthy changed-path evidence source is available")
}
