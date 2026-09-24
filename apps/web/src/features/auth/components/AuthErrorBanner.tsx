interface Props {
  message: string;
}

export function AuthErrorBanner({ message }: Props) {
  if (!message) return null;

  return (
    <div
      id="login-error-banner"
      className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
    >
      <span className="mt-0.5 shrink-0 text-red-400">⚠️</span>
      <span className="leading-snug">{message}</span>
    </div>
  );
}
