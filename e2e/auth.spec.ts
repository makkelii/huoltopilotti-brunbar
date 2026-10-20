import { test, expect } from "@playwright/test";
test("real SDK login, database read/write contract, reload persistence and sign-out", async ({
  page,
  isMobile,
}) => {
  const org = "20000000-0000-0000-0000-000000000001",
    uid = "10000000-0000-0000-0000-000000000001";
  const snapshot = {
    organizationId: org,
    organizationName: "Private browser workshop",
    role: "owner",
    revision: 0,
    members: [{ userId: uid, name: "owner@example.invalid", role: "owner" }],
    store: {
      version: 1,
      assets: [] as Record<string, unknown>[],
      items: [],
      jobs: [],
      faults: [],
      events: [],
      templateVersion: 0,
      templateRequirements: [],
      templateHistory: [],
    },
  };
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "owner@example.invalid",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token = [
    btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    btoa(
      JSON.stringify({
        sub: uid,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ),
    btoa("test-signature"),
  ].join(".");
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "content-type": "application/json",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (url.pathname === "/auth/v1/token") {
      await route.fulfill({
        headers,
        json: {
          access_token: token,
          refresh_token: "test-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user,
        },
      });
      return;
    }
    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ headers, json: user });
      return;
    }
    if (url.pathname === "/auth/v1/logout") {
      await route.fulfill({ headers, json: {} });
      return;
    }
    if (url.pathname === "/rest/v1/memberships") {
      await route.fulfill({ headers, json: [{ organization_id: org }] });
      return;
    }
    if (url.pathname === "/rest/v1/rpc/private_snapshot") {
      await route.fulfill({ headers, json: snapshot });
      return;
    }
    if (url.pathname === "/rest/v1/rpc/private_mutate") {
      const payload = request.postDataJSON();
      expect(payload.p_org).toBe(org);
      expect(payload.p_revision).toBe(snapshot.revision);
      expect(payload.p_kind).toBe("asset");
      snapshot.store.assets.push(payload.p_data);
      snapshot.revision++;
      await route.fulfill({ headers, json: null });
      return;
    }
    await route.fulfill({
      status: 400,
      headers,
      json: { message: "Unexpected test request" },
    });
  });
  await page.goto("");
  await page.getByLabel("Sähköposti").fill("owner@example.invalid");
  await page.getByLabel("Salasana").fill("browser-test-password");
  await page.getByRole("button", { name: "Kirjaudu", exact: true }).click();
  await page.getByRole("button", { name: "Aloitetaan" }).click();
  if (isMobile) await page.getByRole("button", { name: "Valikko" }).click();
  await expect(
    (isMobile
      ? page.getByRole("dialog")
      : page.getByRole("complementary")
    ).getByText("Private browser workshop", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("CNC Haas VF-2", { exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Laitteet", exact: true })
    .click();
  await page.getByRole("button", { name: "Lisää laite" }).click();
  await page
    .getByLabel("Nimi", { exact: true })
    .fill("Persistent contract motor");
  await page.getByRole("button", { name: "Tallenna", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Persistent contract motor" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Persistent contract motor" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("huoltopilotti-demo-v1")),
  ).toBeNull();
  if (isMobile) await page.getByRole("button", { name: "Valikko" }).click();
  await page.getByRole("button", { name: "Asetukset", exact: true }).click();
  await page.getByRole("button", { name: "Kirjaudu ulos" }).click();
  await expect(
    page.getByRole("button", { name: "Kirjaudu", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Persistent contract motor", { exact: true }),
  ).not.toBeVisible();
});
