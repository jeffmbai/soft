type FormFieldProps = {
  label: string;
  value: string;
  editing?: boolean;
  onChange?: (value: string) => void;
};

export default function FormField({ label, value, editing, onChange }: FormFieldProps) {
  return (
    <div>
      <label className="font-data-mono text-[10px] uppercase tracking-wider text-outline">{label}</label>
      {editing ? (
        <input
          type="text"
          defaultValue={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
        />
      ) : (
        <p className="mt-0.5 font-body-sm text-body-sm text-primary">{value}</p>
      )}
    </div>
  );
}
