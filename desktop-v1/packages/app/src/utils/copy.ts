export async function copyText(text: string): Promise<void> {
  if (!text) return

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // fall through to DOM-based fallback
    }
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard unavailable")
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  textarea.style.pointerEvents = "none"
  textarea.style.left = "-9999px"
  textarea.style.top = "0"
  document.body.appendChild(textarea)

  const selection = document.getSelection()
  const originalRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  const copied = document.execCommand("copy")

  document.body.removeChild(textarea)

  if (selection) {
    selection.removeAllRanges()
    if (originalRange) selection.addRange(originalRange)
  }

  if (!copied) {
    throw new Error("Copy command failed")
  }
}
