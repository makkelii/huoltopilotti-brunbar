import { useState } from "react";
import type { Asset, ProductionLine } from "./domain";
import { translate, type Lang } from "./i18n";

export function SearchSelect({
  label,
  value,
  options,
  onChange,
  required = false,
  name,
  lang = "fi",
  disabled = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  required?: boolean;
  name?: string;
  lang?: Lang;
  disabled?: boolean;
}) {
  const searchLabel = `${label} · ${translate(lang, "search")}`;
  const [query, setQuery] = useState("");
  const shown = options.filter(
    (o) =>
      o.value === value ||
      o.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="search-select">
      {options.length > 12 && (
        <label>
          {searchLabel}
          <input
            disabled={disabled}
            type="search"
            aria-label={`${searchLabel}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
          />
        </label>
      )}
      <label>
        {label}
        <select
          disabled={disabled}
          name={name}
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {shown.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
export const equipmentLabel = (a: Asset) =>
  [a.name, a.serial, a.location].filter(Boolean).join(" · ");
export function inEquipmentScope(asset: Asset, scope: string) {
  return (
    scope === "all" ||
    (scope === "unassigned"
      ? !asset.productionLineId
      : asset.productionLineId === scope)
  );
}
export function EquipmentPicker({
  assets,
  lines,
  lang,
  scope,
  assetId,
  onScope,
  onAsset,
}: {
  assets: Asset[];
  lines: ProductionLine[];
  lang: Lang;
  scope: string;
  assetId: string;
  onScope: (value: string) => void;
  onAsset: (value: string) => void;
}) {
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k);
  const eligible = assets.filter(
    (a) => !a.archivedAt && inEquipmentScope(a, lines.length ? scope : "all"),
  );
  return (
    <fieldset className="equipment-picker">
      <legend>{t("equipment")}</legend>
      {lines.length > 0 && (
        <SearchSelect
          lang={lang}
          label={t("productionLines")}
          value={scope}
          options={[
            { value: "all", label: t("allEquipment") },
            { value: "unassigned", label: t("noProductionLine") },
            ...lines.map((l) => ({
              value: l.id,
              label: [l.name, l.identifier].filter(Boolean).join(" · "),
            })),
          ]}
          onChange={(next) => {
            onScope(next || "all");
            if (
              !assets.some(
                (a) => a.id === assetId && inEquipmentScope(a, next || "all"),
              )
            )
              onAsset("");
          }}
        />
      )}
      <SearchSelect
        key={scope}
        lang={lang}
        name="assetId"
        required
        label={t("equipment")}
        value={eligible.some((a) => a.id === assetId) ? assetId : ""}
        options={eligible.map((a) => ({
          value: a.id,
          label: equipmentLabel(a),
        }))}
        onChange={onAsset}
      />
      {!eligible.length && <p role="status">{t("noAssetsInView")}</p>}
    </fieldset>
  );
}
