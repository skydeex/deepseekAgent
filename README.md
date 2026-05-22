# DeepSeek Agent

A terminal AI agent powered by [DeepSeek API](https://platform.deepseek.com/) — an open-source alternative to Claude Code with minimal dependencies.

Reads files, writes and edits code, runs shell commands, searches the codebase, performs web search, and can spawn parallel sub-agents — all from the terminal.

[Русская документация](./README.ru.md)

## Quick Start

```bash
git clone https://github.com/skydeex/deepseekAgent.git
cd deepseekAgent
npm install
npm install -g .          # register the 'agent' command globally
copy .env.example .env   # Windows
# cp .env.example .env  # Linux / macOS
# add your DEEPSEEK_API_KEY to .env
agent
```

Get an API key: [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)

## Update

```bash
agent update
```

## Code Optimizer (built-in)

The agent includes a built-in code optimizer (ported from [claudeSearch](https://github.com/skydeex/claudeSearch)). Instead of reading entire files, it extracts only the parts you need — function outlines, individual method bodies, and context around specific lines. Saves 60–70% of tokens compared to full-file reads.

File reads are also deduplicated: if the model requests the same file again and the file hasn't changed (checked via mtime), the content is not added to context a second time. This prevents context bloat in long sessions, especially after compaction.

Enable with the `/optimizer` command in chat, or set `"optimizer": true` in `.agent/settings.json`. Run `/optimizer` again to disable.

| Tool | Description |
|---|---|
| `code_outline` | List all functions/methods in a file with line numbers |
| `code_definition` | Extract a specific function body (with 3 lines of context above) |
| `code_context` | Show N lines around a line number (target marked with `>>>`) |

**74 language parsers, 169 extensions:** PHP, JS/JSX/TS/TSX, Go, CSS/SCSS/SASS/LESS, Astro, Python, Ruby, Rust, Java, C#, Swift, Kotlin, Bash, C/C++, Objective-C, Lua, Dart, Scala, Elixir, Perl, PowerShell, Groovy, Zig, Haskell, R, OCaml, F#, Clojure, Erlang, Crystal, Nim, Julia, Vue, Svelte, HCL/Terraform, SQL, GraphQL, Prisma, PL/SQL, Cypher, Solidity, D, Fortran, Common Lisp, Racket, Tcl, Nix, VHDL, Millfork, PL/M-80, YAML, TOML, INI, LaTeX, Elm, Gleam, PureScript, Scheme, Lean, Idris, Assembly, Ada, Odin, Pascal, COBOL, Carbon, GLSL, Verilog, WAT, CMake, Makefile, CoffeeScript, Prolog, Smalltalk. For unsupported types the agent falls back to `read_file` automatically.

### Auto-generating support for a new language

When `code_outline` encounters an unknown file type, it offers to generate a parser automatically:

```
Learn to read the structure of .wren files? [Enter] yes  [a] always  [n] not now  [Esc] skip:
```

- **Enter** — generate once, preview the result, then confirm saving
- **a** — always generate without asking (saves `"generateParser": "always"` to settings)
- **n** — skip for this session
- **Esc** — skip silently

You can also ask the agent directly: *"add support for .wren files"* — it will call `generate_parser` automatically.

Control via `/parser` command or `"generateParser"` in `.agent/settings.json` (`"ask"` / `"always"` / `"never"`).

### Adding a parser manually

1. Create `src/parsers/mylang.js` (use `php.js` as a template):

```js
import { strip, esc } from "./utils.js"

export default {
  extensions: [".wren"],

  outline(lines) {
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*(?:\w+\s+)?(\w+)\s*\(/)
      if (m) results.push({ name: m[1] + "()", line: i + 1 })
    }
    return results
  },

  findMethodStart(lines, methodName) {
    const pattern = new RegExp(`^\\s*(?:\\w+\\s+)?${esc(methodName)}\\s*\\(`)
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) return i + 1
    }
    return null
  }
}
```

2. Register in `src/parsers/index.js`:

```js
import mylangParser from "./mylang.js"
register(mylangParser)
```

That's it — `code_outline` and `code_definition` will work with `.wren` files immediately.

## Requirements

- Node.js >= 18
- DeepSeek API key

## Usage

```bash
agent                                          # normal mode
agent --think                                  # extended thinking (deepseek-reasoner)
agent --worktree                               # git-isolated worktree
agent --output-format=json "prompt"           # CI / scripting — JSON output
```

## Slash Commands

Type directly in the chat:

| Command              | Description |
|----------------------|---|
| `/help`              | List all commands |
| `/clear`             | Reset context (= `/reset`, `/new`) |
| `/compact`           | Manually compact context via LLM |
| `/context`           | Context usage progress bar (= `/usage`) |
| `/export [file]`     | Save conversation history to a file |
| `/recap`             | Brief summary of the current session |
| `/btw <question>`    | Ask the model without adding to history |
| `/diff`              | Show `git diff HEAD` |
| `/rewind`            | Roll back to a checkpoint (= `/undo`, `/checkpoint`) |
| `/review [focus]`    | Send `git diff HEAD` to the agent for code review |
| `/security-review`   | Review for vulnerabilities (SQLi, XSS, command injection, etc.) |
| `/simplify [focus]`  | Three parallel agents: DRY, code quality, performance |
| `/batch <task>`      | Agent decomposes the task and runs subtasks in parallel |
| `/loop [N] <prompt>` | Run prompt every N seconds/minutes/hours; repeat `/loop` to stop |
| `/resume`            | Restore previous session (auto-saved on exit) |
| `/optimizer`         | Toggle code optimizer on/off |
| `/parser [sub]`      | Manage auto-generation of language support: `ask`/`always`/`never`/`gen <file>` |
| `/creative`          | Toggle precise mode (temperature=0) ↔ reasoning mode (temperature=0.5) |
| `/lang [code\|off]`  | Set response language (`ru`, `en`, `de`, …) or reset to auto-detect |
| `/model`             | Info about the current model |

## Tools

| Tool | Description |
|---|---|
| `read_file` | Reads a text file. Binary files (exe, zip, png, mp4, etc.) are blocked automatically |
| `write_file` | Creates or overwrites a file. Shows colored diff: removed lines on dark red, added on green |
| `edit_file` | Exact string replacement. Shows diff with 3 lines of context around the change |
| `glob` | Find files by pattern (`src/**/*.js`). Binary files and paths from ignore rules excluded |
| `grep` | Search file contents with regex support. Binary files skipped, ignore rules applied, limit 200 matches |
| `bash` | Run shell commands (sandboxed by default). Output truncated at 8,000 chars |
| `web_search` | DuckDuckGo search, no API key required |
| `todo_write` / `todo_read` | Task list with dependencies within a session |
| `task` | Spawn sub-agents: sync, parallel, or background |
| `code_outline` | List all functions/methods with line numbers (optimizer) |
| `code_definition` | Extract a single function body from a file (optimizer) |
| `code_context` | Show lines around a specific line number (optimizer) |
| `generate_parser` | Generate and install language support for an unknown file type (optimizer) |

## Search Ignore (.agentignore)

On first run the agent creates `.agentignore` in the project root. Both `glob` and `grep` respect it — matching paths are excluded before results are returned to the model.

The following files are read and merged (each overrides the previous):

| File | Source |
|---|---|
| `.agentignore` | Agent-specific (primary, auto-created) |
| `.claudeignore` | Claude Code |
| `.cursorignore` | Cursor |
| `.aiderignore` | Aider |
| `.copilotignore` | GitHub Copilot |

`node_modules/` and `.git/` are always excluded regardless of ignore files.

`.gitignore` is intentionally not read — it often lists generated files (`dist/`, `build/`, etc.) that the agent may need to inspect.

Syntax is the same as `.gitignore`: `node_modules/`, `*.log`, `/dist/`, etc. The patterns are loaded once at startup and cached for the session.

## Permissions

Tools with side effects (`write_file`, `edit_file`, `bash`) require confirmation before running.

**For file operations** (`write_file`, `edit_file`):
```
┌ [?] write_file → /project/src/utils.js
└ [y/Enter] once  [d] remember folder "/project/src"  [N] deny:
```
- `Enter` or `y` — allow once
- `d` — save folder to `.agent/settings.json`, won't ask again on next runs

**For bash and other tools**:
```
┌ [?] bash: {"command":"npm install"}
└ [y/Enter] once  [a] remember for this project  [N] deny:
```
- `a` — add tool to `alwaysAllow` in `.agent/settings.json`, won't ask again

Permissions are saved in `.agent/settings.json` of the current project:
```json
{
  "alwaysAllow": ["read_file", "glob", "grep", "todo_read", "bash"],
  "approvedDirs": ["src", "tests"]
}
```

## Configuration

Auto-created on first run at `.agent/settings.json`:

```json
{
  "model": "deepseek-chat",
  "thinkingModel": "deepseek-reasoner",
  "contextLimit": 60000,
  "alwaysAllow": ["read_file", "glob", "grep", "todo_read", "generate_parser"],
  "neverAllow": [],
  "disallowedTools": [],
  "dangerouslyDisableSandbox": false,
  "mcpServers": {},
  "language": null,
  "optimizer": false,
  "generateParser": "ask"
}
```

| Field | Description |
|---|---|
| `alwaysAllow` | Tools that run without confirmation |
| `neverAllow` | Tools that are always blocked |
| `disallowedTools` | Tools hidden from the model entirely |
| `dangerouslyDisableSandbox` | Remove bash sandbox restrictions |
| `mcpServers` | Connect MCP servers |
| `language` | Response language (e.g. `"Russian"`, `"English"`). If null — agent follows the user's language |
| `optimizer` | Enable code optimizer tools (`code_outline`, `code_definition`, `code_context`, `generate_parser`) |
| `generateParser` | When to auto-generate language support: `"ask"` (default), `"always"`, or `"never"` |

## Memory (AGENT.md)

The agent automatically reads these files and injects them into the system prompt:

| File | Purpose |
|---|---|
| `~/.agent/AGENT.md` | Global instructions for all projects |
| `.agent/AGENT.md` | Instructions for the current project |
| `AGENT.md` | Instructions in the repository root |

## MCP Servers

Connect any MCP server via `.agent/settings.json`:

```json
"mcpServers": {
  "fs": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
  }
}
```

Server tools are registered automatically as `mcp__fs__<tool>`.

## Hooks

Shell commands triggered on agent events (`.agent/hooks.json`):

```json
{
  "PreToolUse": [{ "command": "cat >> agent.log" }],
  "PostToolUse": [],
  "UserPromptSubmit": [],
  "PreCompact": [],
  "Stop": []
}
```

`PreToolUse` can block tool execution (exit code != 0).

## Switching Models

DeepSeek is used by default. Change `baseURL` in `src/agent.js` and `model` in `.agent/settings.json`:

```
DeepSeek (default)  baseURL: https://api.deepseek.com      model: deepseek-chat
OpenAI              no baseURL                              model: gpt-4o
Ollama (local)      baseURL: http://localhost:11434/v1      model: qwen2.5-coder
Groq                baseURL: https://api.groq.com/openai/v1 model: llama-3.3-70b-versatile
```

## JSON Mode (CI / Scripting)

```bash
agent --output-format=json "what does index.js do?"
echo "write hello world" | agent --output-format=json
```

Each event is a separate JSON line:

```json
{ "type": "text", "text": "response fragment" }
{ "type": "tool_call", "tool": "bash", "args": { "command": "ls" } }
{ "type": "tool_result", "tool": "bash", "result": "file1.js\nfile2.js" }
```

## Dependencies

| Package | Purpose |
|---|---|
| `openai` | DeepSeek API client (OpenAI-compatible) |
| `@modelcontextprotocol/sdk` | MCP client |
| `fast-glob` | File search in `glob` and `grep` |
| `dotenv` | `.env` loading |

## License

[See LICENSE](./LICENSE) — personal use only.
