import { useRef, useState } from "react";
import type { Item, Requirement } from "./domain";
import { translate, type Lang } from "./i18n";
import { Button } from "./components/ui/button";
import { RequirementsEditor } from "./RequirementsEditor";
export function TemplateEditor({
  items,
  lang,
  current,
  onSave,
}: {
  items: Item[];
  lang: Lang;
  current: Requirement[];
  onSave: (rows: Requirement[]) => Promise<boolean>;
}) {
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k);
  const [draft, setDraft] = useState(current),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false);
  const lock = useRef(false);
  return (
    <fieldset className="completion form-lock" disabled={saving}>
      <RequirementsEditor
        items={items}
        lang={lang}
        value={draft}
        onChange={setDraft}
      />
      {message && <p role="status">{message}</p>}
      <Button
        disabled={
          saving ||
          draft.some(
            (r) =>
              !Number.isFinite(r.quantity) ||
              r.quantity <= 0 ||
              r.quantity > 100000,
          )
        }
        onClick={async () => {
          if (lock.current) return;
          lock.current = true;
          setSaving(true);
          setMessage("");
          try {
            setMessage(t((await onSave(draft)) ? "serverSaved" : "saveError"));
          } catch {
            setMessage(t("saveError"));
          } finally {
            lock.current = false;
            setSaving(false);
          }
        }}
      >
        {t("save")}
      </Button>
    </fieldset>
  );
}
