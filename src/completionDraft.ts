import type { FreeUsage, Item, Requirement } from "./domain";
import { local, type Lang } from "./i18n";

// A local proposal only. Completion and stock changes still require the existing RPC.
export function completionDraft(
  requirements: Requirement[],
  inventory: Item[],
  lang: Lang,
) {
  const actual: Record<string, number> = {};
  const freeUsage: FreeUsage[] = [];
  const unavailable: string[] = [];
  for (const row of requirements) {
    if (!["tools", "parts", "consumables"].includes(row.category)) continue;
    const name = local(row.label, lang).trim();
    if (!Number.isFinite(row.quantity) || row.quantity <= 0) {
      unavailable.push(name);
      continue;
    }
    if (row.itemId) {
      const item = inventory.find(
        (i) => i.id === row.itemId && !i.inactive && i.type === row.category,
      );
      if (!item) {
        // Never disguise a missing registry reference as stock-free usage.
        unavailable.push(name);
        continue;
      }
      actual[item.id] =
        item.type === "tools" ? 1 : (actual[item.id] || 0) + row.quantity;
    } else if (
      !name ||
      name.length > 200 ||
      freeUsage.length >= 100 ||
      row.quantity > 100000000
    ) {
      unavailable.push(name);
    } else {
      freeUsage.push(
        row.category === "tools"
          ? { type: "tools", name }
          : { type: "parts", name, quantity: row.quantity },
      );
    }
  }
  // Keep the planned amount visible even if stock is short; never silently clamp usage.
  return { actual, freeUsage, unavailable };
}
