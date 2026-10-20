import type { Item, Job } from "./domain";
import { local, translate, type Lang } from "./i18n";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function historyName(value: string | undefined, fallback: string) {
  return value && !uuid.test(value) ? value : fallback;
}
export function completionTime(value: string | undefined, lang: Lang) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  const date = new Date(value);
  if (lang === "fi") {
    const parts = new Intl.DateTimeFormat("fi-FI", {
      timeZone: "Europe/Helsinki",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value;
    return `${get("day")}.${get("month")}.${get("year")} klo ${get("hour")}.${get("minute")}`;
  }
  return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-GB", {
    timeZone: "Europe/Helsinki",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
export function MaintenanceHistory({
  job,
  asset,
  items,
  lang,
}: {
  job: Job;
  asset: string;
  items: Item[];
  lang: Lang;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const used =
    job.usedItems ??
    Object.entries(job.actual || {}).map(([key, quantity]) => {
      const item = items.find((i) => i.id === key);
      const requirement = job.requirements.find((r) => r.itemId === key);
      return {
        name:
          item?.name ||
          (requirement ? local(requirement.label, lang) : undefined),
        type:
          item?.type ||
          (requirement?.category === "tools" ? "tools" : undefined),
        usedQuantity: quantity,
        unit: item?.unit,
      };
    });
  const parts = used.filter((i) => i.type !== "tools" && i.usedQuantity > 0);
  const tools = used.filter((i) => i.type === "tools" && i.usedQuantity > 0);
  const freeParts = (job.freeUsage || []).filter((i) => i.type === "parts");
  const freeTools = (job.freeUsage || []).filter((i) => i.type === "tools");
  return (
    <article className="completion history-entry">
      <h3>
        {historyName(job.name, t("job"))} ·{" "}
        {historyName(job.assetName || asset, t("equipment"))}
      </h3>
      <dl className="history-facts">
        <div>
          <dt>{t("completedOn")}</dt>
          <dd>{completionTime(job.completedAt, lang)}</dd>
        </div>
        <div>
          <dt>{t("performedBy")}</dt>
          <dd>
            {historyName(
              job.performedBy || job.technician,
              t("unknownPerformer"),
            )}
          </dd>
        </div>
        <div>
          <dt>{t("actualMinutes")}</dt>
          <dd>
            {job.actualMinutes === undefined ? "—" : `${job.actualMinutes} min`}
          </dd>
        </div>
      </dl>
      {job.legacyReconstructed && (
        <p className="notice">{t("legacyHistory")}</p>
      )}
      <h4>{t("workDone")}</h4>
      <p className="history-text">{job.notes || "—"}</p>
      <h4>{t("usedSupplies")}</h4>
      {!parts.length && !freeParts.length ? (
        <p>—</p>
      ) : (
        <ul>
          {parts.map((item, index) => (
            <li key={index}>
              {historyName(item.name, t("unknownHistoryItem"))}:{" "}
              {item.usedQuantity} {item.unit || t("pieceUnit")}
            </li>
          ))}
          {freeParts.map((item, index) => (
            <li key={`free-${index}`}>
              {item.name}: {item.quantity} {t("pieceUnit")}
            </li>
          ))}
        </ul>
      )}
      <h4>{t("usedTools")}</h4>
      {!tools.length && !freeTools.length ? (
        <p>—</p>
      ) : (
        <ul>
          {tools.map((item, index) => (
            <li key={index}>
              {historyName(item.name, t("unknownHistoryItem"))}: {t("toolUsed")}
            </li>
          ))}
          {freeTools.map((item, index) => (
            <li key={`free-${index}`}>{item.name}</li>
          ))}
        </ul>
      )}
      {job.completionNotes && (
        <>
          <h4>{t("additionalNotes")}</h4>
          <p className="history-text">{job.completionNotes}</p>
        </>
      )}
    </article>
  );
}
