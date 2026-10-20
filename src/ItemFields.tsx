import type { Item } from "./domain";
import { translate, type Lang } from "./i18n";

export function ItemFields({
  item,
  type,
  onTypeChange,
  lang,
}: {
  item: Item | null;
  type: Item["type"];
  onTypeChange: (type: Item["type"]) => void;
  lang: Lang;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  return (
    <>
      <div className="form-grid">
        <label>
          {t("type")}
          <select
            name="type"
            value={type}
            onChange={(e) => onTypeChange(e.target.value as Item["type"])}
          >
            {(["tools", "parts", "consumables"] as const).map((kind) => (
              <option key={kind} value={kind}>
                {t(kind)}
              </option>
            ))}
          </select>
        </label>
        {type !== "tools" && (
          <label>
            {t("quantity")}
            <input
              type="number"
              name="quantity"
              min="0"
              step="any"
              required
              defaultValue={item?.quantity || 0}
            />
          </label>
        )}
        <label>
          {t("storage")}
          <input name="location" required defaultValue={item?.location} />
        </label>
        {type !== "tools" && (
          <label>
            {t("unit")}
            <input
              name="unit"
              defaultValue={item?.unit || "kpl"}
              maxLength={30}
            />
          </label>
        )}
      </div>
      <details className="advanced-fields">
        <summary>{t("moreDetails")}</summary>
        <div className="form-grid">
          <label>
            {t("partNumber")}
            <input name="partNumber" defaultValue={item?.partNumber} />
          </label>
          <label>
            {t("manufacturer")}
            <input name="manufacturer" defaultValue={item?.manufacturer} />
          </label>
          <label>
            {t("externalId")}
            <input name="externalId" defaultValue={item?.externalId} />
          </label>
          <label>
            {t("calibrationDate")}
            <input
              type="date"
              name="calibration"
              defaultValue={item?.calibration}
            />
          </label>
        </div>
        <label>
          {t("description")}
          <input name="spec" defaultValue={item?.spec} />
        </label>
        <label>
          {t("compatibleEquipment")}
          <input name="compatible" defaultValue={item?.compatible} />
        </label>
        <label>
          {t("approvedAlternatives")}
          <input name="alternatives" defaultValue={item?.alternatives} />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="inactive"
            defaultChecked={item?.inactive}
          />
          {t("inactive")}
        </label>
      </details>
    </>
  );
}
