import { Eye, EyeOff } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  label?: ReactNode;
  value: string;
  onChange(value: string): void;
  shown: boolean;
  onToggle(): void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  inputClassName?: string;
  id?: string;
}

export function PasswordField({
  label,
  value,
  onChange,
  shown,
  onToggle,
  placeholder = '••••••••',
  autoComplete,
  required = true,
  inputClassName = '',
  id,
}: Props) {
  return (
    <div>
      {label ? (
        <label className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full rounded-xl border-2 border-gray-200 py-3 pl-11 pr-4 text-left outline-none transition-colors focus:border-emerald-400 focus:ring-0 dark:border-gray-700 dark:bg-slate-800 dark:text-white ${inputClassName}`}
          dir="ltr"
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 focus:outline-none dark:hover:text-gray-200"
          aria-label={shown ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        >
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
