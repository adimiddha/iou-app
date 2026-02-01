import { formatPhoneDisplay, parsePhoneDisplay } from '../lib/phone-utils';
import { X } from 'lucide-react';

type PhoneInputProps = {
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
};

/** Digits only (0–10). Displays as (xxx) xxx-xxxx. Space and non-digits do nothing. */
export default function PhoneInput({
  value,
  onChange,
  placeholder = '(xxx) xxx-xxxx',
  className = '',
  id,
  'aria-label': ariaLabel,
}: PhoneInputProps) {
  const display = formatPhoneDisplay(value);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const k = e.key;
    if (k === 'Backspace' || k === 'Delete' || k === 'Tab' || k.startsWith('Arrow') || k === 'Home' || k === 'End') return;
    if (/^\d$/.test(k)) return;
    e.preventDefault();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = parsePhoneDisplay(e.target.value);
    onChange(digits);
  };

  return (
    <div className="relative flex items-center w-full">
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={display}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={14}
        className={`${className} ${value.length > 0 ? 'pr-10' : ''}`.trim()}
        id={id}
        aria-label={ariaLabel}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Clear"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
