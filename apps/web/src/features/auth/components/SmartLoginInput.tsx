import { identifyLoginInput } from '../utils/identify-login-input';

interface Props {
  value: string;
  onChange(value: string): void;
}

const badgeClasses = {
  email: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  nationalId: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  phone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  unknown: 'bg-gray-100 text-gray-500 dark:bg-gray-800',
} as const;

const badgeLabels = {
  email: '✉ إيميل',
  nationalId: '🪪 هوية',
  phone: '📱 جوال',
  unknown: '...',
} as const;

export function SmartLoginInput({ value, onChange }: Props) {
  const type = identifyLoginInput(value);
  const onlyDigits = /^\d+$/.test(value.trim());

  return (
    <div>
      <label className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">
        البريد أو الجوال أو رقم الهوية
      </label>
      <div className="relative">
        <input
          id="smart-login-input"
          type="text"
          inputMode="email"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border-2 border-gray-200 py-3 pl-24 pr-4 outline-none transition-colors focus:border-emerald-400 focus:ring-0 dark:border-gray-700 dark:bg-slate-800 dark:text-white"
          dir="auto"
          placeholder="user@example.com أو 05xxxxxxxx أو 10xxxxxxx"
          autoComplete="username"
          autoFocus
        />
        {value.trim().length > 3 ? (
          <span
            className={`absolute left-3 top-1/2 -translate-y-1/2 select-none rounded-full px-2 py-0.5 text-xs font-bold ${badgeClasses[type]}`}
          >
            {badgeLabels[type]}
          </span>
        ) : null}
      </div>
      {onlyDigits ? (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          {type === 'nationalId'
            ? '✓ رقم هوية وطنية معتمد (10 أرقام تبدأ بـ 1 أو 2)'
            : type === 'phone'
              ? '✓ رقم جوال'
              : 'الهوية الوطنية: 10 أرقام تبدأ بـ 1 أو 2 | الجوال: يبدأ بـ 05'}
        </p>
      ) : null}
    </div>
  );
}
