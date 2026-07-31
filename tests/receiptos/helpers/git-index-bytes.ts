import { execFileSync } from "node:child_process"

export function readGitBlobBytes(repoRoot: string, commit: string, repositoryPath: string): Buffer {
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

export function readGitBlobJson<T>(repoRoot: string, commit: string, repositoryPath: string): T {
  return JSON.parse(readGitBlobBytes(repoRoot, commit, repositoryPath).toString("utf8")) as T
}
