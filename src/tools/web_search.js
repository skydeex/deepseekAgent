export const webSearchTool = {
  name: "web_search",
  description: "Search the web and return a list of results with titles, URLs and snippets.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      limit: { type: "number", description: "Max results to return (default: 5)" }
    },
    required: ["query"]
  },
  isReadOnly: true,
  async execute({ query, limit = 5 }) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; deepseek-agent/0.1)" }
    })

    if (!res.ok) return `Search failed: HTTP ${res.status}`

    const html = await res.text()

    // Парсим результаты из HTML DuckDuckGo
    const results = []
    const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g

    let match
    while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
      const href = match[1]
      const title = match[2].trim()
      const snippet = match[3].replace(/<[^>]+>/g, "").trim()

      // DuckDuckGo оборачивает ссылки — извлекаем реальный URL
      const uddg = href.match(/uddg=([^&]+)/)
      const realUrl = uddg ? decodeURIComponent(uddg[1]) : href

      results.push(`${results.length + 1}. ${title}\n   ${realUrl}\n   ${snippet}`)
    }

    if (results.length === 0) return "No results found."

    return results.join("\n\n")
  }
}
