import type { SupabaseClient } from "@supabase/supabase-js";
import type { Store } from "../domain";
export type Snapshot = {
  store: Store;
  revision: number;
  organizationId: string;
  organizationName: string;
  role: "owner" | "administrator" | "technician" | "viewer";
  members: { userId: string; name: string; role: string }[];
};
export class RepositoryError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export class Repository {
  constructor(
    private client: SupabaseClient,
    public organizationId: string,
  ) {}
  async load(): Promise<Snapshot> {
    const { data, error } = await this.client.rpc("private_snapshot", {
      p_org: this.organizationId,
    });
    if (error) throw new RepositoryError(error.code || "load");
    if (!data?.store) throw new RepositoryError("load");
    return data as Snapshot;
  }
  async save(current: Snapshot, next: Store): Promise<Snapshot> {
    const before = current.store;
    const completed = next.jobs.find(
      (j) =>
        j.status === "completed" &&
        before.jobs.find((x) => x.id === j.id)?.status !== "completed",
    );
    let kind = "",
      payload: unknown;
    if (completed) {
      kind = "complete";
      payload = {
        id: completed.id,
        actual: completed.actual,
        notes: completed.notes,
        actualMinutes: completed.actualMinutes,
        completionNotes: completed.completionNotes,
      };
    } else if (next.templateVersion !== before.templateVersion) {
      kind = "template";
      payload = { requirements: next.templateRequirements };
    } else {
      for (const [key, name] of [
        ["assets", "asset"],
        ["jobs", "job"],
        ["items", "item"],
        ["faults", "fault"],
      ] as const) {
        const changed = next[key].filter(
          (x) =>
            JSON.stringify(x) !==
            JSON.stringify(before[key].find((old) => old.id === x.id)),
        );
        if (changed.length) {
          if (kind || changed.length !== 1)
            throw new RepositoryError("invalid");
          kind = name;
          payload = changed[0];
        }
      }
    }
    if (!kind) throw new RepositoryError("invalid");
    const { error } = await this.client.rpc("private_mutate", {
      p_org: this.organizationId,
      p_revision: current.revision,
      p_kind: kind,
      p_data: payload,
    });
    if (error) throw new RepositoryError(error.code || "save");
    return this.load();
  }
}
