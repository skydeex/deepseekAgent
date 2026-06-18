import { getConfig } from "./config.js"
import { runHooks } from "./hooks.js"
import { c } from "./ui.js"
import { estimateTokens } from "./tokens.js"
import { todoReadTool } from "./tools/todo.js"
import { getModifiedFiles } from "./tracking.js"

export async function compactIfNeeded(messages, client, force = false) {
  const { contextLimit } = getConfig()
  const tokens = estimateTokens(messages)

  if (!force && tokens < contextLimit * 0.85) return messages

  process.stdout.write(c.dim(`\n[compactor] Context ~${tokens} tokens, starting checkpoint-restart...\n`))

  await runHooks("PreCompact", { tokenCount: tokens })

  const system = messages.find(m => m.role === "system")
  const nonSystem = messages.filter(m => m.role !== "system")

  const MSG_LIMIT = 1500
  // Collect indices of last 3 user messages — don't truncate them (most important context)
  const lastUserIndices = new Set()
  for (let i = nonSystem.length - 1; i >= 0 && lastUserIndices.size < 3; i--) {
    if (nonSystem[i].role === "user") lastUserIndices.add(i)
  }
  const historyText = nonSystem
    .map((m, i) => {
      const raw = typeof m.content === "string" ? m.content : JSON.stringify(m.content)
      const skip = lastUserIndices.has(i)
      const text = !skip && raw.length > MSG_LIMIT ? raw.slice(0, MSG_LIMIT) + `… [+${raw.length - MSG_LIMIT} chars]` : raw
      return `[${m.role}]: ${text}`
    })
    .join("\n")

  const todoText = await todoReadTool.execute()
  const todoBlock = todoText !== "No tasks."
    ? `\nCurrent TODO list (MUST be included in carry_forward verbatim):\n${todoText}\n`
    : ""

  const modifiedFiles = getModifiedFiles()
  const modifiedBlock = modifiedFiles.length
    ? `\nFiles modified this session (include in carry_forward):\n${modifiedFiles.map(f => `- ${f}`).join("\n")}\n`
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
            "what the next step is, any critical details (file paths, variable names, error " +
            "messages, decisions made), and ALL user-stated rules, constraints, warnings, and " +
            "explicit instructions (things the user said to always/never do — these MUST be " +
            "preserved verbatim in a separate '## User rules' section). Wrap your entire response " +
            "in <carry_forward>...</carry_forward> tags. Aim for 1500-3000 tokens — enough " +
            "detail to continue without confusion, not more."
        },
        {
          role: "user",
          content: historyText + todoBlock + modifiedBlock + "\n\nWrite the carry_forward briefing now."
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

    // Preserve last user message verbatim so agent knows exact latest instruction
    const lastUserMsg = [...nonSystem].reverse().find(m => m.role === "user")
    if (lastUserMsg) {
      const lastRaw = typeof lastUserMsg.content === "string" ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)
      if (lastRaw.length <= 2000) {
        newMessages.push({ role: "user", content: lastRaw })
        newMessages.push({ role: "assistant", content: "Understood, continuing with your last instruction." })
      }
    }

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
            content: "Summarize the following conversation concisely, preserving all important technical details, decisions made, current task state, and ALL user-stated rules, constraints, warnings, and explicit instructions (things the user said to always/never do — list them in a '## User rules' section). End the summary with a section '## Next step:' that explicitly states what the assistant should do next to continue the task."
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
      // Preserve last user message verbatim in fallback too
      const lastUserFallback = [...nonSystem].reverse().find(m => m.role === "user")
      if (lastUserFallback) {
        const lastFbRaw = typeof lastUserFallback.content === "string" ? lastUserFallback.content : JSON.stringify(lastUserFallback.content)
        if (lastFbRaw.length <= 2000) {
          fallback.push({ role: "user", content: lastFbRaw })
          fallback.push({ role: "assistant", content: "Understood, continuing with your last instruction." })
        }
      }
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
