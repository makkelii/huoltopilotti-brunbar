import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Dashboard } from "../src/Dashboard";
import { dashboardJobs, workshopDate } from "../src/dashboard";
import { seed } from "../src/seed";
import App from "../src/App";
import type { Snapshot, Repository } from "../src/data/repository";

afterEach(() => {
  cleanup();
  localStorage.clear();
  location.hash = "";
});
const data = () => {
  const s = seed();
  const job = s.jobs[0];
  s.jobs = [
    {
      ...job,
      id: "late",
      name: "Myöhässä oleva",
      due: "2026-10-19",
      technician: "Asentaja",
    },
    {
      ...job,
      id: "today",
      name: "Tämän päivän työ",
      due: "2026-10-20",
      technician: "Muu",
    },
    {
      ...job,
      id: "week",
      name: "Viikon työ",
      due: "2026-10-27",
      technician: "Asentaja",
      status: "progress",
    },
    {
      ...job,
      id: "later",
      name: "Myöhempi",
      due: "2026-10-28",
      technician: "Muu",
    },
    {
      ...job,
      id: "done-old",
      name: "Vanha valmistunut",
      due: "2026-10-01",
      status: "completed",
      completedAt: "2026-10-18T10:00:00Z",
    },
    {
      ...job,
      id: "done-new",
      name: "Uusin valmistunut",
      due: "2026-10-01",
      status: "completed",
      completedAt: "2026-10-20T05:29:00Z",
    },
  ];
  return s;
};
it("groups real open jobs by calendar boundaries and assignment, excludes completed jobs, and orders history", () => {
  const store = data();
  const original = structuredClone(store.jobs);
  const g = dashboardJobs(store.jobs, "Asentaja", "2026-10-20");
  expect(g.overdue.map((j) => j.id)).toEqual(["late"]);
  expect(g.dueSoon.map((j) => j.id)).toEqual(["today", "week"]);
  expect(g.progress.map((j) => j.id)).toEqual(["week"]);
  expect(g.mine.map((j) => j.id)).toEqual(["late", "week"]);
  expect(g.recent.map((j) => j.id)).toEqual(["done-new", "done-old"]);
  expect(store.jobs).toEqual(original);
  expect(dashboardJobs(store.jobs, "", "2026-10-20").mine).toEqual([]);
});
it("uses Helsinki dates around UTC midnight and the daylight saving change", () => {
  expect(workshopDate(new Date("2026-10-19T22:30:00Z"))).toBe("2026-10-20");
  expect(workshopDate(new Date("2026-12-19T22:30:00Z"))).toBe("2026-12-20");
  expect(
    dashboardJobs(data().jobs, "Asentaja", "2026-10-20").dueSoon,
  ).toHaveLength(2);
});
it("switches queues, opens the selected job, and renders readable latest completions", () => {
  const onOpen = vi.fn();
  render(
    <Dashboard
      store={data()}
      userName="Asentaja"
      today="2026-10-20"
      lang="fi"
      onOpen={onOpen}
      onAll={() => {}}
    />,
  );
  expect(
    within(screen.getByRole("group", { name: "Työjonot" })).getByRole(
      "button",
      { name: /Myöhässä.*1/ },
    ),
  ).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: /Erääntyy pian.*2/ }));
  const queue = within(screen.getByRole("region", { name: "Erääntyy pian" }));
  expect(queue.getByText("Tämän päivän työ")).toBeInTheDocument();
  expect(queue.queryByText("Myöhempi")).not.toBeInTheDocument();
  fireEvent.click(queue.getByRole("button", { name: /Tämän päivän työ/ }));
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "today" }));
  const history = within(
    screen.getByRole("region", { name: "Viimeksi valmistuneet" }),
  );
  expect(history.getAllByRole("button")[0]).toHaveTextContent(
    "Uusin valmistunut",
  );
  expect(history.getByText("20.10.2026 klo 08.29")).toBeInTheDocument();
});
it("shows a genuinely empty live snapshot without demo statistics or fake activity", () => {
  localStorage.setItem("hp-welcome", "1");
  const empty = data();
  empty.jobs = [];
  empty.assets = [];
  empty.items = [];
  empty.events = [];
  const snapshot: Snapshot = {
    store: empty,
    organizationId: "org",
    organizationName: "Oikea yritys",
    role: "viewer",
    revision: 0,
    members: [],
  };
  render(
    <App
      initialSnapshot={snapshot}
      repository={{} as Repository}
      userName="Asentaja"
    />,
  );
  expect(
    screen.getByText("Ei vielä valmistuneita huoltoja"),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Nordic Works/)).not.toBeInTheDocument();
  expect(screen.queryByText("Demotila")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Uusi huoltotyö" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("group", { name: "Työjonot" }).querySelectorAll("strong"),
  ).toHaveLength(4);
  for (const count of screen
    .getByRole("group", { name: "Työjonot" })
    .querySelectorAll("strong"))
    expect(count.textContent).toBe("0");
});
it("keeps six primary destinations and preserves templates, reports and legacy direct links", () => {
  localStorage.setItem("hp-welcome", "1");
  render(<App />);
  const nav = within(screen.getByRole("navigation", { name: "Päänavigaatio" }));
  expect(
    nav.getAllByRole("button").map((button) => button.textContent),
  ).toEqual([
    "Etusivu",
    "Huoltotyöt",
    "Laitteet",
    "Varasto",
    "Huoltotutka",
    "Asetukset",
  ]);
  fireEvent.click(nav.getByRole("button", { name: "Asetukset" }));
  fireEvent.click(screen.getByRole("button", { name: "Huoltopohjat" }));
  expect(location.hash).toBe("#templates");
  expect(nav.getByRole("button", { name: "Asetukset" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  fireEvent.click(nav.getByRole("button", { name: "Asetukset" }));
  fireEvent.click(screen.getByRole("button", { name: "Raportit" }));
  expect(location.hash).toBe("#reports");
});

it("keeps technical asset and fault identifiers out of normal screens", async () => {
  localStorage.setItem("hp-welcome", "1");
  const store = seed();
  const assetId = "12345678-1234-1234-1234-123456789012";
  const faultId = "87654321-1234-1234-1234-123456789012";
  store.assets[0].id = assetId;
  store.faults[0].id = faultId;
  localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(store));
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Laitteet" }));
  expect(container).not.toHaveTextContent(assetId.slice(0, 8));
  fireEvent.click(screen.getByRole("button", { name: "Huoltotutka" }));
  fireEvent.change(screen.getByLabelText("Kuvaus"), {
    target: { value: "Moottori pysähtyy" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Etsi historiasta" }));
  expect(await screen.findByText(store.faults[0].cause[0])).toBeInTheDocument();
  expect(container).not.toHaveTextContent(faultId);
});
