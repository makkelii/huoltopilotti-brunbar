import type { Item, Job } from "./domain";
import { local, translate, type Lang } from "./i18n";

// Read-only preparation summary: no completion data or stock mutation.
export function PlannedKit({
  job,
  items,
  lang,
  compact = false,
}: {
  job: Job;
  items: Item[];
  lang: Lang;
  compact?: boolean;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  return (
    <span className={compact ? "planned-kit compact-kit" : "planned-kit"}>
      {(["tools", "supplies"] as const).map((group) => {
        const rows = job.requirements.filter((r) =>
          group === "tools"
            ? r.category === "tools"
            : r.category === "parts" || r.category === "consumables",
        );
        return (
          <span className="kit-group" key={group}>
            <strong>{t(group === "tools" ? "tools" : "plannedParts")}</strong>
            {!rows.length && <span>{t("noPlannedItems")}</span>}
            {rows.map((r) => {
              const item = items.find(
                (i) =>
                  i.id === r.itemId && i.type === r.category && !i.inactive,
              );
              const available =
                item && item.type !== "tools"
                  ? Math.max(0, item.quantity - item.reserved)
                  : null;
              return (
                <span className="kit-item" key={r.id}>
                  <span>
                    {local(r.label, lang)}
                    {r.category !== "tools" &&
                      ` · ${r.quantity} ${item?.unit || t("pieceUnit")}`}
                  </span>
                  {r.itemId && !item ? (
                    <small className="danger-text">
                      {t("inventoryUnavailable")}
                    </small>
                  ) : (
                    item && (
                      <small>
                        {item.location}
                        {available !== null && (
                          <span
                            className={
                              available < r.quantity ? "danger-text" : ""
                            }
                          >
                            {" "}
                            · {t("available")}: {available}{" "}
                            {item.unit || t("pieceUnit")}
                          </span>
                        )}
                        {!compact && item.spec && ` · ${item.spec}`}
                      </small>
                    )
                  )}
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}
