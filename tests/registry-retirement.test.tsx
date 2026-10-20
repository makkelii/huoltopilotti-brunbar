import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { seed } from "../src/seed";
import { completeJob } from "../src/domain";
import { applyLifecycle, confirmationIdentifier } from "../src/lifecycle";
import { RegistryRemoveAction } from "../src/RegistryRemoveAction";
import { demoHistoryService } from "../src/data/historySearch";
import App from "../src/App";
const fixture = () => {
  const s = seed();
  s.jobs = [{ ...s.jobs[0], recurrence: 0 }];
  return completeJob(s, "j1", {}, "Moottorin korjaus", 20);
};
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("hp-welcome", "1");
  location.hash = "";
});
afterEach(cleanup);
it("removes only an archived record after exact confirmation and retains all historical anchors", async () => {
  const s = fixture();
  const asset = s.assets.find((a) => a.id === s.jobs[0].assetId)!;
  expect(() =>
    applyLifecycle(s, {
      kind: "asset_remove_registry",
      data: { id: asset.id, confirmation: asset.serial },
    }),
  ).toThrow("unavailable");
  const archived = applyLifecycle(s, {
    kind: "asset_archive",
    data: { id: asset.id },
  });
  expect(() =>
    applyLifecycle(archived, {
      kind: "asset_remove_registry",
      data: { id: asset.id, confirmation: "wrong" },
    }),
  ).toThrow("confirmation");
  const next = applyLifecycle(archived, {
    kind: "asset_remove_registry",
    data: { id: asset.id, confirmation: asset.serial },
  });
  expect(next.assets.some((a) => a.id === asset.id)).toBe(false);
  expect(next.removedAssets![0].name).toBe(asset.name);
  expect(next.jobs).toEqual(s.jobs);
  expect(next.faults).toEqual(s.faults);
  expect(next.items).toEqual(s.items);
  expect(() =>
    applyLifecycle(next, { kind: "asset_restore", data: { id: asset.id } }),
  ).toThrow("unavailable");
  const result = await demoHistoryService(next).search(
    {
      query: "korjaus",
      assetId: "",
      lineId: "",
      from: "",
      to: "",
      kind: "maintenance",
      page: 0,
    },
    new AbortController().signal,
  );
  expect(result.results[0].removed).toBe(true);
  expect(result.results[0].assetName).toBe(asset.name);
});
it("requires the human identifier and blocks duplicate submission while waiting for the authoritative response", async () => {
  const s = fixture();
  s.assets[0].archivedAt = "2026-10-20";
  let reject!: (reason: Error) => void;
  const action = vi.fn(
    () =>
      new Promise<boolean>((_, r) => {
        reject = r;
      }),
  );
  render(
    <RegistryRemoveAction
      entity={s.assets[0]}
      type="asset"
      store={s}
      lang="fi"
      onAction={action}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Poista lopullisesti rekisteristä" }),
  );
  const dialog = within(screen.getByRole("dialog"));
  expect(
    dialog.getByRole("button", { name: "Poista lopullisesti rekisteristä" }),
  ).toBeDisabled();
  fireEvent.change(dialog.getByRole("textbox"), {
    target: { value: confirmationIdentifier(s.assets[0]) },
  });
  fireEvent.click(
    dialog.getByRole("button", { name: "Poista lopullisesti rekisteristä" }),
  );
  fireEvent.click(
    dialog.getByRole("button", { name: "Poista lopullisesti rekisteristä" }),
  );
  expect(action).toHaveBeenCalledTimes(1);
  reject(Error("offline"));
  await screen.findByRole("alert");
  expect(dialog.getByRole("textbox")).toHaveValue(s.assets[0].serial);
  expect(
    dialog.getByRole("button", { name: "Poista lopullisesti rekisteristä" }),
  ).not.toBeDisabled();
});
it("removed equipment disappears from both registry views and completed work remains findable", async () => {
  const s = fixture();
  const a = s.assets.find((a) => a.id === s.jobs[0].assetId)!;
  const next = applyLifecycle(
    applyLifecycle(s, { kind: "asset_archive", data: { id: a.id } }),
    {
      kind: "asset_remove_registry",
      data: { id: a.id, confirmation: a.serial },
    },
  );
  localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(next));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Laitteet" }));
  expect(
    screen.queryByRole("heading", { name: a.name }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Arkistoidut laitteet" }));
  expect(
    screen.queryByRole("heading", { name: a.name }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Huoltotyöt" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Tila" }), {
    target: { value: "completed" },
  });
  fireEvent.click(screen.getByText(s.jobs[0].name));
  expect(screen.getByRole("dialog")).toHaveTextContent("Moottorin korjaus");
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "Poistettu rekisteristä",
  );
});
it("line registry removal retains historical metadata without moving devices or resurrecting the line", () => {
  const s = fixture();
  s.productionLines = [
    {
      id: "line",
      name: "Vanha linja",
      identifier: "OLD",
      location: "",
      description: "",
    },
  ];
  s.assets[0].productionLineId = "line";
  const archived = applyLifecycle(s, {
    kind: "production_line_archive",
    data: { id: "line" },
  });
  const result = applyLifecycle(archived, {
    kind: "production_line_remove_registry",
    data: { id: "line", confirmation: "OLD" },
  });
  expect(result.archivedProductionLines).toEqual([]);
  expect(result.removedProductionLines![0].name).toBe("Vanha linja");
  expect(result.assets).toEqual(archived.assets);
  expect(result.jobs).toEqual(s.jobs);
  expect(() =>
    applyLifecycle(result, {
      kind: "production_line_restore",
      data: { id: "line" },
    }),
  ).toThrow("unavailable");
});
