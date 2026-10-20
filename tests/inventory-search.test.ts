import { expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  searchDemoInventory,
  inventorySearchFilter,
} from "../src/data/inventorySearch";
import { Repository } from "../src/data/repository";
import { seed } from "../src/seed";

it("searches names, part numbers and identifiers; excludes tools and inactive items from supply results", () => {
  const parts = {
    ...seed().items[1],
    name: "Bearing",
    partNumber: "P-6205",
    externalId: "ERP-100",
  };
  for (const term of ["bearing", "6205", "erp-100", parts.id])
    expect(searchDemoInventory([parts], "supplies", term, 0).items).toEqual([
      parts,
    ]);
  expect(
    searchDemoInventory(
      [{ ...parts, inactive: true }, seed().items[0]],
      "supplies",
      "mo",
      0,
    ).items,
  ).toEqual([]);
});
it("bounds pages over thousands of demo records without rendering them all", () => {
  const items = Array.from({ length: 5000 }, (_, n) => ({
    ...seed().items[1],
    id: `part-${n}`,
    name: `Bearing ${n}`,
  }));
  const first = searchDemoInventory(items, "supplies", "Bearing", 0);
  const next = searchDemoInventory(items, "supplies", "Bearing", 1);
  expect(first.items).toHaveLength(25);
  expect(first.hasMore).toBe(true);
  expect(next.items[0].id).toBe("part-25");
});
it("quotes search syntax and escapes literal LIKE metacharacters", () => {
  const filter = inventorySearchFilter('x%,_"),id.neq.abc');
  expect(filter).toContain('name.ilike."%x\\\\%,\\\\_\\"),id.neq.abc%"');
  expect(inventorySearchFilter("a".repeat(1000))).not.toContain(
    "a".repeat(101),
  );
});
it("uses bounded authenticated PostgREST queries scoped to the organization and category", async () => {
  const urls: URL[] = [];
  const row = {
    id: "part-id",
    name: "Server bearing",
    type: "part",
    quantity: 8,
    reserved: 2,
    part_number: "P1",
    data: { name: "stale", unit: "kg" },
  };
  const fetch = vi.fn(async (url: RequestInfo | URL) => {
    urls.push(new URL(String(url)));
    return new Response(
      JSON.stringify(
        Array.from({ length: 26 }, (_, n) => ({ ...row, id: `part-${n}` })),
      ),
      { headers: { "content-type": "application/json" } },
    );
  });
  const client = createClient(
    "https://example.supabase.co",
    "public-test-key",
    {
      global: { fetch },
      auth: {
        storageKey: "inventory-search-test",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const repository = new Repository(client, "tenant-a");
  const signal = new AbortController().signal;
  const result = await repository.searchInventory(
    "supplies",
    "Bearing",
    1,
    signal,
  );
  expect(result.items).toHaveLength(25);
  expect(result.hasMore).toBe(true);
  expect(result.items[0]).toMatchObject({
    name: "Server bearing",
    quantity: 8,
    reserved: 2,
    unit: "kg",
    type: "parts",
  });
  expect(urls[0].searchParams.get("organization_id")).toBe("eq.tenant-a");
  expect(urls[0].searchParams.get("type")).toBe("in.(part,consumable)");
  expect(urls[0].searchParams.get("offset")).toBe("25");
  expect(urls[0].searchParams.get("limit")).toBe("26");
  expect(urls[0].searchParams.getAll("or")).toHaveLength(1);
  expect(urls[0].searchParams.get("or")).toContain("data->>inactive.neq.true");
  expect(urls[0].searchParams.get("select")).not.toBe("*");
  await repository.searchInventory("tools", "Torque", 0);
  expect(urls[1].searchParams.get("type")).toBe("in.(tool)");
  await repository.searchInventory("tools", "T", 0);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("propagates search errors rather than showing a successful empty result", async () => {
  const client = createClient(
    "https://example.supabase.co",
    "public-test-key",
    {
      global: {
        fetch: async () =>
          new Response(JSON.stringify({ code: "42501", message: "denied" }), {
            status: 403,
            headers: { "content-type": "application/json" },
          }),
      },
      auth: { persistSession: false },
    },
  );
  await expect(
    new Repository(client, "other-tenant").searchInventory("supplies", "part"),
  ).rejects.toMatchObject({ code: "42501" });
});
