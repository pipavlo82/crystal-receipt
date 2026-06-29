# Stealth

The CYPHES Stealth desktop app, built with Electron and packaged as macOS and Windows desktop artifacts.

## Development

```bash
bun install
OPENCODE_CHANNEL=prod bun --cwd packages/desktop dev
```

## Build

Run the `build` script to build the app's JS assets, then `package` to
bundle the assets as an application. The resulting app will be in `dist/`.

```bash
OPENCODE_CHANNEL=prod bun --cwd packages/desktop build
OPENCODE_CHANNEL=prod CSC_IDENTITY_AUTO_DISCOVERY=false bun --cwd packages/desktop package:mac -- --arm64
```

For a Windows x64 package built on Windows:

```bash
OPENCODE_CHANNEL=prod bun --cwd packages/desktop build
OPENCODE_CHANNEL=prod bun --cwd packages/desktop package:win -- --x64 --publish never
```

For a Windows x64 package cross-built on macOS:

```bash
bun install --os=win32 --cpu=x64 --no-save --frozen-lockfile
OPENCODE_CHANNEL=prod ELECTRON_TARGET_PLATFORM=win32 ELECTRON_TARGET_ARCH=x64 bun --cwd packages/desktop build
OPENCODE_CHANNEL=prod bun --cwd packages/desktop package:win -- --x64 --publish never
```

The Electron entrypoint is generated at `packages/desktop/out/main/index.js`.
