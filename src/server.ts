import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { FlippClient } from "./flipp-client.js";
import { loadConfig } from "./config.js";
import type { DealResult, FlyerResult } from "./types.js";
import { formatAllPolicies, getPriceMatchTips, getPriceMatchPolicy } from "./price-match.js";
import { parsePrice } from "./flipp-client.js";

function formatDeals(deals: DealResult[]): string {
  if (deals.length === 0) return "No deals found matching your criteria.";

  return deals
    .map((d) => {
      let line = `- **${d.store}**: ${d.item_name}`;
      if (d.price && d.price !== "See flyer") line += ` — ${d.price}`;
      if (d.pre_price) {
        line += ` (was ${d.pre_price}`;
        if (d.savings) {
          line += `, save ${d.savings}`;
        }
        line += `)`;
      }
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

  // Tool: check_watch_list
  server.tool(
    "check_watch_list",
    "Check your watch list items against current flyer deals. Shows which of your frequently bought items are on sale this week, with price match tips.",
    {},
    async () => {
      try {
        if (config.watch_items.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Your watch list is empty. Add items to `watch_items` in config.json to track them.",
              },
            ],
          };
        }

        const sections: string[] = [];

        // Search for each watch item in parallel
        const results = await Promise.all(
          config.watch_items.map(async (item) => {
            const deals = await client.comparePrices(item);
            return { item, deals };
          })
        );

        for (const { item, deals } of results) {
          if (deals.length === 0) {
            sections.push(`### ${item}\nNo deals found this week.`);
          } else {
            const tips = getPriceMatchTips(deals);
            const lines = deals
              .slice(0, 5) // top 5 per item
              .map((d) => {
                let line = `- **${d.store}**: ${d.item_name}`;
                if (d.price && d.price !== "See flyer") line += ` — ${d.price}`;
                return line;
              })
              .join("\n");
            sections.push(`### ${item}\n${lines}${tips}`);
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `## Watch List Deals\n\n${sections.join("\n\n")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error checking watch list: ${error}` }],
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

  // Tool: build_shopping_list
  server.tool(
    "build_shopping_list",
    "Takes a list of items you need, finds the cheapest price for each across stores, and groups results by store to minimize trips. Factors in price matching so you can get everything at fewer stops.",
    {
      items: z
        .array(z.string())
        .describe("List of items to shop for (e.g. ['chicken breast', 'bananas', 'milk'])"),
    },
    async ({ items }) => {
      try {
        // Find best price for each item
        const itemResults = await Promise.all(
          items.map(async (item) => {
            const deals = await client.comparePrices(item);
            return { item, deals };
          })
        );

        // For each item, pick the best deal
        interface BestDeal {
          item: string;
          deal: DealResult;
          effectivePrice: number | null;
        }
        const bestDeals: BestDeal[] = [];
        const notFound: string[] = [];

        for (const { item, deals } of itemResults) {
          if (deals.length === 0) {
            notFound.push(item);
            continue;
          }
          bestDeals.push({
            item,
            deal: deals[0],
            effectivePrice: parsePrice(deals[0].price),
          });
        }

        // Group by store
        const storeGroups = new Map<string, BestDeal[]>();
        for (const bd of bestDeals) {
          const store = bd.deal.store;
          if (!storeGroups.has(store)) storeGroups.set(store, []);
          storeGroups.get(store)!.push(bd);
        }

        // Now optimize: if a store price-matches, we can consolidate
        // For each item, check if the store with most items will match the cheapest price
        const storesByItemCount = [...storeGroups.entries()].sort(
          (a, b) => b[1].length - a[1].length
        );

        // The store you're already visiting with the most items
        const primaryStore = storesByItemCount[0]?.[0];
        const primaryPolicy = primaryStore ? getPriceMatchPolicy(primaryStore) : undefined;

        let output = "## Shopping List\n\n";

        if (primaryPolicy?.matches_competitors && storeGroups.size > 1) {
          // Consolidation possible
          output += `> **Tip:** **${primaryStore}** price matches! You can get everything there by bringing competitor flyers.\n\n`;

          output += `### All items at ${primaryStore} (with price matching)\n\n`;
          for (const bd of bestDeals) {
            const atPrimary = bd.deal.store === primaryStore;
            let line = `- **${bd.item}**: ${bd.deal.item_name} — ${bd.deal.price}`;
            if (!atPrimary) {
              line += ` *(match ${bd.deal.store}'s flyer)*`;
            }
            output += line + "\n";
          }
        } else {
          // No consolidation — group by store
          for (const [store, deals] of storesByItemCount) {
            output += `### ${store} (${deals.length} item${deals.length > 1 ? "s" : ""})\n\n`;
            for (const bd of deals) {
              output += `- **${bd.item}**: ${bd.deal.item_name} — ${bd.deal.price}\n`;
            }
            output += "\n";
          }
        }

        if (notFound.length > 0) {
          output += `\n### Not found this week\n${notFound.map((i) => `- ${i}`).join("\n")}\n`;
        }

        return {
          content: [{ type: "text" as const, text: output.trim() }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error building shopping list: ${error}` }],
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
