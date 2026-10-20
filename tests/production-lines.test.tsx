import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import App from "../src/App";
import { AssetsWorkspace } from "../src/AssetsWorkspace";
import { seed } from "../src/seed";
import {
  archiveProductionLine,
  saveProductionLine,
} from "../src/productionLines";
import { Repository, type Snapshot } from "../src/data/repository";
import { completeJob, type ProductionLine } from "../src/domain";
const line: ProductionLine = {
  id: "line-a",
  name: "Pakkauslinja",
  identifier: "PACK-1",
  location: "Halli",
  description: "Pakkauskoneet",
};
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("hp-welcome", "1");
  location.hash = "";
});
afterEach(cleanup);
it("adds and edits a line, rejects duplicate identifiers, and archives without changing devices or historical jobs", () => {
  const original = completeJob(seed(), "j1", { i2: 1 }, "Repaired", 25);
  const withLine = saveProductionLine(original, line);
  withLine.assets[0] = { ...withLine.assets[0], productionLineId: line.id };
  const changed = saveProductionLine(withLine, { ...line, name: "Uusi nimi" });
  expect(changed.productionLines?.[0].name).toBe("Uusi nimi");
  expect(() =>
    saveProductionLine(changed, {
      ...line,
      id: "another",
      identifier: "pack-1",
    }),
  ).toThrow("duplicate");
  expect(() => saveProductionLine(changed, { ...line, name: " " })).toThrow();
  const archived = archiveProductionLine(changed, line.id);
  expect(archived.assets).toHaveLength(original.assets.length);
  expect(archived.assets[0].productionLineId).toBeNull();
  expect(archived.assets[0].name).toBe(original.assets[0].name);
  expect(archived.jobs).toEqual(original.jobs);
  expect(archived.items).toEqual(original.items);
  expect(archived.productionLines).toEqual([]);
  expect(changed.assets[0].productionLineId).toBe(line.id);
});
it("creates a line, assigns a legacy device, moves it to another line and then detaches it through the UI", async () => {
  const store = seed();
  store.productionLines = [line];
  localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(store));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Laitteet" }));
  fireEvent.click(screen.getByRole("button", { name: "Lisää tuotantolinja" }));
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Nimi"), {
    target: { value: "Täyttölinja" },
  });
  fireEvent.change(
    dialog.getByLabelText("Tuotantolinjan tunniste (valinnainen)"),
    { target: { value: "FILL-2" } },
  );
  fireEvent.click(dialog.getByRole("button", { name: "Tallenna" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const other = JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!)
    .productionLines[1];
  for (const target of [line.id, other.id, ""]) {
    const card = within(
      screen
        .getByRole("heading", { name: "CNC Haas VF-2" })
        .closest("section")!,
    );
    fireEvent.click(card.getByRole("button", { name: "Muokkaa" }));
    const form = within(screen.getByRole("dialog"));
    fireEvent.change(form.getByLabelText("Tuotantolinja (valinnainen)"), {
      target: { value: target },
    });
    fireEvent.click(form.getByRole("button", { name: "Tallenna" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const saved = JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!)
      .assets[0];
    expect(saved.productionLineId).toBe(target || null);
    expect(saved.manufacturer).toBe(store.assets[0].manufacturer);
  }
  fireEvent.click(screen.getByRole("button", { name: "Ilman tuotantolinjaa" }));
  expect(
    screen.getByRole("heading", { name: "CNC Haas VF-2" }),
  ).toBeInTheDocument();
});
it("groups current equipment history and open work, with safe archive confirmation", async () => {
  const store = completeJob(seed(), "j1", {}, "Confirmed", 20);
  store.productionLines = [line];
  store.assets[0].productionLineId = line.id;
  store.assets[1].productionLineId = line.id;
  localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(store));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Laitteet" }));
  fireEvent.click(
    screen
      .getByRole("group", { name: "Laitenäkymät" })
      .querySelectorAll("button")[1],
  );
  fireEvent.click(screen.getByRole("button", { name: /PACK-1 Pakkauslinja/ }));
  const views = within(
    screen.getByRole("group", { name: "Tuotantolinjan näkymät" }),
  );
  fireEvent.click(views.getByRole("button", { name: "Huoltohistoria" }));
  const history = within(
    screen.getByRole("region", { name: "Huoltohistoria" }),
  );
  fireEvent.click(
    history.getByRole("button", { name: new RegExp(store.jobs[0].name) }),
  );
  expect(
    within(screen.getByRole("dialog")).getByText("Confirmed"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sulje" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Arkistoi tuotantolinja" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Huoltotyöt ja historia säilyvät",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Arkistoi ja säilytä laitteet" }),
  );
  await waitFor(() =>
    expect(screen.getByText("Ei tuotantolinjoja")).toBeInTheDocument(),
  );
  const saved = JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!);
  expect(saved.assets).toHaveLength(store.assets.length);
  expect(saved.jobs).toEqual(store.jobs);
});
it("exposes no management actions to a technician or viewer while preserving line navigation", () => {
  const store = seed();
  store.productionLines = [line];
  render(
    <AssetsWorkspace
      store={store}
      lang="fi"
      query=""
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
    screen.queryByRole("button", { name: "Lisää tuotantolinja" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Muokkaa" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tuotantolinjat" }));
  fireEvent.click(screen.getByRole("button", { name: /PACK-1 Pakkauslinja/ }));
  expect(
    screen.queryByRole("button", { name: "Muokkaa tuotantolinjaa" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Arkistoi tuotantolinja" }),
  ).not.toBeInTheDocument();
});
it("keeps legacy snapshots without productionLines usable and filters search results", () => {
  render(
    <AssetsWorkspace
      store={seed()}
      lang="fi"
      query="nonexistent"
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
  expect(screen.getByText("Ei laitteita tässä näkymässä")).toBeInTheDocument();
});
it("sends line create/edit/archive through the existing revision-guarded RPC and reloads the authoritative snapshot", async () => {
  const before: Snapshot = {
    store: seed(),
    organizationId: "org",
    organizationName: "Test",
    role: "owner",
    revision: 5,
    members: [],
  };
  const rpc = vi.fn(async () => ({ data: before, error: null }));
  const repo = new Repository({ rpc } as unknown as SupabaseClient, "org");
  const withLine = saveProductionLine(before.store, line);
  await repo.save(before, withLine);
  expect(rpc.mock.calls[0]).toEqual([
    "private_mutate",
    { p_org: "org", p_revision: 5, p_kind: "production_line", p_data: line },
  ]);
  expect(rpc.mock.calls[1]).toEqual(["private_snapshot", { p_org: "org" }]);
  const nextBefore = { ...before, store: withLine };
  await repo.save(nextBefore, archiveProductionLine(withLine, line.id));
  expect(rpc.mock.calls[2]).toEqual([
    "private_mutate",
    {
      p_org: "org",
      p_revision: 5,
      p_kind: "production_line_archive",
      p_data: { id: line.id },
    },
  ]);
});

it("closes an unchanged line edit without issuing a production mutation", async () => {
  const store = seed();
  store.productionLines = [line];
  const save = vi.fn();
  const snapshot: Snapshot = {
    store,
    organizationId: "org",
    organizationName: "Company",
    role: "owner",
    revision: 1,
    members: [],
  };
  render(
    <App
      initialSnapshot={snapshot}
      repository={{ save } as unknown as Repository}
      userName="Manager"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Laitteet" }));
  fireEvent.click(screen.getByRole("button", { name: "Tuotantolinjat" }));
  fireEvent.click(screen.getByRole("button", { name: /PACK-1 Pakkauslinja/ }));
  fireEvent.click(
    screen.getByRole("button", { name: "Muokkaa tuotantolinjaa" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(save).not.toHaveBeenCalled();
});

it("clears the list search when opening a production line so its work and history remain visible", () => {
  const store = seed();
  store.productionLines = [line];
  store.assets[0].productionLineId = line.id;
  localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(store));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Laitteet" }));
  fireEvent.change(screen.getByLabelText(/Hae laitteita tai huoltotöitä/), {
    target: { value: "PACK-1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tuotantolinjat" }));
  fireEvent.click(screen.getByRole("button", { name: /PACK-1 Pakkauslinja/ }));
  expect(screen.getByLabelText(/Hae laitteita tai huoltotöitä/)).toHaveValue(
    "",
  );
  fireEvent.click(
    within(
      screen.getByRole("group", { name: "Tuotantolinjan näkymät" }),
    ).getByRole("button", { name: "Avoimet huoltotyöt" }),
  );
  expect(
    screen.getByRole("region", { name: "Avoimet huoltotyöt" }),
  ).toHaveTextContent(
    store.jobs.find((job) => job.assetId === store.assets[0].id)!.name,
  );
});
