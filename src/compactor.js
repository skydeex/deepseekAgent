import { getConfig } from "./config.js"
import { runHooks } from "./hooks.js"
import { c } from "./ui.js"

// Оценка токенов: ~3 символа = 1 токен для текста; base64 изображений считаем по размеру
function estimateTokens(messages) {
  let chars = 0
  for (const m of messages) {
    if (typeof m.content === "string") {
      chars += m.content.length
    } else if (Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b.type === "image_url") {
          // base64 url: ~1 токен на 4 символа base64 (уже кодировано)
          chars += (b.image_url?.url?.length ?? 0)
        } else {
          chars += (b.text ?? "").length
        }
      }
    }
    // служебные поля (role, tool_call_id и т.д.) — +20 токенов на сообщение
    chars += 60
  }
  return Math.ceil(chars / 3)
}

export async function compactIfNeeded(messages, client, force = false) {
  const { contextLimit } = getConfig()
  const tokens = estimateTokens(messages)

  if (!force && tokens < contextLimit * 0.8) return messages

  process.stdout.write(c.dim(`\n[compactor] Context ~${tokens} tokens, compacting...\n`))

  await runHooks("PreCompact", { tokenCount: tokens })

  // Системное сообщение оставляем, суммаризируем остальное
  const system = messages.find(m => m.role === "system")
  const rest = messages.filter(m => m.role !== "system")

  const summaryResponse = await client.chat.completions.create({
    model: getConfig().model,
    messages: [
      {
        role: "system",
        content: "Summarize the following conversation concisely, preserving all important technical details, decisions made, and current task state. End the summary with a section '## Next step:' that explicitly states what the assistant should do next to continue the task."
      },
      {
        role: "user",
        content: rest.map(m => `[${m.role}]: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`).join("\n")
      }
    ]
  })

  const summary = summaryResponse.choices[0].message.content
  process.stdout.write(c.dim(`[compactor] Compacted to summary.\n`))

  const compacted = []
  if (system) compacted.push(system)
  compacted.push({ role: "user", content: `[Previous conversation summary — continue the task described under "## Next step:" without asking for confirmation]:\n${summary}` })

  return compacted
}
