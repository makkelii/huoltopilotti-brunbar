import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";
import { completeJob } from "../src/domain";

test("production lines remain optional; managers create, edit, move and retire without losing equipment or history", async ({
  page,
  isMobile,
}) => {
  const base = seed();
  base.jobs[0].assetId = base.assets[0].id;
  const store = completeJob(base, "j1", {}, "Vanha huoltotieto säilyy", 26);
  await page.addInitScript((data) => {
    localStorage.setItem("hp-welcome", "1");
    if (!localStorage.getItem("huoltopilotti-demo-v1"))
      localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(data));
  }, store);
  await page.goto("?demo=1#assets");
  await expect(
    page.getByRole("heading", { name: "CNC Haas VF-2" }),
  ).toBeVisible();
  const createLine = async (name: string, identifier: string) => {
    await page
      .getByRole("button", { name: "Lisää tuotantolinja", exact: true })
      .click();
    const form = page.getByRole("dialog");
    await form.getByLabel("Nimi", { exact: true }).fill(name);
    await form
      .getByLabel("Tuotantolinjan tunniste (valinnainen)")
      .fill(identifier);
    await form.getByLabel("Sijainti", { exact: true }).fill("Tehdashalli");
    await form.getByRole("button", { name: "Tallenna", exact: true }).click();
    await expect(form).toHaveCount(0);
  };
  await createLine("Pakkauslinja", "PACK-1");
  await createLine("Täyttölinja", "FILL-2");
  const card = page.locator(".asset-card").filter({ hasText: "CNC Haas VF-2" });
  for (const name of ["Pakkauslinja · PACK-1", "Täyttölinja · FILL-2"]) {
    await card.getByRole("button", { name: "Muokkaa", exact: true }).click();
    await page
      .getByLabel("Tuotantolinja (valinnainen)")
      .selectOption({ label: name });
    await page.getByRole("button", { name: "Tallenna", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(card).toContainText(name.split(" · ")[0]);
  }
  await card.getByRole("button", { name: "Täyttölinja", exact: true }).click();
  await page
    .getByRole("button", { name: "Muokkaa tuotantolinjaa", exact: true })
    .click();
  await page.getByLabel("Nimi", { exact: true }).fill("Täyttölinja 2");
  await page.getByRole("button", { name: "Tallenna", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Täyttölinja 2", exact: true }),
  ).toBeVisible();
  const views = page.getByRole("group", { name: "Tuotantolinjan näkymät" });
  await views
    .getByRole("button", { name: "Avoimet huoltotyöt", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Avoimet huoltotyöt" }),
  ).toContainText(store.jobs[0].name);
  // Existing recurrence remains an open job on the same physical device.
  await views
    .getByRole("button", { name: "Huoltohistoria", exact: true })
    .click();
  const history = page.getByRole("region", { name: "Huoltohistoria" });
  await history
    .getByRole("button", { name: new RegExp(store.jobs[0].name) })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Vanha huoltotieto säilyy",
  );
  await page.getByRole("button", { name: "Sulje", exact: true }).click();
  await views.getByRole("button", { name: "Laitteet", exact: true }).click();
  await page
    .getByRole("button", { name: "Lisää laite tälle linjalle", exact: true })
    .click();
  await expect(page.getByLabel("Tuotantolinja (valinnainen)")).toHaveValue(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!)
          .productionLines[1].id,
    ),
  );
  await page.getByLabel("Nimi", { exact: true }).fill("Uusi syöttökuljetin");
  await page.getByRole("button", { name: "Tallenna", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Uusi syöttökuljetin" }),
  ).toBeVisible();
  const layout = await page
    .locator(".assets-workspace")
    .evaluate((element) => ({
      width: element.clientWidth,
      overflow: element.scrollWidth > element.clientWidth,
    }));
  expect(layout.overflow).toBeFalsy();
  if (isMobile) expect(layout.width).toBeLessThan(500);
  await page
    .getByRole("button", { name: "Arkistoi tuotantolinja", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Huoltotyöt ja historia säilyvät",
  );
  await page
    .getByRole("button", {
      name: "Arkistoi ja säilytä laitteet",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Ilman tuotantolinjaa", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "CNC Haas VF-2" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Uusi syöttökuljetin" }),
  ).toBeVisible();
  await page.reload();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
  );
  expect(saved.productionLines).toHaveLength(1);
  expect(saved.assets).toHaveLength(store.assets.length + 1);
  expect(saved.jobs).toEqual(store.jobs);
  expect(saved.items).toEqual(store.items);
});
