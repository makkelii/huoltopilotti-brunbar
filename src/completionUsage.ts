export type FreeUsage =
  | { type: "tools"; name: string }
  | { type: "parts"; name: string; quantity: number; unit?: string };

export function validateFreeUsage(value: FreeUsage[]): FreeUsage[] {
  if (!Array.isArray(value) || value.length > 100) throw Error("usage");
  return value.map((entry) => {
    const name = entry.name?.trim();
    if (!name || name.length > 200) throw Error("usage");
    if (entry.type === "tools") return { type: "tools", name };
    if (
      entry.type !== "parts" ||
      !Number.isFinite(entry.quantity) ||
      entry.quantity <= 0 ||
      entry.quantity > 100000000 ||
      (entry.unit?.length || 0) > 30
    )
      throw Error("usage");
    return {
      type: "parts",
      name,
      quantity: entry.quantity,
      unit: entry.unit?.trim() || "",
    };
  });
}
