type TextField = HTMLInputElement | HTMLTextAreaElement

const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "url",
  "email",
  "tel",
  "password",
  "number",
  undefined,
])

export function isTextField(element: Element | null): element is TextField {
  if (!element) return false
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly
  if (element instanceof HTMLInputElement) {
    return (
      TEXT_INPUT_TYPES.has(element.type) && !element.disabled && !element.readOnly
    )
  }
  return false
}

function setNativeValue(field: TextField, value: string) {
  const prototype =
    field instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
  setter?.call(field, value)
  field.dispatchEvent(new Event("input", { bubbles: true }))
}

export function insertAtCursor(field: TextField, text: string) {
  const start = field.selectionStart ?? field.value.length
  const end = field.selectionEnd ?? field.value.length
  const next = field.value.slice(0, start) + text + field.value.slice(end)
  setNativeValue(field, next)
  const cursor = start + text.length
  requestAnimationFrame(() => field.setSelectionRange(cursor, cursor))
}

export function deleteBeforeCursor(field: TextField) {
  const start = field.selectionStart ?? field.value.length
  const end = field.selectionEnd ?? field.value.length

  if (start !== end) {
    const next = field.value.slice(0, start) + field.value.slice(end)
    setNativeValue(field, next)
    requestAnimationFrame(() => field.setSelectionRange(start, start))
    return
  }

  if (start === 0) return
  const next = field.value.slice(0, start - 1) + field.value.slice(end)
  setNativeValue(field, next)
  requestAnimationFrame(() => field.setSelectionRange(start - 1, start - 1))
}
