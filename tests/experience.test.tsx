import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import App from "../src/App";
import { Repository, type Snapshot } from "../src/data/repository";
import { seed } from "../src/seed";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("../src/data/supabase", () => ({
  supabase: { functions: { invoke } },
}));
beforeEach(() => {
  invoke.mockReset();
  localStorage.clear();
  localStorage.setItem("hp-welcome", "1");
  location.hash = "";
});
afterEach(cleanup);
it.each(["technician", "viewer"] as const)(
  "explains %s permissions and never offers inventory or register administration",
  (role) => {
    const snapshot: Snapshot = {
      organizationId: "org",
      organizationName: "Workshop",
      revision: 0,
      role,
      members: [],
      store: seed(),
    };
    render(
      <App
        initialSnapshot={snapshot}
        repository={new Repository({} as SupabaseClient, "org")}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Varasto" }));
    expect(
      screen.queryByRole("button", { name: "Muokkaa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Lisää nimike" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Rekistereitä ja käyttäjiä hallitsee/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Asetukset" }));
    expect(
      screen.queryByRole("button", { name: "Kutsu asentaja" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Laitteet" }));
    expect(
      screen.queryByRole("button", { name: "Lisää laite" }),
    ).not.toBeInTheDocument();
    if (role === "viewer") {
      fireEvent.click(screen.getByRole("button", { name: "Huoltotyöt" }));
      expect(screen.getByText(/Sinulla on katseluoikeus/)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Uusi huoltotyö" }),
      ).not.toBeInTheDocument();
    }
  },
);
it("filters inactive stock and searches human identifiers without changing quantities", () => {
  const s = seed();
  s.items[0].inactive = true;
  s.items[1].partNumber = "BEARING-CODE";
  localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(s));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Varasto" }));
  expect(
    screen.queryByText(s.items[0].name, { exact: true }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Tila" }), {
    target: { value: "inactive" },
  });
  expect(
    screen.getByText(s.items[0].name, { exact: true }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Tila" }), {
    target: { value: "all" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /Hae nimellä/ }), {
    target: { value: "BEARING-CODE" },
  });
  expect(
    screen.getByText(s.items[1].name, { exact: true }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: /Hae nimellä/ }), {
    target: { value: "missing" },
  });
  expect(
    screen.getByText(/Ei hakua ja rajauksia vastaavia/),
  ).toBeInTheDocument();
  expect(
    JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!).items,
  ).toEqual(s.items);
});

it("invitation errors retain the email and a pending request cannot be submitted twice", async () => {
  const snapshot: Snapshot = {
    organizationId: "org",
    organizationName: "Workshop",
    revision: 0,
    role: "owner",
    members: [],
    store: seed(),
  };
  let reject!: (reason: Error) => void;
  invoke.mockImplementationOnce(
    () =>
      new Promise((_, r) => {
        reject = r;
      }),
  );
  render(
    <App
      initialSnapshot={snapshot}
      repository={new Repository({} as SupabaseClient, "org")}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Asetukset" }));
  const email = screen.getByRole("textbox", { name: "Sähköposti" });
  fireEvent.change(email, { target: { value: "tech@example.invalid" } });
  const button = screen.getByRole("button", { name: "Kutsu asentaja" });
  fireEvent.submit(button.closest("form")!);
  fireEvent.submit(button.closest("form")!);
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  reject(Error("offline"));
  await waitFor(() => expect(button).not.toBeDisabled());
  expect(email).toHaveValue("tech@example.invalid");
  expect(screen.getByText(/Kutsua ei voitu lähettää/)).toBeInTheDocument();
  invoke.mockResolvedValueOnce({ error: null });
  fireEvent.submit(button.closest("form")!);
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
  expect(invoke).toHaveBeenLastCalledWith("invite-technician-brunbar", {
    body: { organizationId: "org", email: "tech@example.invalid" },
  });
});
