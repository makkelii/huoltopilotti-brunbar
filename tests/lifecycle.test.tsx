import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { seed } from "../src/seed";
import { completeJob, type Store } from "../src/domain";
import {
  applyLifecycle,
  assetDeletable,
  lineDeletable,
} from "../src/lifecycle";
import { EquipmentPicker } from "../src/EquipmentPicker";
import { Repository, type Snapshot } from "../src/data/repository";
import App from "../src/App";
const base = () => {
  const s = seed();
  s.jobs = [];
  s.productionLines = [
    {
      id: "line",
      name: "Testilinja",
      identifier: "TL-1",
      location: "",
      description: "",
    },
  ];
  return s;
};
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("hp-welcome", "1");
  location.hash = "";
});
afterEach(cleanup);
it("archive preserves identity, jobs, faults, inventory and completed history; restore validates active line", () => {
  const seeded = seed();
  seeded.jobs[0].recurrence = 0;
  const history = completeJob(seeded, "j1", {}, "Korjattu", 20);
  history.jobs = history.jobs.filter((j) => j.status === "completed");
  const a = history.assets.find((a) => a.id === history.jobs[0].assetId)!;
  const archived = applyLifecycle(history, {
    kind: "asset_archive",
    data: { id: a.id },
  });
  expect(archived.jobs).toEqual(history.jobs);
  expect(archived.faults).toEqual(history.faults);
  expect(archived.items).toEqual(history.items);
  expect(archived.assets.find((x) => x.id === a.id)?.serial).toBe(a.serial);
  expect(() =>
    applyLifecycle(archived, { kind: "asset_delete", data: { id: a.id } }),
  ).toThrow("dependencies");
  expect(() =>
    applyLifecycle(archived, {
      kind: "asset_restore",
      data: { id: a.id, productionLineId: "retired" },
    }),
  ).toThrow("unavailable");
  const restored = applyLifecycle(archived, {
    kind: "asset_restore",
    data: { id: a.id },
  });
  expect(restored.assets.find((x) => x.id === a.id)?.archivedAt).toBeNull();
  expect(restored.jobs).toEqual(history.jobs);
});
it("open and recurring jobs prevent archive; archived equipment cannot complete and generate recurrence", () => {
  const s = seed();
  const job = s.jobs[0];
  expect(() =>
    applyLifecycle(s, { kind: "asset_archive", data: { id: job.assetId } }),
  ).toThrow("openJobs");
  s.assets = s.assets.map((a) =>
    a.id === job.assetId ? { ...a, archivedAt: "2026-10-20" } : a,
  );
  expect(() => completeJob(s, job.id, {}, "Testattu", 20)).toThrow("invalid");
  render(
    <EquipmentPicker
      assets={s.assets}
      lines={[]}
      lang="fi"
      scope="all"
      assetId={job.assetId}
      onScope={() => {}}
      onAsset={() => {}}
    />,
  );
  expect(screen.getByRole("combobox", { name: "Laite" })).toHaveValue("");
  expect(
    screen.queryByRole("option", {
      name: new RegExp(s.assets.find((a) => a.id === job.assetId)!.serial),
    }),
  ).not.toBeInTheDocument();
});
it("line archive detaches all equipment; restore never moves it and rejects identifier conflicts", () => {
  const s = base();
  s.assets[0].productionLineId = "line";
  s.assets[1].productionLineId = "line";
  s.assets[1].archivedAt = "2026-10-20";
  const archived = applyLifecycle(s, {
    kind: "production_line_archive",
    data: { id: "line" },
  });
  expect(archived.assets[0].productionLineId).toBeNull();
  expect(archived.assets[1].productionLineId).toBeNull();
  expect(archived.assets).toHaveLength(s.assets.length);
  expect(lineDeletable(archived, archived.archivedProductionLines![0])).toBe(
    false,
  );
  archived.productionLines = [{ ...s.productionLines![0], id: "new" }];
  expect(() =>
    applyLifecycle(archived, {
      kind: "production_line_restore",
      data: { id: "line" },
    }),
  ).toThrow("duplicate");
  archived.productionLines = [];
  const restored = applyLifecycle(archived, {
    kind: "production_line_restore",
    data: { id: "line" },
  });
  expect(restored.productionLines![0].name).toBe("Testilinja");
  expect(restored.assets).toEqual(archived.assets);
});
it("empty records can be deleted, but server and client dependency flags block retained references", () => {
  const s = base();
  s.faults = [];
  expect(assetDeletable(s, s.assets[0])).toBe(true);
  expect(
    applyLifecycle(s, { kind: "asset_delete", data: { id: s.assets[0].id } })
      .assets,
  ).toHaveLength(s.assets.length - 1);
  expect(
    applyLifecycle(s, { kind: "production_line_delete", data: { id: "line" } })
      .productionLines,
  ).toEqual([]);
  expect(() =>
    applyLifecycle(
      { ...s, assets: [{ ...s.assets[0], canDelete: false }] },
      { kind: "asset_delete", data: { id: s.assets[0].id } },
    ),
  ).toThrow("dependencies");
});
it("archive is discoverable; archived records retain history access and restore only after confirmation", async () => {
  const s = base();
  s.faults = [];
  localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(s));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Laitteet" }));
  const name = s.assets[0].name;
  const card = within(
    screen.getByRole("heading", { name }).closest("section")!,
  );
  fireEvent.click(card.getByRole("button", { name: "Arkistoi laite" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText(new RegExp(s.assets[0].serial))).toBeInTheDocument();
  fireEvent.click(dialog.getByRole("button", { name: "Arkistoi laite" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.queryByRole("heading", { name })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Arkistoidut laitteet" }));
  const archived = within(
    screen.getByRole("heading", { name }).closest("section")!,
  );
  expect(archived.getByText("Arkistoitu")).toBeInTheDocument();
  expect(
    archived.getByRole("button", { name: "Huoltohistoria" }),
  ).toBeInTheDocument();
  expect(
    archived.queryByRole("button", { name: "Uusi huoltotyö" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    archived.getByRole("button", { name: "Palauta aktiiviseksi" }),
  );
  const restore = within(screen.getByRole("dialog"));
  fireEvent.change(restore.getByRole("combobox"), {
    target: { value: "line" },
  });
  fireEvent.click(
    restore.getByRole("button", { name: "Palauta aktiiviseksi" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Kaikki laitteet" }));
  expect(screen.getByRole("heading", { name })).toBeInTheDocument();
  const saved: Store = JSON.parse(
    localStorage.getItem("huoltopilotti-demo-v1")!,
  );
  expect(saved.assets[0].productionLineId).toBe("line");
});
it("server rejection preserves the record and modal; a second click cannot issue another lifecycle RPC", async () => {
  const s = base();
  s.faults = [];
  const snapshot: Snapshot = {
    store: s,
    organizationId: "org",
    organizationName: "Test",
    revision: 4,
    role: "owner",
    members: [],
  };
  const repo = new Repository({} as SupabaseClient, "org");
  let reject!: (reason: Error) => void;
  const mutate = vi.spyOn(repo, "lifecycle").mockImplementation(
    () =>
      new Promise((_, r) => {
        reject = r;
      }),
  );
  render(<App initialSnapshot={snapshot} repository={repo} />);
  fireEvent.click(screen.getByRole("button", { name: "Laitteet" }));
  const card = within(
    screen
      .getByRole("heading", { name: s.assets[0].name, hidden: true })
      .closest("section")!,
  );
  fireEvent.click(card.getByRole("button", { name: "Poista pysyvästi" }));
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: "Poista pysyvästi" }));
  fireEvent.click(dialog.getByRole("button", { name: "Poista pysyvästi" }));
  expect(mutate).toHaveBeenCalledTimes(1);
  reject(Error("offline"));
  await waitFor(() => expect(dialog.getByRole("alert")).toBeInTheDocument());
  expect(
    screen.getByRole("heading", { name: s.assets[0].name, hidden: true }),
  ).toBeInTheDocument();
  expect(
    dialog.getByRole("button", { name: "Poista pysyvästi" }),
  ).not.toBeDisabled();
});
it("lifecycle repository uses the shared revision RPC and reloads the authoritative snapshot", async () => {
  const snapshot: Snapshot = {
    store: base(),
    organizationId: "org",
    organizationName: "Test",
    revision: 4,
    role: "administrator",
    members: [],
  };
  const rpc = vi.fn(async (name: string) => ({
    error: null,
    data: name === "private_snapshot" ? snapshot : null,
  }));
  const repo = new Repository({ rpc } as unknown as SupabaseClient, "org");
  await repo.lifecycle(snapshot, {
    kind: "asset_restore",
    data: { id: "a1", productionLineId: null },
  });
  expect(rpc.mock.calls[0]).toEqual([
    "private_mutate",
    {
      p_org: "org",
      p_revision: 4,
      p_kind: "asset_restore",
      p_data: { id: "a1", productionLineId: null },
    },
  ]);
});
it("technicians and viewers can browse archived equipment without lifecycle controls", async () => {
  for (const role of ["technician", "viewer"] as const) {
    const store = base();
    store.assets[0].archivedAt = "2026-10-20";
    render(
      <App
        repository={new Repository({} as SupabaseClient, "org")}
        initialSnapshot={{
          store,
          revision: 1,
          organizationId: "org",
          organizationName: "Read test",
          role,
          members: [],
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Laitteet" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Arkistoidut laitteet" }),
    );
    expect(
      screen.getByRole("heading", { name: store.assets[0].name }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Palauta aktiiviseksi" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Poista pysyvästi" }),
    ).not.toBeInTheDocument();
    cleanup();
  }
});
it("archived equipment context does not leak into the active list when switching views", async () => {
  const { AssetsWorkspace } = await import("../src/AssetsWorkspace");
  const store = base();
  store.assets[0].archivedAt = "2026-10-20";
  render(
    <AssetsWorkspace
      store={store}
      lang="fi"
      query=""
      target={{ assetId: store.assets[0].id }}
      canManage={false}
      onCreateLine={vi.fn()}
      onEditLine={vi.fn()}
      onArchiveLine={vi.fn()}
      onCreateAsset={vi.fn()}
      onEditAsset={vi.fn()}
      onHistory={vi.fn()}
      onOpenJob={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("heading", { name: store.assets[0].name }),
  ).toBeInTheDocument();
  fireEvent.click(
    within(screen.getByRole("group", { name: "Laitenäkymät" })).getByRole(
      "button",
      { name: "Kaikki laitteet" },
    ),
  );
  expect(
    screen.queryByRole("heading", { name: store.assets[0].name }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: store.assets[1].name }),
  ).toBeInTheDocument();
});
