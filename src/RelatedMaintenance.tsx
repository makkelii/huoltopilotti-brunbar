import { useState } from "react";
import type { Job, Store } from "./domain";
import { translate, type Lang } from "./i18n";
import { MaintenanceHistory, completionTime } from "./MaintenanceHistory";
import { Button } from "./components/ui/button";

export function RelatedMaintenance({
  job,
  store,
  lang,
}: {
  job: Job;
  store: Store;
  lang: Lang;
}) {
  const [limit, setLimit] = useState(3);
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const previous = store.jobs
    .filter(
      (j) =>
        j.id !== job.id &&
        j.assetId === job.assetId &&
        j.status === "completed",
    )
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  return (
    <section
      className="related-maintenance"
      aria-label={t("previousMaintenance")}
    >
      <h3>{t("previousMaintenance")}</h3>
      <p>{t("sameEquipmentHistory")}</p>
      {!previous.length && <p>{t("noPreviousMaintenance")}</p>}
      {previous.slice(0, limit).map((prior) => (
        <details key={prior.id}>
          <summary>
            {prior.name} · {completionTime(prior.completedAt, lang)}
          </summary>
          <MaintenanceHistory
            job={prior}
            asset={prior.assetName || t("equipment")}
            items={store.items}
            lang={lang}
          />
        </details>
      ))}
      {previous.length > limit && (
        <Button variant="outline" onClick={() => setLimit((n) => n + 3)}>
          {t("moreHistory")}
        </Button>
      )}
    </section>
  );
}
