#!/usr/bin/env bun

await import("./prebuild")

const version = process.env.STEALTH_VERSION ?? "1.0.0"
const pkg = await Bun.file("./package.json").json()
pkg.version = version
await Bun.write("./package.json", JSON.stringify(pkg, null, 2) + "\n")
console.log(`Updated package.json version to ${version}`)
