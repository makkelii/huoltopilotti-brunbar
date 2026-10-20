import type { Item, Job } from "./domain";
import { local, translate, type Lang } from "./i18n";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const readable = (value?: string) =>
  value && !uuid.test(value) ? value : "";
export function historyDate(value?: string, lang: Lang = "fi") {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "—";
  if (lang === "fi") {
    const parts = new Intl.DateTimeFormat("fi-FI", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Helsinki",
    }).formatToParts(new Date(value));
    const get = (key: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === key)?.value;
    return `${get("day")}.${get("month")}.${get("year")} klo ${get("hour")}.${get("minute")}`;
  }
  return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Helsinki",
  }).format(new Date(value));
}
export function MaintenanceHistory({
  job,
  asset,
  items,
  members = [],
  lang,
}: {
  job: Job;
  asset: string;
  items: Item[];
  members?: { userId: string; name: string }[];
  lang: Lang;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const performer = members.find((m) => m.userId === job.performerId)?.name;
  const name = readable(job.performedBy);
  const performedBy =
    name && !name.includes("@")
      ? name
      : readable(performer) ||
        name ||
        readable(job.technician) ||
        t("notRecorded");
  const used =
    job.usedItems ||
    Object.entries(job.actual || {})
      .filter(([, n]) => n > 0)
      .map(([key, n]) => {
        const planned = job.requirements.find((r) => r.itemId === key);
        const item = job.legacyReconstructed
          ? undefined
          : items.find((i) => i.id === key);
        return {
          id: key,
          name:
            readable(item?.name) ||
            (planned ? local(planned.label, lang) : t("unnamedHistoricalItem")),
          type: item?.type || planned?.category,
          usedQuantity: n,
          unit: item?.unit,
        };
      });
  const parts = used.filter((i) => i.type !== "tools");
  const tools = used.filter((i) => i.type === "tools");
  return (
    <article className="maintenance-summary">
      <dl className="history-facts">
        <div>
          <dt>{t("equipment")}</dt>
          <dd>
            {readable(job.assetName) || readable(asset) || t("notRecorded")}
          </dd>
        </div>
        <div>
          <dt>{t("completedOn")}</dt>
          <dd>{historyDate(job.completedAt, lang)}</dd>
        </div>
        <div>
          <dt>{t("performedBy")}</dt>
          <dd>{performedBy}</dd>
        </div>
        <div>
          <dt>{t("actualMinutes")}</dt>
          <dd>{job.actualMinutes ?? "—"}</dd>
        </div>
      </dl>
      <section>
        <h3>{t("workDone")}</h3>
        <p className="preserve-lines">{job.notes || t("notRecorded")}</p>
      </section>
      {(parts.length > 0 || job.freeUsage?.some((i) => i.type === "parts")) && (
        <section>
          <h3>{t("usedSupplies")}</h3>
          <ul>
            {parts.map((i) => (
              <li key={i.id}>
                {readable(i.name) || t("unnamedHistoricalItem")}:{" "}
                {i.usedQuantity} {i.unit || t("pieceUnit")}
              </li>
            ))}
            {job.freeUsage?.map(
              (i, n) =>
                i.type === "parts" && (
                  <li key={`free-${n}`}>
                    {i.name}: {i.quantity} {i.unit || t("pieceUnit")}
                  </li>
                ),
            )}
          </ul>
        </section>
      )}
      {(tools.length > 0 || job.freeUsage?.some((i) => i.type === "tools")) && (
        <section>
          <h3>{t("usedTools")}</h3>
          <ul>
            {tools.map((i) => (
              <li key={i.id}>
                {readable(i.name) || t("unnamedHistoricalItem")}
              </li>
            ))}
            {job.freeUsage?.map(
              (i, n) =>
                i.type === "tools" && <li key={`free-${n}`}>{i.name}</li>,
            )}
          </ul>
        </section>
      )}
      {job.completionNotes && (
        <section>
          <h3>{t("additionalNotes")}</h3>
          <p className="preserve-lines">{job.completionNotes}</p>
        </section>
      )}
    </article>
  );
}
