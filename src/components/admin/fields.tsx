// Plain form controls shared by the admin pages. No state: values travel in FormData.

const control =
  "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

type BaseProps = { label: string; name: string; className?: string };

export function TextField({
  label,
  name,
  className,
  ...input
}: BaseProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">) {
  return (
    <label className={`block text-xs text-muted ${className ?? ""}`}>
      {label}
      <input name={name} className={control} {...input} />
    </label>
  );
}

export function SelectField({
  label,
  name,
  className,
  options,
  ...select
}: BaseProps & {
  options: { value: string | number; label: string }[];
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name">) {
  return (
    <label className={`block text-xs text-muted ${className ?? ""}`}>
      {label}
      <select name={name} className={control} {...select}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextAreaField({
  label,
  name,
  className,
  ...textarea
}: BaseProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  return (
    <label className={`block text-xs text-muted ${className ?? ""}`}>
      {label}
      <textarea name={name} rows={3} className={control} {...textarea} />
    </label>
  );
}

export function CheckboxField({
  label,
  name,
  className,
  ...input
}: BaseProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type">) {
  return (
    <label className={`flex items-center gap-2 text-sm ${className ?? ""}`}>
      <input type="checkbox" name={name} value="true" className="size-4 accent-[var(--accent)]" {...input} />
      {label}
    </label>
  );
}

export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5">
      {title && <h2 className="font-display mb-4 text-lg font-bold uppercase tracking-wide">{title}</h2>}
      {children}
    </section>
  );
}
