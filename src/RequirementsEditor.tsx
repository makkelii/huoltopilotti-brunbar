import { useState } from "react";
import { Button } from "./components/ui/button";
import { id, type Item, type Requirement } from "./domain";
import { local, translate, type Lang } from "./i18n";
import { SearchSelect } from "./EquipmentPicker";
export function RequirementsEditor({
  items,
  lang,
  value,
  onChange,
}: {
  items: Item[];
  lang: Lang;
  value: Requirement[];
  onChange: (rows: Requirement[]) => void;
}) {
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k);
  const [category, setCategory] = useState<Requirement["category"]>("parts");
  const [itemId, setItemId] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const supply = ["tools", "parts", "consumables"].includes(category);
  const available = items.filter((i) => !i.inactive && i.type === category);
  const item = available.find((i) => i.id === itemId);
  return (
    <section className="planned-editor" aria-label={t("plannedSupplies")}>
      <h3>{t("plannedSupplies")}</h3>
      <p>{t("planningHint")}</p>
      {value.map((r, index) => (
        <div className="usage-row" key={r.id}>
          <span>
            <small>
              {t(r.category)} · {t(r.itemId ? "chooseRegistry" : "writeUsage")}
            </small>
            <strong>{local(r.label, lang)}</strong>
          </span>
          {r.category !== "tools" && (
            <label>
              {t("quantity")}
              <input
                aria-label={`${t("quantity")} · ${local(r.label, lang)}`}
                type="number"
                required
                aria-invalid={
                  !Number.isFinite(r.quantity) ||
                  r.quantity <= 0 ||
                  r.quantity > 100000
                }
                min="0.01"
                max="100000"
                step="any"
                value={r.quantity}
                onChange={(e) =>
                  onChange(
                    value.map((x, i) =>
                      i === index
                        ? { ...x, quantity: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
            </label>
          )}
          {(!Number.isFinite(r.quantity) ||
            r.quantity <= 0 ||
            r.quantity > 100000) && (
            <p role="alert">{t("positiveUsageQuantity")}</p>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            {t("remove")} · {local(r.label, lang)}
          </Button>
        </div>
      ))}
      <details>
        <summary>{t("addPlannedNeed")}</summary>
        <label>
          {t("type")}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as Requirement["category"]);
              setItemId("");
            }}
          >
            {(
              [
                "parts",
                "consumables",
                "tools",
                "documents",
                "safety",
                "personnel",
              ] as const
            ).map((c) => (
              <option key={c} value={c}>
                {t(c)}
              </option>
            ))}
          </select>
        </label>
        {supply && (
          <SearchSelect
            key={category}
            lang={lang}
            label={t("chooseRegistry")}
            value={itemId}
            options={available.map((i) => ({
              value: i.id,
              label: [i.name, i.partNumber].filter(Boolean).join(" · "),
            }))}
            onChange={setItemId}
          />
        )}
        {!item && (
          <label>
            {t("plannedName")}
            <input
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </label>
        )}
        {category !== "tools" && (
          <label>
            {t("quantity")}
            <input
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={
            value.length >= 100 ||
            (!item && !name.trim()) ||
            (category !== "tools" &&
              (!Number.isFinite(quantity) ||
                quantity <= 0 ||
                quantity > 100000))
          }
          onClick={() => {
            const label = item?.name || name.trim();
            onChange([
              ...value,
              {
                id: id(),
                category,
                label: [label, label, label],
                quantity: category === "tools" ? 1 : quantity,
                state: "unchecked",
                ...(item ? { itemId: item.id } : {}),
              },
            ]);
            setName("");
            setItemId("");
            setQuantity(1);
          }}
        >
          {t("addItem")}
        </Button>
      </details>
    </section>
  );
}
