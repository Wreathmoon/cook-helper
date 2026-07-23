export interface FilterChipOption {
  label: string;
  value: string;
}

export function FilterChips({
  options,
  selected,
  onChange,
  label,
}: {
  options: FilterChipOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  label?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      {label && (
        <span style={{ fontSize: 11.5, color: 'var(--tx2)', marginRight: 2 }}>{label}</span>
      )}
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <span
            key={opt.value}
            onClick={() => onChange([opt.value])}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--line)'}`,
              background: isSelected ? 'var(--primary-soft)' : 'var(--panel)',
              color: isSelected ? 'var(--primary)' : 'var(--tx)',
              fontWeight: isSelected ? 600 : 400,
              borderRadius: 99,
              padding: '4px 13px',
              fontSize: 12,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {opt.label}
          </span>
        );
      })}
    </div>
  );
}
