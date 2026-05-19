// Инструмент generate_parser — агент вызывает его когда пользователь просит
// добавить поддержку нового языка / сгенерировать парсер для конкретного файла.
//
// Не требует интерактивного диалога — пользователь уже подтвердил намерение
// самим фактом запроса к агенту.

import path from "path"
import { generateParserSilent } from "../parsers/generator.js"
import { getParser }            from "../parsers/index.js"

export const generateParserTool = {
  name: "generate_parser",
  description:
    "Generate and install a code parser for an unknown file type, enabling code_outline " +
    "and code_definition to work with it. Use when the user asks to 'add support for X', " +
    "'generate a parser for .xyz files', or 'make the optimizer work with this file'. " +
    "Provide a path to any sample file of that language — the parser is generated from its content. " +
    "The parser is saved to src/parsers/ and registered immediately (hot-reload, no restart needed).",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to a sample source file of the target language"
      }
    },
    required: ["path"]
  },
  isReadOnly: false,

  async execute({ path: filePath }) {
    const ext = path.extname(filePath).toLowerCase()

    if (!ext) {
      return `Cannot determine file type: no extension in "${filePath}".`
    }

    // Если парсер уже есть — сообщаем
    if (getParser(ext)) {
      return `Parser for ${ext} already exists. Use code_outline to test it on "${filePath}".`
    }

    let result
    try {
      result = await generateParserSilent(filePath)
    } catch (e) {
      return `Error generating parser: ${e.message}`
    }

    if (!result) {
      return (
        `Failed to generate a working parser for ${ext} files. ` +
        `The model could not produce code that matches the file's syntax. ` +
        `You can try again with a different sample file.`
      )
    }

    const preview = result.parser
      .outline((await import("fs")).readFileSync(filePath, "utf-8").split("\n"))
      .slice(0, 8)
      .map(it => `  L${it.line}: ${it.name}`)
      .join("\n")

    return (
      `Parser for ${result.langName} (${result.ext}) generated and installed.\n` +
      `Now code_outline and code_definition work with ${result.ext} files.\n\n` +
      `Sample outline of "${filePath}":\n${preview}`
    )
  }
}
