import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MaintenanceHistory, historyDate } from "../src/MaintenanceHistory";
import { completeJob } from "../src/domain";
import { seed } from "../src/seed";
afterEach(cleanup);
it("shows local completion facts, named performer and both usage sources without technical data", () => {
  const done = completeJob(
    seed(),
    "j1",
    { i1: 1, i2: 1 },
    "Bearing replaced",
    42,
    "Matti Meikäläinen",
    "Check next week",
    [
      { type: "tools", name: "Loan wrench" },
      { type: "parts", name: "Seal", quantity: 2, unit: "kpl" },
    ],
  );
  const job = {
    ...done.jobs[0],
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    completedAt: "2026-10-20T05:29:00Z",
  };
  render(<MaintenanceHistory job={job} asset="Motor" items={[]} lang="fi" />);
  expect(screen.getByText("20.10.2026 klo 08.29")).toBeInTheDocument();
  expect(screen.getByText("Matti Meikäläinen")).toBeInTheDocument();
  expect(screen.getByText("Seal: 2 kpl")).toBeInTheDocument();
  expect(screen.getByText("Loan wrench")).toBeInTheDocument();
  expect(screen.getByText("Bearing replaced")).toBeInTheDocument();
  expect(document.body.textContent).not.toContain(job.id);
  expect(document.body.textContent).not.toContain(job.completedAt);
});
it("displays old history without registry matches or timestamps without exposing identifiers", () => {
  const key = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const job = {
    ...seed().jobs[0],
    status: "completed" as const,
    legacyReconstructed: true,
    actual: { [key]: 2 },
    requirements: [],
    completedAt: undefined,
  };
  render(<MaintenanceHistory job={job} asset="Motor" items={[]} lang="fi" />);
  expect(
    screen.getByText("Aiemmin kirjattu nimike: 2 kpl"),
  ).toBeInTheDocument();
  expect(document.body.textContent).not.toContain(key);
  expect(historyDate("invalid")).toBe("—");
});
it("prefers an available member name over the recorded email", () => {
  const job = {
    ...seed().jobs[0],
    performedBy: "matti@example.invalid",
    performerId: "person",
  };
  render(
    <MaintenanceHistory
      job={job}
      asset="Motor"
      items={[]}
      members={[{ userId: "person", name: "Matti" }]}
      lang="fi"
    />,
  );
  expect(screen.getByText("Matti")).toBeInTheDocument();
  expect(document.body.textContent).not.toContain("matti@example.invalid");
});
