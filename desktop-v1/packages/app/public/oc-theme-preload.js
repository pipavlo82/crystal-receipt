;(function () {
  var key = "opencode-theme-id"
  var previousThemeId = localStorage.getItem(key)
  var themeId = "amoled"

  var scheme = "dark"
  var isDark = true
  var mode = "dark"

  localStorage.setItem(key, themeId)
  localStorage.setItem("opencode-color-scheme", scheme)
  if (previousThemeId !== themeId) {
    localStorage.removeItem("opencode-theme-css-light")
    localStorage.removeItem("opencode-theme-css-dark")
  }
  document.documentElement.dataset.theme = themeId
  document.documentElement.dataset.colorScheme = mode

  // Update theme-color meta tag to match app color scheme
  var metas = document.querySelectorAll("meta[name='theme-color']")
  if (metas.length > 0) metas[0].setAttribute("content", "#020303")

  var css = localStorage.getItem("opencode-theme-css-" + mode)
  if (css) {
    var style = document.createElement("style")
    style.id = "oc-theme-preload"
    style.textContent =
      ":root{color-scheme:" +
      mode +
      ";--text-mix-blend-mode:" +
      (isDark ? "plus-lighter" : "multiply") +
      ";" +
      css +
      "}"
    document.head.appendChild(style)
  }
})()
