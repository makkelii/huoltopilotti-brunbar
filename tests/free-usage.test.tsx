import { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CompletionItems } from "../src/CompletionItems";
import { completeJob, type FreeUsage } from "../src/domain";
import { MaintenanceHistory, completionTime } from "../src/MaintenanceHistory";
import { seed } from "../src/seed";
afterEach(cleanup);
const usage: FreeUsage[] = [
  { type: "tools", name: "  Oma avain  " },
  { type: "parts", name: "Tiiviste", quantity: 2.5 },
];
it("free entries survive reload, never create inventory or consume stock, and do not repeat", () => {
  const before = seed();
  const done = completeJob(
    before,
    "j1",
    { i2: 0.5 },
    "Vaihdettu",
    30,
    "Asentaja",
    "Tarkistettu",
    usage,
  );
  expect(done.items).toHaveLength(before.items.length);
  expect(done.items[1].quantity).toBe(before.items[1].quantity - 0.5);
  expect(done.items[0].quantity).toBe(before.items[0].quantity);
  expect(done.jobs[0].freeUsage?.[0].name).toBe("Oma avain");
  usage[0].name = "Changed later";
  expect(done.jobs[0].freeUsage?.[0].name).toBe("Oma avain");
  expect(JSON.parse(JSON.stringify(done)).jobs[0].freeUsage).toHaveLength(2);
  expect(done.jobs.at(-1)?.freeUsage).toBeUndefined();
  expect(() => completeJob(done, "j1", {}, "Again", 30)).toThrow();
});
it.each(
  [
    [{ type: "parts", name: "", quantity: 1 }],
    [{ type: "parts", name: "x", quantity: 0 }],
    [{ type: "parts", name: "x", quantity: -1 }],
    [{ type: "parts", name: "x", quantity: Infinity }],
    [{ type: "parts", name: "x", quantity: NaN }],
    [{ type: "parts", name: "x", quantity: 100000001 }],
    [{ type: "bad", name: "x" }],
    [{ type: "tools", name: " ".repeat(4) }],
    [{ type: "tools", name: "x".repeat(201) }],
    Array.from({ length: 101 }, () => ({ type: "tools", name: "x" })),
  ].map((entries) => [entries]),
)("rejects malformed usage without changing original stock", (entries) => {
  const before = seed();
  expect(() =>
    completeJob(
      before,
      "j1",
      { i2: 1 },
      "Done",
      30,
      "Tech",
      "",
      entries as FreeUsage[],
    ),
  ).toThrow();
  expect(before.items[1].quantity).toBe(1);
  expect(before.jobs[0].status).toBe("planned");
});
it("adds multiple manual tools without quantities and a fractional part with no registry search", () => {
  function Harness() {
    const [free, setFree] = useState<FreeUsage[]>([]);
    return (
      <>
        <CompletionItems
          lang="fi"
          actual={{}}
          onChange={() => {}}
          search={async () => {
            throw Error("should not search");
          }}
          requirements={[]}
          freeUsage={free}
          onFreeUsageChange={setFree}
        />
        <output>{JSON.stringify(free)}</output>
      </>
    );
  }
  render(<Harness />);
  for (const name of ["Oma avain", "Pihdit"]) {
    fireEvent.click(
      screen.getByRole("button", { name: "Lisää työkalu (valinnainen)" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.queryByRole("spinbutton")).not.toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText("Nimi"), {
      target: { value: name },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Lisää" }));
  }
  fireEvent.click(
    screen.getByRole("button", {
      name: "Lisää varaosa (valinnainen)",
    }),
  );
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Nimi"), {
    target: { value: "Tiiviste" },
  });
  fireEvent.change(dialog.getByRole("spinbutton"), { target: { value: "0" } });
  expect(dialog.getByRole("button", { name: "Lisää" })).toBeDisabled();
  fireEvent.change(dialog.getByRole("spinbutton"), {
    target: { value: "0.5" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Lisää" }));
  expect(screen.getByRole("status")).toHaveTextContent('"quantity":0.5');
  fireEvent.click(
    screen.getByRole("button", { name: "Poista valinta · Pihdit" }),
  );
  expect(screen.getByRole("status")).not.toHaveTextContent("Pihdit");
});
it("formats Finnish time explicitly in Helsinki, including winter time and invalid legacy dates", () => {
  expect(completionTime("2026-10-20T05:29:00Z", "fi")).toBe(
    "20.10.2026 klo 08.29",
  );
  expect(completionTime("2026-12-20T06:29:00Z", "fi")).toBe(
    "20.12.2026 klo 08.29",
  );
  expect(completionTime("broken", "fi")).toBe("—");
});
it("renders old history with missing registry names without leaking UUIDs or estimated time", () => {
  const uuid = "12345678-1234-1234-1234-123456789012";
  const job = {
    ...seed().jobs[0],
    status: "completed" as const,
    legacyReconstructed: true,
    actual: { [uuid]: 2 },
    technician: uuid,
    completedAt: "2026-10-20T05:29:00Z",
  };
  const { container } = render(
    <MaintenanceHistory job={job} asset="Laite" items={[]} lang="fi" />,
  );
  expect(container).not.toHaveTextContent(uuid);
  expect(container).not.toHaveTextContent("T05:29");
  expect(container).not.toHaveTextContent("60 min");
  expect(screen.getByText(/Aiemmin kirjattu tuote/)).toHaveTextContent("2 kpl");
  expect(screen.getByText("20.10.2026 klo 08.29")).toBeInTheDocument();
});

it("uses preserved legacy tool requirements when the registry item is absent", () => {
  const job = {
    ...seed().jobs[0],
    status: "completed" as const,
    legacyReconstructed: true,
    actual: { i1: 1 },
  };
  const { container } = render(
    <MaintenanceHistory job={job} asset="Laite" items={[]} lang="fi" />,
  );
  expect(container).toHaveTextContent("Käytetty");
  expect(container).not.toHaveTextContent("1 kpl");
});
