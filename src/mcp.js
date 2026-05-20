import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { getConfig } from "./config.js"
import { c } from "./ui.js"

const mcpClients = []

// Подключается ко всем MCP-серверам из конфига, возвращает их инструменты
export async function loadMcpTools() {
  const { mcpServers } = getConfig()
  const tools = []

  for (const [name, cfg] of Object.entries(mcpServers)) {
    try {
      const transport = new StdioClientTransport({
        command: cfg.command,
        args: cfg.args ?? []
      })

      const client = new Client({ name: "deepseek-agent", version: "0.2.0" })
      await client.connect(transport)
      mcpClients.push(client)

      const { tools: serverTools } = await client.listTools()
      process.stdout.write(c.dim(`[mcp] Connected to "${name}" — ${serverTools.length} tools\n`))

      for (const tool of serverTools) {
        tools.push({
          name: `mcp__${name}__${tool.name}`,
          description: `[MCP:${name}] ${tool.description ?? ""}`,
          parameters: tool.inputSchema ?? { type: "object", properties: {} },
          isReadOnly: false,
          _mcpClient: client,
          _mcpToolName: tool.name,
          async execute(args) {
            const result = await this._mcpClient.callTool({
              name: this._mcpToolName,
              arguments: args
            })
            return result.content?.map(c => c.text ?? JSON.stringify(c)).join("\n") ?? ""
          }
        })
      }
    } catch (err) {
      process.stdout.write(c.red(`[mcp] Failed to connect to "${name}": ${err.message}\n`))
    }
  }

  return tools
}

export async function disconnectMcp() {
  for (const client of mcpClients) {
    try { await client.close() } catch {}
  }
}
