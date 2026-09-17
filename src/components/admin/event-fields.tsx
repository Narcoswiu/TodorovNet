import { SelectField, TextField } from "@/components/admin/fields";
import type { Dictionary } from "@/i18n/get-dictionary";

type EventValues = {
  name?: string;
  location?: string;
  date_from?: string;
  date_to?: string;
  kind?: string;
  season_id?: number | null;
  round_number?: number | null;
  status?: string;
  ranking?: string;
};

export function EventFields({
  dict,
  seasons,
  values = {},
}: {
  dict: Dictionary;
  seasons: { id: number; year: number; name: string }[];
  values?: EventValues;
}) {
  const f = dict.admin.fields;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label={f.name} name="name" required minLength={2} defaultValue={values.name} className="sm:col-span-2" />
      <TextField label={f.location} name="location" defaultValue={values.location} />
      <SelectField
        label={f.status}
        name="status"
        defaultValue={values.status ?? "draft"}
        options={Object.entries(dict.admin.eventStatus).map(([value, label]) => ({ value, label }))}
      />
      <TextField label={f.dateFrom} name="date_from" type="date" required defaultValue={values.date_from} />
      <TextField label={f.dateTo} name="date_to" type="date" required defaultValue={values.date_to} />
      <SelectField
        label={f.ranking}
        name="ranking"
        defaultValue={values.ranking ?? "points"}
        options={Object.entries(dict.admin.ranking).map(([value, label]) => ({ value, label }))}
      />
      <SelectField
        label={f.kind}
        name="kind"
        defaultValue={values.kind ?? "championship_round"}
        options={Object.entries(dict.admin.kind).map(([value, label]) => ({ value, label }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label={f.season}
          name="season_id"
          defaultValue={values.season_id ?? seasons[0]?.id ?? ""}
          options={[
            { value: "", label: f.noSeason },
            ...seasons.map((season) => ({ value: season.id, label: `${season.year} · ${season.name}` })),
          ]}
        />
        <TextField label={f.round} name="round_number" type="number" min={1} defaultValue={values.round_number ?? ""} />
      </div>
    </div>
  );
}
