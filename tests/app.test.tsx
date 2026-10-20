import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, it, expect } from "vitest";
import App from "../src/App";
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("hp-welcome", "1");
  location.hash = "";
});
afterEach(cleanup);
it("creates equipment and persists it", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Laitteet" }));
  fireEvent.click(screen.getByRole("button", { name: /Lisää laite/ }));
  fireEvent.change(screen.getByLabelText("Nimi"), {
    target: { value: "Test equipment" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(
    screen.getByRole("heading", { name: "Test equipment" }),
  ).toBeInTheDocument();
  expect(localStorage.getItem("huoltopilotti-demo-v1")).toContain(
    "Test equipment",
  );
});
it("switches navigation language", async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText("Kieli"), { target: { value: "de" } });
  expect(screen.getByRole("button", { name: "Anlagen" })).toBeInTheDocument();
  expect(document.documentElement.lang).toBe("de");
});
it("creates a maintenance job", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Uusi huoltotyö" }));
  fireEvent.change(screen.getByLabelText("Nimi"), {
    target: { value: "New test service" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: /Huoltotyöt 5/ }));
  expect(screen.getByText("New test service")).toBeInTheDocument();
});
it("records confirmed fault evidence and retrieves it", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Huoltotutka" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Kirjaa vahvistettu vika" }),
  );
  fireEvent.change(screen.getByLabelText("Kuvaile oireet"), {
    target: { value: "Pneumatiikka vuotaa venttiilissä" },
  });
  fireEvent.change(screen.getByLabelText("Vahvistettu syy ja korjaus"), {
    target: { value: "Vaurioitunut tiiviste vaihdettu" },
  });
  fireEvent.click(
    screen.getByLabelText("Vahvistan, että syy ja korjaus on tarkistettu."),
  );
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.change(screen.getByLabelText("Kuvaus"), {
    target: { value: "Pneumatiikka vuotaa" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Etsi historiasta" }));
  expect(
    screen.getByText("Vaurioitunut tiiviste vaihdettu"),
  ).toBeInTheDocument();
});

it("requires human approval before changing template quantities", async () => {
  const { seed } = await import("../src/seed");
  const { completeJob } = await import("../src/domain");
  const { vi } = await import("vitest");
  const data = completeJob(seed(), "j1", { i2: 1 }, "Confirmed repair");
  localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(data));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Huoltopohjat" }));
  expect(
    JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!).templateVersion,
  ).toBe(1);
  const confirm = vi
    .spyOn(window, "confirm")
    .mockReturnValueOnce(false)
    .mockReturnValueOnce(true);
  fireEvent.click(screen.getByRole("button", { name: "Hyväksy uusi versio" }));
  expect(
    JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!).templateVersion,
  ).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Hyväksy uusi versio" }));
  const updated = JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!);
  expect(updated.templateVersion).toBe(2);
  expect(
    updated.templateRequirements.find((r: { id: string }) => r.id === "r2")
      .quantity,
  ).toBe(1);
  expect(
    updated.templateHistory[0].requirements.find(
      (r: { id: string }) => r.id === "r2",
    ).quantity,
  ).toBe(2);
  confirm.mockRestore();
});

it("creates a tool without quantity and hides stock columns for tools", async () => {
  const { within } = await import("@testing-library/react");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Varasto ja työkalut" }));
  fireEvent.click(screen.getByRole("button", { name: "Lisää nimike" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.queryByLabelText("Määrä")).not.toBeInTheDocument();
  fireEvent.change(dialog.getByLabelText("Tyyppi"), {
    target: { value: "parts" },
  });
  expect(dialog.getByLabelText("Määrä")).toBeInTheDocument();
  fireEvent.change(dialog.getByLabelText("Tyyppi"), {
    target: { value: "tools" },
  });
  expect(dialog.queryByLabelText("Määrä")).not.toBeInTheDocument();
  fireEvent.change(dialog.getByLabelText("Nimi"), {
    target: { value: "Test wrench" },
  });
  fireEvent.change(dialog.getByLabelText("Varastopaikka"), {
    target: { value: "Cabinet" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Tallenna" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const item = JSON.parse(
    localStorage.getItem("huoltopilotti-demo-v1")!,
  ).items.find((i: { name: string }) => i.name === "Test wrench");
  expect(item.type).toBe("tools");
  expect(item.quantity).toBe(0);
  fireEvent.change(screen.getByLabelText("Tyyppi"), {
    target: { value: "tools" },
  });
  expect(
    screen.queryByRole("columnheader", { name: "Määrä" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("columnheader", { name: "Varaukset" }),
  ).not.toBeInTheDocument();
});
