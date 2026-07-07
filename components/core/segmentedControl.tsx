import React from 'react';

type SegmentedControlOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  options: SegmentedControlOption<T>[];
  onChange: (value: T) => void;
  name?: string;
  className?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  name = 'segmented-control',
  className = '',
  size = 'md',
  disabled = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`sentry-segmented-control sentry-segmented-control--${size} ${className}`}
      role="radiogroup"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        const id = `${name}-${opt.value}`;
        return (
          <label
            key={opt.value}
            htmlFor={id}
            className={`sentry-segmented-control-item ${selected ? 'sentry-segmented-control-item--selected' : ''}`}
            data-disabled={disabled || opt.disabled || undefined}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              disabled={disabled || opt.disabled}
              onChange={() => onChange(opt.value)}
              className="sentry-segmented-control-input"
            />
            {opt.icon && <span className="sentry-segmented-control-icon">{opt.icon}</span>}
            <span className="sentry-segmented-control-label">{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
