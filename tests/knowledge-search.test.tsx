import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { KnowledgeSearch } from "../src/KnowledgeSearch";
import { Repository } from "../src/data/repository";
import { seed } from "../src/seed";
import { completeJob } from "../src/domain";
import type { HistoryResult, HistoryService } from "../src/data/historySearch";
import type { SupabaseClient } from "@supabase/supabase-js";
afterEach(cleanup);
const row: HistoryResult = {
  id: "j1",
  kind: "maintenance",
  title: "Moottorin huolto",
  assetId: "a2",
  assetName: "Vanha moottori",
  assetIdentifier: "SER-10",
  lineId: "line",
  lineName: "Vanha linja",
  at: "2026-10-20T05:29:00Z",
  problem: "Moottori kuumenee",
  repair: "Laakeri vaihdettu",
  parts: "Tiiviste: 2",
  tools: "Avain",
  metadataKnown: true,
  archived: true,
  matchedFields: ["problem", "repair"],
};
function service(): HistoryService {
  return {
    search: vi.fn(async () => ({ results: [row], hasMore: true })),
    options: async () => ({
      assets: [{ value: "a2", label: "Vanha moottori" }],
      lines: [{ value: "line", label: "Vanha linja" }],
    }),
    record: async () =>
      completeJob(seed(), "j1", {}, "Laakeri vaihdettu", 20).jobs[0],
  };
}
it("uses combined server filters, paginates and opens the immutable source record", async () => {
  const api = service();
  render(
    <KnowledgeSearch
      service={api}
      store={seed()}
      lang="fi"
      canWork
      onRepeat={vi.fn()}
      onAsset={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Kuvaus"), {
    target: { value: "moottori kuumenee" },
  });
  fireEvent.click(screen.getByText("Rajaa historiatietoja"));
  await screen.findByRole("option", { name: "Vanha moottori" });
  fireEvent.change(screen.getByRole("combobox", { name: "Laite" }), {
    target: { value: "a2" },
  });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Historiallinen tuotantolinja" }),
    { target: { value: "line" } },
  );
  fireEvent.change(screen.getByLabelText("Alkaen"), {
    target: { value: "2026-01-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Etsi historiasta" }));
  expect(await screen.findByText("Laakeri vaihdettu")).toBeInTheDocument();
  expect(screen.getByText("Arkistoitu")).toBeInTheDocument();
  expect(api.search).toHaveBeenCalledWith(
    expect.objectContaining({
      query: "moottori kuumenee",
      assetId: "a2",
      lineId: "line",
      from: "2026-01-01",
      page: 0,
    }),
    expect.any(AbortSignal),
  );
  fireEvent.click(screen.getByRole("button", { name: "Seuraavat" }));
  await waitFor(() =>
    expect(api.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
      expect.any(AbortSignal),
    ),
  );
  await screen.findByRole("button", { name: "Avaa alkuperäinen kirjaus" });
  fireEvent.click(
    screen.getByRole("button", { name: "Avaa alkuperäinen kirjaus" }),
  );
  expect(await screen.findByRole("dialog")).toHaveTextContent(
    "Laakeri vaihdettu",
  );
});
it("ignores obsolete responses and preserves a query after a server error", async () => {
  const api = service();
  let resolve!: (value: { results: HistoryResult[]; hasMore: boolean }) => void;
  const search = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockRejectedValueOnce(Error("offline"))
    .mockResolvedValue({ results: [], hasMore: false });
  api.search = search;
  render(
    <KnowledgeSearch
      service={api}
      store={seed()}
      lang="fi"
      canWork={false}
      onRepeat={vi.fn()}
      onAsset={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Kuvaus"), {
    target: { value: "vanha" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Etsi historiasta" }));
  fireEvent.change(screen.getByLabelText("Kuvaus"), {
    target: { value: "uusi" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Etsi historiasta" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  resolve({ results: [row], hasMore: false });
  await waitFor(() =>
    expect(screen.queryByText("Laakeri vaihdettu")).not.toBeInTheDocument(),
  );
  expect(screen.getByLabelText("Kuvaus")).toHaveValue("uusi");
  fireEvent.click(screen.getByRole("button", { name: "Etsi historiasta" }));
  expect(await screen.findByText(/Ei aiempia tapauksia/)).toBeInTheDocument();
});
it("repository always scopes search and original-record reads by its own organization", async () => {
  const abortSignal = vi.fn(async () => ({
    data: { results: [], hasMore: false },
    error: null,
  }));
  const rpc = vi.fn(() => ({ abortSignal }));
  const api = new Repository({ rpc } as unknown as SupabaseClient, "own-org");
  const controller = new AbortController();
  await api.searchHistory(
    {
      query: "'; select",
      assetId: "foreign",
      lineId: "line",
      from: "",
      to: "",
      kind: "fault",
      page: 2,
    },
    controller.signal,
  );
  expect(rpc).toHaveBeenCalledWith("private_history_search", {
    p_org: "own-org",
    p_query: "'; select",
    p_asset: "foreign",
    p_line: "line",
    p_from: null,
    p_to: null,
    p_kind: "fault",
    p_page: 2,
  });
  expect(abortSignal).toHaveBeenCalledWith(controller.signal);
});
it("locks source loading and ignores a source response after the query changes", async () => {
  const api = service();
  let resolve!: (value: ReturnType<typeof completeJob>["jobs"][number]) => void;
  api.record = vi.fn(
    () =>
      new Promise<ReturnType<typeof completeJob>["jobs"][number]>((r) => {
        resolve = r;
      }),
  );
  render(
    <KnowledgeSearch
      service={api}
      store={seed()}
      lang="fi"
      canWork
      onRepeat={vi.fn()}
      onAsset={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Kuvaus"), {
    target: { value: "moottori" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Etsi historiasta" }));
  const open = await screen.findByRole("button", {
    name: "Avaa alkuperäinen kirjaus",
  });
  fireEvent.click(open);
  fireEvent.click(open);
  expect(api.record).toHaveBeenCalledTimes(1);
  expect(open).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Kuvaus"), {
    target: { value: "toinen vika" },
  });
  resolve(completeJob(seed(), "j1", {}, "Laakeri vaihdettu", 20).jobs[0]);
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Etsi historiasta" }));
  expect(
    await screen.findByRole("button", { name: "Avaa alkuperäinen kirjaus" }),
  ).not.toBeDisabled();
});
it("retries failed filter options and clears filters while retaining the query", async () => {
  const api = service();
  api.options = vi
    .fn()
    .mockRejectedValueOnce(Error("offline"))
    .mockResolvedValue({
      assets: [{ value: "a2", label: "Vanha moottori" }],
      lines: [],
    });
  render(
    <KnowledgeSearch
      service={api}
      store={seed()}
      lang="fi"
      canWork={false}
      onRepeat={vi.fn()}
      onAsset={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText("Rajaa historiatietoja"));
  fireEvent.click(
    await screen.findByRole("button", { name: "Yritä uudelleen" }),
  );
  await screen.findByRole("option", { name: "Vanha moottori" });
  fireEvent.change(screen.getByRole("combobox", { name: "Laite" }), {
    target: { value: "a2" },
  });
  fireEvent.change(screen.getByLabelText("Kuvaus"), {
    target: { value: "moottori" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tyhjennä rajaukset" }));
  expect(screen.getByRole("combobox", { name: "Laite" })).toHaveValue("");
  expect(screen.getByLabelText("Kuvaus")).toHaveValue("moottori");
});
