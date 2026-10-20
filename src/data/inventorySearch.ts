import type { Item } from "../domain";

export type InventoryGroup = "supplies" | "tools";
export const inventoryPageSize = 25;
export type InventoryPage = { items: Item[]; hasMore: boolean };
export type InventorySearch = (
  group: InventoryGroup,
  query: string,
  page: number,
  signal: AbortSignal,
) => Promise<InventoryPage>;

export function searchDemoInventory(
  items: Item[],
  group: InventoryGroup,
  query: string,
  page: number,
): InventoryPage {
  const term = query.trim().toLocaleLowerCase();
  if (term.length < 2) return { items: [], hasMore: false };
  const start = Math.max(0, page) * inventoryPageSize;
  // Stop after one extra match rather than sorting or rendering the full registry.
  const matches: Item[] = [];
  let skipped = 0;
  for (const item of items) {
    if (
      item.inactive ||
      (group === "tools" ? item.type !== "tools" : item.type === "tools")
    )
      continue;
    if (
      ![item.name, item.partNumber, item.id, item.externalId || ""].some(
        (value) => value.toLocaleLowerCase().includes(term),
      )
    )
      continue;
    if (skipped++ < start) continue;
    matches.push(item);
    if (matches.length > inventoryPageSize) break;
  }
  return {
    items: matches.slice(0, inventoryPageSize),
    hasMore: matches.length > inventoryPageSize,
  };
}

// Quote PostgREST filter values and escape LIKE metacharacters. Search text cannot
// inject an OR condition or turn literal %/_ into an unbounded wildcard search.
export function inventorySearchFilter(query: string): string {
  const pattern = `%${query
    .trim()
    .slice(0, 100)
    .replace(/[\\%_]/g, "\\$&")}%`;
  const value = `"${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const filters = ["name", "part_number", "data->>externalId", "data->>id"].map(
    (field) => `${field}.ilike.${value}`,
  );
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      query.trim(),
    )
  )
    filters.push(`id.eq.${query.trim()}`);
  return filters.join(",");
}
