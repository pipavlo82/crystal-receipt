# Stealth Icons

`packages/desktop/icons/source/cyphes.png` is the source image for the Stealth v1.0 app icon.

Regenerate `dev`, `beta`, and `prod` icons from the source PNG whenever the brand image changes. The generated folders must include the macOS `icon.icns`, Dock PNG, Windows ICO, Linux PNGs, and iOS-style fallback PNG sizes used by the packaging scripts.

For unpackaged Electron on macOS, `app.dock.setIcon()` uses `dock.png`. Keep `dock.png` in each channel folder synced with the packaged `icon.icns` source so the dev Dock icon matches the packaged app icon.
