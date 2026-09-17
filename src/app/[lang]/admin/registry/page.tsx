import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { Card, SelectField, TextField } from "@/components/admin/fields";
import { ImportEntries } from "@/components/admin/import-entries";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localizedName } from "@/i18n/localize";
import { importSeasonNumbers, registerSeasonNumber, releaseSeasonNumber } from "@/lib/admin/actions/registry";
import { requireViewer } from "@/lib/auth";

export default async function RegistryPage({ params, searchParams }: PageProps<"/[lang]/admin/registry">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const r = dict.admin.registry;
  const e = dict.admin.entries;
  const viewer = await requireViewer(lang, `/${lang}/admin/registry`);
  if (!viewer.isSuperAdmin) notFound();

  const { data: seasons } = await viewer.supabase.from("seasons").select("id, year, name").order("year", { ascending: false });
  const { season: seasonParam } = await searchParams;
  const season = (seasons ?? []).find((s) => String(s.id) === seasonParam) ?? seasons?.[0];
  if (!season) notFound();

  const [{ data: classes }, { data: numbers }] = await Promise.all([
    viewer.supabase.from("classes").select("id, code, name, name_en").eq("season_id", season.id).order("sort_order"),
    viewer.supabase
      .from("season_numbers")
      .select("race_number, class_id, riders(id, first_name, last_name, clubs(name))")
      .eq("season_id", season.id)
      .order("race_number"),
  ]);
  const className = new Map((classes ?? []).map((cls) => [cls.id, localizedName(cls, lang)]));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {r.heading} · {season.year}
        </h1>
        <nav className="flex gap-2 text-sm">
          {(seasons ?? []).map((s) => (
            <Link key={s.id} href={`?season=${s.id}`} className={s.id === season.id ? "font-semibold" : "text-muted underline"}>
              {s.year}
            </Link>
          ))}
          <Link href={`/${lang}/s/${season.id}/numbers`} className="text-accent underline">
            {dict.admin.publicPage} ↗
          </Link>
        </nav>
      </div>

      <Card title={r.add}>
        <ActionForm action={registerSeasonNumber} submitLabel={r.add} pendingLabel={dict.common.loading}>
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="season_id" value={season.id} />
          <div className="grid gap-3 sm:grid-cols-5">
            <TextField label={e.raceNumber} name="race_number" type="number" min={1} required />
            <TextField label={e.firstName} name="first_name" required />
            <TextField label={e.lastName} name="last_name" required />
            <SelectField label={e.class} name="class" options={(classes ?? []).map((cls) => ({ value: cls.code, label: localizedName(cls, lang) }))} />
            <TextField label={e.club} name="club" />
          </div>
        </ActionForm>
      </Card>

      <Card title={r.import}>
        <ImportEntries lang={lang} dict={dict} targetId={season.id} action={importSeasonNumbers} />
      </Card>

      <Card title={t(r.count, { n: numbers?.length ?? 0 })}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {(numbers ?? []).map((row) => (
                <tr key={row.race_number} className="border-t border-border">
                  <td className="py-1.5 pr-3 text-right font-mono font-semibold tabular-nums">{row.race_number}</td>
                  <td className="py-1.5 pr-3">
                    {row.riders && (
                      <Link href={`/${lang}/r/${row.riders.id}`} className="hover:underline">
                        {row.riders.first_name} {row.riders.last_name}
                      </Link>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-muted">{className.get(row.class_id)}</td>
                  <td className="py-1.5 pr-3 text-muted">{row.riders?.clubs?.name}</td>
                  <td className="py-1.5 text-right">
                    <ActionButton
                      action={releaseSeasonNumber}
                      fields={{ lang, season_id: season.id, race_number: row.race_number }}
                      label={r.release}
                      pendingLabel="…"
                      tone="bad"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
