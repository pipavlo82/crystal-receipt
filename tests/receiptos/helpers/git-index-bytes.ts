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
