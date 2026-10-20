import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./components/ui/button";
import type { Asset, ProductionLine, Store } from "./domain";
import { confirmationIdentifier, type LifecycleRequest } from "./lifecycle";
import { translate, type Lang } from "./i18n";
export function RegistryRemoveAction({
  entity,
  type,
  store,
  lang,
  onAction,
  errorMessage,
}: {
  entity: Asset | ProductionLine;
  type: "asset" | "production_line";
  store: Store;
  lang: Lang;
  onAction: (r: LifecycleRequest) => Promise<boolean>;
  errorMessage?: string;
}) {
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k);
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const lock = useRef(false);
  if (!entity.archivedAt || entity.registryRemovedAt) return null;
  const identifier = confirmationIdentifier(entity);
  const historyCount =
    type === "asset"
      ? store.jobs.filter(
          (j) => j.assetId === entity.id && j.status === "completed",
        ).length
      : 0;
  return (
    <>
      <Button
        variant="ghost"
        className="danger-text"
        onClick={() => {
          setConfirmation("");
          setFailed(false);
          setOpen(true);
        }}
      >
        {t("removeRegistry")}
      </Button>
      <Dialog.Root
        open={open}
        onOpenChange={(value) => {
          if (!lock.current) setOpen(value);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog">
            <Dialog.Title>{t("removeRegistry")}</Dialog.Title>
            <Dialog.Description>
              {entity.name} · {identifier}
            </Dialog.Description>
            <p>{t("removeRegistryExplanation")}</p>
            {type === "asset" && (
              <p>
                {t("completedMaintenance")}: {historyCount}
              </p>
            )}
            <label>
              {t("confirmIdentifier")} · {identifier}
              <input
                disabled={busy}
                autoComplete="off"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            {failed && (
              <p role="alert">{errorMessage || t("lifecycleFailed")}</p>
            )}
            <div className="button-row">
              <Button
                disabled={busy || confirmation.trim() !== identifier}
                onClick={async () => {
                  if (lock.current) return;
                  lock.current = true;
                  setBusy(true);
                  setFailed(false);
                  try {
                    if (
                      await onAction({
                        kind: `${type}_remove_registry`,
                        data: { id: entity.id, confirmation },
                      })
                    )
                      setOpen(false);
                    else setFailed(true);
                  } catch {
                    setFailed(true);
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                {t("removeRegistry")}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
