import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { FlippClient } from "./flipp-client.js";
import { loadConfig } from "./config.js";
import type { DealResult, FlyerResult } from "./types.js";
import { formatAllPolicies, getPriceMatchTips } from "./price-match.js";

function formatDeals(deals: DealResult[]): string {
  if (deals.length === 0) return "No deals found matching your criteria.";

  return deals
    .map((d) => {
      let line = `- **${d.store}**: ${d.item_name}`;
      if (d.price && d.price !== "See flyer") line += ` — ${d.price}`;
      if (d.valid_from && d.valid_to) line += ` (valid ${d.valid_from} to ${d.valid_to})`;
      if (d.description) line += `\n  ${d.description}`;
      return line;
    })
    .join("\n");
}

function formatFlyers(flyers: FlyerResult[]): string {
  if (flyers.length === 0) return "No active flyers found for your area/stores.";

  return flyers
    .map(
      (f) =>
        `- **${f.store}** [${f.categories.join(", ")}] — valid ${f.valid_from} to ${f.valid_to}`
    )
    .join("\n");
}

export function createServer(): McpServer {
  const config = loadConfig();
  const client = new FlippClient(config);

  const server = new McpServer({
    name: "flipp-bot",
    version: "1.0.0",
  });

  // Tool: search_deals
  server.tool(
    "search_deals",
    "Search for deals on a specific item across your preferred grocery stores. Example queries: 'chicken breast', 'ground beef', 'bananas'.",
    {
      query: z.string().describe("Item to search for (e.g. 'chicken breast', 'ground beef')"),
      stores: z
        .array(z.string())
        .optional()
        .describe("Specific stores to search. Omit to use preferred stores from config."),
    },
    async ({ query, stores }) => {
      try {
        const deals = await client.searchDeals(query, stores);
        return {
          content: [
            {
              type: "text" as const,
              text: `## Deals for "${query}"\n\n${formatDeals(deals)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error searching deals: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_weekly_deals
  server.tool(
    "get_weekly_deals",
    "Get all current flyer deals from your preferred stores. Optionally filter by a category keyword like 'meat', 'produce', 'dairy', etc.",
    {
      category: z
        .string()
        .optional()
        .describe("Category keyword to filter by (e.g. 'meat', 'produce', 'dairy')"),
      stores: z
        .array(z.string())
        .optional()
        .describe("Specific stores to check. Omit to use preferred stores from config."),
    },
    async ({ category, stores }) => {
      try {
        const deals = await client.getWeeklyDeals(category, stores);
        const title = category
          ? `## This Week's "${category}" Deals`
          : "## This Week's Deals";
        return {
          content: [
            {
              type: "text" as const,
              text: `${title}\n\n${formatDeals(deals)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching weekly deals: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: compare_prices
  server.tool(
    "compare_prices",
    "Compare prices for a specific item across all your preferred stores, sorted cheapest first.",
    {
      query: z.string().describe("Item to compare prices for (e.g. 'chicken breast')"),
    },
    async ({ query }) => {
      try {
        const deals = await client.comparePrices(query);
        const tips = getPriceMatchTips(deals);
        return {
          content: [
            {
              type: "text" as const,
              text: `## Price Comparison: "${query}"\n\n${formatDeals(deals)}${tips}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error comparing prices: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_price_match_info
  server.tool(
    "get_price_match_info",
    "Get price match policies for grocery stores. Shows which stores will match competitor flyer prices and their conditions.",
    {
      stores: z
        .array(z.string())
        .optional()
        .describe("Specific stores to check. Omit to show all known policies."),
    },
    async ({ stores }) => {
      try {
        const storeFilter = stores ?? config.preferred_stores;
        const text = formatAllPolicies(storeFilter);
        return {
          content: [
            {
              type: "text" as const,
              text: `## Price Match Policies\n\n${text}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching price match info: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_flyers
  server.tool(
    "get_flyers",
    "List all active flyers in your area from your preferred stores.",
    {
      stores: z
        .array(z.string())
        .optional()
        .describe("Specific stores to list flyers for. Omit to use preferred stores."),
    },
    async ({ stores }) => {
      try {
        const flyers = await client.getFlyers(stores);
        return {
          content: [
            {
              type: "text" as const,
              text: `## Active Flyers\n\n${formatFlyers(flyers)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching flyers: ${error}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}
