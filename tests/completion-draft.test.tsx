import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import App from "../src/App";
import { completionDraft } from "../src/completionDraft";
import { seed } from "../src/seed";
import { completeJob, type Store } from "../src/domain";
import { Repository } from "../src/data/repository";
const key = "huoltopilotti-demo-v1";
const fixture = () => {
  const s = seed();
  s.items.forEach((i) => {
    i.quantity = 20;
    i.reserved = 0;
  });
  s.jobs[0].recurrence = 0;
  s.jobs[0].requirements.push({
    id: "free",
    category: "parts",
    label: ["Tiiviste", "Seal", "Dichtung"],
    quantity: 1.5,
    state: "unchecked",
  });
  return s;
};
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("hp-welcome", "1");
  location.hash = "";
});
afterEach(cleanup);
function open(s: Store) {
  localStorage.setItem(key, JSON.stringify(s));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Huoltotyöt" }));
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(s.jobs[0].name) }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Kirjaa valmistuminen" }));
  return within(screen.getByRole("dialog"));
}
it("sums repeated parts, includes tools once, and never changes stock or the plan", () => {
  const s = fixture(),
    plan = s.jobs[0].requirements;
  const before = structuredClone(s);
  plan.push(
    { ...plan[1], id: "duplicate" },
    { ...plan[0], id: "tool-duplicate" },
  );
  const draft = completionDraft(plan, s.items, "fi");
  expect(draft.actual).toEqual({ i1: 1, i2: 4, i3: 1 });
  expect(draft.freeUsage).toEqual([
    { type: "parts", name: "Tiiviste", quantity: 1.5 },
  ]);
  expect(s.items).toEqual(before.items);
  expect(s.jobs[0].actual).toEqual(before.jobs[0].actual);
});
it("reports missing, inactive and wrong-type references without inventing free usage or clamping stock", () => {
  const s = fixture();
  s.items[0].inactive = true;
  s.items[1].quantity = 0;
  s.jobs[0].requirements.push({
    ...s.jobs[0].requirements[1],
    id: "missing",
    itemId: "absent",
  });
  const draft = completionDraft(s.jobs[0].requirements, s.items, "fi");
  expect(draft.actual.i1).toBeUndefined();
  expect(draft.actual.i2).toBe(2);
  expect(draft.unavailable).toHaveLength(2);
  expect(draft.freeUsage).toHaveLength(1);
  s.items[1].type = "tools";
  expect(
    completionDraft(s.jobs[0].requirements, s.items, "fi").actual.i2,
  ).toBeUndefined();
});
it("prefills visible editable rows; cancel preserves stock and history; confirmation stores only corrected usage", async () => {
  const s = fixture(),
    form = open(s);
  expect(
    form.getByRole("spinbutton", { name: /Käytetty määrä · SKF/ }),
  ).toHaveValue(2);
  expect(
    form.getByRole("spinbutton", { name: "Käytetty määrä · Tiiviste" }),
  ).toHaveValue(1.5);
  expect(JSON.parse(localStorage.getItem(key)!).items).toEqual(s.items);
  fireEvent.change(
    form.getByRole("spinbutton", { name: /Käytetty määrä · SKF/ }),
    { target: { value: "0.5" } },
  );
  fireEvent.click(form.getByRole("button", { name: /Poista.*NLGI/ }));
  fireEvent.click(form.getByRole("button", { name: /Poista.*Tiiviste/ }));
  fireEvent.click(form.getByRole("button", { name: "Kirjaa valmiiksi" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const saved: Store = JSON.parse(localStorage.getItem(key)!);
  expect(saved.jobs[0].actual).toEqual({ i1: 1, i2: 0.5 });
  expect(saved.jobs[0].notes).toBe("Huolto tehty suunnitelman mukaan.");
  expect(saved.jobs[0].freeUsage).toEqual([]);
  expect(saved.items.find((i) => i.id === "i1")!.quantity).toBe(20);
  expect(saved.items.find((i) => i.id === "i2")!.quantity).toBe(19.5);
  expect(saved.items.find((i) => i.id === "i3")!.quantity).toBe(20);
  expect(s.jobs[0].requirements).toEqual(saved.jobs[0].requirements);
  expect(() =>
    completeJob(saved, saved.jobs[0].id, { i2: 0.5 }, "duplicate"),
  ).toThrow();
});
it("closing the draft does not persist planned usage", () => {
  const s = fixture(),
    form = open(s);
  fireEvent.click(form.getByRole("button", { name: "Sulje" }));
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(s);
});
it("retains the corrected draft after failed save and blocks duplicate confirmation", async () => {
  const s = fixture(),
    repository = new Repository({} as never, "org");
  let reject!: (e: Error) => void;
  const save = vi.spyOn(repository, "save").mockImplementation(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  render(
    <App
      initialSnapshot={{
        store: s,
        revision: 1,
        organizationId: "org",
        organizationName: "Test",
        role: "technician",
        members: [],
      }}
      repository={repository}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Huoltotyöt" }));
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(s.jobs[0].name) }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Kirjaa valmistuminen" }));
  const form = within(screen.getByRole("dialog"));
  fireEvent.change(
    form.getByRole("spinbutton", { name: /Käytetty määrä · SKF/ }),
    { target: { value: "1" } },
  );
  const button = form.getByRole("button", { name: "Kirjaa valmiiksi" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(save).toHaveBeenCalledTimes(1);
  reject(new Error("offline"));
  await waitFor(() => expect(button).not.toBeDisabled());
  expect(
    form.getByRole("spinbutton", { name: /Käytetty määrä · SKF/ }),
  ).toHaveValue(1);
  expect(form.getByRole("alert")).toBeInTheDocument();
  expect(s.jobs[0].status).not.toBe("completed");
});
