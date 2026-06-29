import { createEffect, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { makeEventListener } from "@solid-primitives/event-listener"
import { createSimpleContext } from "../context/helper"
import amoledThemeJson from "./themes/amoled.json"
import oc2ThemeJson from "./themes/oc-2.json"
import { resolveThemeVariant, themeToCss } from "./resolve"
import type { DesktopTheme } from "./types"

export type ColorScheme = "light" | "dark" | "system"

const STORAGE_KEYS = {
  THEME_ID: "opencode-theme-id",
  COLOR_SCHEME: "opencode-color-scheme",
  THEME_CSS_LIGHT: "opencode-theme-css-light",
  THEME_CSS_DARK: "opencode-theme-css-dark",
} as const

const THEME_STYLE_ID = "oc-theme"
const FORCED_THEME_ID = "amoled"
const FORCED_COLOR_SCHEME: ColorScheme = "dark"
const FORCED_MODE: "dark" = "dark"
let files: Record<string, () => Promise<{ default: DesktopTheme }>> | undefined
let ids: string[] | undefined

function getFiles() {
  if (files) return files
  files = import.meta.glob<{ default: DesktopTheme }>("./themes/*.json")
  return files
}

function themeIDs() {
  if (ids) return ids
  ids = Object.keys(getFiles())
    .map((path) => path.slice("./themes/".length, -".json".length))
    .sort()
  return ids
}

const names: Record<string, string> = {
  "oc-2": "OC-2",
  amoled: "AMOLED",
  aura: "Aura",
  ayu: "Ayu",
  carbonfox: "Carbonfox",
  catppuccin: "Catppuccin",
  "catppuccin-frappe": "Catppuccin Frappe",
  "catppuccin-macchiato": "Catppuccin Macchiato",
  cobalt2: "Cobalt2",
  cursor: "Cursor",
  dracula: "Dracula",
  everforest: "Everforest",
  flexoki: "Flexoki",
  github: "GitHub",
  gruvbox: "Gruvbox",
  kanagawa: "Kanagawa",
  "lucent-orng": "Lucent Orng",
  material: "Material",
  matrix: "Matrix",
  mercury: "Mercury",
  monokai: "Monokai",
  nightowl: "Night Owl",
  nord: "Nord",
  "one-dark": "One Dark",
  onedarkpro: "One Dark Pro",
  opencode: "Stealth",
  orng: "Orng",
  "osaka-jade": "Osaka Jade",
  palenight: "Palenight",
  rosepine: "Rose Pine",
  shadesofpurple: "Shades of Purple",
  solarized: "Solarized",
  synthwave84: "Synthwave '84",
  tokyonight: "Tokyonight",
  vercel: "Vercel",
  vesper: "Vesper",
  zenburn: "Zenburn",
}
const oc2Theme = oc2ThemeJson as DesktopTheme
const amoledTheme = amoledThemeJson as DesktopTheme

function normalize(_id: string | null | undefined) {
  return FORCED_THEME_ID
}

function write(key: string, value: string) {
  if (typeof localStorage !== "object") return
  try {
    localStorage.setItem(key, value)
  } catch {}
}

function drop(key: string) {
  if (typeof localStorage !== "object") return
  try {
    localStorage.removeItem(key)
  } catch {}
}

function clear() {
  drop(STORAGE_KEYS.THEME_CSS_LIGHT)
  drop(STORAGE_KEYS.THEME_CSS_DARK)
}

function ensureThemeStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null
  if (existing) return existing
  const element = document.createElement("style")
  element.id = THEME_STYLE_ID
  document.head.appendChild(element)
  return element
}

function applyThemeCss(theme: DesktopTheme, themeId: string, mode: "light" | "dark") {
  const isDark = mode === "dark"
  const variant = isDark ? theme.dark : theme.light
  const tokens = resolveThemeVariant(variant, isDark)
  const css = themeToCss(tokens)

  if (themeId !== "oc-2") {
    write(isDark ? STORAGE_KEYS.THEME_CSS_DARK : STORAGE_KEYS.THEME_CSS_LIGHT, css)
  }

  const fullCss = `:root {
  color-scheme: ${mode};
  --text-mix-blend-mode: ${isDark ? "plus-lighter" : "multiply"};
  ${css}
}`

  document.getElementById("oc-theme-preload")?.remove()
  ensureThemeStyleElement().textContent = fullCss
  document.documentElement.dataset.theme = themeId
  document.documentElement.dataset.colorScheme = mode

  // Update theme-color meta tag to match light/dark mode
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute("content", isDark ? "#020303" : "#F8F7F7")
}

function cacheThemeVariants(theme: DesktopTheme, themeId: string) {
  if (themeId === "oc-2") return
  for (const mode of ["light", "dark"] as const) {
    const isDark = mode === "dark"
    const variant = isDark ? theme.dark : theme.light
    const tokens = resolveThemeVariant(variant, isDark)
    const css = themeToCss(tokens)
    write(isDark ? STORAGE_KEYS.THEME_CSS_DARK : STORAGE_KEYS.THEME_CSS_LIGHT, css)
  }
}

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: (props: { defaultTheme?: string; onThemeApplied?: (theme: DesktopTheme, mode: "light" | "dark") => void }) => {
    const [store, setStore] = createStore({
      themes: {
        "oc-2": oc2Theme,
        amoled: amoledTheme,
      } as Record<string, DesktopTheme>,
      themeId: FORCED_THEME_ID,
      colorScheme: FORCED_COLOR_SCHEME,
      mode: FORCED_MODE,
      previewThemeId: null as string | null,
      previewScheme: null as ColorScheme | null,
    })

    const loads = new Map<string, Promise<DesktopTheme | undefined>>()

    const load = (id: string) => {
      const next = normalize(id)
      if (!next) return Promise.resolve(undefined)
      const hit = store.themes[next]
      if (hit) return Promise.resolve(hit)
      const pending = loads.get(next)
      if (pending) return pending
      const file = getFiles()[`./themes/${next}.json`]
      if (!file) return Promise.resolve(undefined)
      const task = file()
        .then((mod) => {
          const theme = mod.default
          setStore("themes", next, theme)
          return theme
        })
        .finally(() => {
          loads.delete(next)
        })
      loads.set(next, task)
      return task
    }

    const applyTheme = (theme: DesktopTheme, themeId: string, mode: "light" | "dark") => {
      applyThemeCss(theme, themeId, mode)
      props.onThemeApplied?.(theme, mode)
    }

    const ids = () => [FORCED_THEME_ID]

    const loadThemes = () => Promise.all(themeIDs().map(load)).then(() => store.themes)

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.THEME_ID && e.newValue) {
        write(STORAGE_KEYS.THEME_ID, FORCED_THEME_ID)
        setStore("themeId", FORCED_THEME_ID)
        void load(FORCED_THEME_ID).then((theme) => {
          if (!theme) return
          cacheThemeVariants(theme, FORCED_THEME_ID)
        })
      }
      if (e.key === STORAGE_KEYS.COLOR_SCHEME && e.newValue) {
        write(STORAGE_KEYS.COLOR_SCHEME, FORCED_COLOR_SCHEME)
        setStore("colorScheme", FORCED_COLOR_SCHEME)
        setStore("mode", FORCED_MODE)
      }
    }

    onMount(() => {
      makeEventListener(window, "storage", onStorage)

      write(STORAGE_KEYS.THEME_ID, FORCED_THEME_ID)
      write(STORAGE_KEYS.COLOR_SCHEME, FORCED_COLOR_SCHEME)
      setStore("themeId", FORCED_THEME_ID)
      setStore("colorScheme", FORCED_COLOR_SCHEME)
      setStore("mode", FORCED_MODE)
      void load(FORCED_THEME_ID).then((theme) => {
        if (!theme || store.themeId !== FORCED_THEME_ID) return
        cacheThemeVariants(theme, FORCED_THEME_ID)
      })
    })

    createEffect(() => {
      const theme = store.themes[store.themeId]
      if (!theme) return
      applyTheme(theme, store.themeId, store.mode)
    })

    const setTheme = (_id: string) => {
      setStore("themeId", FORCED_THEME_ID)
      void load(FORCED_THEME_ID).then((theme) => {
        if (!theme || store.themeId !== FORCED_THEME_ID) return
        cacheThemeVariants(theme, FORCED_THEME_ID)
        write(STORAGE_KEYS.THEME_ID, FORCED_THEME_ID)
      })
    }

    const setColorScheme = (_scheme: ColorScheme) => {
      setStore("colorScheme", FORCED_COLOR_SCHEME)
      write(STORAGE_KEYS.COLOR_SCHEME, FORCED_COLOR_SCHEME)
      setStore("mode", FORCED_MODE)
    }

    return {
      themeId: () => store.themeId,
      colorScheme: () => store.colorScheme,
      mode: () => store.mode,
      ids,
      name: (id: string) => store.themes[id]?.name ?? names[id] ?? id,
      loadThemes,
      themes: () => store.themes,
      setTheme,
      setColorScheme,
      registerTheme: (theme: DesktopTheme) => setStore("themes", theme.id, theme),
      previewTheme: (_id: string) => {
        void load(FORCED_THEME_ID).then((theme) => {
          if (!theme) return
          applyTheme(theme, FORCED_THEME_ID, FORCED_MODE)
        })
      },
      previewColorScheme: (_scheme: ColorScheme) => {
        void load(FORCED_THEME_ID).then((theme) => {
          if (!theme) return
          applyTheme(theme, FORCED_THEME_ID, FORCED_MODE)
        })
      },
      commitPreview: () => {
        setTheme(FORCED_THEME_ID)
        setColorScheme(FORCED_COLOR_SCHEME)
        setStore("previewThemeId", null)
        setStore("previewScheme", null)
      },
      cancelPreview: () => {
        setStore("previewThemeId", null)
        setStore("previewScheme", null)
        void load(FORCED_THEME_ID).then((theme) => {
          if (!theme) return
          applyTheme(theme, FORCED_THEME_ID, FORCED_MODE)
        })
      },
    }
  },
})
