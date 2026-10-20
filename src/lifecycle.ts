import type { Asset, ProductionLine, Store } from "./domain";
import { archiveProductionLine } from "./productionLines";
export type LifecycleKind =
  | "asset_remove_registry"
  | "production_line_remove_registry"
  | "asset_archive"
  | "asset_restore"
  | "asset_delete"
  | "production_line_archive"
  | "production_line_restore"
  | "production_line_delete";
export type LifecycleRequest = {
  kind: LifecycleKind;
  data: { id: string; productionLineId?: string | null; confirmation?: string };
};
export function assetDeletable(store: Store, asset: Asset) {
  return (
    asset.canDelete !== false &&
    !store.jobs.some((j) => j.assetId === asset.id) &&
    !store.faults.some((f) => f.assetId === asset.id) &&
    !store.items.some((i) => i.compatible.includes(asset.id)) &&
    !JSON.stringify([
      store.templateRequirements,
      store.templateHistory,
    ]).includes(asset.id)
  );
}
export function lineDeletable(store: Store, line: ProductionLine) {
  return (
    line.canDelete !== false &&
    !store.assets.some((a) => a.productionLineId === line.id)
  );
}
export function confirmationIdentifier(entity: Asset | ProductionLine) {
  return (
    ("serial" in entity ? entity.serial.trim() : entity.identifier.trim()) ||
    entity.name.trim()
  );
}
export function applyLifecycle(store: Store, request: LifecycleRequest): Store {
  const { kind, data } = request;
  if (
    kind === "asset_remove_registry" ||
    kind === "production_line_remove_registry"
  ) {
    const isAsset = kind === "asset_remove_registry";
    const entity = isAsset
      ? store.assets.find((a) => a.id === data.id)
      : store.archivedProductionLines?.find((l) => l.id === data.id);
    if (!entity?.archivedAt || entity.registryRemovedAt)
      throw Error("unavailable");
    if (data.confirmation?.trim() !== confirmationIdentifier(entity))
      throw Error("confirmation");
    if (
      isAsset &&
      store.jobs.some((j) => j.assetId === data.id && j.status !== "completed")
    )
      throw Error("openJobs");
    if (!isAsset && store.assets.some((a) => a.productionLineId === data.id))
      throw Error("dependencies");
    const removed = { ...entity, registryRemovedAt: new Date().toISOString() };
    return isAsset
      ? {
          ...store,
          assets: store.assets.filter((a) => a.id !== data.id),
          removedAssets: [...(store.removedAssets || []), removed as Asset],
        }
      : {
          ...store,
          archivedProductionLines: store.archivedProductionLines?.filter(
            (l) => l.id !== data.id,
          ),
          removedProductionLines: [
            ...(store.removedProductionLines || []),
            removed as ProductionLine,
          ],
        };
  }
  if (kind === "production_line_archive") {
    const line = store.productionLines?.find((l) => l.id === data.id);
    if (!line) throw Error("unavailable");
    return {
      ...archiveProductionLine(store, data.id),
      archivedProductionLines: [
        ...(store.archivedProductionLines || []),
        {
          ...line,
          archivedAt: new Date().toISOString(),
          canDelete: lineDeletable(store, line),
        },
      ],
    };
  }
  if (kind.startsWith("asset_")) {
    const asset = store.assets.find((a) => a.id === data.id);
    if (!asset) throw Error("unavailable");
    if (kind === "asset_delete") {
      if (!assetDeletable(store, asset)) throw Error("dependencies");
      if (
        !asset.archivedAt ||
        data.confirmation?.trim() !== confirmationIdentifier(asset)
      )
        throw Error("unavailable");
      return { ...store, assets: store.assets.filter((a) => a.id !== data.id) };
    }
    if (kind === "asset_archive") {
      if (asset.archivedAt) throw Error("unavailable");
      if (
        store.jobs.some(
          (j) => j.assetId === asset.id && j.status !== "completed",
        )
      )
        throw Error("openJobs");
      return {
        ...store,
        assets: store.assets.map((a) =>
          a.id === asset.id
            ? { ...a, archivedAt: new Date().toISOString() }
            : a,
        ),
      };
    }
    if (!asset.archivedAt) throw Error("unavailable");
    if (
      data.productionLineId &&
      !store.productionLines?.some((l) => l.id === data.productionLineId)
    )
      throw Error("unavailable");
    return {
      ...store,
      assets: store.assets.map((a) =>
        a.id === asset.id
          ? {
              ...a,
              archivedAt: null,
              productionLineId: data.productionLineId || null,
            }
          : a,
      ),
    };
  }
  const archived = store.archivedProductionLines || [];
  const line = [...(store.productionLines || []), ...archived].find(
    (l) => l.id === data.id,
  );
  if (!line) throw Error("unavailable");
  if (kind === "production_line_delete") {
    if (!lineDeletable(store, line)) throw Error("dependencies");
    if (
      !line.archivedAt ||
      data.confirmation?.trim() !== confirmationIdentifier(line)
    )
      throw Error("unavailable");
    return {
      ...store,
      productionLines: store.productionLines?.filter((l) => l.id !== line.id),
      archivedProductionLines: archived.filter((l) => l.id !== line.id),
    };
  }
  if (!line.archivedAt) throw Error("unavailable");
  if (
    line.identifier &&
    store.productionLines?.some(
      (l) =>
        l.identifier.trim().toLowerCase() ===
        line.identifier.trim().toLowerCase(),
    )
  )
    throw Error("duplicate");
  return {
    ...store,
    productionLines: [
      ...(store.productionLines || []),
      { ...line, archivedAt: null },
    ],
    archivedProductionLines: archived.filter((l) => l.id !== line.id),
  };
}
