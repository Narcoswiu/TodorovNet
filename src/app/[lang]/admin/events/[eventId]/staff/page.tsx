import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { Card, SelectField, TextField } from "@/components/admin/fields";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { assignStaff, removeStaff } from "@/lib/admin/actions/staff";
import { requireViewer, type StaffRole } from "@/lib/auth";

export default async function EventStaffPage({ params }: PageProps<"/[lang]/admin/events/[eventId]/staff">) {
  const { lang, eventId: rawId } = await params;
  const eventId = Number(rawId);
  if (!hasLocale(lang) || !Number.isInteger(eventId)) notFound();
  const dict = getDictionary(lang);
  const text = dict.admin.staff;
  const viewer = await requireViewer(lang, `/${lang}/admin/events/${eventId}/staff`);

  const { data: members } = await viewer.supabase.rpc("event_staff_members", { p_event_id: eventId });

  // Mirrors the database rule: organizers add timekeepers and GPS judges; a super admin adds anyone.
  const assignable: StaffRole[] = viewer.isSuperAdmin
    ? ["organizer", "timekeeper", "gps_judge", "jury", "jury_chair"]
    : ["timekeeper", "gps_judge"];

  return (
    <>
      <Card title={dict.admin.tabs.staff}>
        {!members?.length && <p className="text-sm text-muted">{text.none}</p>}
        <ul className="divide-y divide-border text-sm">
          {(members ?? []).map((member) => (
            <li key={`${member.user_id}-${member.role}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <div className="font-medium">{member.full_name || member.email}</div>
                <div className="text-xs text-muted">
                  {member.full_name ? `${member.email} · ` : ""}
                  {text.roles[member.role]}
                </div>
              </div>
              {(viewer.isSuperAdmin || assignable.includes(member.role)) && (
                <ActionButton
                  action={removeStaff}
                  fields={{ lang, event_id: eventId, user_id: member.user_id, role: member.role }}
                  label={text.remove}
                  pendingLabel="…"
                  tone="bad"
                />
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title={text.assign}>
        <p className="mb-3 text-xs text-muted">{text.help}</p>
        <ActionForm action={assignStaff} submitLabel={text.assign} pendingLabel={dict.common.loading}>
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="event_id" value={eventId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label={text.email} name="email" type="email" required />
            <SelectField label={text.role} name="role" options={assignable.map((role) => ({ value: role, label: text.roles[role] }))} />
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
