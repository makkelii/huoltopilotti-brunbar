import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./components/ui/button";
import { SearchSelect } from "./EquipmentPicker";
import type { Asset, ProductionLine, Store } from "./domain";
import type { LifecycleRequest } from "./lifecycle";
import { translate, type Lang } from "./i18n";
export function LifecycleActions({
  entity,
  type,
  store,
  lang,
  onAction,
  showArchive = true,
  errorMessage,
}: {
  entity: Asset | ProductionLine;
  type: "asset" | "production_line";
  store: Store;
  lang: Lang;
  onAction: (request: LifecycleRequest) => Promise<boolean>;
  showArchive?: boolean;
  errorMessage?: string;
}) {
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k);
  const [action, setAction] = useState<"archive" | "restore" | null>(null),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [lineId, setLineId] = useState("");
  const lock = useRef(false);
  const openJobs =
    type === "asset"
      ? store.jobs.filter(
          (j) => j.assetId === entity.id && j.status !== "completed",
        ).length
      : 0;
  const title =
    action === "restore"
      ? t(type === "asset" ? "restoreAsset" : "restoreLine")
      : t("archiveAsset");
  const begin = (a: typeof action) => {
    setFailed(false);
    setAction(a);
    const prior = (entity as Asset).productionLineId;
    setLineId(store.productionLines?.some((l) => l.id === prior) ? prior! : "");
  };
  return (
    <div className="lifecycle-actions">
      {entity.archivedAt ? (
        <Button variant="outline" onClick={() => begin("restore")}>
          {t(type === "asset" ? "restoreAsset" : "restoreLine")}
        </Button>
      ) : (
        showArchive && (
          <Button variant="ghost" onClick={() => begin("archive")}>
            {t("archiveAsset")}
          </Button>
        )
      )}
      <Dialog.Root
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !lock.current) setAction(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog lifecycle-dialog">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>
              {entity.name} ·{" "}
              {type === "asset"
                ? (entity as Asset).serial || t("noSerial")
                : (entity as ProductionLine).identifier ||
                  t("noLineIdentifier")}
            </Dialog.Description>
            <p>
              {t(
                action === "restore"
                  ? type === "asset"
                    ? "restoreAssetExplanation"
                    : "restoreLineExplanation"
                  : "archiveAssetExplanation",
              )}
            </p>
            {action === "archive" && openJobs > 0 && (
              <p role="alert">
                {t("archiveOpenJobs")} ({openJobs})
              </p>
            )}
            {action === "restore" && type === "asset" && (
              <SearchSelect
                lang={lang}
                disabled={busy}
                label={t("productionLineOptional")}
                value={lineId}
                onChange={setLineId}
                options={(store.productionLines || []).map((l) => ({
                  value: l.id,
                  label: [l.name, l.identifier].filter(Boolean).join(" · "),
                }))}
              />
            )}
            {failed && (
              <p role="alert">{errorMessage || t("lifecycleFailed")}</p>
            )}
            <div className="button-row">
              <Button
                disabled={busy || (action === "archive" && openJobs > 0)}
                onClick={async () => {
                  if (lock.current || !action) return;
                  lock.current = true;
                  setBusy(true);
                  setFailed(false);
                  try {
                    if (
                      await onAction({
                        kind: `${type}_${action}`,
                        data: {
                          id: entity.id,
                          ...(type === "asset" && action === "restore"
                            ? { productionLineId: lineId || null }
                            : {}),
                        },
                      })
                    )
                      setAction(null);
                    else setFailed(true);
                  } catch {
                    setFailed(true);
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                {title}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                {t("cancel")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
