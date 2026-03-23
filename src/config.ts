import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { FlippBotConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_CONFIG: FlippBotConfig = {
  postal_code: "",
  locale: "en-ca",
  preferred_stores: [],
  watch_items: [],
  max_results_per_query: 25,
};

export function loadConfig(): FlippBotConfig {
  // Look for config.json in project root (one level up from src/dist)
  const configPath = resolve(__dirname, "..", "config.json");

  if (!existsSync(configPath)) {
    console.error(
      `No config.json found at ${configPath}. Using defaults. Copy config.example.json to config.json and fill in your details.`
    );
    return DEFAULT_CONFIG;
  }

  const raw = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<FlippBotConfig>;

  return {
    ...DEFAULT_CONFIG,
    ...parsed,
  };
}
