import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";

test("review planned usage, cancel, then confirm corrected usage once", async ({
  page,
}) => {
  const s = seed();
  s.items.forEach((i) => {
    i.quantity = 20;
    i.reserved = 0;
  });
  s.jobs[0].recurrence = 0;
  s.jobs[0].requirements.push({
    id: "free",
    category: "parts",
    label: ["Tiiviste", "Seal", "Dichtung"],
    quantity: 1.5,
    state: "unchecked",
  });
  await page.addInitScript((data) => {
    localStorage.setItem("hp-welcome", "1");
    if (!localStorage.getItem("huoltopilotti-demo-v1"))
      localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(data));
  }, s);
  await page.goto("?demo=1#jobs");
  await page.getByRole("button", { name: new RegExp(s.jobs[0].name) }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Kirjaa valmistuminen" }).click();
  await expect(
    dialog.getByRole("spinbutton", { name: "Käytetty määrä · SKF 6205-2RS" }),
  ).toHaveValue("2");
  await expect(
    dialog.getByRole("spinbutton", { name: "Käytetty määrä · Tiiviste" }),
  ).toHaveValue("1.5");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
    ),
  ).toEqual(s);
  await dialog.getByRole("button", { name: "Sulje", exact: true }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
    ),
  ).toEqual(s);
  await page.getByRole("button", { name: new RegExp(s.jobs[0].name) }).click();
  await dialog.getByRole("button", { name: "Kirjaa valmistuminen" }).click();
  await dialog
    .getByRole("spinbutton", { name: "Käytetty määrä · SKF 6205-2RS" })
    .fill("0.5");
  await dialog.getByRole("button", { name: "Poista valinta · NLGI 2" }).click();
  await dialog
    .getByRole("button", { name: "Poista valinta · Tiiviste" })
    .click();
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Kirjaa valmiiksi" }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
  );
  expect(saved.jobs[0].actual).toEqual({ i1: 1, i2: 0.5 });
  expect(saved.items.find((i: { id: string }) => i.id === "i2").quantity).toBe(
    19.5,
  );
  expect(saved.items.find((i: { id: string }) => i.id === "i1").quantity).toBe(
    20,
  );
  await page.reload();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
    ),
  ).toEqual(saved);
});
