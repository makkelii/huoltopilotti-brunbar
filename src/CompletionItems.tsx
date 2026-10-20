import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Search, Trash2, Wrench, Package } from "lucide-react";
import { Button } from "./components/ui/button";
import type { FreeUsage, Item, Requirement } from "./domain";
import { local, translate, type Lang } from "./i18n";
import type {
  InventoryGroup,
  InventoryPage,
  InventorySearch,
} from "./data/inventorySearch";

type Props = {
  lang: Lang;
  actual: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
  search: InventorySearch;
  requirements: Requirement[];
  inventory?: Item[];
  freeUsage?: FreeUsage[];
  onFreeUsageChange?: (value: FreeUsage[]) => void;
};

export function CompletionItems({
  lang,
  actual,
  onChange,
  search,
  requirements,
  inventory = [],
  freeUsage = [],
  onFreeUsageChange,
}: Props) {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const [manual, setManual] = useState<InventoryGroup | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualQuantity, setManualQuantity] = useState(1);
  const [selected, setSelected] = useState<Item[]>(() =>
    inventory.filter((item) => actual[item.id] !== undefined),
  );
  const [group, setGroup] = useState<InventoryGroup | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<InventoryPage>({
    items: [],
    hasMore: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const activeSearch = useRef(0);
  const term = query.trim();
  const title = (kind: InventoryGroup) =>
    t(kind === "tools" ? "usedTools" : "usedSupplies");

  useEffect(() => {
    const ticket = ++activeSearch.current;
    const controller = new AbortController();
    if (!group || term.length < 2) return;
    const timer = setTimeout(() => {
      search(group, term, page, controller.signal)
        .then((data) => {
          if (ticket !== activeSearch.current || controller.signal.aborted)
            return;
          setResult(data);
          setLoading(false);
        })
        .catch(() => {
          if (ticket !== activeSearch.current || controller.signal.aborted)
            return;
          setLoading(false);
          setError(true);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [group, query, page, search, retry]);

  function startSearch(value: string, nextPage = 0) {
    // Hide stale results immediately, before the debounce or next effect runs.
    activeSearch.current++;
    setQuery(value);
    setPage(nextPage);
    setResult({ items: [], hasMore: false });
    setError(false);
    setLoading(value.trim().length >= 2);
  }
  function remove(item: Item) {
    const next = { ...actual };
    delete next[item.id];
    onChange(next);
    setSelected((items) => items.filter((i) => i.id !== item.id));
  }
  return (
    <div className="completion-items">
      {(["supplies", "tools"] as const).map((kind) => (
        <section key={kind} aria-label={title(kind)} className="usage-section">
          <div className="usage-heading">
            <h3>
              {kind === "tools" ? <Wrench size={17} /> : <Package size={17} />}
              {title(kind)}
            </h3>
            <Button
              type="button"
              variant="outline"
              aria-label={t(kind === "tools" ? "addTool" : "addPart")}
              onClick={(event) => {
                opener.current = event.currentTarget;
                setManual(onFreeUsageChange ? kind : null);
                setManualName("");
                setManualQuantity(1);
                startSearch("");
                setGroup(kind);
              }}
            >
              <Plus size={16} />
              {t(kind === "tools" ? "addTool" : "addPart")}
            </Button>
          </div>
          {!selected.some((i) =>
            kind === "tools" ? i.type === "tools" : i.type !== "tools",
          ) &&
            !freeUsage.some((entry) =>
              kind === "tools"
                ? entry.type === "tools"
                : entry.type === "parts",
            ) && <p className="usage-hint">{t("noUsageSelected")}</p>}
          {selected
            .filter((i) =>
              kind === "tools" ? i.type === "tools" : i.type !== "tools",
            )
            .map((item) => (
              <div className="usage-row" key={item.id}>
                <div className="usage-description">
                  <strong>{item.name}</strong>
                  <small>{item.partNumber}</small>
                </div>
                {kind === "supplies" ? (
                  <div className="usage-amount">
                    <label>
                      {t("usedQuantity")}
                      <input
                        aria-label={`${t("usedQuantity")} · ${item.name}`}
                        type="number"
                        required
                        min="0"
                        aria-describedby={`usage-unit-${item.id}`}
                        max={Math.max(0, item.quantity - item.reserved)}
                        step="any"
                        value={actual[item.id] ?? ""}
                        onChange={(e) => {
                          const quantity = Number(e.target.value);
                          e.target.setCustomValidity(
                            Number.isFinite(quantity) && quantity > 0
                              ? ""
                              : t("positiveUsageQuantity"),
                          );
                          onChange({ ...actual, [item.id]: quantity });
                        }}
                      />
                    </label>
                    <span>
                      <small>{t("unit")}</small>
                      <span id={`usage-unit-${item.id}`}>
                        {item.unit || t("pieceUnit")}
                      </span>
                    </span>
                  </div>
                ) : (
                  <span className="badge ready">{t("toolUsed")}</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`${t("removeUsage")} · ${item.name}`}
                  onClick={() => remove(item)}
                >
                  <Trash2 size={17} />
                </Button>
              </div>
            ))}
          {freeUsage.map(
            (entry, index) =>
              (kind === "tools"
                ? entry.type === "tools"
                : entry.type === "parts") && (
                <div className="usage-row" key={`manual-${index}`}>
                  <strong>{entry.name}</strong>
                  {entry.type === "parts" && (
                    <label>
                      {t("usedQuantity")}
                      <input
                        aria-label={`${t("usedQuantity")} · ${entry.name}`}
                        type="number"
                        required
                        min="0.01"
                        max="100000000"
                        step="any"
                        value={entry.quantity}
                        onChange={(e) =>
                          onFreeUsageChange?.(
                            freeUsage.map((x, i) =>
                              i === index && x.type === "parts"
                                ? { ...x, quantity: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`${t("removeUsage")} · ${entry.name}`}
                    onClick={() =>
                      onFreeUsageChange?.(
                        freeUsage.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 size={17} />
                  </Button>
                </div>
              ),
          )}
          <p className="usage-hint">
            {t(kind === "tools" ? "toolsNotConsumed" : "stockUnitHint")}
          </p>
        </section>
      ))}
      {requirements.some((r) =>
        ["tools", "parts", "consumables"].includes(r.category),
      ) && (
        <details className="planned-usage">
          <summary>{t("plannedSupplies")}</summary>
          <p>{t("plannedNotUsed")}</p>
          <ul>
            {requirements
              .filter((r) =>
                ["tools", "parts", "consumables"].includes(r.category),
              )
              .map((r) => (
                <li key={r.id}>
                  {local(r.label, lang)}
                  {r.category !== "tools" && ` · ${r.quantity}`}
                  {(() => {
                    const item = inventory.find(
                      (i) => i.id === r.itemId && !i.inactive,
                    );
                    const used = r.itemId
                      ? actual[r.itemId] !== undefined
                      : freeUsage.some(
                          (x) =>
                            x.name === local(r.label, lang) &&
                            (x.type === "tools") === (r.category === "tools"),
                        );
                    const unavailable =
                      !!r.itemId &&
                      (!item ||
                        (item.type !== "tools" &&
                          item.quantity - item.reserved <= 0));
                    return (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          used ||
                          unavailable ||
                          (!r.itemId &&
                            (!onFreeUsageChange || freeUsage.length >= 100))
                        }
                        onClick={() => {
                          if (item) {
                            setSelected((rows) =>
                              rows.some((i) => i.id === item.id)
                                ? rows
                                : [...rows, item],
                            );
                            onChange({
                              ...actual,
                              [item.id]:
                                item.type === "tools"
                                  ? 1
                                  : Math.min(
                                      r.quantity,
                                      item.quantity - item.reserved,
                                    ),
                            });
                          } else if (!r.itemId)
                            onFreeUsageChange?.([
                              ...freeUsage,
                              r.category === "tools"
                                ? { type: "tools", name: local(r.label, lang) }
                                : {
                                    type: "parts",
                                    name: local(r.label, lang),
                                    quantity: r.quantity,
                                  },
                            ]);
                        }}
                      >
                        {t(
                          used
                            ? "alreadySelected"
                            : unavailable
                              ? "inventoryUnavailable"
                              : "useSuggestion",
                        )}{" "}
                        · {local(r.label, lang)}
                      </Button>
                    );
                  })()}
                </li>
              ))}
          </ul>
        </details>
      )}
      <Dialog.Root
        open={group !== null}
        onOpenChange={(open) => {
          if (!open) {
            activeSearch.current++;
            setGroup(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay usage-overlay" />
          <Dialog.Content
            className="dialog usage-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              opener.current?.focus();
            }}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              input.current?.focus();
            }}
          >
            <Dialog.Title>{group && title(group)}</Dialog.Title>
            <Dialog.Description>
              {t(manual ? "freeUsageHint" : "inventorySearchHelp")}
            </Dialog.Description>
            {onFreeUsageChange && (
              <div className="button-row">
                <Button
                  type="button"
                  variant={manual ? "default" : "outline"}
                  onClick={() => {
                    activeSearch.current++;
                    setManual(group);
                    setManualName("");
                    setManualQuantity(1);
                  }}
                >
                  {t("writeUsage")}
                </Button>
                <Button
                  type="button"
                  variant={!manual ? "default" : "outline"}
                  onClick={() => {
                    setManual(null);
                    startSearch("");
                  }}
                >
                  {t("chooseRegistry")}
                </Button>
              </div>
            )}
            {manual ? (
              <div className="manual-usage">
                <p>{t("freeUsageHint")}</p>
                <label>
                  {t("freeName")}
                  <input
                    ref={input}
                    maxLength={200}
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                  />
                </label>
                {manual === "supplies" && (
                  <label>
                    {t("usedQuantity")}
                    <input
                      type="number"
                      min="0"
                      max="100000000"
                      step="any"
                      value={manualQuantity}
                      onChange={(e) =>
                        setManualQuantity(Number(e.target.value))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                    />
                  </label>
                )}
                <Button
                  type="button"
                  disabled={
                    !manualName.trim() ||
                    freeUsage.length >= 100 ||
                    (manual === "supplies" &&
                      (!Number.isFinite(manualQuantity) ||
                        manualQuantity <= 0 ||
                        manualQuantity > 100000000))
                  }
                  onClick={() => {
                    onFreeUsageChange?.([
                      ...freeUsage,
                      manual === "tools"
                        ? { type: "tools", name: manualName.trim() }
                        : {
                            type: "parts",
                            name: manualName.trim(),
                            quantity: manualQuantity,
                          },
                    ]);
                    setGroup(null);
                    setManual(null);
                  }}
                >
                  {t("addUsage")}
                </Button>
              </div>
            ) : (
              <>
                <label className="usage-search">
                  <Search size={18} />
                  <span className="sr-only">{t("searchInventory")}</span>
                  <input
                    ref={input}
                    type="search"
                    maxLength={100}
                    value={query}
                    onChange={(e) => startSearch(e.target.value)}
                    placeholder={t("searchInventory")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                  />
                </label>
                <div role="status" aria-live="polite" className="usage-hint">
                  {loading
                    ? t("loading")
                    : error
                      ? ""
                      : term.length < 2
                        ? t("searchMinChars")
                        : result.items.length === 0
                          ? t("noInventoryResults")
                          : `${t("searchResults")}: ${result.items.length}`}
                </div>
                {error && (
                  <div role="alert">
                    <p>{t("inventorySearchFailed")}</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        startSearch(query, page);
                        setRetry((n) => n + 1);
                      }}
                    >
                      {t("retrySearch")}
                    </Button>
                  </div>
                )}
                <ul
                  className="usage-results"
                  aria-label={t("searchResults")}
                  aria-busy={loading}
                >
                  {result.items.map((item) => {
                    const exists = selected.some((i) => i.id === item.id);
                    const available = Math.max(
                      0,
                      item.quantity - item.reserved,
                    );
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="usage-result"
                          disabled={
                            exists ||
                            item.inactive ||
                            (item.type !== "tools" && available <= 0)
                          }
                          onClick={() => {
                            setSelected((items) => [...items, item]);
                            onChange({
                              ...actual,
                              [item.id]:
                                item.type === "tools"
                                  ? 1
                                  : Math.min(1, available),
                            });
                            activeSearch.current++;
                            setGroup(null);
                          }}
                        >
                          <span>
                            <strong>{item.name}</strong>
                            <small>
                              {t("partNumber")}: {item.partNumber || "—"} ·{" "}
                              {t(item.type)}
                            </small>
                            {item.externalId && (
                              <small>{item.externalId}</small>
                            )}
                            {exists && <small>{t("alreadySelected")}</small>}
                            {item.type !== "tools" && available <= 0 && (
                              <small>{t("inventoryUnavailable")}</small>
                            )}
                          </span>
                          {item.type !== "tools" && (
                            <span>
                              {t("availableStock")}: {available}{" "}
                              {item.unit || t("pieceUnit")}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="usage-pagination">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page === 0 || loading || error}
                    onClick={() => startSearch(query, page - 1)}
                  >
                    {t("previousResults")}
                  </Button>
                  <span>{page + 1}</span>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!result.hasMore || loading || error}
                    onClick={() => startSearch(query, page + 1)}
                  >
                    {t("nextResults")}
                  </Button>
                </div>
              </>
            )}
            <Dialog.Close asChild>
              <Button type="button" variant="outline">
                {t("close")}
              </Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
