import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";

test("six destinations, mobile focus management, secondary tools and theme persist", async ({
  page,
  isMobile,
}) => {
  await page.addInitScript(() => localStorage.setItem("hp-welcome", "1"));
  await page.goto("?demo=1");
  const menu = page.getByRole("button", { name: "Valikko", exact: true });
  if (isMobile) {
    await menu.click();
    const dialog = page.getByRole("dialog", { name: "Päänavigaatio" });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: "Sulje", exact: true });
    await close.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      await expect(dialog.locator(":focus")).toHaveCount(1);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(menu).toBeFocused();
    await menu.click();
  }
  const navigation = page.getByRole("navigation", { name: "Päänavigaatio" });
  await expect(navigation.getByRole("button")).toHaveText([
    "Etusivu",
    "Huoltotyöt",
    "Laitteet",
    "Varasto",
    "Huoltotutka",
    "Asetukset",
  ]);
  const navBox = await navigation
    .getByRole("button", { name: "Huoltotyöt", exact: true })
    .boundingBox();
  expect(navBox!.height).toBeGreaterThanOrEqual(44);
  await navigation.getByRole("button", { name: "Asetukset" }).click();
  if (isMobile) await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Asetukset", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Raportit", exact: true }).click();
  await expect(page).toHaveURL(/#reports$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Raportit", exact: true }),
  ).toBeVisible();
  if (isMobile) await menu.click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Asetukset" })
    .click();
  await page.getByRole("button", { name: "Huoltopohjat", exact: true }).click();
  await expect(page).toHaveURL(/#templates$/);
  await page
    .getByRole("button", { name: "Vaihda teemaa", exact: true })
    .first()
    .click();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("dashboard prioritizes real jobs, opens work and history, and supports narrow screens", async ({
  page,
}) => {
  const data = seed();
  const job = data.jobs[0];
  data.jobs = [
    {
      ...job,
      id: "overdue",
      name: "Tärkeä erääntynyt työ",
      due: "2026-10-19",
      technician: "Aleksi Korhonen",
    },
    {
      ...job,
      id: "soon",
      name: "Huomisen työ",
      due: "2026-10-21",
      technician: "Toinen asentaja",
    },
    {
      ...job,
      id: "started",
      name: "Käynnissä oleva työ",
      status: "progress",
      due: "2026-10-24",
      technician: "Aleksi Korhonen",
    },
    {
      ...job,
      id: "done",
      name: "Valmis tarkistus",
      status: "completed",
      completedAt: "2026-10-20T05:29:00Z",
      due: "2026-10-19",
      notes: "Tiiviste tarkistettu",
      actualMinutes: 25,
      performedBy: "Aleksi Korhonen",
      freeUsage: [{ type: "tools", name: "Oma avain" }],
    },
  ];
  await page.clock.setFixedTime(new Date("2026-10-20T08:00:00Z"));
  await page.addInitScript((store) => {
    localStorage.setItem("hp-welcome", "1");
    localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(store));
  }, data);
  await page.goto("?demo=1");
  const group = page.getByRole("group", { name: "Työjonot" });
  await expect(group.getByRole("button", { name: /Myöhässä/ })).toHaveText(/1/);
  await expect(group.getByRole("button", { name: /Erääntyy pian/ })).toHaveText(
    /2/,
  );
  await expect(group.getByRole("button", { name: /Omat työt/ })).toHaveText(
    /2/,
  );
  await group.getByRole("button", { name: /Omat työt/ }).click();
  const queue = page.getByRole("region", { name: "Omat työt" });
  await expect(queue).toContainText("Tärkeä erääntynyt työ");
  await expect(queue).toContainText("Käynnissä oleva työ");
  await expect(queue).not.toContainText("Huomisen työ");
  await queue.getByRole("button", { name: /Käynnissä oleva työ/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Tarkistuslista ei ole lupa aloittaa",
  );
  await page.getByRole("button", { name: "Sulje", exact: true }).click();
  await page
    .getByRole("region", { name: "Viimeksi valmistuneet" })
    .getByRole("button", { name: /Valmis tarkistus/ })
    .click();
  const history = page.getByRole("dialog");
  await expect(history).toContainText("Tiiviste tarkistettu");
  await expect(history).toContainText("Oma avain");
  await expect(history).toContainText("20.10.2026 klo 08.29");
  await expect(history).not.toContainText(
    "Tarkistuslista ei ole lupa aloittaa",
  );
  await page.getByRole("button", { name: "Sulje", exact: true }).click();
  await page.setViewportSize({ width: 360, height: 800 });
  const overflow = await page
    .locator(".work-overview")
    .evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(overflow).toBeFalsy();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
