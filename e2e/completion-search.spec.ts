import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";

test("authenticated completion searches the server for an uncached part and preserves the transaction contract", async ({
  page,
}) => {
  const org = "20000000-0000-0000-0000-000000000001";
  const uid = "10000000-0000-0000-0000-000000000001";
  const toolId = "40000000-0000-0000-0000-000000000002";
  const partId = "40000000-0000-0000-0000-000000000001";
  const store = seed();
  store.items = []; // Search must not rely on the application's previously loaded inventory.
  store.events = [];
  store.faults = [];
  store.templateRequirements = [];
  store.jobs = [
    {
      ...store.jobs[0],
      name: "Server search maintenance",
      requirements: [],
      recurrence: 0,
    },
  ];
  const snapshot = {
    organizationId: org,
    organizationName: "Search workshop",
    role: "owner",
    revision: 0,
    members: [{ userId: uid, name: "owner@example.invalid", role: "owner" }],
    store,
  };
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "owner@example.invalid",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    btoa(JSON.stringify({ sub: uid, role: "authenticated", exp: expiresAt })),
    btoa("test-signature"),
  ].join(".");
  await page.addInitScript(
    ({ session }) => {
      localStorage.setItem("hp-welcome", "1");
      localStorage.setItem("huoltopilotti-auth-v1", JSON.stringify(session));
    },
    {
      session: {
        access_token: token,
        refresh_token: "test-refresh",
        expires_in: 3600,
        expires_at: expiresAt,
        token_type: "bearer",
        user,
      },
    },
  );
  let searches = 0;
  let completions = 0;
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "content-type": "application/json",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (url.pathname === "/auth/v1/user")
      return route.fulfill({ headers, json: user });
    if (url.pathname === "/rest/v1/memberships")
      return route.fulfill({ headers, json: [{ organization_id: org }] });
    if (url.pathname === "/rest/v1/rpc/private_snapshot")
      return route.fulfill({ headers, json: snapshot });
    if (url.pathname === "/rest/v1/inventory") {
      searches++;
      expect(url.searchParams.get("organization_id")).toBe(`eq.${org}`);
      expect(url.searchParams.get("limit")).toBe("26");
      if (url.searchParams.get("type") === "in.(tool)") {
        return route.fulfill({
          headers,
          json: [
            {
              id: toolId,
              name: "Calibrated wrench",
              type: "tool",
              quantity: 0,
              reserved: 2,
              part_number: "TOOL-42",
              data: {},
            },
          ],
        });
      }
      expect(url.searchParams.get("or")).toContain("ERP-42");
      expect(url.searchParams.get("type")).toBe("in.(part,consumable)");
      return route.fulfill({
        headers,
        json: [
          {
            id: partId,
            name: "Bulk lubricant",
            type: "consumable",
            quantity: 12,
            reserved: 2,
            part_number: "LUB-42",
            data: { unit: "kg", externalId: "ERP-42" },
          },
        ],
      });
    }
    if (url.pathname === "/rest/v1/rpc/private_mutate") {
      const payload = request.postDataJSON();
      expect(payload.p_org).toBe(org);
      expect(payload.p_kind).toBe("complete");
      expect(payload.p_revision).toBe(0);
      expect(payload.p_data.actual).toEqual({ [partId]: 2.5, [toolId]: 1 });
      expect(payload.p_data.notes).toBe("Verified server completion");
      expect(payload.p_data.actualMinutes).toBe(45);
      completions++;
      snapshot.store.jobs[0] = {
        ...snapshot.store.jobs[0],
        status: "completed",
        notes: payload.p_data.notes,
        actual: payload.p_data.actual,
        actualMinutes: 45,
        completedAt: new Date().toISOString(),
        usedItems: [
          {
            id: toolId,
            name: "Calibrated wrench",
            type: "tools",
            quantity: 0,
            reserved: 2,
            partNumber: "TOOL-42",
            manufacturer: "",
            location: "Cabinet",
            spec: "",
            calibration: "2027-01-01",
            compatible: "",
            alternatives: "",
            usedQuantity: 1,
          },
          {
            id: partId,
            name: "Bulk lubricant",
            type: "consumables",
            quantity: 12,
            reserved: 2,
            partNumber: "LUB-42",
            manufacturer: "",
            location: "",
            spec: "",
            calibration: "",
            compatible: "",
            alternatives: "",
            unit: "kg",
            usedQuantity: 2.5,
          },
        ],
      };
      snapshot.revision++;
      return route.fulfill({ headers, json: null });
    }
    return route.fulfill({
      headers,
      status: 400,
      json: { message: "Unexpected request" },
    });
  });
  await page.goto("/#jobs");
  await page.getByRole("button", { name: /Server search maintenance/ }).click();
  await page.getByRole("button", { name: "Kirjaa valmistuminen" }).click();
  expect(searches).toBe(0);
  await page
    .getByRole("button", { name: "Lisää · Käytetyt varaosat ja tarvikkeet" })
    .click();
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Lisää · Käytetyt varaosat ja tarvikkeet",
    }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Lisää · Käytetyt varaosat ja tarvikkeet" })
    .click();

  expect(searches).toBe(0);
  await page.getByRole("searchbox").fill("ERP-42");
  await page
    .getByRole("button", { name: /Bulk lubricant.*Tuotenumero/ })
    .click();
  await page.getByLabel("Käytetty määrä · Bulk lubricant").fill("2.5");
  await expect(page.getByText("kg", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lisää · Käytetyt työkalut" }).click();
  await page.getByRole("searchbox").fill("TOOL-42");
  const tool = page.getByRole("button", {
    name: /Calibrated wrench.*Tuotenumero/,
  });
  await expect(tool).toBeEnabled();
  await expect(tool).not.toContainText("Käytettävissä");
  await tool.click();
  await expect(page.getByText("Käytetty", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Käytetty määrä · Calibrated wrench"),
  ).toHaveCount(0);
  await page.getByLabel("Käytetty aika (min)").fill("45");
  await page
    .getByLabel("Muistiinpanot / vahvistettu korjaus")
    .fill("Verified server completion");
  await page.getByRole("button", { name: "Vahvista", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(completions).toBe(1);
  expect(searches).toBe(2);
  await page.reload();
  await page.getByRole("button", { name: /Server search maintenance/ }).click();
  await expect(
    page.getByText("Verified server completion", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Bulk lubricant · LUB-42: 2.5 kg")).toBeVisible();
  await expect(
    page.getByText("Calibrated wrench · TOOL-42: Käytetty"),
  ).toBeVisible();
});
