import { execFileSync } from "node:child_process"

// Byte-integrity manifests pin Git candidate bytes. The index represents staged
// candidate content, CI index bytes equal committed HEAD bytes, and Windows
// working-tree CRLF conversion must not affect byte-identity verification.
export function readGitIndexBytes(repoRoot: string, repositoryPath: string): Buffer {
  let diffStatus = 0
  try {
    execFileSync("git", ["diff", "--quiet", "--", repositoryPath], {
      cwd: repoRoot,
      stdio: "ignore",
    })
  } catch (error: any) {
    const status = error?.status
    if (status === 1) {
      throw new Error(
        `Byte-integrity test requires staged candidate bytes for ${repositoryPath}; stage the file before running this test.`,
      )
    }
    diffStatus = status ?? -1
    throw new Error(`Git diff failed for ${repositoryPath} (exit ${diffStatus}).`)
  }

  try {
    return execFileSync("git", ["show", `:${repositoryPath}`], {
      cwd: repoRoot,
      encoding: "buffer",
      maxBuffer: 16 * 1024 * 1024,
    }) as Buffer
  } catch (error: any) {
    const status = error?.status ?? -1
    const stderr = Buffer.isBuffer(error?.stderr) ? error.stderr.toString("utf8").trim() : ""
    const suffix = stderr ? ` ${stderr}` : ""
    throw new Error(`Git index read failed for ${repositoryPath} (exit ${status}).${suffix}`)
  }
}

export function readGitIndexJson<T>(repoRoot: string, repositoryPath: string): T {
  return JSON.parse(readGitIndexBytes(repoRoot, repositoryPath).toString("utf8")) as T
}

function ensureGitCommitAvailable(repoRoot: string, commit: string): void {
  try {
    execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], {
      cwd: repoRoot,
      stdio: "ignore",
    })
    return
  } catch {}

  execFileSync("git", ["fetch", "--no-tags", "--depth=1", "origin", commit], {
    cwd: repoRoot,
    stdio: "pipe",
    maxBuffer: 16 * 1024 * 1024,
  })

  try {
    execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], {
      cwd: repoRoot,
      stdio: "ignore",
    })
  } catch (error: any) {
    const status = error?.status ?? -1
    throw new Error(`Pinned Git commit ${commit} is unavailable after explicit fetch (exit ${status}).`)
  }

  const resolved = execFileSync("git", ["rev-parse", `${commit}^{commit}`], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim()
  if (resolved !== commit) {
    throw new Error(`Explicit fetch resolved ${commit} to unexpected commit ${resolved}.`)
  }
}

export function readGitBlobBytesAtCommit(repoRoot: string, commit: string, repositoryPath: string): Buffer {
  ensureGitCommitAvailable(repoRoot, commit)
  try {
    return execFileSync("git", ["cat-file", "blob", `${commit}:${repositoryPath}`], {
      cwd: repoRoot,
      encoding: "buffer",
      maxBuffer: 16 * 1024 * 1024,
    }) as Buffer
  } catch (error: any) {
    const status = error?.status ?? -1
    const stderr = Buffer.isBuffer(error?.stderr) ? error.stderr.toString("utf8").trim() : ""
    const suffix = stderr ? ` ${stderr}` : ""
    throw new Error(`Git blob read failed for ${repositoryPath} at ${commit} (exit ${status}).${suffix}`)
  }
}

export function readGitBlobJsonAtCommit<T>(repoRoot: string, commit: string, repositoryPath: string): T {
  return JSON.parse(readGitBlobBytesAtCommit(repoRoot, commit, repositoryPath).toString("utf8")) as T
}
