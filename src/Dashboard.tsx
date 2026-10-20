import { useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CircleCheck,
  Clock3,
  UserRound,
  ArrowRight,
  Wrench,
} from "lucide-react";
import type { Store, Job } from "./domain";
import { dashboardJobs } from "./dashboard";
import { completionTime, historyName } from "./MaintenanceHistory";
import { translate, type Lang } from "./i18n";
import { Button } from "./components/ui/button";

type Queue = "overdue" | "dueSoon" | "progress" | "mine";
export function Dashboard({
  store,
  userName,
  today,
  lang,
  onOpen,
  onAll,
}: {
  store: Store;
  userName: string;
  today: string;
  lang: Lang;
  onOpen: (job: Job) => void;
  onAll: () => void;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const groups = dashboardJobs(store.jobs, userName, today);
  const [queue, setQueue] = useState<Queue>(() =>
    groups.overdue.length
      ? "overdue"
      : groups.dueSoon.length
        ? "dueSoon"
        : groups.progress.length
          ? "progress"
          : "mine",
  );
  const tabs = [
    {
      key: "overdue",
      label: "overdue",
      hint: "overdueHint",
      icon: AlertCircle,
    },
    {
      key: "dueSoon",
      label: "dueSoon",
      hint: "dueSoonHint",
      icon: CalendarDays,
    },
    { key: "progress", label: "progress", hint: "progressHint", icon: Clock3 },
    { key: "mine", label: "myJobs", hint: "myJobsHint", icon: UserRound },
  ] as const;
  const asset = (job: Job) =>
    historyName(
      job.assetName || store.assets.find((a) => a.id === job.assetId)?.name,
      t("equipment"),
    );
  const due = (job: Job) =>
    job.due === today
      ? t("todayLabel")
      : new Intl.DateTimeFormat(lang === "fi" ? "fi-FI" : lang, {
          timeZone: "Europe/Helsinki",
          day: "numeric",
          month: "numeric",
          year: "numeric",
        }).format(new Date(`${job.due}T12:00:00Z`));
  return (
    <div className="work-overview">
      <div className="queue-switcher" role="group" aria-label={t("workQueues")}>
        {tabs.map(({ key, label, hint, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`queue-summary ${key === "overdue" && groups.overdue.length ? "attention" : ""}`}
            aria-pressed={queue === key}
            aria-controls="dashboard-queue"
            onClick={() => setQueue(key)}
          >
            <span className="queue-summary-label">
              <Icon size={19} aria-hidden="true" />
              {t(label)}
            </span>
            <strong>{groups[key].length}</strong>
            <small>{t(hint)}</small>
          </button>
        ))}
      </div>
      <div className="overview-columns">
        <section
          className="card work-queue"
          id="dashboard-queue"
          aria-labelledby="work-queue-heading"
        >
          <div className="overview-section-heading">
            <div>
              <span className="eyebrow">{t("nextActions")}</span>
              <h2 id="work-queue-heading">
                {t(tabs.find((tab) => tab.key === queue)!.label)}
              </h2>
            </div>
            <span className="count">{groups[queue].length}</span>
          </div>
          {groups[queue].length ? (
            <ul className="overview-job-list">
              {groups[queue].slice(0, 8).map((job) => (
                <li key={job.id}>
                  <button
                    className="overview-job"
                    type="button"
                    onClick={() => onOpen(job)}
                  >
                    <span className="overview-job-body">
                      <strong>{historyName(job.name, t("job"))}</strong>
                      <span className="overview-asset">{asset(job)}</span>
                      <span
                        className={`overview-due ${job.due < today ? "is-overdue" : ""}`}
                      >
                        <CalendarDays size={14} aria-hidden="true" />
                        {due(job)}
                        <span aria-hidden="true">·</span>
                        {historyName(job.technician, t("unknownPerformer"))}
                      </span>
                    </span>
                    <span className="overview-job-state">
                      <span className={`badge ${job.status}`}>
                        {t(job.status)}
                      </span>
                      {job.priority === "high" && (
                        <span className="priority-label">{t("high")}</span>
                      )}
                    </span>
                    <ArrowRight
                      size={17}
                      className="overview-arrow"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="overview-empty">
              <CircleCheck size={28} aria-hidden="true" />
              <h3>{t("queueEmpty")}</h3>
              <p>{t(queue === "mine" ? "myJobsEmpty" : "queueEmptyHint")}</p>
            </div>
          )}
          <div className="overview-section-footer">
            <Button variant="ghost" onClick={onAll}>
              {t("allJobs")}
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </section>
        <section
          className="card recent-work"
          aria-labelledby="recent-work-heading"
        >
          <div className="overview-section-heading">
            <div>
              <span className="eyebrow">{t("workHistory")}</span>
              <h2 id="recent-work-heading">{t("recentCompleted")}</h2>
            </div>
            <CircleCheck size={20} aria-hidden="true" />
          </div>
          {groups.recent.length ? (
            <ul className="recent-job-list">
              {groups.recent.slice(0, 5).map((job) => (
                <li key={job.id}>
                  <button className="recent-job" onClick={() => onOpen(job)}>
                    <span className="recent-check">
                      <CircleCheck size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{historyName(job.name, t("job"))}</strong>
                      <span>{asset(job)}</span>
                      <small>{completionTime(job.completedAt, lang)}</small>
                    </span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="overview-empty">
              <Wrench size={26} aria-hidden="true" />
              <h3>{t("noCompletedWork")}</h3>
              <p>{t("noCompletedWorkHint")}</p>
            </div>
          )}
          <p className="overview-note">{t("historyLocationHint")}</p>
        </section>
      </div>
    </div>
  );
}
