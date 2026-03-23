# Flipp Bot - MCP Server for Smart Flyer Filtering

## Problem

Flipp shows flyers from many stores, making it tedious to find deals on items you actually buy at stores you actually shop at. Even with search, you get results from irrelevant stores mixed in.

## Solution

Build an **MCP (Model Context Protocol) server** that Claude can use as a tool to search and filter Flipp flyer deals based on your preferences. You just talk to Claude naturally ("what chicken deals are there this week?") and it handles the rest.

## Research Findings

### Flipp API Access

Flipp does **not** have a public API, but their backend exposes undocumented endpoints:

**Endpoint 1 - Get Flyers by Postal Code:**
```
GET https://flyers-ng.flippback.com/api/flipp/data?locale=en&postal_code={postal_code}&sid={session_id}
```
- Returns list of all active flyers for a location
- Each flyer has: `id`, `merchant`, `categories`, `valid_from`, `valid_to`
- `sid` = random 16-digit number (no real auth needed)

**Endpoint 2 - Get Flyer Items:**
```
GET https://flyers-ng.flippback.com/api/flipp/flyers/{flyer_id}/flyer_items?locale=en&sid={session_id}
```
- Returns all items in a specific flyer
- Each item has: `name`, `price`, `valid_from`, `valid_to`

**Endpoint 3 - Search Items (older API, may still work):**
```
GET https://backflipp.wishabi.com/flipp/items/search?locale=en-ca&postal_code={postal_code}&q={query}
```
- Direct item search across all stores
- Returns item details including descriptions and prices

### Key Notes
- No API key or authentication required (just a random session ID)
- These are undocumented/unofficial endpoints used by Flipp's own frontend
- Rate limiting is unknown - should be respectful with request frequency
- API structure sourced from: [flippscrape](https://github.com/Kiizon/flippscrape), [flipp scraper gist](https://gist.github.com/jQwotos/37c54992881824d7084680ee91c9633c)

## Architecture

```
┌─────────────────┐     MCP Protocol      ┌──────────────────────┐
│  Claude Desktop  │ ◄──────────────────► │  flipp-bot MCP Server │
│  or Claude Code  │                       │  (TypeScript/Node.js) │
└─────────────────┘                       └──────────┬───────────┘
                                                     │
                                           ┌─────────▼─────────┐
                                           │   Flipp Backend    │
                                           │ flippback.com API  │
                                           └───────────────────┘
```

## MCP Tools to Expose

### 1. `search_deals`
Search for specific items across your preferred stores.
```
Input:  { query: "chicken breast", stores?: ["No Frills", "Walmart"] }
Output: Filtered list of matching deals with store, price, valid dates
```

### 2. `get_weekly_deals`
Get all current deals from your preferred stores, optionally filtered by category.
```
Input:  { category?: "meat", stores?: ["No Frills"] }
Output: All current flyer items from specified stores
```

### 3. `compare_prices`
Find the best price for an item across stores.
```
Input:  { query: "ground beef" }
Output: Sorted list of matching items by price, across preferred stores
```

### 4. `get_flyers`
List active flyers for your area.
```
Input:  { stores?: ["Walmart"] }
Output: Active flyers with merchant, category, valid dates
```

## User Config (`config.json`)

```json
{
  "postal_code": "YOUR_POSTAL_CODE",
  "locale": "en-ca",
  "preferred_stores": [
    "No Frills",
    "Loblaws",
    "Walmart",
    "FreshCo",
    "Food Basics",
    "Real Canadian Superstore"
  ],
  "watch_items": [
    "chicken breast",
    "ground beef",
    "bananas",
    "avocado",
    "strawberries",
    "blueberries"
  ],
  "max_results_per_query": 25
}
```

## Project Structure

```
flipp-bot/
├── package.json
├── tsconfig.json
├── config.json              # User preferences (postal code, stores, items)
├── src/
│   ├── index.ts             # MCP server entry point
│   ├── server.ts            # MCP server setup and tool definitions
│   ├── flipp-client.ts      # Flipp API client (HTTP requests)
│   ├── types.ts             # TypeScript types for API responses
│   └── config.ts            # Config loader
├── PLAN.md                  # This file
└── README.md                # Setup instructions (created later)
```

## Implementation Steps

1. **Initialize project** - `package.json`, `tsconfig.json`, dependencies (`@modelcontextprotocol/sdk`, `node-fetch`)
2. **Build Flipp API client** - HTTP client for the two flippback.com endpoints
3. **Define types** - TypeScript interfaces for flyers, items, config
4. **Build MCP server** - Register tools (`search_deals`, `get_weekly_deals`, `compare_prices`, `get_flyers`)
5. **Add config loading** - Read user preferences from `config.json`
6. **Test locally** - Verify API calls work and tools return expected data
7. **Document setup** - How to add to Claude Desktop / Claude Code MCP config

## How You'll Use It

After setup, in Claude Desktop or Claude Code:

> **You:** "What chicken deals are there this week?"
>
> **Claude:** *calls search_deals({ query: "chicken breast" })*
> "Here are the chicken breast deals this week:
> - **No Frills**: Boneless Chicken Breast $4.97/lb (valid Mar 20-26)
> - **Walmart**: Fresh Chicken Breast $5.47/lb (valid Mar 19-25)
> - **FreshCo**: Chicken Breast Family Pack $3.99/lb (valid Mar 20-26)"

> **You:** "What's good at No Frills this week?"
>
> **Claude:** *calls get_weekly_deals({ stores: ["No Frills"] })*
> "Here are the highlights from No Frills this week: ..."

## Status

- [x] Research Flipp API endpoints
- [x] Identify approach (MCP Server)
- [x] Document plan
- [ ] Initialize TypeScript project
- [ ] Build Flipp API client
- [ ] Build MCP server with tools
- [ ] Test end-to-end
- [ ] Document setup for Claude Desktop/Code
