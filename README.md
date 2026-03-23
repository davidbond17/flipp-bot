# Flipp Bot

An MCP server that lets Claude search and filter grocery flyer deals from [Flipp](https://flipp.com/). Instead of manually scrolling through dozens of store flyers, just ask Claude what's on sale.

## Setup

### 1. Install and build

```bash
npm install
npm run build
```

### 2. Configure your preferences

```bash
cp config.example.json config.json
```

Edit `config.json` with your details:
- **postal_code**: Your Canadian postal code or US ZIP code
- **preferred_stores**: Stores you actually shop at (deals from other stores are filtered out)
- **watch_items**: Items you buy regularly (used for context)
- **max_results_per_query**: Cap on results returned per tool call

### 3. Add to Claude Desktop

Edit your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac):

```json
{
  "mcpServers": {
    "flipp-bot": {
      "command": "node",
      "args": ["/absolute/path/to/flipp-bot/dist/index.js"]
    }
  }
}
```

### 3b. Or add to Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "flipp-bot": {
      "command": "node",
      "args": ["/absolute/path/to/flipp-bot/dist/index.js"]
    }
  }
}
```

### 4. Restart Claude and start chatting

## Tools

| Tool | Description | Example prompt |
|------|-------------|---------------|
| `search_deals` | Search for a specific item across stores | "Any deals on chicken breast this week?" |
| `get_weekly_deals` | Browse all deals, optionally by category | "What meat deals are there this week?" |
| `compare_prices` | Compare prices for an item across stores | "Where's the cheapest ground beef?" |
| `get_flyers` | List active flyers in your area | "What flyers are out this week?" |

## How it works

The server uses Flipp's internal APIs to fetch flyer data:

1. **Flyer listing** (`flyers-ng.flippback.com`) — gets all active flyers for your postal code
2. **Flyer items** — fetches individual items from each flyer
3. **Search** (`backflipp.wishabi.com`) — direct item search across stores

All results are filtered to your preferred stores and formatted for Claude to present clearly.

## Notes

- This uses undocumented Flipp APIs that could change without notice
- No API key or authentication is required
- Be respectful with request frequency — avoid excessive automated polling
- Flyer data is refreshed weekly by the stores themselves
