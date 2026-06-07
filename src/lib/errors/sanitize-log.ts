const SENSITIVE_KEY_VALUE_PATTERN =
  /\b((?:[a-z0-9]+_)*(?:birth_date|birth_place|birth_time|email|gender|name|nickname)(?:_[a-z0-9]+)*)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,}]+)/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const ISO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/g;
const TIME_PATTERN = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;

export function redactSensitiveLogText(value: string): string {
  return value
    .replace(SENSITIVE_KEY_VALUE_PATTERN, '$1=[redacted]')
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(ISO_DATE_PATTERN, '[redacted-date]')
    .replace(TIME_PATTERN, '[redacted-time]');
}

export function sanitizeErrorForLog(err: unknown): string {
  const raw =
    err instanceof Error
      ? `${err.name}: ${err.message}`
      : typeof err === 'string'
        ? err
        : 'non-error thrown';
  return redactSensitiveLogText(raw).slice(0, 500);
}

export type ReportableError = Error & { digest?: string };

export function sanitizeErrorForReporting(err: ReportableError): ReportableError {
  const safe = new Error(redactSensitiveLogText(err.message).slice(0, 500));
  safe.name = err.name;
  if (err.digest) {
    (safe as ReportableError).digest = redactSensitiveLogText(err.digest).slice(0, 200);
  }
  return safe as ReportableError;
}
