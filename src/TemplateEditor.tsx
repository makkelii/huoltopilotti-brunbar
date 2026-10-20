import { useState, type FormEvent } from "react";
import type { Item, Requirement } from "./domain";
import { id } from "./domain";
import { translate, type Lang } from "./i18n";
import { Button } from "./components/ui/button";
export function TemplateEditor({
  items,
  lang,
  current,
  onSave,
}: {
  items: Item[];
  lang: Lang;
  current: Requirement[];
  onSave: (requirements: Requirement[]) => Promise<boolean>;
}) {
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k);
  const [category, setCategory] = useState<Requirement["category"]>("tools");
  const [draft, setDraft] = useState(current),
    [message, setMessage] = useState("");
  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = String(f.get("label"));
    const itemId = String(f.get("item"));
    const category = String(f.get("category")) as Requirement["category"];
    const item = items.find((i) => i.id === itemId);
    if (
      ["tools", "parts", "consumables"].includes(category) &&
      (!item || item.type !== category)
    ) {
      setMessage(t("stockError"));
      return;
    }
    setDraft([
      ...draft,
      {
        id: id(),
        category,
        label: [text, text, text],
        quantity: category === "tools" ? 1 : Number(f.get("quantity")),
        state: "unchecked",
        ...(itemId ? { itemId } : {}),
      },
    ]);
    setMessage("");
    e.currentTarget.reset();
    setCategory("tools");
  }
  return (
    <div className="completion">
      <h3>{t("templates")}</h3>
      <form onSubmit={add}>
        <label>
          {t("type")}
          <select
            name="category"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as Requirement["category"])
            }
          >
            {(
              [
                "tools",
                "parts",
                "consumables",
                "safety",
                "documents",
                "personnel",
              ] as const
            ).map((k) => (
              <option key={k} value={k}>
                {t(k)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("description")}
          <input name="label" required maxLength={1000} />
        </label>
        <label>
          {t("inventory")}
          <select name="item">
            <option value="">—</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        {category !== "tools" && (
          <label>
            {t("quantity")}
            <input
              name="quantity"
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              defaultValue="1"
              required
            />
          </label>
        )}
        <Button variant="outline" type="submit">
          {t("addItem")}
        </Button>
      </form>
      {draft.map((r) => (
        <div className="template-row" key={r.id}>
          <span>
            {r.label[{ fi: 0, en: 1, de: 2 }[lang]]}
            {r.category !== "tools" && ` · ${r.quantity}`}
          </span>
          <Button
            variant="ghost"
            onClick={() => setDraft(draft.filter((x) => x.id !== r.id))}
          >
            {t("remove")}
          </Button>
        </div>
      ))}
      {message && <p role="alert">{message}</p>}
      <Button
        onClick={async () => {
          if (window.confirm(t("approveConfirm")) && (await onSave(draft)))
            setMessage(t("serverSaved"));
        }}
      >
        {t("approve")}
      </Button>
    </div>
  );
}
