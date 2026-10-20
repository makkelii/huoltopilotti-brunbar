import { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  within,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CompletionItems } from "../src/CompletionItems";
import { seed } from "../src/seed";
import {
  searchDemoInventory,
  type InventorySearch,
} from "../src/data/inventorySearch";

const data = seed();
const search: InventorySearch = async (group, query, page) =>
  searchDemoInventory(data.items, group, query, page);
function Harness({ find = search }: { find?: InventorySearch }) {
  const [actual, setActual] = useState<Record<string, number>>({});
  return (
    <>
      <CompletionItems
        lang="fi"
        actual={actual}
        onChange={setActual}
        search={find}
        requirements={data.jobs[0].requirements}
      />
      <output data-testid="usage">{JSON.stringify(actual)}</output>
    </>
  );
}
afterEach(cleanup);
const addParts = () =>
  fireEvent.click(
    screen.getByRole("button", {
      name: "Lisää · Käytetyt varaosat ja tarvikkeet",
    }),
  );
const input = () => screen.getByRole("searchbox");

it("does not render unused registry fields or copy planned supplies into actual usage", () => {
  render(<Harness />);
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  expect(screen.getByTestId("usage")).toHaveTextContent("{}");
  expect(screen.getByText("Suunnitellut tarvikkeet")).toBeInTheDocument();
});

it("searches, selects, edits and removes only explicit part usage, with duplicate prevention", async () => {
  render(<Harness />);
  addParts();
  fireEvent.change(input(), { target: { value: "SKF" } });
  const result = await screen.findByRole("button", { name: /SKF 6205-2RS/ });
  expect(result).toHaveTextContent("Varaosat");
  expect(result).toHaveTextContent("Käytettävissä: 1");
  fireEvent.click(result);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByTestId("usage")).toHaveTextContent('"i2":1');
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "0" } });
  expect(screen.getByRole("spinbutton")).toBeInvalid();
  fireEvent.change(screen.getByRole("spinbutton"), {
    target: { value: "0.5" },
  });
  expect(screen.getByRole("spinbutton")).toBeValid();
  expect(screen.getByTestId("usage")).toHaveTextContent('"i2":0.5');
  expect(screen.getByText("kpl")).toBeInTheDocument();
  addParts();
  fireEvent.change(input(), { target: { value: "SKF" } });
  expect(
    await screen.findByRole("button", { name: /SKF 6205-2RS/ }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Sulje" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Poista valinta · SKF 6205-2RS" }),
  );
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  expect(screen.getByTestId("usage")).toHaveTextContent("{}");
});

it("records tool use explicitly without a consumption quantity field", async () => {
  render(<Harness />);
  fireEvent.click(
    screen.getByRole("button", { name: "Lisää · Käytetyt työkalut" }),
  );
  fireEvent.change(input(), { target: { value: data.items[0].name } });
  fireEvent.click(
    await screen.findByRole("button", { name: new RegExp(data.items[0].name) }),
  );
  expect(screen.getByText("Käytetty", { exact: true })).toBeInTheDocument();
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  expect(screen.getByTestId("usage")).toHaveTextContent('"i1":1');
  expect(data.items[0].quantity).toBe(2);
});

it("waits for two characters and debounces changes; handles empty results and retry", async () => {
  const find = vi
    .fn<InventorySearch>()
    .mockRejectedValueOnce(Error("offline"))
    .mockResolvedValue({ items: [], hasMore: false });
  render(<Harness find={find} />);
  addParts();
  expect(find).not.toHaveBeenCalled();
  fireEvent.change(input(), { target: { value: "S" } });
  expect(find).not.toHaveBeenCalled();
  fireEvent.change(input(), { target: { value: "SK" } });
  fireEvent.change(input(), { target: { value: "SKF" } });
  await screen.findByRole("alert");
  expect(find).toHaveBeenCalledTimes(1);
  expect(find.mock.calls[0][1]).toBe("SKF");
  fireEvent.click(screen.getByRole("button", { name: "Yritä uudelleen" }));
  await screen.findByText(
    "Hakua vastaavia käytössä olevia tuotteita ei löytynyt.",
  );
  expect(find).toHaveBeenCalledTimes(2);
});

it("ignores an older response after the search changes", async () => {
  let finish!: (page: { items: typeof data.items; hasMore: boolean }) => void;
  const find = vi
    .fn<InventorySearch>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({ items: [], hasMore: false });
  render(<Harness find={find} />);
  addParts();
  fireEvent.change(input(), { target: { value: "SKF" } });
  await waitFor(() => expect(find).toHaveBeenCalledTimes(1));
  fireEvent.change(input(), { target: { value: "missing" } });
  await screen.findByText(
    "Hakua vastaavia käytössä olevia tuotteita ei löytynyt.",
  );
  finish({ items: [data.items[1]], hasMore: false });
  await waitFor(() =>
    expect(
      within(screen.getByRole("dialog")).queryByRole("button", {
        name: /SKF 6205/,
      }),
    ).not.toBeInTheDocument(),
  );
  expect(find.mock.calls[0][3].aborted).toBe(true);
});

it("requests the next page and prevents selecting unavailable inventory", async () => {
  const find = vi
    .fn<InventorySearch>()
    .mockResolvedValueOnce({
      items: [{ ...data.items[1], quantity: 0 }],
      hasMore: true,
    })
    .mockResolvedValue({ items: [], hasMore: false });
  render(<Harness find={find} />);
  addParts();
  fireEvent.change(input(), { target: { value: "SK" } });
  expect(
    await screen.findByRole("button", { name: /SKF 6205/ }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Seuraavat" }));
  await waitFor(() => expect(find).toHaveBeenCalledTimes(2));
  expect(find.mock.calls[1][2]).toBe(1);
});
