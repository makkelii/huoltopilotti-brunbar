import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";
import { completeJob } from "../src/domain";
test("repeat maintenance creates only a reviewed new plan and cancellation preserves history", async ({
  page,
}) => {
  const base = seed();
  base.jobs = [
    {
      ...base.jobs[0],
      recurrence: 0,
      description: "Vanha suunnitelma",
      instructions: "Irrota virta",
    },
  ];
  const s = completeJob(
    base,
    "j1",
    {},
    "Vanha korjaus",
    20,
    "Vanha suorittaja",
  );
  await page.addInitScript((data) => {
    localStorage.setItem("hp-welcome", "1");
    localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(data));
  }, s);
  await page.goto("?demo=1#jobs");
  await page
    .getByRole("combobox", { name: "Tila", exact: true })
    .selectOption("completed");
  await page
    .getByRole("button", { name: /Kuljettimen laakerihuolto/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Tee sama huolto uudelleen", exact: true })
    .click();
  await expect(page.getByLabel("Työohjeet ja valmistelut")).toHaveValue(
    "Irrota virta",
  );
  await page.getByRole("button", { name: "Peruuta", exact: true }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
    ),
  ).toEqual(s);
  await page
    .getByRole("button", { name: /Kuljettimen laakerihuolto/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Tee sama huolto uudelleen", exact: true })
    .click();
  await page
    .getByLabel("Nimi", { exact: true })
    .fill("Uudelleen suunniteltu huolto");
  await page.getByRole("button", { name: "Tallenna", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const next = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
  );
  expect(next.jobs).toHaveLength(2);
  expect(next.jobs[0]).toEqual(s.jobs[0]);
  expect(next.items).toEqual(s.items);
  expect(next.jobs[1].actual).toEqual({});
  expect(next.jobs[1].status).toBe("planned");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
