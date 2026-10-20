import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./components/ui/button";
import { SearchSelect } from "./EquipmentPicker";
import {
  MaintenanceHistory,
  completionTime,
  historyName,
} from "./MaintenanceHistory";
import { local, translate, type Lang } from "./i18n";
import type { Fault, Job, Store } from "./domain";
import type {
  HistoryFilter,
  HistoryPage,
  HistoryOptions,
  HistoryResult,
  HistoryService,
} from "./data/historySearch";
export function KnowledgeSearch({
  service,
  store,
  lang,
  canWork,
  onRepeat,
  onAsset,
}: {
  service: HistoryService;
  store: Store;
  lang: Lang;
  canWork: boolean;
  onRepeat: (job: Job) => void;
  onAsset: (id: string) => void;
}) {
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k);
  const [filter, setFilter] = useState<HistoryFilter>({
    query: "",
    assetId: "",
    lineId: "",
    from: "",
    to: "",
    kind: "",
    page: 0,
  });
  const [result, setResult] = useState<HistoryPage | null>(null),
    [options, setOptions] = useState<HistoryOptions>({ assets: [], lines: [] }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false),
    [submitted, setSubmitted] = useState<HistoryFilter | null>(null),
    [record, setRecord] = useState<{
      row: HistoryResult;
      data: Job | Fault;
    } | null>(null);
  const generation = useRef(0),
    recordGeneration = useRef(0);
  useEffect(() => {
    let active = true;
    service
      .options()
      .then((o) => {
        if (active) setOptions(o);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      recordGeneration.current++;
    };
  }, [service]);
  useEffect(() => {
    if (!submitted) return;
    const ticket = ++generation.current;
    const controller = new AbortController();
    service
      .search(submitted, controller.signal)
      .then((page) => {
        if (ticket === generation.current && !controller.signal.aborted) {
          setResult(page);
          setLoading(false);
        }
      })
      .catch(() => {
        if (ticket === generation.current && !controller.signal.aborted) {
          setError(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [service, submitted]);
  function update(next: Partial<HistoryFilter>) {
    generation.current++;
    setFilter({ ...filter, ...next, page: 0 });
    setResult(null);
    setSubmitted(null);
    setLoading(false);
    setError(false);
  }
  function search(page = 0) {
    generation.current++;
    setResult(null);
    setError(false);
    setLoading(true);
    const next = { ...filter, page };
    setFilter(next);
    setSubmitted(next);
  }
  return (
    <div className="knowledge-search">
      <section className="card padded">
        <h2>{t("knowledgeTitle")}</h2>
        <p>{t("knowledgeDisclaimer")}</p>
        <form
          className="edit-form"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <label htmlFor="knowledge-query">{t("description")}</label>
          <textarea
            id="knowledge-query"
            maxLength={200}
            value={filter.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder={t("knowledgePlaceholder")}
          />
          <details>
            <summary>{t("knowledgeFilters")}</summary>
            <div className="form-grid">
              <SearchSelect
                lang={lang}
                label={t("equipment")}
                value={filter.assetId}
                options={options.assets}
                onChange={(v) => update({ assetId: v })}
              />
              <SearchSelect
                lang={lang}
                label={t("historicalLine")}
                value={filter.lineId}
                options={options.lines}
                onChange={(v) => update({ lineId: v })}
              />
              <label>
                {t("fromDate")}
                <input
                  type="date"
                  value={filter.from}
                  onChange={(e) => update({ from: e.target.value })}
                />
              </label>
              <label>
                {t("toDate")}
                <input
                  type="date"
                  min={filter.from}
                  value={filter.to}
                  onChange={(e) => update({ to: e.target.value })}
                />
              </label>
              <label>
                {t("type")}
                <select
                  value={filter.kind}
                  onChange={(e) =>
                    update({ kind: e.target.value as HistoryFilter["kind"] })
                  }
                >
                  <option value="">{t("all")}</option>
                  <option value="maintenance">
                    {t("completedMaintenance")}
                  </option>
                  <option value="fault">{t("faultRecords")}</option>
                </select>
              </label>
            </div>
          </details>
          <Button
            type="submit"
            disabled={loading || filter.query.trim().length < 2}
          >
            {t("find")}
          </Button>
        </form>
        {loading && <p role="status">{t("loading")}</p>}
        {error && <p role="alert">{t("knowledgeFailed")}</p>}
      </section>
      <section
        className="knowledge-results"
        aria-label={t("searchResults")}
        aria-busy={loading}
      >
        {result && !result.results.length && (
          <div className="card padded" role="status">
            {t("knowledgeEmpty")}
          </div>
        )}
        {result?.results.map((row) => (
          <article className="card padded" key={`${row.kind}-${row.id}`}>
            <span className="badge">
              {t(
                row.kind === "maintenance"
                  ? "completedMaintenance"
                  : "faultRecords",
              )}
            </span>
            <h2>{historyName(row.title, t("job"))}</h2>
            <h3>
              {historyName(row.assetName, t("equipment"))}
              {row.assetIdentifier ? ` · ${row.assetIdentifier}` : ""}{" "}
              {row.archived && <span className="badge">{t("archived")}</span>}
            </h3>
            <p>{completionTime(row.at, lang)}</p>
            {row.lineName && (
              <p>
                {t("historicalLine")}: {row.lineName}
              </p>
            )}
            {!row.metadataKnown && (
              <small>{t("unknownHistoricalPlacement")}</small>
            )}
            <dl>
              <dt>{t("symptoms")}</dt>
              <dd>{row.problem || "—"}</dd>
              <dt>{t("workDone")}</dt>
              <dd>{row.repair || "—"}</dd>
              {row.parts && (
                <>
                  <dt>{t("usedSupplies")}</dt>
                  <dd>{row.parts}</dd>
                </>
              )}
              {row.tools && (
                <>
                  <dt>{t("usedTools")}</dt>
                  <dd>{row.tools}</dd>
                </>
              )}
            </dl>
            <small>
              {t("knowledgeMatch")}:{" "}
              {row.matchedFields
                .map((field) =>
                  t(
                    field === "problem"
                      ? "symptoms"
                      : field === "repair"
                        ? "workDone"
                        : field === "title"
                          ? "name"
                          : "plannedSupplies",
                  ),
                )
                .join(", ") || t("knowledgeCombinedFields")}
            </small>
            <Button
              variant="outline"
              disabled={loading}
              onClick={async () => {
                const ticket = ++recordGeneration.current;
                setError(false);
                try {
                  const data = await service.record(row.kind, row.id);
                  if (recordGeneration.current === ticket)
                    setRecord({ row, data });
                } catch {
                  if (recordGeneration.current === ticket) setError(true);
                }
              }}
            >
              {t("openOriginalHistory")}
            </Button>
          </article>
        ))}
        {result && (
          <div className="button-row">
            <Button
              variant="outline"
              disabled={loading || filter.page === 0}
              onClick={() => search(filter.page - 1)}
            >
              {t("previousResults")}
            </Button>
            <span>{filter.page + 1}</span>
            <Button
              variant="outline"
              disabled={loading || !result.hasMore}
              onClick={() => search(filter.page + 1)}
            >
              {t("nextResults")}
            </Button>
          </div>
        )}
      </section>
      <Dialog.Root
        open={record !== null}
        onOpenChange={(open) => {
          if (!open) {
            recordGeneration.current++;
            setRecord(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog job-dialog">
            <Dialog.Title>{record?.row.title}</Dialog.Title>
            <Dialog.Description>{record?.row.assetName}</Dialog.Description>
            {record && (
              <>
                {record.row.kind === "maintenance" ? (
                  <>
                    <MaintenanceHistory
                      job={record.data as Job}
                      asset={record.row.assetName}
                      items={store.items}
                      lang={lang}
                    />
                    {canWork && (
                      <Button
                        onClick={() => {
                          const job = record.data as Job;
                          setRecord(null);
                          onRepeat(job);
                        }}
                      >
                        {t("repeatMaintenance")}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <p>{local((record.data as Fault).symptoms, lang)}</p>
                    <h3>{t("confirmedCause")}</h3>
                    <p>{local((record.data as Fault).cause, lang)}</p>
                  </>
                )}
                {store.assets.some((a) => a.id === record.row.assetId) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const id = record.row.assetId;
                      setRecord(null);
                      onAsset(id);
                    }}
                  >
                    {t("equipment")}: {record.row.assetName}
                  </Button>
                )}
              </>
            )}
            <Dialog.Close asChild>
              <Button variant="outline">{t("close")}</Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
