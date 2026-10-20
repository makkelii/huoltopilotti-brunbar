import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";

test("completes without any registry and keeps free usage after reload", async ({
  page,
}) => {
  const store = seed();
  store.items = [];
  store.jobs = [{ ...store.jobs[0], requirements: [], recurrence: 0 }];
  await page.addInitScript(
    ({ data }) => {
      if (!localStorage.getItem("huoltopilotti-demo-v1"))
        localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(data));
      localStorage.setItem("hp-welcome", "1");
    },
    { data: store },
  );
  await page.goto("?demo=1#jobs");
  await page
    .getByRole("button", { name: new RegExp(store.jobs[0].name) })
    .click();
  await page.getByRole("button", { name: "Kirjaa valmistuminen" }).click();
  await page.getByLabel("Tehdyt työt").fill("Seal replaced");
  await page.getByLabel("Käytetty aika (min)").fill("30");
  await page
    .getByRole("button", { name: "Lisää varaosa", exact: true })
    .click();
  await page
    .locator(".free-usage-row")
    .first()
    .getByLabel("Nimi", { exact: true })
    .fill("External seal");
  await page
    .locator(".free-usage-row")
    .first()
    .getByLabel("Käytetty määrä")
    .fill("2");
  for (const name of ["Loan wrench", "Pliers"]) {
    await page
      .getByRole("button", { name: "Lisää työkalu", exact: true })
      .click();
    await page
      .locator(".free-usage-row")
      .last()
      .getByLabel("Nimi", { exact: true })
      .fill(name);
  }
  await expect(
    page.locator(".free-usage-row").last().getByRole("spinbutton"),
  ).toHaveCount(0);
  // Two synchronous submissions must still create only one completion.
  await page.locator("form.completion").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "Huolto kirjattu valmiiksi",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
  );
  expect(saved.items).toEqual([]);
  expect(saved.events).toHaveLength(1);
  expect(saved.jobs[0].freeUsage).toHaveLength(3);
  await page.reload();
  await page
    .getByRole("button", { name: new RegExp(store.jobs[0].name) })
    .click();
  await expect(page.getByText("External seal: 2 kpl")).toBeVisible();
  await expect(page.getByText("Loan wrench", { exact: true })).toBeVisible();
  await expect(page.getByText("Pliers", { exact: true })).toBeVisible();
  await expect(page.locator(".safety-notice")).toHaveCount(0);
});
