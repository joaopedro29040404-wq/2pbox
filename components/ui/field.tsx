'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import { applyMask, type MaskName } from '@/lib/masks';

type BaseProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
};

function FieldInfo({ text }: { text: ReactNode }) {
  return (
    <span className="ui-field-info">
      <button type="button" aria-label={typeof text === 'string' ? text : 'Mais informações'} onClick={(event) => event.preventDefault()}>
        <Info size={12} />
      </button>
      <span className="ui-field-tip" role="tooltip">
        {text}
      </span>
    </span>
  );
}

function FieldHead({ id, label, hint, optional }: { id?: string; label?: ReactNode; hint?: ReactNode; optional?: boolean }) {
  if (!label && !hint) return null;

  const content = (
    <>
      {label && (
        <span className="ui-field-head-text">
          {label}
          {optional && <em>opcional</em>}
        </span>
      )}
      {hint && <FieldInfo text={hint} />}
    </>
  );

  if (!id) return <legend className="ui-field-head">{content}</legend>;

  return (
    <div className="ui-field-head">
      <label htmlFor={id}>{content}</label>
    </div>
  );
}

function FieldShell({
  id,
  label,
  hint,
  error,
  optional,
  fullWidth,
  children,
}: BaseProps & { id: string; children: ReactNode }) {
  return (
    <div className={`ui-field ${error ? 'has-error' : ''} ${fullWidth ? 'is-full' : ''}`}>
      <FieldHead id={id} label={label} hint={hint} optional={optional} />
      {children}
      {error && (
        <p className="ui-field-error" role="alert">
          <AlertCircle size={13} /> {error}
        </p>
      )}
    </div>
  );
}

export type TextFieldProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    mask?: MaskName;
    onValueChange?: (value: string) => void;
    onChange?: InputHTMLAttributes<HTMLInputElement>['onChange'];
  };

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, optional, icon, fullWidth, mask, onValueChange, onChange, id, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || generatedId;

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} fullWidth={fullWidth}>
      <div className={`ui-input ${icon ? 'has-icon' : ''}`}>
        {icon && <span className="ui-input-icon">{icon}</span>}
        <input
          {...rest}
          id={fieldId}
          ref={ref}
          className={className}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            if (mask) event.target.value = applyMask(mask, event.target.value);
            onValueChange?.(event.target.value);
            onChange?.(event);
          }}
        />
      </div>
    </FieldShell>
  );
});

export type TextAreaFieldProps = BaseProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { onValueChange?: (value: string) => void };

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, hint, error, optional, fullWidth, onValueChange, onChange, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || generatedId;

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} fullWidth={fullWidth}>
      <div className="ui-input ui-input-textarea">
        <textarea
          {...rest}
          id={fieldId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            onValueChange?.(event.target.value);
            onChange?.(event);
          }}
        />
      </div>
    </FieldShell>
  );
});

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectFieldProps = BaseProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    options: SelectOption[];
    placeholder?: string;
    onValueChange?: (value: string) => void;
  };

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, optional, fullWidth, options, placeholder, onValueChange, onChange, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || generatedId;

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} fullWidth={fullWidth}>
      <div className="ui-input ui-input-select">
        <select
          {...rest}
          id={fieldId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            onValueChange?.(event.target.value);
            onChange?.(event);
          }}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </FieldShell>
  );
});

export type RadioOption = { value: string; label: string; description?: string; icon?: ReactNode; disabled?: boolean };

export type RadioGroupProps = BaseProps & {
  name: string;
  value: string;
  options: RadioOption[];
  columns?: 1 | 2 | 3;
  onValueChange: (value: string) => void;
};

export function RadioGroup({ label, hint, error, name, value, options, columns = 1, fullWidth, onValueChange }: RadioGroupProps) {
  return (
    <fieldset className={`ui-field ui-radio-group ${error ? 'has-error' : ''} ${fullWidth ? 'is-full' : ''}`}>
      <FieldHead label={label} hint={hint} />
      <div className="ui-radio-list" data-columns={columns}>
        {options.map((option) => (
          <label key={option.value} className={`ui-radio ${value === option.value ? 'is-selected' : ''} ${option.disabled ? 'is-disabled' : ''}`}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onValueChange(option.value)}
            />
            {option.icon && <span className="ui-radio-icon">{option.icon}</span>}
            <span className="ui-radio-copy">
              <strong>{option.label}</strong>
              {option.description && <small>{option.description}</small>}
            </span>
            <span className="ui-radio-mark" aria-hidden="true" />
          </label>
        ))}
      </div>
      {error && (
        <p className="ui-field-error" role="alert">
          <AlertCircle size={13} /> {error}
        </p>
      )}
    </fieldset>
  );
}

export type CheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  label: ReactNode;
  description?: ReactNode;
  error?: string;
  onCheckedChange?: (checked: boolean) => void;
};

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(function CheckboxField(
  { label, description, error, onCheckedChange, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || generatedId;

  return (
    <div className={`ui-field ui-checkbox-field ${error ? 'has-error' : ''}`}>
      <label className="ui-checkbox" htmlFor={fieldId}>
        <input
          {...rest}
          id={fieldId}
          ref={ref}
          type="checkbox"
          onChange={(event) => onCheckedChange?.(event.target.checked)}
        />
        <span className="ui-checkbox-mark" aria-hidden="true" />
        <span className="ui-checkbox-copy">
          <strong>{label}</strong>
          {description && <small>{description}</small>}
        </span>
      </label>
      {error && (
        <p className="ui-field-error" role="alert">
          <AlertCircle size={13} /> {error}
        </p>
      )}
    </div>
  );
});
