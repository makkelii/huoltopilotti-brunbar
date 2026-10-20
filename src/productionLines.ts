import type { ProductionLine, Store } from "./domain";
export function saveProductionLine(store: Store, entry: ProductionLine): Store {
  const line = {
    ...entry,
    name: entry.name.trim(),
    identifier: entry.identifier.trim(),
    location: entry.location.trim(),
    description: entry.description.trim(),
  };
  const lines = store.productionLines || [];
  if (
    !line.name ||
    line.name.length > 120 ||
    line.identifier.length > 80 ||
    line.location.length > 200 ||
    line.description.length > 4000
  )
    throw Error("invalid");
  if (
    line.identifier &&
    lines.some(
      (l) =>
        l.id !== line.id &&
        l.identifier.toLowerCase() === line.identifier.toLowerCase(),
    )
  )
    throw Error("duplicate");
  return {
    ...store,
    productionLines: lines.some((l) => l.id === line.id)
      ? lines.map((l) => (l.id === line.id ? { ...l, ...line } : l))
      : [...lines, line],
  };
}
export function archiveProductionLine(store: Store, lineId: string): Store {
  if (!(store.productionLines || []).some((l) => l.id === lineId))
    throw Error("absent");
  return {
    ...store,
    productionLines: (store.productionLines || []).filter(
      (l) => l.id !== lineId,
    ),
    assets: store.assets.map((a) =>
      a.productionLineId === lineId ? { ...a, productionLineId: null } : a,
    ),
  };
}
