import { SelectField, TextField } from "@/components/admin/fields";
import type { Dictionary } from "@/i18n/get-dictionary";
import { isoToEventLocal } from "@/lib/timezone";

type StageValues = {
  day_number?: number;
  type?: string;
  name?: string;
  name_en?: string | null;
  points_scale?: string | null;
  first_start_at?: string | null;
  start_interval_seconds?: number | null;
  riders_per_slot?: number;
  course_closes_at?: string | null;
};

export function StageFields({
  dict,
  scales,
  values = {},
}: {
  dict: Dictionary;
  scales: { code: string; name: string }[];
  values?: StageValues;
}) {
  const s = dict.admin.stages;
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <TextField label={s.day} name="day_number" type="number" min={1} required defaultValue={values.day_number ?? 1} />
      <SelectField
        label={s.type}
        name="type"
        defaultValue={values.type ?? "navigation"}
        options={Object.entries(dict.stageType).map(([value, label]) => ({ value, label }))}
      />
      <TextField label={dict.admin.fields.name} name="name" required defaultValue={values.name} />
      <TextField label={dict.admin.fields.nameEn} name="name_en" defaultValue={values.name_en ?? ""} />
      <SelectField
        label={s.pointsScale}
        name="points_scale"
        defaultValue={values.points_scale ?? ""}
        className="sm:col-span-2"
        options={[{ value: "", label: s.noPoints }, ...scales.map((scale) => ({ value: scale.code, label: scale.name }))]}
      />
      <TextField label={s.firstStart} name="first_start_at" type="datetime-local" defaultValue={isoToEventLocal(values.first_start_at)} />
      <TextField label={s.closesAt} name="course_closes_at" type="datetime-local" defaultValue={isoToEventLocal(values.course_closes_at)} />
      <TextField label={s.interval} name="start_interval_seconds" type="number" min={1} defaultValue={values.start_interval_seconds ?? 30} />
      <TextField label={s.perSlot} name="riders_per_slot" type="number" min={1} defaultValue={values.riders_per_slot ?? 1} />
    </div>
  );
}
