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
import { Repository, type Snapshot } from "../src/data/repository";
import type { SupabaseClient } from "@supabase/supabase-js";
const fixture = () => {
  const s = seed();
  s.jobs[0].recurrence = 0;
  s.jobs[0].description = "Tarkista laakeri";
  s.jobs[0].instructions = "Irrota virta";
  return completeJob(
    s,
    "j1",
    { i1: 1, i2: 1, i3: 0.25 },
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
it("prefills actual tools, parts and consumables instead of planned quantities, keeping work and safety instructions", () => {
  const s = fixture();
  const p = repeatPlan(s.jobs[0], s, "fi");
  expect(
    p.requirements
      .filter((r) => ["tools", "parts", "consumables"].includes(r.category))
      .map((r) => [r.itemId, r.quantity]),
  ).toEqual([
    ["i1", 1],
    ["i2", 1],
    ["i3", 0.25],
  ]);
  expect(
    p.requirements
      .filter((r) => ["documents", "safety", "personnel"].includes(r.category))
      .map((r) => r.label),
  ).toEqual(
    s.jobs[0].requirements
      .filter((r) => ["documents", "safety", "personnel"].includes(r.category))
      .map((r) => r.label),
  );
});
it("free usage alone replaces the old supply plan without creating registry entries", () => {
  const s = fixture();
  s.jobs[0].actual = {};
  s.jobs[0].usedItems = [];
  s.jobs[0].freeUsage = [
    { type: "tools", name: "Oma avain" },
    { type: "parts", name: "Oma tiiviste", quantity: 2.5 },
  ];
  const before = structuredClone(s);
  const p = repeatPlan(s.jobs[0], s, "fi");
  const rows = p.requirements.filter((r) =>
    ["tools", "parts", "consumables"].includes(r.category),
  );
  expect(rows.map((r) => [r.label[0], r.quantity, r.itemId])).toEqual([
    ["Oma avain", 1, undefined],
    ["Oma tiiviste", 2.5, undefined],
  ]);
  expect(s).toEqual(before);
});
it("falls back to the whole old plan only when there is no positive actual usage", () => {
  const s = fixture();
  s.jobs[0].actual = { i2: 0 };
  s.jobs[0].usedItems = [];
  s.jobs[0].freeUsage = [];
  const p = repeatPlan(s.jobs[0], s, "fi");
  expect(
    p.requirements.map((r) => [r.category, r.label, r.itemId, r.quantity]),
  ).toEqual(
    s.jobs[0].requirements.map((r) => [
      r.category,
      r.label,
      r.itemId,
      r.category === "tools" ? 1 : r.quantity,
    ]),
  );
  expect(p.requirements.every((r) => r.state === "unchecked")).toBe(true);
  expect(
    p.requirements.every(
      (r) => !s.jobs[0].requirements.some((old) => old.id === r.id),
    ),
  ).toBe(true);
});
it("uses frozen usage even without an actual map, preserving historical names and orphaned amounts as free planning", () => {
  const s = fixture();
  s.jobs[0].actual = {};
  s.jobs[0].requirements = [];
  s.jobs[0].usedItems![0].usedQuantity = 7;
  const original = s.jobs[0].usedItems!.map((i) => ({
    name: i.name,
    quantity: i.type === "tools" ? 1 : i.usedQuantity,
  }));
  s.items = [];
  const p = repeatPlan(s.jobs[0], s, "fi");
  expect(
    p.requirements.map((r) => ({ name: r.label[0], quantity: r.quantity })),
  ).toEqual(original);
  expect(p.requirements.every((r) => !r.itemId)).toBe(true);
  expect(p.warnings).toHaveLength(3);
});
it("supports legacy actual maps and falls back to historical planning labels for removed registry references", () => {
  const s = fixture();
  s.jobs[0].usedItems = undefined;
  s.items = s.items.filter((i) => i.id !== "i2");
  const p = repeatPlan(s.jobs[0], s, "fi");
  expect(
    p.requirements.find((r) => r.label[0] === "Laakeri SKF 6205-2RS"),
  ).toMatchObject({ category: "parts", quantity: 1 });
  expect(
    p.requirements.find((r) => r.label[0] === "Laakeri SKF 6205-2RS"),
  ).not.toHaveProperty("itemId");
});
it("combines registered and manual usage once, preserves frozen names, and never falls back per missing category", () => {
  const s = fixture();
  s.jobs[0].freeUsage = [
    { type: "tools", name: "Oma avain" },
    { type: "parts", name: "Oma tiiviste", quantity: 0.5 },
  ];
  s.items.find((i) => i.id === "i2")!.name = "Uusi rekisterinimi";
  const p = repeatPlan(s.jobs[0], s, "fi");
  expect(p.requirements.filter((r) => r.itemId === "i2")).toHaveLength(1);
  expect(p.requirements.find((r) => r.itemId === "i2")!.label[0]).toBe(
    "SKF 6205-2RS",
  );
  expect(
    p.requirements.filter((r) =>
      ["tools", "parts", "consumables"].includes(r.category),
    ),
  ).toHaveLength(5);
});
it("does not expose orphaned identifiers or substitute the old supply plan for unresolvable actual usage", () => {
  const s = fixture();
  s.jobs[0].usedItems = [];
  s.jobs[0].actual = { "ffffffff-ffff-ffff-ffff-ffffffffffff": 1 };
  const p = repeatPlan(s.jobs[0], s, "fi");
  expect(
    p.requirements.every(
      (r) => !["tools", "parts", "consumables"].includes(r.category),
    ),
  ).toBe(true);
  expect(p.warnings).toHaveLength(1);
  expect(JSON.stringify(p)).not.toContain("ffffffff");
  expect(() =>
    repeatPlan({ ...s.jobs[0], status: "planned" }, s, "fi"),
  ).toThrow("completed source required");
});
it.each(["viewer", "technician"] as const)(
  "retains %s permissions when opening original completed history",
  (role) => {
    const snapshot: Snapshot = {
      store: fixture(),
      organizationId: "org",
      organizationName: "Workshop",
      revision: 0,
      role,
      members: [],
    };
    render(
      <App
        initialSnapshot={snapshot}
        repository={new Repository({} as SupabaseClient, "org")}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Huoltotyöt" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Tila" }), {
      target: { value: "completed" },
    });
    fireEvent.click(screen.getByText(snapshot.store.jobs[0].name));
    if (role === "viewer")
      expect(
        screen.queryByRole("button", { name: "Tee sama huolto uudelleen" }),
      ).not.toBeInTheDocument();
    else {
      fireEvent.click(
        screen.getByRole("button", { name: "Tee sama huolto uudelleen" }),
      );
      expect(screen.getByLabelText("Määrä · SKF 6205-2RS")).toHaveValue(1);
    }
  },
);
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
  expect(dialog.getByLabelText("Määrä · SKF 6205-2RS")).toHaveValue(1);
  fireEvent.change(dialog.getByLabelText("Määrä · SKF 6205-2RS"), {
    target: { value: "3" },
  });
  fireEvent.click(
    dialog.getByRole("button", { name: "Poista · Momenttiavain T-014" }),
  );
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
  expect(
    next.requirements.find((r: { itemId?: string }) => r.itemId === "i2")
      .quantity,
  ).toBe(3);
  expect(
    next.requirements.some((r: { itemId?: string }) => r.itemId === "i1"),
  ).toBe(false);
  expect(next.actual).toEqual({});
  expect(next.freeUsage || []).toEqual([]);
  expect(next.usedItems || []).toEqual([]);
  expect(next.notes).toBe("");
  expect(next.technician).toBe("Aleksi Korhonen");
  expect(next.recurrence).toBe(0);
  expect(next).not.toHaveProperty("completedAt");
});
