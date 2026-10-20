import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type {
  Session,
  SupabaseClient,
  AuthChangeEvent,
} from "@supabase/supabase-js";
import AuthGate from "../src/AuthGate";
import type { Snapshot } from "../src/data/repository";
const empty: Snapshot = {
  organizationId: "org-one",
  organizationName: "Private Workshop",
  revision: 0,
  role: "owner",
  members: [
    { userId: "user-one", name: "owner@example.invalid", role: "owner" },
  ],
  store: {
    version: 1,
    assets: [],
    jobs: [],
    items: [],
    faults: [],
    events: [],
    templateVersion: 0,
    templateRequirements: [],
    templateHistory: [],
  },
};
function fixture(initial: Session | null = null) {
  let listener: (
    event: AuthChangeEvent,
    session: Session | null,
  ) => void = () => {};
  const session = {
    user: { id: "user-one", email: "owner@example.invalid" },
  } as Session;
  let current = initial;
  const auth = {
    getSession: vi.fn(async () => ({
      data: { session: current },
      error: null,
    })),
    onAuthStateChange: vi.fn((cb: typeof listener) => {
      listener = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn(async () => {
      current = session;
      listener("SIGNED_IN", session);
      return { error: null };
    }),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => {
      current = null;
      listener("SIGNED_OUT", null);
      return { error: null };
    }),
  };
  const rpc = vi.fn(async (name: string) => ({
    data: name === "private_snapshot" ? structuredClone(empty) : null,
    error: null,
  }));
  const eq = vi.fn(async () => ({
    data: [{ organization_id: "org-one" }],
    error: null,
  }));
  return {
    auth,
    rpc,
    eq,
    session,
    emit: (event: AuthChangeEvent, s: Session | null) => listener(event, s),
    client: {
      auth,
      rpc,
      from: () => ({ select: () => ({ eq }) }),
    } as unknown as SupabaseClient,
  };
}
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("hp-welcome", "1");
  history.replaceState(null, "", "/");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("uses email/password and loads shared database without reading or writing demo state", async () => {
  localStorage.setItem("huoltopilotti-demo-v1", "synthetic-only");
  const f = fixture();
  render(<AuthGate client={f.client} isConfigured />);
  await screen.findByRole("button", { name: "Kirjaudu" });
  fireEvent.change(screen.getByLabelText("Sähköposti"), {
    target: { value: "owner@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Salasana"), {
    target: { value: "test-only-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Kirjaudu" }));
  await screen.findByText("Private Workshop");
  expect(f.auth.signInWithPassword).toHaveBeenCalledWith({
    email: "owner@example.invalid",
    password: "test-only-password",
  });
  expect(f.rpc).toHaveBeenCalledWith("private_snapshot", { p_org: "org-one" });
  expect(localStorage.getItem("huoltopilotti-demo-v1")).toBe("synthetic-only");
  expect(screen.queryByText("CNC Haas VF-2")).not.toBeInTheDocument();
});
it("requests recovery with canonical subdirectory redirect and generic confirmation", async () => {
  const f = fixture();
  render(<AuthGate client={f.client} isConfigured />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Unohtuiko salasana?" }),
  );
  fireEvent.change(screen.getByLabelText("Sähköposti"), {
    target: { value: "owner@example.invalid" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Lähetä palautuslinkki" }),
  );
  await screen.findByRole("status");
  expect(f.auth.resetPasswordForEmail).toHaveBeenCalledWith(
    "owner@example.invalid",
    { redirectTo: `${window.location.origin}/?auth=recovery` },
  );
});
it("accepts recovery event and updates password only through authenticated SDK", async () => {
  const f = fixture();
  render(<AuthGate client={f.client} isConfigured />);
  await screen.findByRole("button", { name: "Kirjaudu" });
  act(() => f.emit("PASSWORD_RECOVERY", f.session));
  fireEvent.change(await screen.findByLabelText("Salasana"), {
    target: { value: "new-test-only-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  await waitFor(() =>
    expect(f.auth.updateUser).toHaveBeenCalledWith({
      password: "new-test-only-password",
    }),
  );
});
it("fails closed on missing membership instead of showing demo", async () => {
  const f = fixture({ user: { id: "user-one" } } as Session);
  f.eq.mockResolvedValue({ data: [], error: null });
  render(<AuthGate client={f.client} isConfigured />);
  await screen.findByRole("alert");
  expect(screen.queryByText("CNC Haas VF-2")).not.toBeInTheDocument();
  expect(f.rpc).not.toHaveBeenCalled();
});
it("clears organization records immediately on sign-out and session expiry", async () => {
  const f = fixture({ user: { id: "user-one" } } as Session);
  render(<AuthGate client={f.client} isConfigured />);
  await screen.findByText("Private Workshop");
  act(() => f.emit("SIGNED_OUT", null));
  await screen.findByRole("button", { name: "Kirjaudu" });
  expect(screen.queryByText("Private Workshop")).not.toBeInTheDocument();
});
it("discards stale organization responses after session switches", async () => {
  const f = fixture({ user: { id: "user-one" } } as Session);
  let resolve: (value: { data: Snapshot; error: null }) => void = () => {};
  f.rpc.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  render(<AuthGate client={f.client} isConfigured />);
  await waitFor(() => expect(f.rpc).toHaveBeenCalled());
  act(() => f.emit("SIGNED_OUT", null));
  await act(async () => resolve({ data: structuredClone(empty), error: null }));
  expect(screen.queryByText("Private Workshop")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Kirjaudu" })).toBeInTheDocument();
});

it("keeps failed production edits open and never reports database success", async () => {
  const f = fixture({
    user: { id: "user-one", email: "owner@example.invalid" },
  } as Session);
  render(<AuthGate client={f.client} isConfigured />);
  await screen.findByText("Private Workshop");
  fireEvent.click(screen.getByRole("button", { name: "Laitteet" }));
  fireEvent.click(screen.getByRole("button", { name: "Lisää laite" }));
  fireEvent.change(screen.getByLabelText("Nimi"), {
    target: { value: "Rejected equipment" },
  });
  f.rpc.mockRejectedValueOnce(Error("denied"));
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  await screen.findAllByRole("alert");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(
    screen.queryByText("Tallennettu tietokantaan"),
  ).not.toBeInTheDocument();
  expect(localStorage.getItem("huoltopilotti-demo-v1")).toBeNull();
});

it("does not load organization data while a recovery session is changing its password", async () => {
  history.replaceState(null, "", "/?auth=recovery");
  const f = fixture({ user: { id: "user-one" } } as Session);
  render(<AuthGate client={f.client} isConfigured />);
  await screen.findByRole("button", { name: "Tallenna" });
  expect(f.eq).not.toHaveBeenCalled();
  expect(f.rpc).not.toHaveBeenCalled();
});
it("does not allow password update from a bare recovery URL without a session", async () => {
  history.replaceState(null, "", "/?auth=recovery");
  const f = fixture();
  render(<AuthGate client={f.client} isConfigured />);
  await screen.findByText(/Palautus- tai kutsulinkki puuttuu/);
  expect(screen.queryByLabelText("Salasana")).not.toBeInTheDocument();
  expect(f.auth.updateUser).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Lähetä palautuslinkki" }),
  ).toBeInTheDocument();
});
it("rejects an expired recovery callback even if another session already exists", async () => {
  const f = fixture({ user: { id: "user-one" } } as Session);
  render(
    <AuthGate
      client={f.client}
      isConfigured
      callback={{ purpose: "recovery", hasError: true }}
    />,
  );
  await screen.findByText(/Palautus- tai kutsulinkki puuttuu/);
  expect(screen.queryByLabelText("Salasana")).not.toBeInTheDocument();
  expect(f.rpc).not.toHaveBeenCalled();
});
it("shows rate-limit diagnostics rather than a misleading sign-in failure", async () => {
  const f = fixture();
  render(<AuthGate client={f.client} isConfigured />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Unohtuiko salasana?" }),
  );
  fireEvent.change(screen.getByLabelText("Sähköposti"), {
    target: { value: "owner@example.invalid" },
  });
  f.auth.resetPasswordForEmail.mockRejectedValueOnce({
    code: "over_email_send_rate_limit",
    status: 429,
    message: "do not display provider detail",
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Lähetä palautuslinkki" }),
  );
  await screen.findByText(/lähetysraja on täyttynyt/);
  expect(
    screen.queryByText("do not display provider detail"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Kirjautuminen epäonnistui/),
  ).not.toBeInTheDocument();
});
it("handles a dashboard recovery callback with a session and without an auth query", async () => {
  const f = fixture({ user: { id: "user-one" } } as Session);
  render(
    <AuthGate
      client={f.client}
      isConfigured
      callback={{ purpose: "recovery", hasError: false }}
    />,
  );
  fireEvent.change(await screen.findByLabelText("Salasana"), {
    target: { value: "new-verified-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  await waitFor(() =>
    expect(f.auth.updateUser).toHaveBeenCalledWith({
      password: "new-verified-password",
    }),
  );
});

it("refuses ambiguous organization membership without a server-assigned default", async () => {
  const f = fixture();
  f.eq.mockResolvedValue({
    data: [{ organization_id: "one" }, { organization_id: "two" }],
    error: null,
  });
  render(<AuthGate client={f.client} isConfigured />);
  await screen.findByRole("button", { name: "Kirjaudu" });
  await act(async () => f.emit("SIGNED_IN", f.session));
  await screen.findByRole("alert");
  expect(f.rpc).not.toHaveBeenCalled();
});
it("uses only the database-assigned default for a multi-organization user", async () => {
  const f = fixture();
  f.eq.mockResolvedValue({
    data: [
      { organization_id: "other", is_default: false },
      { organization_id: "org-one", is_default: true },
    ] as never,
    error: null,
  });
  render(<AuthGate client={f.client} isConfigured />);
  await screen.findByRole("button", { name: "Kirjaudu" });
  await act(async () => f.emit("SIGNED_IN", f.session));
  await screen.findByText("Private Workshop");
  expect(f.rpc).toHaveBeenCalledWith("private_snapshot", { p_org: "org-one" });
});

it("prefers the current membership display name over email in the workspace", async () => {
  const f = fixture({
    user: { id: "user-one", email: "owner@example.invalid" },
  } as Session);
  const named = structuredClone(empty);
  named.members[0].name = "Sanna Asentaja";
  f.rpc.mockResolvedValue({ data: named, error: null });
  render(<AuthGate client={f.client} isConfigured />);
  expect(await screen.findByText("Sanna Asentaja")).toBeInTheDocument();
  expect(screen.queryByText("owner@example.invalid")).not.toBeInTheDocument();
});
