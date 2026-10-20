import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";

test("a signed-in viewer sees permission explanations and cannot administer or complete work", async ({
  page,
}) => {
  const uid = "10000000-0000-0000-0000-000000000001",
    org = "20000000-0000-0000-0000-000000000001";
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "viewer@example.invalid",
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
  let mutations = 0;
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "content-type": "application/json",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (path === "/auth/v1/token") {
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
    if (path === "/auth/v1/user") {
      await route.fulfill({ headers, json: user });
      return;
    }
    if (path === "/rest/v1/memberships") {
      await route.fulfill({ headers, json: [{ organization_id: org }] });
      return;
    }
    if (path === "/rest/v1/rpc/private_snapshot") {
      await route.fulfill({
        headers,
        json: {
          organizationId: org,
          organizationName: "Readonly workshop",
          revision: 0,
          role: "viewer",
          members: [{ userId: uid, name: user.email, role: "viewer" }],
          store: seed(),
        },
      });
      return;
    }
    mutations++;
    await route.fulfill({
      status: 403,
      headers,
      json: { message: "forbidden", code: "42501" },
    });
  });
  await page.addInitScript(() => localStorage.setItem("hp-welcome", "1"));
  await page.goto("");
  await page.getByLabel("Sähköposti").fill(user.email);
  await page.getByLabel("Salasana").fill("browser-test-password");
  await page.getByRole("button", { name: "Kirjaudu", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Etusivu", exact: true }),
  ).toBeVisible();
  const navigate = async (name: string) => {
    const menu = page.getByRole("button", { name: "Valikko", exact: true });
    if (await menu.isVisible()) await menu.click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
  };
  await navigate("Varasto");
  await expect(
    page.getByRole("button", { name: "Muokkaa", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Lisää nimike", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/Rekistereitä ja käyttäjiä hallitsee/),
  ).toBeVisible();
  await navigate("Laitteet");
  await expect(
    page.getByRole("button", { name: "Lisää laite", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Arkistoi laite", exact: true }),
  ).toHaveCount(0);
  await navigate("Huoltotyöt");
  await expect(page.getByText(/Sinulla on katseluoikeus/)).toBeVisible();
  await page
    .getByRole("button", { name: /Kuljettimen laakerihuolto/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kirjaa valmistuminen", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sulje", exact: true }).click();
  await navigate("Asetukset");
  await expect(
    page.getByRole("button", { name: "Kutsu asentaja", exact: true }),
  ).toHaveCount(0);
  expect(mutations).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
