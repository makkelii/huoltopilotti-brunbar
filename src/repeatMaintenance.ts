import { id, type Job, type Requirement, type Store } from "./domain";
import { local, translate, type Lang } from "./i18n";
export type RepeatPlan = {
  name: string;
  description: string;
  instructions: string;
  duration: number;
  priority: Job["priority"];
  requirements: Requirement[];
  assetId: string;
  warnings: string[];
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
  const planned = source.requirements || [];
  const actual: Requirement[] = [];
  const positive = (n: number | undefined): n is number =>
    typeof n === "number" && Number.isFinite(n) && n > 0;
  let hasActual = false;
  // Frozen usage is authoritative; older snapshots may only contain the actual map.
  const itemIds = new Set([
    ...(source.usedItems || []).map((i) => i.id),
    ...Object.keys(source.actual || {}),
  ]);
  for (const itemId of itemIds) {
    const frozen = source.usedItems?.find((i) => i.id === itemId);
    const amount = frozen ? frozen.usedQuantity : source.actual?.[itemId];
    if (!positive(amount)) continue;
    hasActual = true;
    const current = store.items.find((i) => i.id === itemId);
    const prior = planned.find((r) => r.itemId === itemId);
    const name =
      frozen?.name || current?.name || (prior && local(prior.label, lang));
    if (!name) {
      // Do not invent a name or expose an orphaned technical identifier.
      warnings.push(translate(lang, "unknownHistoryItem"));
      continue;
    }
    const category = frozen?.type || current?.type || prior?.category;
    if (!category || !["parts", "consumables", "tools"].includes(category))
      continue;
    actual.push(
      copy({
        id: "",
        category,
        label: [name, name, name],
        itemId,
        quantity: amount,
        state: "unchecked",
      }),
    );
  }
  for (const row of source.freeUsage || []) {
    const amount = row.type === "tools" ? 1 : row.quantity;
    if (!positive(amount) || !row.name.trim()) continue;
    hasActual = true;
    actual.push(
      copy({
        id: "",
        category: row.type,
        label: [row.name, row.name, row.name],
        quantity: amount,
        state: "unchecked",
      }),
    );
  }
  // Actual supplies replace the entire old supply plan, never its safety/work instructions.
  const requirements = hasActual
    ? [
        ...planned
          .filter(
            (r) => !["parts", "consumables", "tools"].includes(r.category),
          )
          .map(copy),
        ...actual,
      ]
    : planned.map(copy);
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
  };
}
