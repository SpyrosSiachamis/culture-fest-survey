"use client";

/**
 * The filter controls, built from the catalogue the API sends.
 *
 * Nothing in this file knows what a genre or an age range is. It walks `schema.fields`, renders a
 * chip per declared value and sends the selections straight back — which is what makes a new option
 * on the backend show up here on its own. Labels come from the survey's own locale entries, keyed by
 * the same values, so a category is translated once for both the survey and this bar.
 *
 * Values within a field are OR-ed and fields are AND-ed, matching what the API does; the count in
 * the header is there so a filter left on three screens ago is visible rather than mysterious.
 */

import { useState } from "react";

import { useLang } from "@/components/LanguageProvider";
import { fieldLabel, valueLabel } from "@/lib/adminLabels";
import { format } from "@/lib/i18n";
import type { AnalyticsField, FilterSelection } from "@/lib/adminApi";
import { AdmButton, Panel } from "./AdminUI";

export function FilterBar({
  fields,
  selection,
  onChange,
}: {
  fields: AnalyticsField[];
  selection: FilterSelection;
  onChange: (next: FilterSelection) => void;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  const activeCount = Object.values(selection).reduce((sum, values) => sum + values.length, 0);

  function toggle(field: string, value: string) {
    const current = selection[field] ?? [];
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];

    const updated = { ...selection };
    // Drop the key entirely rather than leaving an empty array, so the request carries no trace of
    // a filter that is no longer set.
    if (next.length === 0) delete updated[field];
    else updated[field] = next;

    onChange(updated);
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold text-adm-text">{t.admin.filters.title}</h2>
          <span className="text-xs text-adm-muted">
            {activeCount === 0
              ? t.admin.filters.none
              : format(t.admin.filters.active, { count: activeCount })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <AdmButton type="button" variant="ghost" onClick={() => onChange({})}>
              {t.admin.filters.clear}
            </AdmButton>
          )}
          <AdmButton
            type="button"
            variant="ghost"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? t.admin.filters.hide : t.admin.filters.show}
          </AdmButton>
        </div>
      </div>

      {open && (
        <div className="mt-5 flex flex-col gap-5 border-t border-adm-line pt-5">
          {fields.map((field) => (
            <fieldset key={field.name}>
              <legend className="mb-2 text-xs uppercase tracking-[0.12em] text-adm-muted">
                {fieldLabel(t, field.name)}
              </legend>
              <div className="flex flex-wrap gap-2">
                {field.values.map((value) => {
                  const checked = (selection[field.name] ?? []).includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggle(field.name, value)}
                      className={`min-h-9 cursor-pointer rounded-sm border px-3 text-xs transition-colors ${
                        checked
                          ? "border-adm-accent bg-adm-accent/25 text-adm-text"
                          : "border-adm-line text-adm-muted hover:border-adm-accent hover:text-adm-text"
                      }`}
                    >
                      {valueLabel(t, field.name, value)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </Panel>
  );
}
