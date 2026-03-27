// Price match policies for major Canadian grocery stores.
// Source: publicly posted store policies (as of early 2026).
// These can vary by location — this covers the general national policy.

export interface PriceMatchPolicy {
  store: string;
  matches_competitors: boolean;
  details: string;
  conditions: string[];
}

export const PRICE_MATCH_POLICIES: PriceMatchPolicy[] = [
  {
    store: "No Frills",
    matches_competitors: true,
    details: "Matches all local competitor flyer prices.",
    conditions: [
      "Must show a valid competitor flyer (print or digital)",
      "Item must be identical (same brand, size, variety)",
      "Limit of one price match per item per customer",
      "Does not apply to clearance, liquidation, or pharmacy items",
    ],
  },
  {
    store: "Real Canadian Superstore",
    matches_competitors: true,
    details: "Matches all local competitor flyer prices.",
    conditions: [
      "Must show a valid competitor flyer (print or digital)",
      "Item must be identical (same brand, size, variety)",
      "Limit of one price match per item per customer",
      "Does not apply to clearance, liquidation, or pharmacy items",
    ],
  },
  {
    store: "FreshCo",
    matches_competitors: true,
    details: "Matches all local competitor flyer prices.",
    conditions: [
      "Must show a valid competitor flyer (print or digital)",
      "Item must be identical (same brand, size, variety)",
      "Does not match Walmart Rollback or clearance pricing",
    ],
  },
  {
    store: "Food Basics",
    matches_competitors: true,
    details: "Matches all local competitor flyer prices.",
    conditions: [
      "Must show a valid competitor flyer (print or digital)",
      "Item must be identical (same brand, size, variety)",
      "Does not match clearance or liquidation prices",
    ],
  },
  {
    store: "Walmart",
    matches_competitors: true,
    details: "Ad Match: matches local competitor advertised prices.",
    conditions: [
      "Must show a valid competitor flyer (print or digital)",
      "Item must be identical (same brand, size, variety)",
      "Does not match BOGO or buy-one-get-one offers",
      "Does not match percentage-off or dollar-off deals",
      "Does not match Thanksgiving/Christmas/Easter flyer prices at some locations",
    ],
  },
  {
    store: "Loblaws",
    matches_competitors: false,
    details: "Does NOT price match competitors.",
    conditions: [],
  },
  {
    store: "Metro",
    matches_competitors: false,
    details: "Does NOT price match competitors.",
    conditions: [],
  },
  {
    store: "Longo's",
    matches_competitors: false,
    details: "Does NOT price match competitors.",
    conditions: [],
  },
  {
    store: "Sobeys",
    matches_competitors: false,
    details: "Does NOT price match competitors.",
    conditions: [],
  },
  {
    store: "Farm Boy",
    matches_competitors: false,
    details: "Does NOT price match competitors.",
    conditions: [],
  },
  {
    store: "T&T Supermarket",
    matches_competitors: false,
    details: "Does NOT price match competitors.",
    conditions: [],
  },
];

/**
 * Look up the price match policy for a given store name.
 * Uses fuzzy substring matching (same as store filtering elsewhere).
 */
export function getPriceMatchPolicy(storeName: string): PriceMatchPolicy | undefined {
  const lower = storeName.toLowerCase();
  return PRICE_MATCH_POLICIES.find(
    (p) =>
      p.store.toLowerCase().includes(lower) ||
      lower.includes(p.store.toLowerCase())
  );
}

/**
 * Format all known price match policies as markdown.
 */
export function formatAllPolicies(storeFilter?: string[]): string {
  const policies = storeFilter?.length
    ? PRICE_MATCH_POLICIES.filter((p) =>
        storeFilter.some(
          (s) =>
            p.store.toLowerCase().includes(s.toLowerCase()) ||
            s.toLowerCase().includes(p.store.toLowerCase())
        )
      )
    : PRICE_MATCH_POLICIES;

  if (policies.length === 0) return "No price match policies found for the specified stores.";

  const matchers = policies.filter((p) => p.matches_competitors);
  const nonMatchers = policies.filter((p) => !p.matches_competitors);

  let output = "";

  if (matchers.length > 0) {
    output += "### Stores that price match\n\n";
    for (const p of matchers) {
      output += `**${p.store}** — ${p.details}\n`;
      for (const c of p.conditions) {
        output += `  - ${c}\n`;
      }
      output += "\n";
    }
  }

  if (nonMatchers.length > 0) {
    output += "### Stores that do NOT price match\n\n";
    for (const p of nonMatchers) {
      output += `- **${p.store}** — ${p.details}\n`;
    }
  }

  return output.trim();
}

/**
 * Given compare_prices results, add price match tips.
 * e.g. "Cheapest at FreshCo — No Frills and Walmart will match this price."
 */
export function getPriceMatchTips(results: { store: string; price: string }[]): string {
  if (results.length === 0) return "";

  const cheapestStore = results[0].store;
  const cheapestPolicy = getPriceMatchPolicy(cheapestStore);

  // Find which other stores in the results will price match
  const otherStores = results.slice(1).map((r) => r.store);
  const matchingStores = otherStores.filter((s) => {
    const policy = getPriceMatchPolicy(s);
    return policy?.matches_competitors;
  });

  if (matchingStores.length === 0) return "";

  const uniqueMatchers = [...new Set(matchingStores)];
  const storeList = uniqueMatchers.join(", ");

  // If the cheapest store itself doesn't price match, the tip is straightforward
  if (!cheapestPolicy?.matches_competitors) {
    return `\n\n> **Price match tip:** ${storeList} will match ${cheapestStore}'s price — bring the flyer!`;
  }

  // If cheapest store also matches, mention the others
  return `\n\n> **Price match tip:** ${storeList} will also match this price — bring the flyer!`;
}
