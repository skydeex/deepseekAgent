import { getConfig } from "./config.js"
import { runHooks } from "./hooks.js"
import { c } from "./ui.js"
import { estimateTokens } from "./tokens.js"
import { todoReadTool } from "./tools/todo.js"

export async function compactIfNeeded(messages, client, force = false) {
  const { contextLimit } = getConfig()
  const tokens = estimateTokens(messages)

  if (!force && tokens < contextLimit * 0.85) return messages

  process.stdout.write(c.dim(`\n[compactor] Context ~${tokens} tokens, starting checkpoint-restart...\n`))

  await runHooks("PreCompact", { tokenCount: tokens })

  const system = messages.find(m => m.role === "system")
  const nonSystem = messages.filter(m => m.role !== "system")
  const recent = nonSystem.slice(-6)

  const historyText = recent
    .map(m => `[${m.role}]: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`)
    .join("\n")

  const todoText = await todoReadTool.execute()
  const todoBlock = todoText !== "No tasks."
    ? `\nCurrent TODO list (MUST be included in carry_forward verbatim):\n${todoText}\n`
    : ""

  try {
    const carryResponse = await client.chat.completions.create({
      model: getConfig().model,
      messages: [
        {
          role: "system",
          content:
            "You are creating a context checkpoint. Write a concise briefing that will let you " +
            "continue the current task in a fresh context window. Be specific and technical. " +
            "Focus on: what the task is, what has been done, what exact state things are in, " +
            "what the next step is, and any critical details (file paths, variable names, error " +
            "messages, decisions made) that would be lost otherwise. Wrap your entire response " +
            "in <carry_forward>...</carry_forward> tags. Aim for 1500-3000 tokens — enough " +
            "detail to continue without confusion, not more."
        },
        {
          role: "user",
          content: historyText + todoBlock + "\n\nWrite the carry_forward briefing now."
        }
      ]
    })

    const raw = carryResponse.choices[0].message.content
    const match = raw.match(/<carry_forward>([\s\S]*?)<\/carry_forward>/)
    const briefing = match ? match[1].trim() : raw.trim()

    const newMessages = []
    if (system) newMessages.push(system)
    newMessages.push({ role: "user", content: "<carry_forward>\n" + briefing + "\n</carry_forward>" })
    newMessages.push({ role: "assistant", content: "Context restored. Continuing." })

    const newTokens = estimateTokens(newMessages)
    process.stdout.write(c.dim(`[compactor] Checkpoint complete. Context reset to ~${newTokens} tokens.\n`))

    return newMessages
  } catch (err) {
    process.stdout.write(c.dim(`[compactor] WARNING: carry_forward request failed (${err.message}), falling back to summary.\n`))

    try {
      const summaryResponse = await client.chat.completions.create({
        model: getConfig().model,
        messages: [
          {
            role: "system",
            content: "Summarize the following conversation concisely, preserving all important technical details, decisions made, and current task state. End the summary with a section '## Next step:' that explicitly states what the assistant should do next to continue the task."
          },
          {
            role: "user",
            content: nonSystem
              .map(m => `[${m.role}]: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`)
              .join("\n")
          }
        ]
      })

      const summary = summaryResponse.choices[0].message.content
      const fallback = []
      if (system) fallback.push(system)
      fallback.push({ role: "user", content: `[Previous conversation summary]:\n${summary}` })
      fallback.push({ role: "assistant", content: "Context restored." })
      fallback.push({ role: "user", content: "Continue the task. Immediately perform the next action using tools — do not summarize, do not ask for confirmation, just act." })
      return fallback
    } catch (fallbackErr) {
      process.stdout.write(c.dim(`[compactor] WARNING: fallback summary also failed (${fallbackErr.message}), returning last messages.\n`))
      const minimal = []
      if (system) minimal.push(system)
      for (const m of recent) minimal.push(m)
      return minimal
    }
  }
}
