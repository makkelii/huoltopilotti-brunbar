import { id, type Job, type Requirement, type Store } from "./domain";
import { local, type Lang } from "./i18n";
export type RepeatPlan = {
  name: string;
  description: string;
  instructions: string;
  duration: number;
  priority: Job["priority"];
  requirements: Requirement[];
  assetId: string;
  warnings: string[];
  suggestions: Requirement[];
};
export function repeatPlan(source: Job, store: Store, lang: Lang): RepeatPlan {
  if (source.status !== "completed") throw Error("completed source required");
  const warnings: string[] = [];
  const copy = (r: Requirement): Requirement => {
    const item = r.itemId
      ? store.items.find(
          (i) => i.id === r.itemId && !i.inactive && i.type === r.category,
        )
      : undefined;
    if (r.itemId && !item) warnings.push(local(r.label, lang));
    return {
      id: id(),
      category: r.category,
      label: [...r.label],
      quantity: r.category === "tools" ? 1 : r.quantity,
      state: "unchecked",
      ...(item ? { itemId: item.id } : {}),
    };
  };
  const requirements = (source.requirements || []).map(copy);
  const suggestions: Requirement[] = [];
  if (
    !requirements.some((r) =>
      ["parts", "consumables", "tools"].includes(r.category),
    )
  ) {
    for (const [itemId, amount] of Object.entries(source.actual || {})) {
      if (amount <= 0) continue;
      const frozen = source.usedItems?.find((i) => i.id === itemId);
      const current = store.items.find((i) => i.id === itemId);
      const name = frozen?.name || current?.name;
      if (!name) continue;
      const category = frozen?.type || current?.type || "parts";
      suggestions.push(
        copy({
          id: id(),
          category,
          label: [name, name, name],
          itemId,
          quantity: category === "tools" ? 1 : amount,
          state: "unchecked",
        }),
      );
    }
    for (const row of source.freeUsage || [])
      suggestions.push({
        id: id(),
        category: row.type,
        label: [row.name, row.name, row.name],
        quantity: row.type === "tools" ? 1 : row.quantity,
        state: "unchecked",
      });
  }
  return {
    name: source.name,
    description: source.description || "",
    instructions: source.instructions || "",
    duration: source.duration > 0 ? source.duration : 60,
    priority: source.priority,
    assetId:
      store.assets.find((a) => a.id === source.assetId && !a.archivedAt)?.id ||
      "",
    requirements,
    warnings,
    suggestions,
  };
}
