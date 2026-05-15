'use client';

interface MockInputProps {
  label: string;
  value: string | null;
  placeholder: string;
  onTap: () => void;
  filled?: boolean;
}

export function MockInput({ label, value, placeholder, onTap, filled }: MockInputProps) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`mock-input${filled || value ? ' filled' : ''}`}
    >
      <span className="lbl">{label}</span>
      <span className={`val${!value ? ' placeholder' : ''}`}>{value ?? placeholder}</span>
      <span className="chevron">›</span>
    </button>
  );
}
