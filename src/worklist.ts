import type { Store } from "./domain";
import { local, type Lang } from "./i18n";
import { inEquipmentScope } from "./EquipmentPicker";

export function worklist(
  store: Store,
  options: {
    filter: string;
    onlyMine: boolean;
    userName: string;
    onlyOverdue: boolean;
    today: string;
    assetId: string;
    scope: string;
    query: string;
    lang: Lang;
  },
) {
  const assets = new Map(
    [...store.assets, ...(store.removedAssets || [])].map((a) => [a.id, a]),
  );
  const activeIds = new Set(store.assets.map((a) => a.id));
  const lines = new Map((store.productionLines || []).map((l) => [l.id, l]));
  const terms = options.query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return store.jobs
    .filter((j) => {
      const a = assets.get(j.assetId),
        line = a?.productionLineId ? lines.get(a.productionLineId) : undefined;
      const late = j.status !== "completed" && !!j.due && j.due < options.today;
      if (!(
        options.filter === "all" ||
        (options.filter === "active" && j.status !== "completed") ||
        j.status === options.filter ||
        (options.filter === "overdue" && late)
      ))
        return false;
      if (
        (options.onlyMine && j.technician !== options.userName) ||
        (options.onlyOverdue && !late) ||
        (options.assetId && j.assetId !== options.assetId)
      )
        return false;
      if (
        !a ||
        (!activeIds.has(a.id) && j.status !== "completed") ||
        !inEquipmentScope(a, options.scope)
      )
        return false;
      const text = [
        j.name,
        j.description,
        a.name,
        a.serial,
        a.location,
        line?.name,
        line?.identifier,
        line?.location,
        ...j.requirements.map((r) => local(r.label, options.lang)),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return terms.every((term) => text.includes(term));
    })
    .sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (b.status === "completed" && a.status !== "completed") return -1;
      if (a.status === "completed")
        return (b.completedAt || "").localeCompare(a.completedAt || "");
      return (
        Number(b.priority === "high") - Number(a.priority === "high") ||
        (a.due || "9999").localeCompare(b.due || "9999") ||
        a.name.localeCompare(b.name)
      );
    });
}
