import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../src/App";
import { seed } from "../src/seed";
import { EquipmentPicker } from "../src/EquipmentPicker";
import { useState } from "react";
import { TemplateEditor } from "../src/TemplateEditor";
import { CompletionItems } from "../src/CompletionItems";
import type { FreeUsage, Requirement } from "../src/domain";
const fixture = () => {
  const s = seed();
  s.productionLines = [
    {
      id: "l1",
      name: "Linja A",
      identifier: "A",
      location: "",
      description: "",
    },
    {
      id: "l2",
      name: "Linja B",
      identifier: "B",
      location: "",
      description: "",
    },
  ];
  s.assets[0].productionLineId = "l1";
  s.assets[1].productionLineId = "l2";
  s.assets[1].name = s.assets[0].name;
  return s;
};
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("hp-welcome", "1");
  location.hash = "";
});
afterEach(cleanup);
it("clears incompatible equipment immediately and allows unassigned equipment", () => {
  const s = fixture();
  function Harness() {
    const [scope, ss] = useState("l1"),
      [asset, sa] = useState("a1");
    return (
      <EquipmentPicker
        assets={s.assets}
        lines={s.productionLines!}
        lang="fi"
        scope={scope}
        assetId={asset}
        onScope={ss}
        onAsset={sa}
      />
    );
  }
  render(<Harness />);
  expect(screen.getByRole("combobox", { name: "Laite" })).toHaveValue("a1");
  fireEvent.change(screen.getByRole("combobox", { name: "Tuotantolinjat" }), {
    target: { value: "l2" },
  });
  expect(screen.getByRole("combobox", { name: "Laite" })).toHaveValue("");
  expect(
    screen.queryByRole("option", { name: new RegExp(s.assets[0].serial) }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Tuotantolinjat" }), {
    target: { value: "unassigned" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Laite" }), {
    target: { value: s.assets[2].id },
  });
  expect(screen.getByRole("combobox", { name: "Laite" })).toHaveValue(
    s.assets[2].id,
  );
});
it("prefills a new job from equipment; editing preserves equipment and planning does not consume", async () => {
  const s = fixture();
  localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(s));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Laitteet" }));
  const card = within(
    screen
      .getAllByRole("heading", { name: s.assets[0].name })[0]
      .closest("section")!,
  );
  fireEvent.click(card.getByRole("button", { name: "Uusi huoltotyö" }));
  const form = within(screen.getByRole("dialog"));
  expect(form.getByRole("combobox", { name: "Laite" })).toHaveValue("a1");
  expect(form.getByRole("combobox", { name: "Tuotantolinjat" })).toHaveValue(
    "l1",
  );
  fireEvent.change(form.getByLabelText("Nimi", { exact: true }), {
    target: { value: "Suunnittelutesti" },
  });
  fireEvent.click(form.getByText("Lisää suunniteltu tarve tai ohje"));
  fireEvent.change(form.getByLabelText("Tarpeen nimi tai ohje"), {
    target: { value: "Oma tiiviste" },
  });
  fireEvent.click(form.getByRole("button", { name: "Lisää nimike" }));
  fireEvent.click(form.getByRole("button", { name: "Tallenna" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const saved = JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!);
  const job = saved.jobs.at(-1);
  expect(job.requirements.at(-1).itemId).toBeUndefined();
  expect(saved.items).toEqual(s.items);
  expect(saved.templateRequirements).toEqual(s.templateRequirements);
  fireEvent.click(screen.getByRole("button", { name: "Huoltotyöt" }));
  const row = screen.getByText("Suunnittelutesti").closest("tr")!;
  fireEvent.click(within(row).getByRole("button", { name: "Muokkaa" }));
  expect(screen.getByRole("combobox", { name: "Laite" })).toHaveValue("a1");
  expect(screen.getByRole("combobox", { name: "Tuotantolinjat" })).toHaveValue(
    "l1",
  );
});
it("searches hundreds of devices by serial without exposing UUIDs; no lines hides line control", () => {
  const s = seed();
  const assets = Array.from({ length: 200 }, (_, i) => ({
    ...s.assets[0],
    id: `device-${i}`,
    serial: `SER-${i}`,
  }));
  function H() {
    const [asset, sa] = useState("");
    return (
      <EquipmentPicker
        assets={assets}
        lines={[]}
        lang="fi"
        scope="all"
        assetId={asset}
        onScope={() => {}}
        onAsset={sa}
      />
    );
  }
  render(<H />);
  expect(
    screen.queryByRole("combobox", { name: "Tuotantolinjat" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "SER-199" },
  });
  expect(screen.getAllByRole("option")).toHaveLength(2);
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "device-199" },
  });
  expect(screen.getByRole("combobox")).toHaveValue("device-199");
});
it("template save has a synchronous duplicate guard and retains its draft on failure", async () => {
  let resolve!: (value: boolean) => void;
  const save = vi.fn(
    () =>
      new Promise<boolean>((r) => {
        resolve = r;
      }),
  );
  render(<TemplateEditor items={[]} lang="fi" current={[]} onSave={save} />);
  fireEvent.click(screen.getByText("Lisää suunniteltu tarve tai ohje"));
  fireEvent.change(screen.getByLabelText("Tarpeen nimi tai ohje"), {
    target: { value: "Tiiviste" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lisää nimike" }));
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  expect(save).toHaveBeenCalledTimes(1);
  resolve(false);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Tallenna" })).not.toBeDisabled(),
  );
  expect(screen.getByText("Tiiviste", { exact: true })).toBeInTheDocument();
});
it("suggestions require explicit confirmation; free usage and registered quantities remain separate", () => {
  const s = seed();
  const requirements: Requirement[] = [
    {
      id: "x",
      category: "parts",
      label: ["Oma osa", "Own", "Eigen"],
      quantity: 4,
      state: "unchecked",
    },
    {
      id: "y",
      category: "parts",
      itemId: "i2",
      label: ["Laakeri", "Bearing", "Lager"],
      quantity: 2,
      state: "unchecked",
    },
  ];
  function H() {
    const [a, sa] = useState<Record<string, number>>({}),
      [f, sf] = useState<FreeUsage[]>([]);
    return (
      <>
        <CompletionItems
          lang="fi"
          actual={a}
          onChange={sa}
          freeUsage={f}
          onFreeUsageChange={sf}
          inventory={s.items}
          search={async () => ({ items: [], hasMore: false })}
          requirements={requirements}
        />
        <output>{JSON.stringify({ a, f })}</output>
      </>
    );
  }
  render(<H />);
  expect(screen.getByRole("status").textContent).toBe('{"a":{},"f":[]}');
  fireEvent.click(screen.getByText("Suunnitellut tarvikkeet"));
  fireEvent.click(
    screen.getByRole("button", { name: "Vahvista käyttöön · Oma osa" }),
  );
  expect(screen.getByRole("status").textContent).toContain('"a":{}');
  fireEvent.click(
    screen.getByRole("button", { name: "Vahvista käyttöön · Laakeri" }),
  );
  expect(screen.getByRole("status").textContent).toContain('"i2":1');
  expect(
    screen.getByRole("spinbutton", { name: "Käytetty määrä · Oma osa" }),
  ).toHaveValue(4);
});
it("failed job saves preserve the draft and entity ID, and ignore a second click while pending", async () => {
  const { Repository } = await import("../src/data/repository");
  const store = fixture();
  const snapshot = {
    store,
    revision: 1,
    organizationId: "org",
    organizationName: "Test",
    role: "technician" as const,
    members: [{ userId: "u", name: "Asentaja", role: "technician" as const }],
  };
  const repository = new Repository({} as never, "org");
  let fail!: (e: Error) => void;
  const save = vi.spyOn(repository, "save").mockImplementation(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  render(
    <App
      initialSnapshot={snapshot}
      repository={repository}
      userName="Asentaja"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Uusi huoltotyö" }));
  fireEvent.change(screen.getByLabelText("Nimi", { exact: true }), {
    target: { value: "Säilyvä luonnos" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Laite" }), {
    target: { value: "a1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  expect(save).toHaveBeenCalledTimes(1);
  const firstId = save.mock.calls[0][1].jobs.at(-1)!.id;
  fail(Error("offline"));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Tallenna" })).not.toBeDisabled(),
  );
  expect(screen.getByLabelText("Nimi", { exact: true })).toHaveValue(
    "Säilyvä luonnos",
  );
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][1].jobs.at(-1)!.id).toBe(firstId);
  fail(Error("offline"));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Tallenna" })).not.toBeDisabled(),
  );
});
it("viewer can inspect a job but cannot edit requirements or start and complete work", async () => {
  const { Repository } = await import("../src/data/repository");
  const store = fixture();
  render(
    <App
      repository={new Repository({} as never, "org")}
      initialSnapshot={{
        store,
        revision: 1,
        organizationId: "org",
        organizationName: "Test",
        role: "viewer",
        members: [],
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Huoltotyöt" }));
  expect(
    screen.queryByRole("button", { name: "Muokkaa" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByText(store.jobs[0].name));
  const dialog = within(screen.getByRole("dialog"));
  expect(
    dialog.queryByRole("button", { name: "Kirjaa valmistuminen" }),
  ).not.toBeInTheDocument();
  expect(
    dialog.queryByRole("button", { name: "Työn alla" }),
  ).not.toBeInTheDocument();
  for (const input of dialog.getAllByRole("combobox"))
    expect(input).toBeDisabled();
});
it("job filters combine line, equipment, overdue and assignee and clear an incompatible device filter", () => {
  const s = fixture();
  s.jobs[0] = {
    ...s.jobs[0],
    assetId: "a1",
    technician: "Aleksi Korhonen",
    due: "2000-01-01",
  };
  s.jobs[1] = {
    ...s.jobs[1],
    assetId: "a2",
    technician: "Muu",
    due: "2099-01-01",
  };
  localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(s));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Huoltotyöt" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Tuotantolinjat" }), {
    target: { value: "l1" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Laite" }), {
    target: { value: "a1" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: "Omat työt" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Myöhässä" }));
  expect(screen.getByText(s.jobs[0].name)).toBeInTheDocument();
  expect(screen.queryByText(s.jobs[1].name)).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Tuotantolinjat" }), {
    target: { value: "l2" },
  });
  expect(screen.getByRole("combobox", { name: "Laite" })).toHaveValue("");
  expect(screen.getByText("Ei tuloksia")).toBeInTheDocument();
});
it("tools in planning have no quantity, registry options match category and inactive items are excluded", async () => {
  const { RequirementsEditor } = await import("../src/RequirementsEditor");
  const s = seed();
  s.items[0].inactive = true;
  function H() {
    const [rows, setRows] = useState<Requirement[]>([]);
    return (
      <RequirementsEditor
        items={s.items}
        lang="fi"
        value={rows}
        onChange={setRows}
      />
    );
  }
  render(<H />);
  fireEvent.click(screen.getByText("Lisää suunniteltu tarve tai ohje"));
  fireEvent.change(screen.getByRole("combobox", { name: "Tyyppi" }), {
    target: { value: "tools" },
  });
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: /Momenttiavain/ }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tarpeen nimi tai ohje"), {
    target: { value: "Oma avain" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lisää nimike" }));
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  expect(screen.getByText("Oma avain", { exact: true })).toBeInTheDocument();
});
it("large production-line selection is searchable and stale equipment is absent after a relationship changes", () => {
  const s = fixture();
  const lines = Array.from({ length: 30 }, (_, i) => ({
    ...s.productionLines![0],
    id: `line-${i}`,
    identifier: `LN-${i}`,
  }));
  const asset = { ...s.assets[0], productionLineId: "line-29" };
  const props = {
    assets: [asset],
    lines,
    lang: "fi" as const,
    scope: "line-29",
    assetId: "a1",
    onScope: vi.fn(),
    onAsset: vi.fn(),
  };
  const { rerender } = render(<EquipmentPicker {...props} />);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "LN-29" },
  });
  expect(
    screen.getByRole("option", { name: "Linja A · LN-29" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: "Linja A · LN-10" }),
  ).not.toBeInTheDocument();
  rerender(
    <EquipmentPicker
      {...props}
      assets={[{ ...asset, productionLineId: "line-10" }]}
    />,
  );
  expect(screen.getByRole("combobox", { name: "Laite" })).toHaveValue("");
  expect(
    screen.queryByRole("option", { name: new RegExp(asset.serial) }),
  ).not.toBeInTheDocument();
});
