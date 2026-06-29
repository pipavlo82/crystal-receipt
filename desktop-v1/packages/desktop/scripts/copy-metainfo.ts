import { resolveChannel } from "./utils"
import { rmSync } from "node:fs"

const arg = process.argv[2]
const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const appId = channel === "prod" ? "network.cyphes.stealth" : `network.cyphes.stealth.${channel}`
const productName = channel === "prod" ? "Stealth" : `Stealth ${channel.charAt(0).toUpperCase() + channel.slice(1)}`
const summary = `Open source AI coding agent${channel !== "prod" ? ` (${channel})` : ""}`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${appId}</id>

  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>

  <name>${productName}</name>
  <summary>${summary}</summary>

  <developer id="network.cyphes">
    <name>CYPHES</name>
  </developer>

  <description>
    <p>
      Stealth is an open source agent that helps you write and run code with any AI model.
    </p>
  </description>

  <launchable type="desktop-id">${appId}.desktop</launchable>

  <content_rating type="oars-1.1" />

  <url type="bugtracker">https://github.com/CYPHES-ATP/Stealth/issues</url>
  <url type="homepage">https://github.com/CYPHES-ATP/Stealth</url>
  <url type="vcs-browser">https://github.com/CYPHES-ATP/Stealth</url>

  <screenshots>
    <screenshot type="default">
      <image>https://raw.githubusercontent.com/CYPHES-ATP/Stealth/main/docs/stealth-desktop.png</image>
    </screenshot>
  </screenshots>
</component>
`

for (const file of new Bun.Glob("resources/*.metainfo.xml").scanSync(".")) {
  rmSync(file, { force: true })
}
await Bun.write(`resources/${appId}.metainfo.xml`, xml)
console.log(`Generated metainfo for ${channel} at resources/${appId}.metainfo.xml`)
