import type { Job } from "./domain";

/** Calendar boundaries follow the workshop's Finnish time zone, including DST. */
export function workshopDate(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Helsinki",
  }).format(now);
}
export function dashboardJobs(jobs: Job[], userName: string, today: string) {
  const end = new Date(Date.parse(`${today}T12:00:00Z`) + 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const active = jobs
    .filter((j) => j.status !== "completed")
    .sort(
      (a, b) =>
        a.due.localeCompare(b.due) ||
        Number(b.priority === "high") - Number(a.priority === "high") ||
        a.name.localeCompare(b.name),
    );
  return {
    overdue: active.filter((j) => j.due < today),
    dueSoon: active.filter((j) => j.due >= today && j.due <= end),
    progress: active.filter((j) => j.status === "progress"),
    mine: active.filter(
      (j) => !!userName.trim() && j.technician.trim() === userName.trim(),
    ),
    recent: jobs
      .filter((j) => j.status === "completed")
      .sort(
        (a, b) =>
          (Date.parse(b.completedAt || "") || 0) -
          (Date.parse(a.completedAt || "") || 0),
      ),
  };
}
