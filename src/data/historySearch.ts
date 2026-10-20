import type { Fault, Job, Store } from "../domain";
import { local } from "../i18n";
export type HistoryKind = "maintenance" | "fault";
export type HistoryFilter = {
  query: string;
  assetId: string;
  lineId: string;
  from: string;
  to: string;
  kind: "" | HistoryKind;
  page: number;
};
export type HistoryResult = {
  id: string;
  kind: HistoryKind;
  title: string;
  assetId: string;
  assetName: string;
  assetIdentifier: string;
  lineId: string | null;
  lineName: string | null;
  at: string;
  problem: string;
  repair: string;
  parts: string;
  tools: string;
  metadataKnown: boolean;
  archived: boolean;
  removed?: boolean;
  lineRemoved?: boolean;
  matchedFields: string[];
};
export type HistoryPage = { results: HistoryResult[]; hasMore: boolean };
export type HistoryOptions = {
  assets: { value: string; label: string }[];
  lines: { value: string; label: string }[];
};
export type HistoryService = {
  search: (filter: HistoryFilter, signal: AbortSignal) => Promise<HistoryPage>;
  record: (kind: HistoryKind, id: string) => Promise<Job | Fault>;
  options: () => Promise<HistoryOptions>;
};
export function demoHistoryService(store: Store): HistoryService {
  const jobs: HistoryResult[] = store.jobs
    .filter((j) => j.status === "completed")
    .map((j) => {
      const a = [...store.assets, ...(store.removedAssets || [])].find(
        (a) => a.id === j.assetId,
      );
      return {
        id: j.id,
        kind: "maintenance",
        title: j.name,
        assetId: j.assetId,
        assetName: j.assetName || a?.name || "",
        assetIdentifier: "",
        lineId: null,
        lineName: null,
        at: j.completedAt || "",
        problem: [j.description, j.instructions, j.completionNotes]
          .filter(Boolean)
          .join(" "),
        repair: j.notes,
        parts: [
          ...(j.usedItems || [])
            .filter((i) => i.type !== "tools")
            .map((i) => `${i.name}: ${i.usedQuantity}`),
          ...(j.freeUsage || [])
            .filter((i) => i.type === "parts")
            .map((i) => `${i.name}: ${i.quantity}`),
        ].join(", "),
        tools: [
          ...(j.usedItems || [])
            .filter((i) => i.type === "tools")
            .map((i) => i.name),
          ...(j.freeUsage || [])
            .filter((i) => i.type === "tools")
            .map((i) => i.name),
        ].join(", "),
        metadataKnown: false,
        archived: !!a?.archivedAt,
        removed: !!store.removedAssets?.some((a) => a.id === j.assetId),
        matchedFields: [],
      };
    });
  const faults: HistoryResult[] = store.faults.map((f) => ({
    id: f.id,
    kind: "fault",
    title: local(f.symptoms, "fi"),
    assetId: f.assetId,
    assetName:
      [...store.assets, ...(store.removedAssets || [])].find(
        (a) => a.id === f.assetId,
      )?.name || "",
    assetIdentifier: "",
    lineId: null,
    lineName: null,
    at: f.date,
    problem: local(f.symptoms, "fi"),
    repair: local(f.cause, "fi"),
    parts: "",
    tools: "",
    metadataKnown: false,
    archived: !![...store.assets, ...(store.removedAssets || [])].find(
      (a) => a.id === f.assetId,
    )?.archivedAt,
    removed: !!store.removedAssets?.some((a) => a.id === f.assetId),
    matchedFields: [],
  }));
  const rows = [...jobs, ...faults];
  return {
    search: async (f) => {
      const tokens =
        f.query.toLocaleLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) || [];
      if (!tokens.length) return { results: [], hasMore: false };
      const candidates = rows
        .filter(
          (r) =>
            (!f.assetId || r.assetId === f.assetId) &&
            (!f.lineId || r.lineId === f.lineId) &&
            (!f.kind || r.kind === f.kind) &&
            (!f.from || r.at.slice(0, 10) >= f.from) &&
            (!f.to || r.at.slice(0, 10) <= f.to),
        )
        .map((r) => {
          const fields = [
            r.problem,
            r.repair,
            r.title,
            r.assetName,
            r.parts,
            r.tools,
          ];
          const score = fields.reduce(
            (n, field, i) =>
              n +
              tokens.filter((t) => field.toLowerCase().includes(t)).length *
                (i < 2 ? 4 : 1),
            0,
          );
          return { r, score };
        })
        .filter(({ score }) => score > 0)
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.r.at.localeCompare(a.r.at) ||
            a.r.id.localeCompare(b.r.id),
        );
      const start = f.page * 20;
      return {
        results: candidates.slice(start, start + 20).map((x) => x.r),
        hasMore: candidates.length > start + 20,
      };
    },
    record: async (kind, id) => {
      const r =
        kind === "maintenance"
          ? store.jobs.find((j) => j.id === id && j.status === "completed")
          : store.faults.find((f) => f.id === id);
      if (!r) throw Error("missing");
      return r;
    },
    options: async () => ({
      assets: [...store.assets, ...(store.removedAssets || [])].map((a) => ({
        value: a.id,
        label: [a.name, a.serial].filter(Boolean).join(" · "),
      })),
      lines: [],
    }),
  };
}
