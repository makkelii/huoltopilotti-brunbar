import type { FreeUsage } from "./completionUsage";
import { translate, type Lang } from "./i18n";
import { Button } from "./components/ui/button";

export function FreeUsageEditor({
  value,
  onChange,
  lang,
}: {
  value: FreeUsage[];
  onChange: (value: FreeUsage[]) => void;
  lang: Lang;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  return (
    <div className="free-usage">
      <div className="button-row">
        <Button
          type="button"
          variant="outline"
          disabled={value.length >= 100}
          onClick={() =>
            onChange([
              ...value,
              { type: "parts", name: "", quantity: 1, unit: "" },
            ])
          }
        >
          {t("addFreePart")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={value.length >= 100}
          onClick={() => onChange([...value, { type: "tools", name: "" }])}
        >
          {t("addFreeTool")}
        </Button>
      </div>
      {value.map((entry, index) => (
        <fieldset className="free-usage-row" key={index}>
          <legend>
            {t(entry.type === "tools" ? "usedTools" : "usedSupplies")}{" "}
            {index + 1}
          </legend>
          <label>
            {t("name")}
            <input
              required
              maxLength={200}
              value={entry.name}
              onChange={(e) =>
                onChange(
                  value.map((v, i) =>
                    i === index ? { ...v, name: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          {entry.type === "parts" && (
            <div className="form-grid">
              <label>
                {t("usedQuantity")}
                <input
                  type="number"
                  required
                  min="0.000001"
                  max="100000000"
                  step="any"
                  value={entry.quantity}
                  onChange={(e) =>
                    onChange(
                      value.map((v, i) =>
                        i === index
                          ? { ...entry, quantity: Number(e.target.value) }
                          : v,
                      ),
                    )
                  }
                />
              </label>
              <label>
                {t("unit")}
                <input
                  maxLength={30}
                  placeholder={t("pieceUnit")}
                  value={entry.unit || ""}
                  onChange={(e) =>
                    onChange(
                      value.map((v, i) =>
                        i === index ? { ...entry, unit: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
            </div>
          )}
          <small>{t("freeUsageHint")}</small>
          <Button
            type="button"
            variant="ghost"
            aria-label={`${t("removeUsage")} ${index + 1}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            {t("remove")}
          </Button>
        </fieldset>
      ))}
    </div>
  );
}
