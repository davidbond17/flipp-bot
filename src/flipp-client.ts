import type {
  FlippFlyer,
  FlippFlyersResponse,
  FlippItem,
  FlippBotConfig,
  DealResult,
  FlyerResult,
} from "./types.js";

const FLYERS_URL =
  "https://flyers-ng.flippback.com/api/flipp/data";
const FLYER_ITEMS_URL =
  "https://flyers-ng.flippback.com/api/flipp/flyers/{flyerId}/flyer_items";
const SEARCH_URL =
  "https://backflipp.wishabi.com/flipp/items/search";

function generateSid(): string {
  let sid = "";
  for (let i = 0; i < 16; i++) {
    sid += Math.floor(Math.random() * 10).toString();
  }
  return sid;
}

function normalizeCategories(categories: string[] | string): string[] {
  if (Array.isArray(categories)) return categories;
  if (typeof categories === "string") {
    return categories.split(",").map((c) => c.trim());
  }
  return [];
}

function matchesStore(merchant: string, preferredStores: string[]): boolean {
  if (preferredStores.length === 0) return true;
  const merchantLower = merchant.toLowerCase();
  return preferredStores.some(
    (store) =>
      merchantLower.includes(store.toLowerCase()) ||
      store.toLowerCase().includes(merchantLower)
  );
}

export class FlippClient {
  private config: FlippBotConfig;

  constructor(config: FlippBotConfig) {
    this.config = config;
  }

  /**
   * Fetch all active flyers for the configured postal code.
   */
  async getFlyers(stores?: string[]): Promise<FlyerResult[]> {
    const sid = generateSid();
    const locale = this.config.locale.replace("-", "").substring(0, 2); // "en-ca" -> "en"
    const url = `${FLYERS_URL}?locale=${locale}&postal_code=${encodeURIComponent(this.config.postal_code)}&sid=${sid}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Flipp flyers API returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as FlippFlyersResponse;
    if (!data.flyers) return [];

    const filterStores = stores ?? this.config.preferred_stores;

    return data.flyers
      .filter((f) => matchesStore(f.merchant, filterStores))
      .map((f) => ({
        id: f.id,
        store: f.merchant,
        categories: normalizeCategories(f.categories),
        valid_from: f.valid_from,
        valid_to: f.valid_to,
      }));
  }

  /**
   * Fetch all items from a specific flyer.
   */
  async getFlyerItems(flyerId: number): Promise<FlippItem[]> {
    const sid = generateSid();
    const locale = this.config.locale.replace("-", "").substring(0, 2);
    const url = FLYER_ITEMS_URL.replace("{flyerId}", flyerId.toString()) +
      `?locale=${locale}&sid=${sid}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Flipp flyer items API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    // Response may be an array directly or wrapped in an object
    const items: FlippItem[] = Array.isArray(data) ? data : data.items ?? [];
    return items;
  }

  /**
   * Search for items using the backflipp search API.
   */
  async searchItems(query: string): Promise<FlippItem[]> {
    const url = `${SEARCH_URL}?locale=${encodeURIComponent(this.config.locale)}&postal_code=${encodeURIComponent(this.config.postal_code)}&q=${encodeURIComponent(query)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Flipp search API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const items: FlippItem[] = Array.isArray(data) ? data : data.items ?? [];
    return items;
  }

  /**
   * Search for deals on a specific item, filtered to preferred stores.
   * Uses the flyer-based approach: get flyers -> get items -> filter by query.
   */
  async searchDeals(query: string, stores?: string[]): Promise<DealResult[]> {
    const flyers = await this.getFlyers(stores);
    const queryLower = query.toLowerCase();
    const results: DealResult[] = [];

    // Fetch items from each flyer in parallel
    const flyerItemSets = await Promise.all(
      flyers.map(async (flyer) => {
        try {
          const items = await this.getFlyerItems(flyer.id);
          return { flyer, items };
        } catch {
          // If a single flyer fails, skip it
          return { flyer, items: [] as FlippItem[] };
        }
      })
    );

    for (const { flyer, items } of flyerItemSets) {
      for (const item of items) {
        const name = (item.name ?? "").toLowerCase();
        const desc = (item.description ?? "").toLowerCase();

        if (name.includes(queryLower) || desc.includes(queryLower)) {
          results.push({
            store: flyer.store,
            item_name: item.name,
            price: item.price ?? "See flyer",
            pre_price: item.pre_price,
            savings: item.savings,
            valid_from: item.valid_from ?? flyer.valid_from,
            valid_to: item.valid_to ?? flyer.valid_to,
            description: item.description,
          });
        }
      }
    }

    return results.slice(0, this.config.max_results_per_query);
  }

  /**
   * Get all deals from preferred stores this week, optionally filtered by category keyword.
   */
  async getWeeklyDeals(
    category?: string,
    stores?: string[]
  ): Promise<DealResult[]> {
    const flyers = await this.getFlyers(stores);
    const results: DealResult[] = [];
    const categoryLower = category?.toLowerCase();

    const flyerItemSets = await Promise.all(
      flyers.map(async (flyer) => {
        try {
          const items = await this.getFlyerItems(flyer.id);
          return { flyer, items };
        } catch {
          return { flyer, items: [] as FlippItem[] };
        }
      })
    );

    for (const { flyer, items } of flyerItemSets) {
      for (const item of items) {
        // If a category filter is given, only include items that match
        if (categoryLower) {
          const name = (item.name ?? "").toLowerCase();
          const desc = (item.description ?? "").toLowerCase();
          const cat = (item.category ?? "").toLowerCase();
          if (
            !name.includes(categoryLower) &&
            !desc.includes(categoryLower) &&
            !cat.includes(categoryLower)
          ) {
            continue;
          }
        }

        results.push({
          store: flyer.store,
          item_name: item.name,
          price: item.price ?? "See flyer",
          pre_price: item.pre_price,
          savings: item.savings,
          valid_from: item.valid_from ?? flyer.valid_from,
          valid_to: item.valid_to ?? flyer.valid_to,
          description: item.description,
        });
      }
    }

    return results.slice(0, this.config.max_results_per_query);
  }

  /**
   * Compare prices for an item across all preferred stores.
   * Returns results sorted by price (lowest first).
   */
  async comparePrices(query: string): Promise<DealResult[]> {
    const deals = await this.searchDeals(query);

    // Try to sort by numeric price
    return deals.sort((a, b) => {
      const priceA = parsePrice(a.price);
      const priceB = parsePrice(b.price);
      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1;
      if (priceB === null) return -1;
      return priceA - priceB;
    });
  }
}

/**
 * Try to extract a numeric price from a price string.
 * Handles formats like "$4.97", "4.97/lb", "$3.99", "2/$5", etc.
 */
export function parsePrice(price: string): number | null {
  if (!price || price === "See flyer") return null;

  // Handle "2/$5" style (return per-unit price)
  const multiMatch = price.match(/(\d+)\s*\/\s*\$?([\d.]+)/);
  if (multiMatch) {
    const qty = parseFloat(multiMatch[1]);
    const total = parseFloat(multiMatch[2]);
    if (qty > 0) return total / qty;
  }

  // Handle "$4.97" or "$4.97/lb" or "4.97"
  const match = price.match(/\$?([\d.]+)/);
  if (match) {
    const val = parseFloat(match[1]);
    if (!isNaN(val)) return val;
  }

  return null;
}
