import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";
import { completeJob } from "../src/domain";

test("worklist kit, bounded job pages, same-equipment history and mobile completion", async ({
  page,
}, testInfo) => {
  const initial = seed();
  initial.items.forEach((i) => {
    i.quantity = 30;
    i.reserved = 0;
  });
  const s = completeJob(
    initial,
    "j1",
    { i2: 0.5, i1: 1 },
    "Laakeri vaihdettu ja koeajettu",
    30,
    "Asentaja",
    "Tarkista kuluma seuraavalla kerralla",
  );
  const prior = structuredClone(s.jobs[0]);
  s.productionLines = [
    {
      id: "line",
      name: "Pakkaamo",
      identifier: "P1",
      location: "Itähalli",
      description: "",
    },
  ];
  s.assets.find((a) => a.id === "a2")!.productionLineId = "line";
  s.jobs = [
    prior,
    ...Array.from({ length: 80 }, (_, i) => ({
      ...initial.jobs[0],
      id: `next-${i}`,
      name: `Huolto ${String(i).padStart(3, "0")}`,
      priority: "normal" as const,
      recurrence: 0,
      description: "Tarkista laakeri ja voitelu",
    })),
  ];
  await page.addInitScript((data) => {
    localStorage.setItem("hp-welcome", "1");
    if (!localStorage.getItem("huoltopilotti-demo-v1"))
      localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(data));
  }, s);
  await page.goto("?demo=1#jobs");
  await expect(page.getByRole("row")).toHaveCount(26);
  const row = page.getByRole("row").filter({ hasText: "Huolto 000" });
  await expect(row.getByText("Laakeri SKF 6205-2RS · 2 kpl")).toBeVisible();
  await expect(row).toContainText("Pakkaamo");
  await expect(row).toContainText("Momenttiavain");
  await page.getByRole("button", { name: "Seuraavat työt" }).click();
  await expect(page.getByRole("button", { name: /Huolto 025/ })).toBeVisible();
  await page
    .getByRole("textbox", {
      name: "Hae työtä, laitetta, linjaa, sijaintia tai nimikettä",
    })
    .fill("Pakkaamo Huolto 079 SKF");
  await expect(page.getByRole("row")).toHaveCount(2);
  await page.getByRole("button", { name: /Huolto 079/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("region", { name: "Ota mukaan" }),
  ).toBeVisible();
  await expect(dialog.getByText(/Lukitus ja merkintä;/).first()).toBeVisible();
  const history = dialog.getByRole("region", {
    name: "Aiemmat huollot samalla laitteella",
  });
  await history.locator("summary").click();
  await expect(
    history.getByText("Laakeri vaihdettu ja koeajettu", { exact: true }),
  ).toBeVisible();
  await expect(history).toContainText("SKF 6205-2RS: 0.5");
  await expect(history).toContainText("Tarkista kuluma seuraavalla kerralla");
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("handbook.png"),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Kirjaa valmistuminen" }).click();
  await dialog.getByRole("button", { name: "Kirjaa valmiiksi" }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
  );
  expect(saved.jobs[0]).toEqual(prior);
  expect(
    saved.jobs.find((j: { id: string }) => j.id === "next-79").actual,
  ).toEqual({ i1: 1, i2: 2, i3: 1 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
