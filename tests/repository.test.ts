import { it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Repository, type Snapshot } from "../src/data/repository";
import { seed } from "../src/seed";
const snapshot = (): Snapshot => ({
  store: seed(),
  revision: 7,
  organizationId: "org",
  organizationName: "Test",
  role: "owner",
  members: [],
});
it("uses guarded transactional completion rather than browser inventory upserts", async () => {
  const before = snapshot();
  const next = structuredClone(before.store);
  next.jobs[0] = {
    ...next.jobs[0],
    status: "completed",
    actual: { i2: 1 },
    notes: "Confirmed",
    freeUsage: [
      { type: "tools", name: "Wrench" },
      { type: "parts", name: "Seal", quantity: 2 },
    ],
  };
  next.items[1].quantity = 0;
  const rpc = vi.fn(async (name: string) => ({
    data: name === "private_snapshot" ? before : null,
    error: null,
  }));
  await new Repository({ rpc } as unknown as SupabaseClient, "org").save(
    before,
    next,
  );
  expect(rpc.mock.calls[0]).toEqual([
    "private_mutate",
    {
      p_org: "org",
      p_revision: 7,
      p_kind: "complete",
      p_data: {
        id: "j1",
        actual: { i2: 1 },
        notes: "Confirmed",
        freeUsage: next.jobs[0].freeUsage,
      },
    },
  ]);
});
it("propagates conflicts without blind retry or false success", async () => {
  const before = snapshot();
  const next = structuredClone(before.store);
  next.assets[0].name = "Changed";
  const rpc = vi.fn(async () => ({ data: null, error: { code: "40001" } }));
  await expect(
    new Repository({ rpc } as unknown as SupabaseClient, "org").save(
      before,
      next,
    ),
  ).rejects.toMatchObject({ code: "40001" });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(before.store.assets[0].name).toBe("CNC Haas VF-2");
});
it("does not send full snapshots or unrelated records when editing equipment", async () => {
  const before = snapshot();
  const next = structuredClone(before.store);
  next.assets[0].name = "Changed";
  const rpc = vi.fn(async (name: string) => ({
    data: name === "private_snapshot" ? before : null,
    error: null,
  }));
  await new Repository({ rpc } as unknown as SupabaseClient, "org").save(
    before,
    next,
  );
  expect(rpc.mock.calls[0]).toEqual([
    "private_mutate",
    { p_org: "org", p_revision: 7, p_kind: "asset", p_data: next.assets[0] },
  ]);
});
