// Оценка токенов с учётом Unicode-диапазонов.
// ASCII (~4 символа/токен), кириллица/расширенная латиница (~2 символа/токен),
// CJK и выше (~1 символ/токен).
function countTextTokens(text) {
  const ascii = (text.match(/[\x00-\x7F]/g) ?? []).length
  const mid   = (text.match(/[\x80-\u07FF]/g) ?? []).length
  const high  = text.length - ascii - mid
  return ascii * 0.25 + mid * 0.5 + high * 1.0
}

export function estimateTokens(messages) {
  let tokens = 0
  for (const m of messages) {
    if (typeof m.content === "string") {
      tokens += countTextTokens(m.content)
    } else if (Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b.type === "image_url") {
          tokens += (b.image_url?.url?.length ?? 0) / 4
        } else {
          tokens += countTextTokens(b.text ?? "")
        }
      }
    }
    tokens += 20
  }
  return Math.ceil(tokens)
}
