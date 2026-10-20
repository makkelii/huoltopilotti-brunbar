import { afterEach, beforeEach, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import App from "../src/App";
import { seed } from "../src/seed";
import { completeJob } from "../src/domain";
import { worklist } from "../src/worklist";
import { Repository } from "../src/data/repository";
const key = "huoltopilotti-demo-v1";
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("hp-welcome", "1");
  location.hash = "";
});
afterEach(cleanup);
const options = {
  filter: "active",
  onlyMine: false,
  userName: "Aleksi Korhonen",
  onlyOverdue: false,
  today: "2026-10-20",
  assetId: "",
  scope: "all",
  query: "",
  lang: "fi" as const,
};
it("searches location, line, serial and planned supplies and preserves combined filters", () => {
  const s = seed();
  s.productionLines = [
    {
      id: "line",
      name: "Pakkaamo",
      identifier: "PK1",
      location: "Itähalli",
      description: "",
    },
  ];
  s.assets.find((a) => a.id === s.jobs[0].assetId)!.productionLineId = "line";
  expect(
    worklist(s, { ...options, query: "Pakkaamo SKF" }).map((j) => j.id),
  ).toContain("j1");
  expect(
    worklist(s, { ...options, query: "Itähalli DEMO-2048" }).map((j) => j.id),
  ).toContain("j1");
  expect(
    worklist(s, { ...options, query: "Pakkaamo", scope: "unassigned" }),
  ).toEqual([]);
  expect(
    worklist(s, { ...options, onlyMine: true, userName: "Someone else" }),
  ).toEqual([]);
  expect(worklist(s, { ...options, query: "impossible" })).toEqual([]);
});
it("renders 25 of 120 jobs, pages through all and resets the page on search", () => {
  const s = seed();
  s.jobs = Array.from({ length: 120 }, (_, i) => ({
    ...s.jobs[0],
    id: `job-${i}`,
    name: `Huolto ${String(i).padStart(3, "0")}`,
    priority: "normal",
    requirements: [],
  }));
  localStorage.setItem(key, JSON.stringify(s));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Huoltotyöt" }));
  expect(screen.getAllByRole("row")).toHaveLength(26);
  fireEvent.click(screen.getByRole("button", { name: "Seuraavat työt" }));
  expect(
    screen.getByRole("button", { name: /Huolto 025/ }),
  ).toBeInTheDocument();
  fireEvent.change(
    screen.getByRole("textbox", {
      name: "Hae työtä, laitetta, linjaa, sijaintia tai nimikettä",
    }),
    { target: { value: "Huolto 119" } },
  );
  expect(
    screen.getByRole("button", { name: /Huolto 119/ }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("row")).toHaveLength(2);
  expect(
    screen.queryByRole("button", { name: "Seuraavat työt" }),
  ).not.toBeInTheDocument();
});
it("shows kit without opening a job and original same-equipment history inside its handbook", () => {
  const original = seed();
  let s = completeJob(
    original,
    "j1",
    { i2: 0.5, i1: 1 },
    "Edellinen korjaus ja koeajo",
    40,
    "Asentaja",
    "Tarkista akselin kuluma",
  );
  const prior = structuredClone(s.jobs[0]);
  s = {
    ...s,
    jobs: [
      s.jobs[0],
      {
        ...original.jobs[0],
        id: "next",
        name: "Seuraava laakerihuolto",
        recurrence: 0,
      },
    ],
  };
  localStorage.setItem(key, JSON.stringify(s));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Huoltotyöt" }));
  const row = within(
    screen.getByRole("row", { name: /Seuraava laakerihuolto/ }),
  );
  expect(row.getByText("Laakeri SKF 6205-2RS · 2 kpl")).toBeInTheDocument();
  fireEvent.click(row.getByRole("button", { name: /Seuraava laakerihuolto/ }));
  const form = within(screen.getByRole("dialog"));
  expect(form.getByRole("region", { name: "Ota mukaan" })).toBeInTheDocument();
  const history = form.getByRole("region", {
    name: "Aiemmat huollot samalla laitteella",
  });
  expect(history).toHaveTextContent("Kuljettimen laakerihuolto");
  fireEvent.click(
    within(history).getByText(/Kuljettimen laakerihuolto ·/, {
      selector: "summary",
    }),
  );
  expect(history).toHaveTextContent("Tarkista akselin kuluma");
  expect(history).toHaveTextContent("SKF 6205-2RS: 0.5");
  const saved = JSON.parse(localStorage.getItem(key)!);
  expect(saved.jobs[0]).toEqual(prior);
  expect(saved.items).toEqual(s.items);
});
it("opens worklist for a technician and keeps write controls unavailable to a viewer", () => {
  const store = seed(),
    repository = new Repository({} as never, "org");
  const snapshot = {
    store,
    revision: 1,
    organizationId: "org",
    organizationName: "Test",
    members: [],
    role: "technician" as const,
  };
  const first = render(
    <App repository={repository} initialSnapshot={snapshot} />,
  );
  expect(
    screen.getByRole("heading", { name: "Huoltotyöt" }),
  ).toBeInTheDocument();
  first.unmount();
  render(
    <App
      repository={repository}
      initialSnapshot={{ ...snapshot, role: "viewer" }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Huoltotyöt" }));
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(store.jobs[0].name) }),
  );
  expect(
    within(screen.getByRole("dialog")).queryByRole("button", {
      name: "Kirjaa valmistuminen",
    }),
  ).not.toBeInTheDocument();
});
