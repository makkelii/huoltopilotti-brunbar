import { test, expect, type Page } from "@playwright/test";
function recoveryIdentity() {
  const uid = "10000000-0000-0000-0000-000000000001";
  return {
    user: {
      id: uid,
      aud: "authenticated",
      role: "authenticated",
      email: "owner@example.invalid",
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
    token: [
      btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })),
      btoa(
        JSON.stringify({
          sub: uid,
          role: "authenticated",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ),
      btoa("test-signature"),
    ].join("."),
  };
}
async function stub(page: Page) {
  const { user, token } = recoveryIdentity();
  let updated = false,
    workspaceReads = 0;
  let mailError = false;
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "content-type": "application/json",
    };
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (url.pathname === "/auth/v1/recover") {
      expect(url.searchParams.get("redirect_to")).toBe(
        "http://127.0.0.1:4173/?auth=recovery",
      );
      expect(req.postDataJSON().email).toBe("owner@example.invalid");
      await route.fulfill({
        status: mailError ? 429 : 200,
        headers,
        json: mailError
          ? { code: "over_email_send_rate_limit", msg: "test provider detail" }
          : {},
      });
      return;
    }
    if (url.pathname === "/auth/v1/user") {
      if (req.method() === "PUT") {
        expect(req.postDataJSON().password).toBe("new-browser-test-password");
        updated = true;
      }
      await route.fulfill({ headers, json: { user } });
      return;
    }
    if (url.pathname.startsWith("/rest/")) {
      workspaceReads++;
      await route.fulfill({
        status: 403,
        headers,
        json: { message: "No organization access" },
      });
      return;
    }
    await route.fulfill({ headers, json: {} });
  });
  return {
    token,
    get updated() {
      return updated;
    },
    get workspaceReads() {
      return workspaceReads;
    },
    failMail: () => {
      mailError = true;
    },
  };
}
test("recovery request uses root callback and shows specific provider rate limit", async ({
  page,
}) => {
  const mock = await stub(page);
  await page.goto("");
  await page.getByRole("button", { name: "Unohtuiko salasana?" }).click();
  await page.getByLabel("Sähköposti").fill("owner@example.invalid");
  mock.failMail();
  await page.getByRole("button", { name: "Lähetä palautuslinkki" }).click();
  await expect(page.getByText(/lähetysraja on täyttynyt/)).toBeVisible();
  await expect(page.getByText("test provider detail")).not.toBeVisible();
});
for (const query of ["?auth=recovery", ""])
  test(`verified SDK recovery link ${query || "from dashboard"} permits password change without organization reads`, async ({
    page,
  }) => {
    const mock = await stub(page);
    await page.goto(
      `${query}#access_token=${mock.token}&refresh_token=test-refresh&token_type=bearer&expires_in=3600&type=recovery`,
    );
    await expect(
      page.getByRole("heading", { name: "Aseta uusi salasana" }),
    ).toBeVisible();
    expect(mock.workspaceReads).toBe(0);
    await page.getByLabel("Salasana").fill("new-browser-test-password");
    await page.getByRole("button", { name: "Tallenna" }).click();
    await expect.poll(() => mock.updated).toBe(true);
  });
test("expired link offers a new recovery request and no password form", async ({
  page,
}) => {
  await stub(page);
  await page.goto(
    "?auth=recovery#error=access_denied&error_code=otp_expired&error_description=hidden-provider-message",
  );
  await expect(
    page.getByText(/Palautus- tai kutsulinkki puuttuu/),
  ).toBeVisible();
  await expect(page.getByLabel("Salasana", { exact: true })).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lähetä palautuslinkki" }),
  ).toBeVisible();
  await expect(page.getByText("hidden-provider-message")).not.toBeVisible();
});
