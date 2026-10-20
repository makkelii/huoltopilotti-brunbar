import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";
import { completeJob } from "../src/domain";
for (const useActual of [true, false]) {
  test(`repeat maintenance prefills ${useActual ? "actual usage" : "fallback plan"} for editing without changing history or stock`, async ({
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
      useActual ? { i1: 1, i2: 1, i3: 0.25 } : {},
      "Vanha korjaus",
      20,
      "Vanha suorittaja",
      "",
      useActual
        ? [
            { type: "parts", name: "Oma tiiviste", quantity: 2.5 },
            { type: "tools", name: "Oma avain" },
          ]
        : [],
    );
    if (useActual) s.items = s.items.filter((i) => i.id !== "i3");
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
    await expect(
      page.getByLabel(
        useActual ? "Määrä · SKF 6205-2RS" : "Määrä · Laakeri SKF 6205-2RS",
        { exact: true },
      ),
    ).toHaveValue(useActual ? "1" : "2");
    if (useActual) {
      await expect(
        page.getByLabel("Määrä · Oma tiiviste", { exact: true }),
      ).toHaveValue("2.5");
      await expect(
        page.getByLabel("Määrä · NLGI 2", { exact: true }),
      ).toHaveValue("0.25");
      await expect(
        page.getByRole("button", { name: "Poista · Oma avain", exact: true }),
      ).toBeVisible();
    }
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
    await page
      .getByLabel(
        useActual ? "Määrä · SKF 6205-2RS" : "Määrä · Laakeri SKF 6205-2RS",
        { exact: true },
      )
      .fill("3");
    if (useActual)
      await page
        .getByRole("button", { name: "Poista · Oma tiiviste", exact: true })
        .click();
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
      next.jobs[1].requirements.find(
        (r: { itemId?: string }) => r.itemId === "i2",
      ).quantity,
    ).toBe(3);
    if (useActual) {
      expect(
        next.jobs[1].requirements.some(
          (r: { label: string[] }) => r.label[0] === "Oma tiiviste",
        ),
      ).toBe(false);
      expect(
        next.jobs[1].requirements.find(
          (r: { label: string[] }) => r.label[0] === "NLGI 2",
        ),
      ).not.toHaveProperty("itemId");
    }
    expect(next.jobs[1].freeUsage || []).toEqual([]);
    expect(next.jobs[1].usedItems || []).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
}
