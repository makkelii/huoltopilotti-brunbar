import { applyLifecycle, type LifecycleRequest } from "./lifecycle";
import type { Requirement } from "./domain";
import {
  EquipmentPicker,
  inEquipmentScope,
  SearchSelect,
  equipmentLabel,
} from "./EquipmentPicker";
import { RequirementsEditor } from "./RequirementsEditor";
import { AssetsWorkspace } from "./AssetsWorkspace";
import { saveProductionLine } from "./productionLines";
import { Dashboard } from "./Dashboard";
import { workshopDate } from "./dashboard";
import { AppNavigation, isPage, type Page } from "./AppNavigation";
import {
  MaintenanceHistory,
  completionTime,
  historyName,
} from "./MaintenanceHistory";
import { Repository, type Snapshot, RepositoryError } from "./data/repository";
import { supabase } from "./data/supabase";
import { CompletionItems } from "./CompletionItems";
import { searchDemoInventory } from "./data/inventorySearch";
import { TemplateEditor } from "./TemplateEditor";
import {
  useEffect,
  useState,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Box,
  Wrench,
  Radio,
  BarChart3,
  ChevronRight,
  Plus,
  Search,
  ArrowRight,
  Sun,
  Moon,
  Menu,
  X,
  BookOpen,
  ShieldCheck,
  Download,
  CheckCircle2,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { translate, local, type Lang, type Key } from "./i18n";
import { seed, requirements } from "./seed";
import {
  id,
  readiness,
  matchFaults,
  completeJob,
  csv,
  normalizeFreeUsage,
  type FreeUsage,
  type Store,
  type Asset,
  type ProductionLine,
  type Job,
  type Item,
} from "./domain";
const storeKey = "huoltopilotti-demo-v1";
export default function App({
  initialSnapshot,
  repository,
  userName = "Aleksi Korhonen",
  onSignOut,
}: {
  initialSnapshot?: Snapshot;
  repository?: Repository;
  userName?: string;
  onSignOut?: () => Promise<void>;
} = {}) {
  const live = Boolean(repository),
    orgId = initialSnapshot?.organizationId || "demo",
    organizationName = initialSnapshot?.organizationName || "Nordic Works Oy";
  const snapshotRef = useRef(initialSnapshot),
    savingRef = useRef(false);
  const canManage =
    !live ||
    ["owner", "administrator"].includes(snapshotRef.current?.role || "");
  const [saving, setSaving] = useState(false),
    [inviteEmail, setInviteEmail] = useState(""),
    [inviteStatus, setInviteStatus] = useState("");
  const initials = userName.slice(0, 2).toUpperCase();

  const [store, setStore] = useState<Store>(() => {
    if (initialSnapshot) return initialSnapshot.store;
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) {
        const x = JSON.parse(raw);
        if (
          x.version === 1 &&
          Array.isArray(x.assets) &&
          Array.isArray(x.jobs) &&
          Array.isArray(x.items) &&
          Array.isArray(x.faults) &&
          Array.isArray(x.events)
        )
          return {
            ...x,
            templateRequirements: x.templateRequirements || requirements(),
            templateHistory: x.templateHistory || [],
          };
      }
    } catch {
      /* recover original demo */
    }
    return seed();
  });
  const searchCompletionInventory = useCallback(
    (
      group: "supplies" | "tools",
      query: string,
      page: number,
      signal: AbortSignal,
    ) =>
      repository
        ? repository.searchInventory(group, query, page, signal)
        : Promise.resolve(searchDemoInventory(store.items, group, query, page)),
    [repository, store.items],
  );
  const [lang, setLang] = useState<Lang>(() => {
    const v = localStorage.getItem("hp-lang");
    return v === "en" || v === "de" ? v : "fi";
  });
  const t = (key: Key) => {
    const k = live
      ? key === "demo"
        ? "privateMode"
        : key === "demoText"
          ? "persistentText"
          : key === "onboardingText"
            ? "helpText"
            : key === "limits"
              ? "noEvidence"
              : key === "saved"
                ? "serverSaved"
                : key
      : key;
    return translate(["fi", "en", "de"].includes(lang) ? lang : "fi", k);
  };
  const [page, setPage] = useState<Page>("dashboard"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("active"),
    [inventoryType, setInventoryType] = useState("all"),
    [itemType, setItemType] = useState<Item["type"]>("tools"),
    [dark, setDark] = useState(localStorage.getItem("hp-theme") === "dark"),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState<
      "asset" | "job" | "item" | "line" | "fault" | "onboarding" | "help" | null
    >(() => (localStorage.getItem("hp-welcome") ? null : "onboarding")),
    [editing, setEditing] = useState<
      Asset | Job | Item | ProductionLine | null
    >(null),
    [selected, setSelected] = useState<string | null>(null),
    [symptoms, setSymptoms] = useState(""),
    [searched, setSearched] = useState(false),
    [actual, setActual] = useState<Record<string, number>>({}),
    [listScope, setListScope] = useState("all"),
    [listAsset, setListAsset] = useState(""),
    [onlyMine, setOnlyMine] = useState(false),
    [onlyOverdue, setOnlyOverdue] = useState(false),
    [draftId, setDraftId] = useState<string>(() => id()),
    [jobScope, setJobScope] = useState("all"),
    [jobAsset, setJobAsset] = useState(""),
    [jobRequirements, setJobRequirements] = useState<Requirement[]>([]),
    [assetTarget, setAssetTarget] = useState<{
      assetId?: string;
      lineId?: string;
    } | null>(null),
    [newAssetLine, setNewAssetLine] = useState<string | null>(null),
    [historyAsset, setHistoryAsset] = useState<string | null>(null),
    [actualMinutes, setActualMinutes] = useState(60),
    [freeUsage, setFreeUsage] = useState<FreeUsage[]>([]),
    [completionNotes, setCompletionNotes] = useState(""),
    [notes, setNotes] = useState(""),
    [completion, setCompletion] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (live) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify(store));
    } catch {
      setError(
        lang === "fi"
          ? "Selaimen tallennustila ei ole käytettävissä."
          : lang === "de"
            ? "Browserspeicher nicht verfügbar."
            : "Browser storage is unavailable.",
      );
    }
  }, [store, lang, live]);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("hp-lang", lang);
  }, [lang]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("hp-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    const closeDesktopMenu = () => {
      if (window.innerWidth > 760) setMobile(false);
    };
    window.addEventListener("resize", closeDesktopMenu);
    return () => window.removeEventListener("resize", closeDesktopMenu);
  }, []);
  const go = (p: Page) => {
    setPage(p);
    setAssetTarget(null);
    setQuery("");
    setFilter("active");
    setListScope("all");
    setListAsset("");
    setOnlyMine(false);
    setOnlyOverdue(false);
    setMobile(false);
    window.location.hash = p;
  };
  useEffect(() => {
    const apply = () => {
      const p = location.hash.slice(1);
      if (isPage(p)) setPage(p);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  const change = async (
    next: Store,
    lifecycle?: LifecycleRequest,
  ): Promise<boolean> => {
    if (!repository) {
      setStore(next);
      setToast(t("saved"));
      return true;
    }
    if (savingRef.current || !snapshotRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const result = lifecycle
        ? await repository.lifecycle(snapshotRef.current, lifecycle)
        : await repository.save(snapshotRef.current, next);
      snapshotRef.current = result;
      setStore(result.store);
      setToast(t("serverSaved"));
      return true;
    } catch (e) {
      setError(
        t(
          e instanceof RepositoryError && e.code === "40001"
            ? "conflict"
            : e instanceof RepositoryError && e.code === "23505"
              ? "duplicateLineIdentifier"
              : e instanceof RepositoryError && e.code === "23503"
                ? "lifecycleDependencies"
                : e instanceof RepositoryError && e.code === "55006"
                  ? "archiveOpenJobs"
                  : e instanceof RepositoryError && e.code === "55000"
                    ? "lifecycleUnavailable"
                    : "saveError",
        ),
      );
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  async function lifecycle(request: LifecycleRequest) {
    try {
      return await change(applyLifecycle(store, request), request);
    } catch (e) {
      setError(
        t(
          e instanceof Error && e.message === "openJobs"
            ? "archiveOpenJobs"
            : e instanceof Error && e.message === "duplicate"
              ? "duplicateLineIdentifier"
              : e instanceof Error && e.message === "dependencies"
                ? "lifecycleDependencies"
                : "lifecycleUnavailable",
        ),
      );
      return false;
    }
  }
  async function refresh() {
    if (!repository || savingRef.current) return;
    const revisionAtStart = snapshotRef.current?.revision;
    const result = await repository.load();
    if (savingRef.current || snapshotRef.current?.revision !== revisionAtStart)
      return;
    snapshotRef.current = result;
    setStore(result.store);
    setError("");
  }
  useEffect(() => {
    if (!repository) return;
    const timer = setInterval(() => {
      if (
        !savingRef.current &&
        !modal &&
        !selected &&
        document.visibilityState === "visible"
      )
        void refresh().catch(() => setError(t("accessError")));
    }, 15000);
    return () => clearInterval(timer);
  }, [repository, modal, selected]);

  const open = (
    kind: "asset" | "job" | "item" | "line",
    entry: Asset | Job | Item | ProductionLine | null = null,
    lineId: string | null = null,
    assetId: string | null = null,
  ) => {
    if (
      live &&
      !canManage &&
      (kind === "asset" || kind === "item" || kind === "line")
    ) {
      setError(t("accessError"));
      return;
    }
    if (kind === "job" && !store.assets.some((a) => !a.archivedAt)) {
      setError(t("noEquipment"));
      return;
    }
    if (kind === "job") {
      if (live && snapshotRef.current?.role === "viewer") return;
      const previous = entry as Job | null;
      if (previous?.status === "completed") return;
      const selectedAsset = store.assets.find(
        (a) => !a.archivedAt && a.id === (previous?.assetId || assetId),
      );
      setJobAsset(selectedAsset?.id || "");
      setJobScope(
        selectedAsset
          ? selectedAsset.productionLineId ||
              (store.productionLines?.length ? "unassigned" : "all")
          : lineId || "all",
      );
      setJobRequirements(
        (previous?.requirements || store.templateRequirements).map((r) => ({
          ...r,
          label: [...r.label],
          state: previous ? r.state : "unchecked",
        })),
      );
    }
    setDraftId(entry?.id || id());
    setEditing(entry);
    if (kind === "asset") setNewAssetLine(lineId);
    if (kind === "item") setItemType((entry as Item | null)?.type || "tools");
    setModal(kind);
    setError("");
  };
  function navigateEquipment(target: { assetId?: string; lineId?: string }) {
    setSelected(null);
    setHistoryAsset(null);
    setCompletion(false);
    go("assets");
    setAssetTarget(target);
  }
  const active = store.jobs.filter((j) => j.status !== "completed"),
    today = workshopDate();
  const overdue = active.filter((j) => j.due < today);
  const chosen = store.jobs.find((j) => j.id === selected);
  const filteredJobs = store.jobs.filter(
    (j) =>
      (filter === "all" ||
        (filter === "active" && j.status !== "completed") ||
        j.status === filter ||
        (filter === "overdue" && j.due < today && j.status !== "completed")) &&
      (!onlyMine || j.technician === userName) &&
      (!onlyOverdue || (j.due < today && j.status !== "completed")) &&
      (!listAsset || j.assetId === listAsset) &&
      store.assets.some(
        (a) => a.id === j.assetId && inEquipmentScope(a, listScope),
      ) &&
      (j.name + " " + store.assets.find((a) => a.id === j.assetId)?.name)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const labelJob = (j: Job) => {
    const names: Record<string, Key> = {};
    return names[j.id] ? t(names[j.id]) : j.name;
  };
  const assetName = (assetId: string) =>
    store.assets.find((a) => a.id === assetId)?.name || "—";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      s = (k: string) => String(f.get(k) || "").trim();
    if (!s("name")) return;
    const entryId = editing?.id || draftId;
    let ok = false;
    if (modal === "line") {
      try {
        const next = saveProductionLine(store, {
          id: entryId,
          name: s("name"),
          identifier: s("identifier"),
          location: s("location"),
          description: s("description"),
        });
        ok =
          JSON.stringify(next.productionLines || []) ===
          JSON.stringify(store.productionLines || [])
            ? true
            : await change(next);
      } catch {
        setError(t("invalidProductionLine"));
        return;
      }
    } else if (modal === "asset") {
      const asset: Asset = {
        id: entryId,
        name: s("name"),
        manufacturer: s("manufacturer"),
        model: s("model"),
        serial: s("serial"),
        location: s("location"),
        description: s("description"),
        status: (editing as Asset | null)?.status || "operational",
        productionLineId: s("productionLineId") || null,
      };
      ok = await change({
        ...store,
        ...(!repository
          ? {
              productionLines: store.productionLines?.map((l) =>
                store.assets.some((a) => a.productionLineId === l.id) ||
                asset.productionLineId === l.id
                  ? { ...l, canDelete: false }
                  : l,
              ),
            }
          : {}),
        assets: editing
          ? store.assets.map((a) => (a.id === entryId ? asset : a))
          : [...store.assets, asset],
      });
    } else if (modal === "job") {
      const previous = editing as Job | null;
      if (
        !store.assets.some(
          (a) =>
            !a.archivedAt &&
            a.id === jobAsset &&
            inEquipmentScope(
              a,
              store.productionLines?.length ? jobScope : "all",
            ),
        )
      ) {
        setError(t("invalidEquipment"));
        return;
      }
      const job: Job = {
        id: entryId,
        name: s("name"),
        assetId: jobAsset,
        due: s("due"),
        priority: s("priority") as Job["priority"],
        status: previous?.status || "planned",
        technician: s("technician"),
        duration: Number(s("duration")),
        requirements: jobRequirements,
        instructions: s("instructions"),
        notes: previous?.notes || "",
        actual: previous?.actual || {},
        recurrence: Number(s("recurrence")),
        description: s("description"),
      };
      ok = await change({
        ...store,
        jobs: editing
          ? store.jobs.map((j) => (j.id === entryId ? job : j))
          : [...store.jobs, job],
      });
    } else if (modal === "item") {
      const item: Item = {
        id: entryId,
        name: s("name"),
        type: s("type") as Item["type"],
        quantity:
          s("type") === "tools"
            ? ((editing as Item | null)?.quantity ?? 0)
            : Number(s("quantity")),
        reserved: (editing as Item | null)?.reserved || 0,
        location: s("location"),
        spec: s("spec"),
        manufacturer: s("manufacturer"),
        partNumber: s("partNumber"),
        calibration: s("calibration"),
        compatible: s("compatible"),
        alternatives: s("alternatives"),
        unit:
          s("type") === "tools" ? (editing as Item | null)?.unit : s("unit"),
        externalId: s("externalId"),
        inactive: f.get("inactive") === "on",
      };
      ok = await change({
        ...store,
        items: editing
          ? store.items.map((i) => (i.id === entryId ? item : i))
          : [...store.items, item],
      });
    } else if (modal === "fault") {
      if (!store.assets.some((a) => a.id === s("assetId") && !a.archivedAt)) {
        setError(t("lifecycleUnavailable"));
        return;
      }
      const text = s("name"),
        cause = s("cause");
      ok = await change({
        ...store,
        faults: [
          ...store.faults,
          {
            id: entryId,
            orgId,
            assetId: s("assetId"),
            symptoms: [text, text, text],
            cause: [cause, cause, cause],
            check: [
              translate("fi", "safe"),
              translate("en", "safe"),
              translate("de", "safe"),
            ],
            verified: true,
            date: today,
          },
        ],
      });
    }
    if (ok) setModal(null);
  }
  async function finish() {
    if (!chosen || savingRef.current) return;
    try {
      const usage = normalizeFreeUsage(freeUsage);
      if (
        !(await change(
          repository
            ? {
                ...store,
                jobs: store.jobs.map((job) =>
                  job.id === chosen.id
                    ? {
                        ...job,
                        status: "completed" as const,
                        actual,
                        notes,
                        actualMinutes,
                        completionNotes,
                        freeUsage: usage,
                      }
                    : job,
                ),
              }
            : completeJob(
                store,
                chosen.id,
                actual,
                notes,
                actualMinutes,
                userName,
                completionNotes,
                usage,
              ),
        ))
      )
        return;
      setCompletion(false);
      setSelected(null);
      setError("");
    } catch {
      setError(t("stockError"));
    }
  }
  function exportCsv() {
    const rows = [
      [t("job"), t("equipment"), t("due"), t("status"), t("notes")],
      ...store.jobs.map((j) => [
        j.name,
        assetName(j.assetId),
        j.due,
        t(j.status),
        j.notes,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([csv(rows)], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "huoltopilotti.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const jobTable = (jobs: Job[]) => (
    <div className="table-scroll maintenance-table">
      <table>
        <thead>
          <tr>
            <th>{t("job")}</th>
            <th>{t("due")}</th>
            <th>{t("readiness")}</th>
            <th>{t("technician")}</th>
            <th>{t("status")}</th>
            <th>
              <span className="sr-only">{t("edit")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>
                <button
                  className="job-link"
                  onClick={() => {
                    setSelected(j.id);
                    setCompletion(false);
                    setActual({});
                    setNotes(j.notes);
                  }}
                >
                  <span
                    className={
                      "table-icon " + (j.priority === "high" ? "amber" : "")
                    }
                  >
                    <Wrench size={17} />
                  </span>
                  <span>
                    <strong>
                      {labelJob(j)}
                      {j.priority === "high" && (
                        <span className="badge high">{t("high")}</span>
                      )}
                    </strong>
                    <small>
                      {assetName(j.assetId)}{" "}
                      {store.assets.find((a) => a.id === j.assetId)?.archivedAt
                        ? ` · ${t("archived")}`
                        : ""}
                    </small>
                    {j.status !== "completed" && (
                      <small>
                        {
                          store.productionLines?.find(
                            (l) =>
                              l.id ===
                              store.assets.find((a) => a.id === j.assetId)
                                ?.productionLineId,
                          )?.name
                        }
                      </small>
                    )}
                    <small className="mobile-job-meta">
                      {new Date(j.due + "T12:00:00").toLocaleDateString(lang)} ·{" "}
                      {t(
                        j.due < today && j.status !== "completed"
                          ? "overdue"
                          : j.status,
                      )}{" "}
                      · {t(j.priority)} · {j.technician}
                    </small>
                  </span>
                </button>
              </td>
              <td>
                <span
                  className={
                    j.due < today && j.status !== "completed"
                      ? "danger-text"
                      : ""
                  }
                >
                  {new Date(j.due + "T12:00:00").toLocaleDateString(lang, {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                {j.due < today && j.status !== "completed" && (
                  <small className="danger-text">{t("overdue")}</small>
                )}
              </td>
              <td>
                <span className={"readiness-dot " + readiness(j)} />
                {t(readiness(j))}
              </td>
              <td>
                <span className="avatar tiny">
                  {j.technician
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <span className="technician">{j.technician}</span>
              </td>
              <td>
                <span className={"badge " + j.status}>{t(j.status)}</span>
              </td>
              <td>
                {j.status === "completed" ||
                (live && snapshotRef.current?.role === "viewer") ? (
                  <button
                    className="icon-button"
                    aria-label={t(j.status === "completed" ? "history" : "job")}
                    onClick={() => {
                      setSelected(j.id);
                      setCompletion(false);
                    }}
                  >
                    <ChevronRight size={18} />
                  </button>
                ) : (
                  <button
                    className="icon-button"
                    aria-label={t("edit")}
                    onClick={() => open("job", j)}
                  >
                    <ChevronRight size={18} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {jobs.length === 0 && <p className="empty">{t("empty")}</p>}
    </div>
  );
  return (
    <div className="app" aria-busy={saving}>
      {saving && (
        <div className="saving-overlay" role="status">
          {t("loading")}
        </div>
      )}
      <a className="skip" href="#main">
        {t("skipContent")}
      </a>
      <aside className="sidebar">
        <AppNavigation
          page={page}
          lang={lang}
          organizationName={organizationName}
          userName={userName}
          role={snapshotRef.current?.role || "technician"}
          live={live}
          onNavigate={go}
          onHelp={() => setModal("help")}
        />
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <Dialog.Root open={mobile} onOpenChange={setMobile}>
            <Dialog.Trigger asChild>
              <button
                className="icon-button mobile-menu"
                aria-label={t("menu")}
              >
                <Menu size={22} />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="navigation-overlay" />
              <Dialog.Content className="mobile-navigation">
                <Dialog.Title className="sr-only">
                  {t("primaryNavigation")}
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  {t("navigationHelp")}
                </Dialog.Description>
                <AppNavigation
                  mobile
                  page={page}
                  lang={lang}
                  organizationName={organizationName}
                  userName={userName}
                  role={snapshotRef.current?.role || "technician"}
                  live={live}
                  onNavigate={go}
                  onHelp={() => {
                    setMobile(false);
                    setModal("help");
                  }}
                />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <div className="breadcrumb">
            <strong>{t(page)}</strong>
          </div>
          <div className="top-actions">
            {!live && (
              <span className="demo-pill">
                <span />
                {t("demo")}
              </span>
            )}
            <select
              aria-label={t("language")}
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
            >
              <option value="fi">FI</option>
              <option value="en">EN</option>
              <option value="de">DE</option>
            </select>
            <button
              className="icon-button"
              aria-label={t("theme")}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="avatar small">{initials}</span>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "dashboard"
                  ? new Date().toLocaleDateString(lang, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      timeZone: "Europe/Helsinki",
                    })
                  : organizationName.toUpperCase()}
              </div>
              <h1>{t(page)}</h1>
              <p>
                {page === "dashboard"
                  ? t("dashboardIntro")
                  : page === "radar"
                    ? t("radarText")
                    : page === "inventory"
                      ? t("inventoryIntro")
                      : page === "assets"
                        ? t("assetsIntro")
                        : page === "jobs"
                          ? t("jobsIntro")
                          : page === "settings"
                            ? t("settingsIntro")
                            : t("workspaceTools")}
              </p>
            </div>
            {page === "radar" &&
              (!live || snapshotRef.current?.role !== "viewer") && (
                <Button
                  onClick={() => {
                    if (!store.assets.some((a) => !a.archivedAt)) {
                      setError(t("noEquipment"));
                      return;
                    }
                    setEditing(null);
                    setDraftId(id());
                    setModal("fault");
                  }}
                >
                  <Plus size={17} />
                  {t("newFault")}
                </Button>
              )}
            {page !== "radar" &&
              page !== "settings" &&
              (page === "assets" || page === "inventory"
                ? canManage
                : !live || snapshotRef.current?.role !== "viewer") && (
                <Button
                  onClick={() =>
                    page === "assets"
                      ? open("asset")
                      : page === "inventory"
                        ? open("item")
                        : page === "reports"
                          ? exportCsv()
                          : open("job")
                  }
                >
                  <Plus size={17} />
                  {page === "assets"
                    ? t("newAsset")
                    : page === "inventory"
                      ? t("addItem")
                      : page === "reports"
                        ? t("export")
                        : t("newJob")}
                </Button>
              )}
          </div>
          {error && !selected && !modal && (
            <p role="alert" className="global-error">
              {error}
            </p>
          )}
          {page === "dashboard" && (
            <Dashboard
              store={store}
              userName={userName}
              today={today}
              lang={lang}
              onOpen={(job) => {
                setSelected(job.id);
                setCompletion(false);
                setActual({});
                setNotes(job.notes);
                setError("");
              }}
              onAll={() => go("jobs")}
            />
          )}
          {(page === "jobs" || page === "assets" || page === "inventory") && (
            <div className="toolbar">
              <div className="search-field">
                <Search size={18} />
                <input
                  aria-label={t("search")}
                  placeholder={t("search")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {page === "jobs" && (
                <select
                  aria-label={t("status")}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">{t("allStatuses")}</option>
                  <option value="active">{t("activeJobs")}</option>
                  {(
                    ["planned", "progress", "completed", "overdue"] as const
                  ).map((s) => (
                    <option key={s} value={s}>
                      {t(s)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {page === "jobs" && (
            <>
              <div className="job-filters">
                {!!store.productionLines?.length && (
                  <SearchSelect
                    label={t("productionLines")}
                    value={listScope}
                    onChange={(v) => {
                      const next = v || "all";
                      setListScope(next);
                      if (
                        !store.assets.some(
                          (a) =>
                            a.id === listAsset && inEquipmentScope(a, next),
                        )
                      )
                        setListAsset("");
                    }}
                    options={[
                      { value: "all", label: t("allEquipment") },
                      { value: "unassigned", label: t("noProductionLine") },
                      ...store.productionLines.map((l) => ({
                        value: l.id,
                        label: [l.name, l.identifier]
                          .filter(Boolean)
                          .join(" · "),
                      })),
                    ]}
                  />
                )}
                <SearchSelect
                  key={listScope}
                  lang={lang}
                  label={t("equipment")}
                  value={listAsset}
                  onChange={setListAsset}
                  options={store.assets
                    .filter((a) => inEquipmentScope(a, listScope))
                    .map((a) => ({
                      value: a.id,
                      label:
                        equipmentLabel(a) +
                        (a.archivedAt ? ` · ${t("archived")}` : ""),
                    }))}
                />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={onlyMine}
                    onChange={(e) => setOnlyMine(e.target.checked)}
                  />
                  {t("myJobs")}
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={onlyOverdue}
                    onChange={(e) => setOnlyOverdue(e.target.checked)}
                  />
                  {t("overdue")}
                </label>
                <Button variant="outline" onClick={() => go("templates")}>
                  {t("templates")}
                </Button>
              </div>
              <section className="card">
                {jobTable(filteredJobs)}
                {!filteredJobs.length && (
                  <p className="empty-state">
                    {t("empty")}{" "}
                    {query ||
                    filter !== "active" ||
                    listScope !== "all" ||
                    listAsset ||
                    onlyMine ||
                    onlyOverdue
                      ? t("adjustAssetSearch")
                      : t("newJob")}
                  </p>
                )}
              </section>
            </>
          )}
          {page === "assets" && (
            <AssetsWorkspace
              key={JSON.stringify(assetTarget)}
              store={store}
              lang={lang}
              query={query}
              canManage={canManage}
              canWork={!live || snapshotRef.current?.role !== "viewer"}
              target={assetTarget}
              onResetTarget={() => setAssetTarget(null)}
              onCreateJob={(assetId, lineId) =>
                open("job", null, lineId || null, assetId || null)
              }
              onClearSearch={() => setQuery("")}
              onCreateLine={() => open("line")}
              onEditLine={(line) => open("line", line)}
              onArchiveLine={(line) =>
                lifecycle({
                  kind: "production_line_archive",
                  data: { id: line.id },
                })
              }
              onLifecycle={lifecycle}
              lifecycleError={error}
              onCreateAsset={(lineId) => open("asset", null, lineId)}
              onEditAsset={(asset) => open("asset", asset)}
              onHistory={(asset) => setHistoryAsset(asset.id)}
              onOpenJob={(job) => {
                setSelected(job.id);
                setCompletion(false);
                setActual({});
                setNotes(job.notes);
                setError("");
              }}
            />
          )}
          {page === "inventory" && (
            <div className="card table-scroll">
              <label>
                {t("type")}{" "}
                <select
                  value={inventoryType}
                  onChange={(e) => setInventoryType(e.target.value)}
                >
                  {["all", "tools", "parts", "consumables"].map((type) => (
                    <option key={type} value={type}>
                      {t(type as Key)}
                    </option>
                  ))}
                </select>
              </label>
              <table>
                <thead>
                  <tr>
                    {[
                      "name",
                      "type",
                      "quantity",
                      "reservation",
                      "storage",
                      "description",
                      "edit",
                    ]
                      .filter(
                        (k) =>
                          inventoryType !== "tools" ||
                          !["quantity", "reservation"].includes(k),
                      )
                      .map((k) => (
                        <th key={k}>{t(k as Key)}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {store.items
                    .filter(
                      (i) =>
                        inventoryType === "all" || i.type === inventoryType,
                    )
                    .filter((i) =>
                      (i.name + " " + i.spec)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((i) => (
                      <tr key={i.id}>
                        <td>
                          <strong>{i.name}</strong>
                          {i.inactive && <small>{t("inactive")}</small>}
                          <small>
                            {i.manufacturer} · {i.partNumber}
                          </small>
                        </td>
                        <td>{t(i.type)}</td>
                        {inventoryType !== "tools" && (
                          <>
                            <td>
                              {i.type !== "tools" && (
                                <span
                                  className={
                                    i.quantity - i.reserved < 2
                                      ? "danger-text"
                                      : ""
                                  }
                                >
                                  {i.quantity}
                                </span>
                              )}
                            </td>
                            <td>{i.type !== "tools" && i.reserved}</td>
                          </>
                        )}
                        <td>{i.location}</td>
                        <td>
                          {i.spec}
                          <small>{i.calibration}</small>
                        </td>
                        <td>
                          <Button
                            variant="outline"
                            onClick={() => open("item", i)}
                          >
                            {t("edit")}
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          {page === "radar" && (
            <div className="radar-layout">
              <section className="card padded">
                <div className="feature-icon">
                  <Radio size={28} />
                </div>
                <h2>{t("symptoms")}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSearched(true);
                  }}
                >
                  <label htmlFor="symptoms">{t("description")}</label>
                  <textarea
                    id="symptoms"
                    required
                    minLength={4}
                    value={symptoms}
                    onChange={(e) => {
                      setSymptoms(e.target.value);
                      setSearched(false);
                    }}
                    placeholder={
                      live
                        ? t("symptoms")
                        : local(store.faults[0].symptoms, lang)
                    }
                  />
                  <Button type="submit">
                    <Search size={17} />
                    {t("find")}
                  </Button>
                </form>
                <p className="notice">{t("limits")}</p>
              </section>
              <section>
                {searched &&
                  matchFaults(symptoms, store.faults, orgId).map(
                    ({ fault, terms }) => (
                      <article className="card padded match" key={fault.id}>
                        <span className="badge operational">
                          {t("confirmedRecord")} ·{" "}
                          {Number.isFinite(Date.parse(fault.date))
                            ? new Intl.DateTimeFormat(lang, {
                                timeZone: "Europe/Helsinki",
                              }).format(new Date(fault.date))
                            : "—"}
                        </span>
                        <h2>
                          {assetName(fault.assetId)}{" "}
                          {store.assets.find((a) => a.id === fault.assetId)
                            ?.archivedAt && (
                            <span className="badge">{t("archived")}</span>
                          )}
                        </h2>
                        <p>{local(fault.symptoms, lang)}</p>
                        <h3>{t("cause")}</h3>
                        <p>{local(fault.cause, lang)}</p>
                        <h3>{t("reason")}</h3>
                        <p>{terms.join(", ")}</p>
                        <h3>{t("check")}</h3>
                        <p>{local(fault.check, lang)}</p>
                        <p className="notice">{t("limits")}</p>
                      </article>
                    ),
                  )}
                {searched &&
                  !matchFaults(symptoms, store.faults, orgId).length && (
                    <div className="card padded">{t("noMatch")}</div>
                  )}
              </section>
            </div>
          )}
          {page === "reports" && (
            <section className="card padded">
              <div className="section-heading">
                <h2>{t("history")}</h2>
                <div className="button-row">
                  <Button variant="outline" onClick={exportCsv}>
                    <Download size={16} />
                    {t("export")}
                  </Button>
                  <Button onClick={() => window.print()}>{t("print")}</Button>
                </div>
              </div>
              <h3>{t("overdue")}</h3>
              {jobTable(overdue)}
              {store.jobs
                .filter((j) => j.status === "completed")
                .map((j) => (
                  <MaintenanceHistory
                    key={j.id}
                    job={j}
                    asset={assetName(j.assetId)}
                    items={store.items}
                    lang={lang}
                  />
                ))}
            </section>
          )}
          {page === "templates" && (
            <section className="card padded">
              <span className="badge operational">
                {t("version")} {store.templateVersion}
              </span>
              <h2>
                {live
                  ? t("templates")
                  : lang === "fi"
                    ? "Laakerihuollon valmistelu"
                    : lang === "de"
                      ? "Vorbereitung der Lagerwartung"
                      : "Bearing maintenance preparation"}
              </h2>
              <p className="notice">{t("proposal")}</p>
              {store.templateRequirements.map((r) => (
                <div className="template-row" key={r.id}>
                  <CheckCircle2 size={19} />
                  <div>
                    <small>{t(r.category)}</small>
                    <p>{local(r.label, lang)}</p>
                    <small>
                      {r.category !== "tools" && (
                        <>
                          {t("quantity")}: {r.quantity}
                        </>
                      )}
                    </small>
                  </div>
                </div>
              ))}
              {canManage &&
                store.jobs.some((j) => j.status === "completed") && (
                  <Button
                    onClick={() => {
                      const latest = store.jobs
                        .filter((j) => j.status === "completed")
                        .sort((a, b) =>
                          (a.completedAt || "").localeCompare(
                            b.completedAt || "",
                          ),
                        )
                        .at(-1);
                      if (latest && window.confirm(t("approveConfirm"))) {
                        const reqs = store.templateRequirements
                          .map((r) => ({
                            ...r,
                            quantity: r.itemId
                              ? (latest.actual[r.itemId] ?? r.quantity)
                              : r.quantity,
                            state: "unchecked" as const,
                          }))
                          .filter((r) => r.quantity > 0);
                        change({
                          ...store,
                          templateVersion: store.templateVersion + 1,
                          templateRequirements: reqs,
                          templateHistory: [
                            ...store.templateHistory,
                            {
                              version: store.templateVersion,
                              approvedAt: new Date().toISOString(),
                              requirements: store.templateRequirements,
                            },
                          ],
                        });
                      }
                    }}
                  >
                    {t("approve")}
                  </Button>
                )}
              {canManage && (
                <TemplateEditor
                  key={store.templateVersion}
                  items={store.items}
                  current={store.templateRequirements}
                  lang={lang}
                  onSave={(reqs) =>
                    change({
                      ...store,
                      templateVersion: store.templateVersion + 1,
                      templateRequirements: reqs,
                      templateHistory: [
                        ...store.templateHistory,
                        {
                          version: store.templateVersion,
                          approvedAt: new Date().toISOString(),
                          requirements: store.templateRequirements,
                        },
                      ],
                    })
                  }
                />
              )}
              <h3>{t("history")}</h3>
              {store.templateHistory.map((v) => (
                <p key={v.version}>
                  {t("version")} {v.version} ·{" "}
                  {new Date(v.approvedAt).toLocaleDateString(lang)}
                </p>
              ))}
            </section>
          )}
          {page === "settings" && (
            <div className="settings-grid">
              <section className="card padded workspace-tools">
                <h2>{t("workspaceTools")}</h2>
                <p>{t("workspaceToolsHint")}</p>
                <div className="button-row">
                  <Button variant="outline" onClick={() => go("reports")}>
                    <BarChart3 size={17} />
                    {t("reports")}
                  </Button>
                  <Button variant="outline" onClick={() => go("templates")}>
                    <BookOpen size={17} />
                    {t("templates")}
                  </Button>
                </div>
              </section>
              <section className="card padded">
                <h2>{t("preferences")}</h2>
                <label>
                  {t("language")}
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value as Lang)}
                  >
                    <option value="fi">Suomi</option>
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                  </select>
                </label>
                <Button variant="outline" onClick={() => setDark(!dark)}>
                  <Sun size={17} />
                  {t("theme")}
                </Button>
                {!live && (
                  <>
                    <h3>{t("demo")}</h3>
                    <p>{t("demoText")}</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (window.confirm(t("resetConfirm"))) {
                          change(seed());
                        }
                      }}
                    >
                      {t("reset")}
                    </Button>
                  </>
                )}
                {live && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        void refresh().catch(() => setError(t("accessError")))
                      }
                    >
                      {t("reload")}
                    </Button>
                    <Button variant="outline" onClick={onSignOut}>
                      {t("signOut")}
                    </Button>
                  </>
                )}
              </section>
              <section className="card padded">
                <h2>{t(live ? "team" : "plan")}</h2>
                {live ? (
                  <>
                    <p>{organizationName}</p>
                    {snapshotRef.current?.members.map((m) => (
                      <p key={m.userId}>
                        {m.name} · {t(m.role as Key)}
                        {canManage &&
                          m.role !== "owner" &&
                          m.userId !==
                            snapshotRef.current?.members.find(
                              (member) => member.name === userName,
                            )?.userId && (
                            <select
                              aria-label={m.name}
                              value={m.role}
                              onChange={async (e) => {
                                if (!supabase) return;
                                const { error } = await supabase.rpc(
                                  "manage_organization_member",
                                  {
                                    p_org: orgId,
                                    p_user: m.userId,
                                    p_role: e.target.value,
                                  },
                                );
                                if (error) setError(t("saveError"));
                                else
                                  await refresh().catch(() =>
                                    setError(t("accessError")),
                                  );
                              }}
                            >
                              {[
                                "technician",
                                "viewer",
                                ...(snapshotRef.current?.role === "owner"
                                  ? ["administrator"]
                                  : []),
                              ].map((role) => (
                                <option key={role} value={role}>
                                  {t(role as Key)}
                                </option>
                              ))}
                            </select>
                          )}
                      </p>
                    ))}
                    {canManage && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!supabase) return;
                          setSaving(true);
                          setInviteStatus("");
                          try {
                            const { error } = await supabase.functions.invoke(
                              "invite-technician-brunbar",
                              {
                                body: {
                                  organizationId: orgId,
                                  email: inviteEmail,
                                },
                              },
                            );
                            setInviteStatus(
                              t(error ? "inviteError" : "inviteSent"),
                            );
                          } catch {
                            setInviteStatus(t("inviteError"));
                          } finally {
                            setSaving(false);
                          }
                        }}
                      >
                        <label>
                          {t("email")}
                          <input
                            type="email"
                            required
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                          />
                        </label>
                        <Button type="submit">{t("invite")}</Button>
                        <p role="status">{inviteStatus}</p>
                      </form>
                    )}
                  </>
                ) : (
                  <>
                    <p className="notice">{t("disabled")}</p>
                    {[
                      ["Free", "0 €", "5"],
                      ["Pro", "19 € / month", "100"],
                      ["Business", "49 € / month", "500"],
                    ].map(([name, price, n]) => (
                      <div className="plan" key={name}>
                        <strong>{name}</strong>
                        <span>
                          {price.replace(
                            "month",
                            lang === "fi"
                              ? "kk"
                              : lang === "de"
                                ? "Monat"
                                : "month",
                          )}
                        </span>
                        <small>
                          {n} {t("assets").toLowerCase()}
                        </small>
                      </div>
                    ))}
                    <h3>{t("team")}</h3>
                    <p>Aleksi Korhonen · {t("technician")}</p>
                  </>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
      <Dialog.Root
        open={modal !== null}
        onOpenChange={(o) => {
          if (!o && !savingRef.current) {
            setModal(null);
            localStorage.setItem("hp-welcome", "1");
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog">
            <Dialog.Title>
              {modal === "onboarding"
                ? t("onboarding")
                : modal === "help"
                  ? t("help")
                  : modal === "line"
                    ? t(editing ? "editProductionLine" : "newProductionLine")
                    : modal === "asset"
                      ? t(editing ? "edit" : "newAsset")
                      : modal === "item"
                        ? t(editing ? "edit" : "addItem")
                        : modal === "fault"
                          ? t("newFault")
                          : t(editing ? "edit" : "newJob")}
            </Dialog.Title>
            <Dialog.Description className="dialog-description">
              {modal === "onboarding"
                ? t("onboardingText")
                : modal === "help"
                  ? t("helpText")
                  : t("demoText")}
            </Dialog.Description>
            <Dialog.Close className="dialog-close" aria-label={t("close")}>
              <X size={20} />
            </Dialog.Close>
            {modal === "onboarding" || modal === "help" ? (
              <>
                <div className="onboarding-steps">
                  {[Box, Wrench, ShieldCheck].map((Icon, i) => (
                    <div key={i}>
                      <Icon size={24} />
                      <span>
                        {t((["assets", "jobs", "readiness"] as const)[i])}
                      </span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => {
                    localStorage.setItem("hp-welcome", "1");
                    setModal(null);
                  }}
                >
                  {t("start")}
                  <ArrowRight size={17} />
                </Button>
              </>
            ) : (
              <form onSubmit={submit} className="edit-form" aria-busy={saving}>
                <fieldset className="form-fields" disabled={saving}>
                  {modal === "job" && (
                    <EquipmentPicker
                      assets={store.assets}
                      lines={store.productionLines || []}
                      lang={lang}
                      scope={jobScope}
                      assetId={jobAsset}
                      onScope={setJobScope}
                      onAsset={setJobAsset}
                    />
                  )}
                  <label>
                    {t(modal === "fault" ? "symptoms" : "name")}
                    <input
                      name="name"
                      required
                      maxLength={120}
                      defaultValue={editing?.name}
                    />
                  </label>
                  {modal === "fault" && (
                    <>
                      <label>
                        {t("equipment")}
                        <select required name="assetId">
                          {store.assets
                            .filter((a) => !a.archivedAt)
                            .map((a) => (
                              <option value={a.id} key={a.id}>
                                {a.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        {t("confirmedCause")}
                        <textarea name="cause" required minLength={5} />
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" required />
                        {t("verified")}
                      </label>
                    </>
                  )}
                  {modal === "line" && (
                    <>
                      <div className="form-grid">
                        <label>
                          {t("lineIdentifier")}
                          <input
                            name="identifier"
                            maxLength={80}
                            defaultValue={
                              (editing as ProductionLine)?.identifier
                            }
                          />
                        </label>
                        <label>
                          {t("location")}
                          <input
                            name="location"
                            maxLength={200}
                            defaultValue={(editing as ProductionLine)?.location}
                          />
                        </label>
                      </div>
                      <label>
                        {t("description")}
                        <textarea
                          name="description"
                          maxLength={4000}
                          defaultValue={
                            (editing as ProductionLine)?.description
                          }
                        />
                      </label>
                      <p className="notice">
                        {t("productionLineOptionalHint")}
                      </p>
                    </>
                  )}
                  {modal === "asset" && (
                    <>
                      <label>
                        {t("productionLineOptional")}
                        <select
                          name="productionLineId"
                          defaultValue={
                            (editing as Asset)?.productionLineId ||
                            newAssetLine ||
                            ""
                          }
                        >
                          <option value="">{t("noProductionLine")}</option>
                          {(store.productionLines || []).map((line) => (
                            <option key={line.id} value={line.id}>
                              {line.name}
                              {line.identifier ? ` · ${line.identifier}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="form-grid">
                        {(
                          [
                            "manufacturer",
                            "model",
                            "serial",
                            "location",
                          ] as const
                        ).map((k) => (
                          <label key={k}>
                            {t(k)}
                            <input
                              name={k}
                              defaultValue={(editing as Asset)?.[k]}
                            />
                          </label>
                        ))}
                      </div>
                      <label>
                        {t("description")}
                        <textarea
                          name="description"
                          defaultValue={(editing as Asset)?.description}
                        />
                      </label>
                    </>
                  )}
                  {modal === "job" && (
                    <>
                      <label>
                        {t("description")}
                        <textarea
                          name="description"
                          defaultValue={(editing as Job)?.description}
                        />
                      </label>

                      <div className="form-grid">
                        <label>
                          {t("due")}
                          <input
                            required
                            type="date"
                            name="due"
                            defaultValue={(editing as Job)?.due || today}
                          />
                        </label>
                        <label>
                          {t("priority")}
                          <select
                            name="priority"
                            defaultValue={
                              (editing as Job)?.priority || "normal"
                            }
                          >
                            <option value="normal">{t("normal")}</option>
                            <option value="high">{t("high")}</option>
                          </select>
                        </label>
                        <label>
                          {t("technician")}
                          {live ? (
                            <select
                              name="technician"
                              required
                              defaultValue={
                                (editing as Job)?.technician || userName
                              }
                            >
                              {(editing as Job)?.technician &&
                                !snapshotRef.current?.members.some(
                                  (m) =>
                                    m.name === (editing as Job).technician &&
                                    m.role !== "viewer",
                                ) && (
                                  <option value={(editing as Job).technician}>
                                    {(editing as Job).technician}
                                  </option>
                                )}
                              {snapshotRef.current?.members
                                .filter((m) => m.role !== "viewer")
                                .map((m) => (
                                  <option key={m.userId} value={m.name}>
                                    {m.name}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <input
                              name="technician"
                              required
                              defaultValue={
                                (editing as Job)?.technician || userName
                              }
                            />
                          )}
                        </label>
                        <label>
                          {t("duration")}
                          <input
                            type="number"
                            min="1"
                            max="10000"
                            required
                            name="duration"
                            defaultValue={(editing as Job)?.duration || 60}
                          />
                        </label>
                      </div>
                      <RequirementsEditor
                        items={store.items}
                        lang={lang}
                        value={jobRequirements}
                        onChange={setJobRequirements}
                      />
                      <label>
                        {t("workInstructions")}
                        <textarea
                          name="instructions"
                          maxLength={10000}
                          defaultValue={(editing as Job)?.instructions}
                        />
                      </label>
                      <label>
                        {t("recurrence")}
                        <input
                          type="number"
                          name="recurrence"
                          min="0"
                          max="3650"
                          required
                          defaultValue={(editing as Job)?.recurrence || 0}
                        />
                      </label>
                    </>
                  )}
                  {modal === "item" && (
                    <>
                      {itemType !== "tools" && (
                        <label>
                          {t("unit")}
                          <input
                            name="unit"
                            defaultValue={(editing as Item)?.unit || "kpl"}
                          />
                        </label>
                      )}
                      <label>
                        {t("externalId")}
                        <input
                          name="externalId"
                          defaultValue={(editing as Item)?.externalId}
                        />
                      </label>
                      <label>
                        <input
                          name="inactive"
                          type="checkbox"
                          defaultChecked={(editing as Item)?.inactive}
                        />{" "}
                        {t("inactive")}
                      </label>

                      <div className="form-grid">
                        <label>
                          {t("type")}
                          <select
                            name="type"
                            value={itemType}
                            onChange={(e) =>
                              setItemType(e.target.value as Item["type"])
                            }
                          >
                            {(["tools", "parts", "consumables"] as const).map(
                              (k) => (
                                <option key={k} value={k}>
                                  {t(k)}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        {itemType !== "tools" && (
                          <label>
                            {t("quantity")}
                            <input
                              type="number"
                              name="quantity"
                              min="0"
                              step="any"
                              required
                              defaultValue={(editing as Item)?.quantity || 0}
                            />
                          </label>
                        )}
                        <label>
                          {t("storage")}
                          <input
                            name="location"
                            required
                            defaultValue={(editing as Item)?.location}
                          />
                        </label>
                        <label>
                          {t("manufacturer")}
                          <input
                            name="manufacturer"
                            defaultValue={(editing as Item)?.manufacturer}
                          />
                        </label>
                        <label>
                          {lang === "fi"
                            ? "Osanumero"
                            : lang === "de"
                              ? "Teilenummer"
                              : "Part number"}
                          <input
                            name="partNumber"
                            defaultValue={(editing as Item)?.partNumber}
                          />
                        </label>
                        <label>
                          {lang === "fi"
                            ? "Kalibrointi voimassa"
                            : lang === "de"
                              ? "Kalibrierung gültig bis"
                              : "Calibration valid until"}
                          <input
                            type="date"
                            name="calibration"
                            defaultValue={(editing as Item)?.calibration}
                          />
                        </label>
                      </div>
                      <label>
                        {t("description")}
                        <input
                          name="spec"
                          defaultValue={(editing as Item)?.spec}
                        />
                      </label>
                      <label>
                        {lang === "fi"
                          ? "Yhteensopivat laitteet"
                          : lang === "de"
                            ? "Kompatible Anlagen"
                            : "Compatible equipment"}
                        <input
                          name="compatible"
                          defaultValue={(editing as Item)?.compatible}
                        />
                      </label>
                      <label>
                        {lang === "fi"
                          ? "Hyväksytyt vaihtoehdot"
                          : lang === "de"
                            ? "Freigegebene Alternativen"
                            : "Approved alternatives"}
                        <input
                          name="alternatives"
                          defaultValue={(editing as Item)?.alternatives}
                        />
                      </label>
                    </>
                  )}
                  {error && <p role="alert">{error}</p>}
                  <div className="dialog-actions">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => setModal(null)}
                    >
                      {t("cancel")}
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {t("save")}
                    </Button>
                  </div>
                </fieldset>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={!!chosen}
        onOpenChange={(o) => {
          if (!o && !savingRef.current) {
            setSelected(null);
            setError("");
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog job-dialog">
            <Dialog.Title>{historyName(chosen?.name, t("job"))}</Dialog.Title>
            <Dialog.Description className="dialog-description">
              {chosen &&
                historyName(
                  chosen.assetName || assetName(chosen.assetId),
                  t("equipment"),
                )}
              {chosen?.status !== "completed" && (
                <>
                  {" "}
                  · {chosen?.technician} · {chosen?.duration} min
                </>
              )}
            </Dialog.Description>
            <Dialog.Close className="dialog-close" aria-label={t("close")}>
              <X size={20} />
            </Dialog.Close>
            {chosen && store.assets.some((a) => a.id === chosen.assetId) && (
              <div className="button-row job-context">
                <Button
                  variant="outline"
                  onClick={() => navigateEquipment({ assetId: chosen.assetId })}
                >
                  {t("equipment")}: {assetName(chosen.assetId)}{" "}
                  {store.assets.find((a) => a.id === chosen.assetId)?.archivedAt
                    ? ` · ${t("archived")}`
                    : ""}
                </Button>
                {store.productionLines
                  ?.filter(
                    (l) =>
                      l.id ===
                      store.assets.find((a) => a.id === chosen.assetId)
                        ?.productionLineId,
                  )
                  .map((l) => (
                    <Button
                      key={l.id}
                      variant="outline"
                      onClick={() => navigateEquipment({ lineId: l.id })}
                    >
                      {t("currentLine")}: {l.name}
                    </Button>
                  ))}
              </div>
            )}
            {chosen?.status !== "completed" && (
              <p className="safety-notice">
                <ShieldCheck size={22} />
                {t("safe")}
              </p>
            )}
            {chosen && (
              <>
                {chosen.status !== "completed" && !completion && (
                  <>
                    {chosen.description && (
                      <p className="job-instructions">{chosen.description}</p>
                    )}
                    {chosen.instructions && (
                      <section className="job-instructions">
                        <h3>{t("workInstructions")}</h3>
                        <p>{chosen.instructions}</p>
                      </section>
                    )}
                    <div className="section-heading">
                      <h2>{t("plannedSupplies")}</h2>
                      <span className="badge planned">
                        {t(readiness(chosen))}
                      </span>
                    </div>
                    {chosen.requirements.map((r) => {
                      const item = (
                        chosen.status === "completed"
                          ? chosen.usedItems || []
                          : store.items
                      ).find((i) => i.id === r.itemId);
                      return (
                        <div className="requirement" key={r.id}>
                          <div>
                            <small>{t(r.category)}</small>
                            <p>{local(r.label, lang)}</p>
                            <small>
                              {r.category !== "tools" && (
                                <>
                                  {t("quantity")}: {r.quantity}
                                </>
                              )}
                            </small>
                            {item && (
                              <small>
                                {item.location} ·{" "}
                                {item.type !== "tools" && (
                                  <>
                                    {t("quantity")}: {item.quantity} ·{" "}
                                  </>
                                )}
                                {item.spec}
                                {item.calibration
                                  ? " · " + item.calibration
                                  : ""}
                              </small>
                            )}
                          </div>
                          <select
                            aria-label={local(r.label, lang)}
                            disabled={
                              chosen.status === "completed" ||
                              saving ||
                              (live && snapshotRef.current?.role === "viewer")
                            }
                            value={r.state}
                            onChange={(e) =>
                              change({
                                ...store,
                                jobs: store.jobs.map((j) =>
                                  j.id === chosen.id
                                    ? {
                                        ...j,
                                        requirements: j.requirements.map((x) =>
                                          x.id === r.id
                                            ? {
                                                ...x,
                                                state: e.target
                                                  .value as typeof r.state,
                                              }
                                            : x,
                                        ),
                                      }
                                    : j,
                                ),
                              })
                            }
                          >
                            {(
                              ["unchecked", "ready", "needs", "review"] as const
                            ).map((s) => (
                              <option key={s} value={s}>
                                {t(s)}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </>
                )}
                {chosen.status !== "completed" &&
                  !completion &&
                  (!live || snapshotRef.current?.role !== "viewer") && (
                    <div className="button-row">
                      <Button
                        disabled={saving}
                        variant="outline"
                        onClick={() => {
                          change({
                            ...store,
                            jobs: store.jobs.map((j) =>
                              j.id === chosen.id
                                ? { ...j, status: "progress" }
                                : j,
                            ),
                          });
                        }}
                      >
                        {t("progress")}
                      </Button>
                      <Button
                        onClick={() => {
                          setCompletion(true);
                          setCompletionNotes("");
                          setNotes("");
                          setFreeUsage([]);
                          setActualMinutes(chosen.duration);
                          setActual({});
                        }}
                      >
                        {t("complete")}
                      </Button>
                    </div>
                  )}
                {completion && (
                  <form
                    className="completion"
                    onSubmit={(e) => {
                      e.preventDefault();
                      finish();
                    }}
                  >
                    <fieldset className="form-fields" disabled={saving}>
                      <h3>{t("actual")}</h3>
                      <label>
                        {t("workDone")}
                        <textarea
                          required
                          maxLength={10000}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </label>
                      <label>
                        {t("actualMinutes")}
                        <input
                          type="number"
                          min="1"
                          max="100000"
                          required
                          value={actualMinutes}
                          onChange={(e) =>
                            setActualMinutes(Number(e.target.value))
                          }
                        />
                      </label>
                      <CompletionItems
                        lang={lang}
                        actual={actual}
                        onChange={setActual}
                        search={searchCompletionInventory}
                        requirements={chosen.requirements}
                        inventory={store.items}
                        freeUsage={freeUsage}
                        onFreeUsageChange={setFreeUsage}
                      />
                      <label>
                        {t("additionalNotes")}
                        <textarea
                          value={completionNotes}
                          onChange={(e) => setCompletionNotes(e.target.value)}
                        />
                      </label>
                      {error && (
                        <p role="alert" className="danger-text">
                          {error}
                        </p>
                      )}
                      <Button type="submit" disabled={saving || !notes.trim()}>
                        {t("recordComplete")}
                      </Button>
                    </fieldset>
                  </form>
                )}
                {chosen.status === "completed" && (
                  <MaintenanceHistory
                    job={chosen}
                    asset={assetName(chosen.assetId)}
                    items={store.items}
                    lang={lang}
                  />
                )}
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(historyAsset)}
        onOpenChange={(open) => {
          if (!open) setHistoryAsset(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog">
            <Dialog.Title>
              {assetName(historyAsset || "")} · {t("maintenanceHistory")}
            </Dialog.Title>
            <Dialog.Description>{t("completed")}</Dialog.Description>
            {historyAsset && (
              <Button
                variant="outline"
                onClick={() => navigateEquipment({ assetId: historyAsset })}
              >
                {t("equipment")}: {assetName(historyAsset)}
              </Button>
            )}
            {!store.jobs.some(
              (j) => j.assetId === historyAsset && j.status === "completed",
            ) && <p>{t("noMaintenanceHistory")}</p>}
            {store.jobs
              .filter(
                (j) => j.assetId === historyAsset && j.status === "completed",
              )
              .sort((a, b) =>
                (b.completedAt || "").localeCompare(a.completedAt || ""),
              )
              .map((j) => (
                <p key={j.id}>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setHistoryAsset(null);
                      setSelected(j.id);
                    }}
                  >
                    {completionTime(j.completedAt, lang)} · {j.name}
                  </Button>
                </p>
              ))}
            <Dialog.Close asChild>
              <Button variant="outline">{t("close")}</Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
