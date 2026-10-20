import { validateFreeUsage, type FreeUsage } from "./completionUsage";
import type { Local } from "./i18n";
export type Asset = {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  serial: string;
  location: string;
  status: "operational" | "review";
  description: string;
};
export type Item = {
  id: string;
  name: string;
  type: "tools" | "parts" | "consumables";
  quantity: number;
  reserved: number;
  location: string;
  spec: string;
  manufacturer: string;
  partNumber: string;
  calibration: string;
  compatible: string;
  alternatives: string;
  unit?: string;
  externalId?: string;
  inactive?: boolean;
};
export type Requirement = {
  id: string;
  category:
    "tools" | "parts" | "consumables" | "safety" | "documents" | "personnel";
  label: Local;
  itemId?: string;
  quantity: number;
  state: "unchecked" | "ready" | "needs" | "review";
};
export type Job = {
  id: string;
  name: string;
  assetId: string;
  due: string;
  priority: "high" | "normal";
  status: "planned" | "progress" | "completed";
  technician: string;
  duration: number;
  requirements: Requirement[];
  notes: string;
  actual: Record<string, number>;
  completedAt?: string;
  recurrence: number;
  legacyReconstructed?: boolean;
  description?: string;
  actualMinutes?: number;
  completionNotes?: string;
  performedBy?: string;
  freeUsage?: FreeUsage[];
  assetName?: string;
  performerId?: string;
  usedItems?: (Item & { usedQuantity: number })[];
};
export type Fault = {
  id: string;
  orgId: string;
  assetId: string;
  symptoms: Local;
  cause: Local;
  check: Local;
  verified: boolean;
  date: string;
};
export type Store = {
  version: 1;
  assets: Asset[];
  jobs: Job[];
  items: Item[];
  faults: Fault[];
  events: { id: string; at: string; text: string }[];
  templateVersion: number;
  templateRequirements: Requirement[];
  templateHistory: {
    version: number;
    approvedAt: string;
    requirements: Requirement[];
  }[];
};
export const id = () => crypto.randomUUID();
export function readiness(job: Job) {
  if (job.requirements.some((r) => r.state === "needs")) return "needs";
  if (job.requirements.some((r) => r.state === "review")) return "review";
  if (
    job.requirements.every((r) => r.state === "ready") &&
    job.requirements.length
  )
    return "ready";
  return "unchecked";
}
const tokens = (s: string) =>
  new Set(
    s
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((x) => x.length > 3),
  );
export function matchFaults(query: string, faults: Fault[], orgId: string) {
  const q = tokens(query);
  return faults
    .filter((f) => f.orgId === orgId && f.verified)
    .map((f) => ({
      fault: f,
      terms: [...tokens(f.symptoms.join(" "))].filter((t) => q.has(t)),
    }))
    .filter((r) => r.terms.length > 0)
    .sort((a, b) => b.terms.length - a.terms.length)
    .slice(0, 4);
}
export function completeJob(
  store: Store,
  jobId: string,
  actual: Record<string, number>,
  notes: string,
  actualMinutes = store.jobs.find((j) => j.id === jobId)?.duration || 0,
  performedBy?: string,
  completionNotes = "",
  freeUsage: FreeUsage[] = [],
): Store {
  const usage = validateFreeUsage(freeUsage);
  const job = store.jobs.find((j) => j.id === jobId);
  if (
    !job ||
    job.status === "completed" ||
    !Number.isFinite(actualMinutes) ||
    actualMinutes < 1 ||
    actualMinutes > 100000
  )
    throw Error("invalid");
  for (const [itemId, n] of Object.entries(actual)) {
    const item = store.items.find((i) => i.id === itemId);
    if (
      !Number.isFinite(n) ||
      n < 0 ||
      !item ||
      (item.inactive && n > 0) ||
      (item.type !== "tools" && n > item.quantity - item.reserved)
    )
      throw Error("stock");
  }
  const nextJobs =
    job.recurrence > 0
      ? [
          {
            ...job,
            id: id(),
            status: "planned" as const,
            due: new Date(
              new Date(job.due + "T12:00:00").getTime() +
                job.recurrence * 86400000,
            )
              .toISOString()
              .slice(0, 10),
            requirements: job.requirements.map((r) => ({
              ...r,
              state: "unchecked" as const,
            })),
            notes: "",
            actual: {},
            completedAt: undefined,
            usedItems: undefined,
            freeUsage: undefined,
            assetName: undefined,
            actualMinutes: undefined,
            completionNotes: undefined,
            performedBy: undefined,
          },
        ]
      : [];
  return {
    ...store,
    items: store.items.map((i) => ({
      ...i,
      quantity:
        i.type === "tools" ? i.quantity : i.quantity - (actual[i.id] || 0),
    })),
    jobs: [
      ...store.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: "completed" as const,
              actual,
              actualMinutes,
              freeUsage: usage,
              assetName: store.assets.find((a) => a.id === job.assetId)?.name,
              completionNotes,
              performedBy: performedBy || job.technician,
              usedItems: store.items
                .filter((i) => (actual[i.id] || 0) > 0)
                .map((i) => ({ ...i, usedQuantity: actual[i.id] })),
              notes,
              completedAt: new Date().toISOString(),
            }
          : j,
      ),
      ...nextJobs,
    ],
    events: [
      { id: id(), at: new Date().toISOString(), text: job.name },
      ...store.events,
    ],
  };
}
export function csv(rows: string[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map(
            (s) =>
              '"' +
              (/^[=+@\-\t\r]/.test(s) ? "'" : "") +
              s.replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n")
  );
}
