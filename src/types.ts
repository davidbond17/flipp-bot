// Flipp API response types

export interface FlippFlyer {
  id: number;
  merchant: string;
  categories: string[] | string;
  valid_from: string;
  valid_to: string;
  name?: string;
  flyer_type?: string;
}

export interface FlippFlyersResponse {
  flyers: FlippFlyer[];
}

export interface FlippItem {
  id: number;
  flyer_item_id?: number;
  name: string;
  description?: string;
  price?: string;
  pre_price?: string;
  savings?: string;
  valid_from?: string;
  valid_to?: string;
  image_url?: string;
  brand?: string;
  category?: string;
  merchant?: string;
  cutout_image_url?: string;
}

export interface FlippSearchResult {
  items: FlippItem[];
}

// Config types

export interface FlippBotConfig {
  postal_code: string;
  locale: string;
  preferred_stores: string[];
  watch_items: string[];
  max_results_per_query: number;
}

// Processed output types for tool responses

export interface DealResult {
  store: string;
  item_name: string;
  price: string;
  valid_from: string;
  valid_to: string;
  description?: string;
}

export interface FlyerResult {
  id: number;
  store: string;
  categories: string[];
  valid_from: string;
  valid_to: string;
}
