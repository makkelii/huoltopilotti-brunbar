import type { LifecycleRequest } from "../lifecycle";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  inventoryPageSize,
  inventorySearchFilter,
  type InventoryGroup,
  type InventoryPage,
} from "./inventorySearch";
import type { Item } from "../domain";
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
  async searchInventory(
    group: InventoryGroup,
    query: string,
    page = 0,
    signal?: AbortSignal,
  ): Promise<InventoryPage> {
    if (query.trim().length < 2) return { items: [], hasMore: false };
    const offset = Math.max(0, Math.floor(page)) * inventoryPageSize;
    let request = this.client
      .from("inventory")
      .select(
        "id,name,type,quantity,reserved,manufacturer,part_number,storage_location,specifications,data",
      )
      .eq("organization_id", this.organizationId)
      .in("type", group === "tools" ? ["tool"] : ["part", "consumable"])
      .or(
        `and(or(data->>inactive.is.null,data->>inactive.neq.true),or(${inventorySearchFilter(query)}))`,
      )
      .order("name")
      .order("id")
      .range(offset, offset + inventoryPageSize);
    if (signal) request = request.abortSignal(signal);
    const { data, error } = await request;
    if (error) throw new RepositoryError(error.code || "load");
    const items = (data || []).map(
      (row) =>
        ({
          ...row.data,
          id: row.id,
          name: row.name,
          type:
            row.type === "tool"
              ? "tools"
              : row.type === "part"
                ? "parts"
                : "consumables",
          quantity: Number(row.quantity),
          reserved: Number(row.reserved),
          manufacturer: row.manufacturer || "",
          partNumber: row.part_number || "",
          location: row.storage_location || "",
          spec: row.specifications || "",
        }) as Item,
    );
    return {
      items: items.slice(0, inventoryPageSize),
      hasMore: items.length > inventoryPageSize,
    };
  }
  async load(): Promise<Snapshot> {
    const { data, error } = await this.client.rpc("private_snapshot", {
      p_org: this.organizationId,
    });
    if (error) throw new RepositoryError(error.code || "load");
    if (!data?.store) throw new RepositoryError("load");
    return data as Snapshot;
  }
  async lifecycle(
    current: Snapshot,
    request: LifecycleRequest,
  ): Promise<Snapshot> {
    const { error } = await this.client.rpc("private_mutate", {
      p_org: this.organizationId,
      p_revision: current.revision,
      p_kind: request.kind,
      p_data: request.data,
    });
    if (error) throw new RepositoryError(error.code || "save");
    return this.load();
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
        freeUsage: completed.freeUsage || [],
      };
    } else if (next.templateVersion !== before.templateVersion) {
      kind = "template";
      payload = { requirements: next.templateRequirements };
    } else if (
      JSON.stringify(before.productionLines || []) !==
      JSON.stringify(next.productionLines || [])
    ) {
      const removed = (before.productionLines || []).filter(
        (line) => !(next.productionLines || []).some((n) => n.id === line.id),
      );
      const changed = (next.productionLines || []).filter(
        (line) =>
          JSON.stringify(line) !==
          JSON.stringify(
            (before.productionLines || []).find((old) => old.id === line.id),
          ),
      );
      if (removed.length === 1 && changed.length === 0) {
        kind = "production_line_archive";
        payload = { id: removed[0].id };
      } else if (removed.length === 0 && changed.length === 1) {
        kind = "production_line";
        payload = changed[0];
      } else throw new RepositoryError("invalid");
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
