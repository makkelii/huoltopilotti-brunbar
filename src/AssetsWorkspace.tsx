import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Factory,
  MapPin,
  Plus,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { completionTime, historyName } from "./MaintenanceHistory";
import type { Asset, Job, ProductionLine, Store } from "./domain";
import { translate, type Lang } from "./i18n";

type View = "all" | "lines" | "unassigned";
export function AssetsWorkspace({
  store,
  lang,
  query,
  canManage,
  onCreateLine,
  onEditLine,
  onArchiveLine,
  onCreateAsset,
  onEditAsset,
  onHistory,
  onOpenJob,
  onClearSearch,
}: {
  store: Store;
  lang: Lang;
  query: string;
  canManage: boolean;
  onCreateLine: () => void;
  onEditLine: (line: ProductionLine) => void;
  onArchiveLine: (line: ProductionLine) => Promise<boolean>;
  onCreateAsset: (lineId: string) => void;
  onEditAsset: (asset: Asset) => void;
  onHistory: (asset: Asset) => void;
  onOpenJob: (job: Job) => void;
  onClearSearch?: () => void;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const [view, setView] = useState<View>("all");
  const [lineId, setLineId] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [detail, setDetail] = useState<"assets" | "open" | "history">("assets");
  const lines = store.productionLines || [];
  const line = lines.find((entry) => entry.id === lineId);
  const term = query.trim().toLocaleLowerCase();
  const matches = (...values: (string | undefined)[]) =>
    values.join(" ").toLocaleLowerCase().includes(term);
  const lineAssets = store.assets.filter(
    (asset) => asset.productionLineId === lineId,
  );
  const lineAssetIds = new Set(lineAssets.map((asset) => asset.id));
  const openJobs = store.jobs
    .filter(
      (job) => lineAssetIds.has(job.assetId) && job.status !== "completed",
    )
    .sort((a, b) => a.due.localeCompare(b.due));
  const history = store.jobs
    .filter(
      (job) => lineAssetIds.has(job.assetId) && job.status === "completed",
    )
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  const visibleAssets = (
    line
      ? lineAssets
      : store.assets.filter(
          (asset) => view !== "unassigned" || !asset.productionLineId,
        )
  ).filter((asset) => {
    const group = lines.find((entry) => entry.id === asset.productionLineId);
    return matches(
      asset.name,
      asset.serial,
      asset.location,
      group?.name,
      group?.identifier,
    );
  });
  function chooseLine(id: string) {
    onClearSearch?.();
    setLineId(id);
    setConfirmArchive(false);
    setDetail("assets");
  }
  function assetCards(assets: Asset[]) {
    return assets.length ? (
      <div className="equipment-grid">
        {assets.map((asset) => {
          const group = lines.find(
            (entry) => entry.id === asset.productionLineId,
          );
          const pending = store.jobs.filter(
            (job) => job.assetId === asset.id && job.status !== "completed",
          ).length;
          return (
            <section className="card asset-card equipment-card" key={asset.id}>
              <div className="equipment-card-title">
                <span className="equipment-icon">
                  <Box size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2>{asset.name}</h2>
                  {asset.serial && <small>{asset.serial}</small>}
                </div>
                <span className={`badge ${asset.status}`}>
                  {t(asset.status)}
                </span>
              </div>
              <div className="equipment-context">
                {group ? (
                  <button
                    className="text-button"
                    onClick={() => chooseLine(group.id)}
                  >
                    <Factory size={15} aria-hidden="true" />
                    {group.name}
                  </button>
                ) : (
                  <span>{t("noProductionLine")}</span>
                )}
                {asset.location && (
                  <span>
                    <MapPin size={14} aria-hidden="true" />
                    {asset.location}
                  </span>
                )}
              </div>
              <p className="equipment-work-count">
                {t("openMaintenance")}: <strong>{pending}</strong>
              </p>
              <details className="equipment-technical">
                <summary>{t("technicalDetails")}</summary>
                <dl>
                  {(
                    ["manufacturer", "model", "serial", "description"] as const
                  ).map(
                    (key) =>
                      asset[key] && (
                        <div key={key}>
                          <dt>{t(key)}</dt>
                          <dd>{asset[key]}</dd>
                        </div>
                      ),
                  )}
                </dl>
              </details>
              <div className="equipment-actions">
                <Button variant="outline" onClick={() => onHistory(asset)}>
                  {t("history")}
                  <ArrowRight size={15} aria-hidden="true" />
                </Button>
                {canManage && (
                  <Button variant="ghost" onClick={() => onEditAsset(asset)}>
                    {t("edit")}
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    ) : (
      <div className="card hierarchy-empty">
        <Box size={26} aria-hidden="true" />
        <h2>{t("noAssetsInView")}</h2>
        <p>{t(term ? "adjustAssetSearch" : "firstAssetHint")}</p>
      </div>
    );
  }
  if (lineId && !line)
    return (
      <section className="card hierarchy-empty">
        <h2>{t("lineUnavailable")}</h2>
        <Button variant="outline" onClick={() => chooseLine("")}>
          {t("backToEquipment")}
        </Button>
      </section>
    );
  return (
    <div className="assets-workspace">
      {!line && (
        <div className="hierarchy-toolbar">
          <div
            className="hierarchy-filters"
            role="group"
            aria-label={t("equipmentViews")}
          >
            {(["all", "lines", "unassigned"] as const).map((key) => (
              <Button
                key={key}
                variant={view === key ? "default" : "outline"}
                aria-pressed={view === key}
                onClick={() => {
                  setView(key);
                  setLineId(null);
                }}
              >
                {t(
                  key === "all"
                    ? "allEquipment"
                    : key === "lines"
                      ? "productionLines"
                      : "withoutProductionLine",
                )}
              </Button>
            ))}
          </div>
          {canManage && (
            <Button variant="outline" onClick={onCreateLine}>
              <Plus size={16} />
              {t("newProductionLine")}
            </Button>
          )}
        </div>
      )}
      {line ? (
        <>
          <button
            className="text-button hierarchy-back"
            onClick={() => {
              setLineId(null);
              setConfirmArchive(false);
              setView("lines");
            }}
          >
            <ArrowLeft size={16} />
            {t("productionLines")}
          </button>
          <section className="card production-line-overview">
            <div className="line-overview-heading">
              <span className="equipment-icon">
                <Factory size={24} aria-hidden="true" />
              </span>
              <div>
                {line.identifier && <small>{line.identifier}</small>}
                <h2>{line.name}</h2>
              </div>
              {canManage && (
                <Button variant="outline" onClick={() => onEditLine(line)}>
                  {t("editProductionLine")}
                </Button>
              )}
            </div>
            {line.location && (
              <p className="line-location">
                <MapPin size={16} />
                {line.location}
              </p>
            )}
            {line.description && (
              <p className="line-description">{line.description}</p>
            )}
            <dl className="line-summary">
              <div>
                <dt>{t("assets")}</dt>
                <dd>{lineAssets.length}</dd>
              </div>
              <div>
                <dt>{t("openMaintenance")}</dt>
                <dd>{openJobs.length}</dd>
              </div>
              <div>
                <dt>{t("completedMaintenance")}</dt>
                <dd>{history.length}</dd>
              </div>
            </dl>
            {canManage && (
              <div className="line-management">
                <Button
                  variant="outline"
                  onClick={() => onCreateAsset(line.id)}
                >
                  <Plus size={16} />
                  {t("addAssetToLine")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmArchive(!confirmArchive)}
                >
                  {t("archiveProductionLine")}
                </Button>
              </div>
            )}
            {confirmArchive && (
              <div className="archive-line-confirm" role="alert">
                <p>
                  {t("archiveLineExplanation")} ({lineAssets.length}{" "}
                  {t("assets").toLowerCase()})
                </p>
                <div className="button-row">
                  <Button
                    onClick={async () => {
                      if (await onArchiveLine(line)) {
                        setLineId(null);
                        setConfirmArchive(false);
                        setView("lines");
                      }
                    }}
                  >
                    {t("confirmArchiveLine")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmArchive(false)}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            )}
          </section>
          <div
            className="hierarchy-filters"
            role="group"
            aria-label={t("productionLineViews")}
          >
            {(["assets", "open", "history"] as const).map((key) => (
              <Button
                key={key}
                aria-pressed={detail === key}
                variant={detail === key ? "default" : "outline"}
                onClick={() => setDetail(key)}
              >
                {t(
                  key === "assets"
                    ? "assets"
                    : key === "open"
                      ? "openMaintenance"
                      : "history",
                )}
              </Button>
            ))}
          </div>
          {detail === "assets" ? (
            assetCards(visibleAssets)
          ) : (
            <section
              className="card line-job-list"
              aria-label={t(detail === "open" ? "openMaintenance" : "history")}
            >
              <p className="line-history-hint">{t("lineHistoryScope")}</p>
              {(detail === "open" ? openJobs : history)
                .filter((job) =>
                  matches(
                    job.name,
                    job.notes,
                    store.assets.find((asset) => asset.id === job.assetId)
                      ?.name,
                  ),
                )
                .map((job) => (
                  <button
                    key={job.id}
                    className="line-job"
                    onClick={() => onOpenJob(job)}
                  >
                    <span>
                      <strong>{historyName(job.name, t("job"))}</strong>
                      <span>
                        {historyName(
                          job.assetName ||
                            store.assets.find(
                              (asset) => asset.id === job.assetId,
                            )?.name,
                          t("equipment"),
                        )}
                      </span>
                      <small>
                        {detail === "history"
                          ? completionTime(job.completedAt, lang)
                          : new Intl.DateTimeFormat(lang, {
                              timeZone: "Europe/Helsinki",
                            }).format(new Date(`${job.due}T12:00:00Z`))}
                      </small>
                    </span>
                    <span className={`badge ${job.status}`}>
                      {t(job.status)}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              {!(detail === "open" ? openJobs : history).some((job) =>
                matches(
                  job.name,
                  job.notes,
                  store.assets.find((asset) => asset.id === job.assetId)?.name,
                ),
              ) && (
                <div className="hierarchy-empty">
                  <p>
                    {t(detail === "open" ? "noOpenLineJobs" : "noLineHistory")}
                  </p>
                </div>
              )}
            </section>
          )}
        </>
      ) : view === "lines" ? (
        <>
          {lines.filter((entry) =>
            matches(
              entry.name,
              entry.identifier,
              entry.location,
              entry.description,
            ),
          ).length ? (
            <div className="production-line-grid">
              {lines
                .filter((entry) =>
                  matches(
                    entry.name,
                    entry.identifier,
                    entry.location,
                    entry.description,
                  ),
                )
                .map((entry) => {
                  const ids = new Set(
                    store.assets
                      .filter((a) => a.productionLineId === entry.id)
                      .map((a) => a.id),
                  );
                  const pending = store.jobs.filter(
                    (j) => ids.has(j.assetId) && j.status !== "completed",
                  ).length;
                  return (
                    <button
                      className="card production-line-card"
                      key={entry.id}
                      onClick={() => chooseLine(entry.id)}
                    >
                      <Factory size={24} aria-hidden="true" />
                      <span>
                        {entry.identifier && <small>{entry.identifier}</small>}
                        <strong>{entry.name}</strong>
                        {entry.location && <span>{entry.location}</span>}
                        <small>
                          {ids.size} {t("assets").toLowerCase()} · {pending}{" "}
                          {t("openMaintenance").toLowerCase()}
                        </small>
                      </span>
                      <ArrowRight size={18} aria-hidden="true" />
                    </button>
                  );
                })}
            </div>
          ) : (
            <div className="card hierarchy-empty">
              <Factory size={26} aria-hidden="true" />
              <h2>{t("noProductionLines")}</h2>
              <p>
                {t(term ? "adjustAssetSearch" : "productionLineOptionalHint")}
              </p>
            </div>
          )}
        </>
      ) : (
        assetCards(visibleAssets)
      )}
    </div>
  );
}
