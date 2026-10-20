import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { seed } from "../src/seed";
import { completeJob } from "../src/domain";
import { repeatPlan } from "../src/repeatMaintenance";
import App from "../src/App";
const fixture = () => {
  const s = seed();
  s.jobs[0].recurrence = 0;
  s.jobs[0].description = "Tarkista laakeri";
  s.jobs[0].instructions = "Irrota virta";
  return completeJob(
    s,
    "j1",
    { i2: 1 },
    "Vanha toteuma",
    25,
    "Vanha suorittaja",
  );
};
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("hp-welcome", "1");
  location.hash = "";
});
afterEach(cleanup);
it("copies only plan fields and resets acknowledgements without copying actual data or performer", () => {
  const s = fixture(),
    source = s.jobs[0];
  const before = structuredClone(s);
  const plan = repeatPlan(source, s, "fi");
  expect(plan.name).toBe(source.name);
  expect(plan.instructions).toBe("Irrota virta");
  expect(plan.requirements.every((r) => r.state === "unchecked")).toBe(true);
  expect(plan.requirements[0].id).not.toBe(source.requirements[0].id);
  for (const key of [
    "notes",
    "actual",
    "completedAt",
    "actualMinutes",
    "performedBy",
    "technician",
    "freeUsage",
    "usedItems",
  ])
    expect(plan).not.toHaveProperty(key);
  expect(s).toEqual(before);
});
it("archived/missing equipment is unselected, current placement is used, and stale inventory becomes explicit free planning", () => {
  const s = fixture();
  s.assets.find((a) => a.id === s.jobs[0].assetId)!.archivedAt = "2026-10-20";
  s.items[0].inactive = true;
  s.items = s.items.filter((i) => i.id !== "i2");
  const p = repeatPlan(s.jobs[0], s, "fi");
  expect(p.assetId).toBe("");
  expect(p.warnings.length).toBeGreaterThanOrEqual(2);
  expect(
    p.requirements.filter((r) => r.itemId === "i1" || r.itemId === "i2"),
  ).toEqual([]);
});
it("previous actual usage is a separate suggestion when no planned supplies existed", () => {
  const s = fixture();
  s.jobs[0].requirements = [];
  s.jobs[0].freeUsage = [{ type: "tools", name: "Oma avain" }];
  const p = repeatPlan(s.jobs[0], s, "fi");
  expect(p.requirements).toEqual([]);
  expect(p.suggestions.map((r) => r.label[0])).toEqual([
    "SKF 6205-2RS",
    "Oma avain",
  ]);
});
it("opens an editable draft, cancellation does not save, and new work leaves history and stock unchanged", async () => {
  const s = fixture();
  s.productionLines = [
    {
      id: "line-now",
      name: "Nykyinen linja",
      identifier: "N",
      location: "",
      description: "",
    },
  ];
  s.assets.find((a) => a.id === s.jobs[0].assetId)!.productionLineId =
    "line-now";
  localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(s));
  render(<App />);
  const open = () => {
    fireEvent.click(screen.getByRole("button", { name: "Huoltotyöt" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Tila" }), {
      target: { value: "completed" },
    });
    fireEvent.click(screen.getByText(s.jobs[0].name));
    fireEvent.click(
      screen.getByRole("button", { name: "Tee sama huolto uudelleen" }),
    );
  };
  open();
  expect(screen.getByRole("combobox", { name: "Tuotantolinjat" })).toHaveValue(
    "line-now",
  );
  expect(screen.getByLabelText("Työohjeet ja valmistelut")).toHaveValue(
    "Irrota virta",
  );
  expect(JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!)).toEqual(s);
  fireEvent.click(screen.getByRole("button", { name: "Peruuta" }));
  expect(JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!)).toEqual(s);
  open();
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Nimi", { exact: true }), {
    target: { value: "Uusi suunnitelma" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Tallenna" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const saved = JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!);
  expect(saved.jobs[0]).toEqual(s.jobs[0]);
  expect(saved.items).toEqual(s.items);
  const next = saved.jobs.at(-1);
  expect(next.id).not.toBe(s.jobs[0].id);
  expect(next.status).toBe("planned");
  expect(next.actual).toEqual({});
  expect(next.notes).toBe("");
  expect(next.technician).toBe("Aleksi Korhonen");
  expect(next.recurrence).toBe(0);
  expect(next).not.toHaveProperty("completedAt");
});
