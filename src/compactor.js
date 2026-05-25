import { getConfig } from "./config.js"
import { runHooks } from "./hooks.js"
import { c } from "./ui.js"
import { estimateTokens } from "./tokens.js"

export async function compactIfNeeded(messages, client, force = false) {
  const { contextLimit } = getConfig()
  const tokens = estimateTokens(messages)

  if (!force && tokens < contextLimit * 0.9) return messages

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
  compacted.push({ role: "user", content: `[Previous conversation summary]:\n${summary}` })
  compacted.push({ role: "assistant", content: "Context restored." })
  compacted.push({ role: "user", content: "Continue the task. Immediately perform the next action using tools — do not summarize, do not ask for confirmation, just act." })

  return compacted
}
