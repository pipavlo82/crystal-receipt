/**
 * Host-independent classification for frozen repository-relative paths.
 *
 * Uses explicit POSIX and Windows path semantics so Windows-absolute forms
 * (drive, UNC, device, rooted, drive-qualified) are rejected on Linux CI
 * before any Git or filesystem lookup.
 */

import { posix, win32 } from "node:path"

/**
 * True when `repositoryPath` is absolute, rooted, drive-qualified, or otherwise
 * not a safe repository-relative path under portable POSIX/Windows rules.
 */
export function isUnsafeFrozenRepositoryPath(repositoryPath: string): boolean {
  if (typeof repositoryPath !== "string" || repositoryPath.length === 0) {
    return true
  }
  if (repositoryPath.includes("\0")) {
    return true
  }
  // Explicit dual-platform absolute/rooted detection (host-independent).
  if (posix.isAbsolute(repositoryPath) || win32.isAbsolute(repositoryPath)) {
    return true
  }
  // Drive-relative / drive-qualified without a root separator: C:foo
  if (/^[A-Za-z]:/.test(repositoryPath)) {
    return true
  }
  return false
}

/**
 * Normalize a frozen repository-relative path to POSIX separators.
 * Returns null when the path is unsafe or contains traversal.
 */
export function tryNormalizeFrozenRepositoryRelativePath(
  repositoryPath: string,
): string | null {
  if (typeof repositoryPath !== "string" || repositoryPath.length === 0) {
    return null
  }
  if (isUnsafeFrozenRepositoryPath(repositoryPath)) {
    return null
  }
  const normalized = posix.normalize(repositoryPath.replace(/\\/g, "/"))
  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/") ||
    normalized.split("/").some((part) => part === "..") ||
    isUnsafeFrozenRepositoryPath(normalized)
  ) {
    return null
  }
  return normalized
}
