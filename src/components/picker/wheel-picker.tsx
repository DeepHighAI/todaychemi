'use client';

import { useEffect, useRef } from 'react';

interface WheelPickerProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  'aria-label'?: string;
}

// .picker-col .opt { height: 40px } — must match this CSS value
const ITEM_HEIGHT = 40;

export function WheelPicker({ options, value, onChange, 'aria-label': ariaLabel }: WheelPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const idx = options.indexOf(value);
    if (idx >= 0) ref.current.scrollTop = idx * ITEM_HEIGHT;
  }, [value, options]);

  function select(o: string, i: number) {
    if (ref.current) ref.current.scrollTop = i * ITEM_HEIGHT;
    onChange(o);
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const idx = Math.round(e.currentTarget.scrollTop / ITEM_HEIGHT);
    const v = options[Math.max(0, Math.min(options.length - 1, idx))];
    if (v !== value) onChange(v);
  }

  return (
    <div className="picker-col" ref={ref} aria-label={ariaLabel} onScroll={handleScroll}>
      {options.map((o, i) => (
        <div
          key={o}
          className={`opt${o === value ? ' sel' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => select(o, i)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              select(o, i);
            }
          }}
        >
          {o}
        </div>
      ))}
    </div>
  );
}
