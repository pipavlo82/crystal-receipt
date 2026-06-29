import { beforeEach, describe, expect, test } from "bun:test"

const src = await Bun.file(new URL("../public/oc-theme-preload.js", import.meta.url)).text()

const run = () => Function(src)()

beforeEach(() => {
  document.head.innerHTML = ""
  document.documentElement.removeAttribute("data-theme")
  document.documentElement.removeAttribute("data-color-scheme")
  localStorage.clear()
  Object.defineProperty(window, "matchMedia", {
    value: () =>
      ({
        matches: false,
      }) as MediaQueryList,
    configurable: true,
  })
})

describe("theme preload", () => {
  test("forces AMOLED dark mode before mount", () => {
    localStorage.setItem("opencode-theme-id", "oc-1")
    localStorage.setItem("opencode-theme-css-light", "--background-base:#fff;")
    localStorage.setItem("opencode-theme-css-dark", "--background-base:#000;")

    run()

    expect(document.documentElement.dataset.theme).toBe("amoled")
    expect(document.documentElement.dataset.colorScheme).toBe("dark")
    expect(localStorage.getItem("opencode-theme-id")).toBe("amoled")
    expect(localStorage.getItem("opencode-color-scheme")).toBe("dark")
    expect(localStorage.getItem("opencode-theme-css-light")).toBeNull()
    expect(localStorage.getItem("opencode-theme-css-dark")).toBeNull()
    expect(document.getElementById("oc-theme-preload")).toBeNull()
  })

  test("ignores saved non-AMOLED theme choices", () => {
    localStorage.setItem("opencode-theme-id", "nightowl")
    localStorage.setItem("opencode-theme-css-light", "--background-base:#fff;")
    localStorage.setItem("opencode-theme-css-dark", "--background-base:#020303;")

    run()

    expect(document.documentElement.dataset.theme).toBe("amoled")
    expect(document.documentElement.dataset.colorScheme).toBe("dark")
    expect(localStorage.getItem("opencode-theme-id")).toBe("amoled")
    expect(document.getElementById("oc-theme-preload")).toBeNull()
  })

  test("keeps cached AMOLED dark css when already forced", () => {
    localStorage.setItem("opencode-theme-id", "amoled")
    localStorage.setItem("opencode-theme-css-dark", "--background-base:#020303;")

    run()

    expect(document.documentElement.dataset.theme).toBe("amoled")
    expect(document.documentElement.dataset.colorScheme).toBe("dark")
    expect(document.getElementById("oc-theme-preload")?.textContent).toContain("--background-base:#020303;")
  })
})
