async function searchBrave(query, limit) {
  const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; deepseek-agent/0.1)" }
  })

  if (!res.ok) return []

  const html = await res.text()
  const results = []

  // Пробуем <div class="snippet">
  const snippetRegex = /<a[^>]+class="[^"]*result-header[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g
  let match
  while ((match = snippetRegex.exec(html)) !== null && results.length < limit) {
    const url = match[1].trim()
    const title = match[2].replace(/<[^>]+>/g, "").trim()
    const snippet = match[3].replace(/<[^>]+>/g, "").trim()
    if (url && title) {
      results.push(`${results.length + 1}. ${title}\n   ${url}\n   ${snippet}`)
    }
  }

  // Fallback: ищем <div class="snippet">
  if (results.length === 0) {
    const divRegex = /<div[^>]+class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/g
    while ((match = divRegex.exec(html)) !== null && results.length < limit) {
      const block = match[1]
      const titleMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/)
      const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/)
      if (titleMatch) {
        const url = titleMatch[1].trim()
        const title = titleMatch[2].trim()
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : ""
        results.push(`${results.length + 1}. ${title}\n   ${url}\n   ${snippet}`)
      }
    }
  }

  return results
}

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

    if (results.length === 0) {
      process.stdout.write("\x1b[2m  ↳ DuckDuckGo пусто, пробуем Brave...\x1b[0m\n")
      const braveResults = await searchBrave(query, limit)
      if (braveResults.length === 0) return "No results found."
      return braveResults.join("\n\n")
    }

    return results.join("\n\n")
  }
}
