import { describe, expect, it } from 'vitest';
import { redactSensitiveLogText, sanitizeErrorForLog } from '@/lib/errors/sanitize-log';

describe('sanitize-log', () => {
  it('redacts explicit PII key/value pairs plus raw dates, times, and emails', () => {
    const text =
      'birth_date=1995-06-15 birth_time: 10:30:00 gender=F email=a@example.com nickname="봄달"';

    const result = redactSensitiveLogText(text);

    expect(result).not.toContain('1995-06-15');
    expect(result).not.toContain('10:30:00');
    expect(result).not.toContain('a@example.com');
    expect(result).not.toContain('봄달');
    expect(result).toContain('birth_date=[redacted]');
    expect(result).toContain('birth_time=[redacted]');
    expect(result).toContain('gender=[redacted]');
  });

  it('redacts prefixed domain PII keys such as relation_nickname and user_email', () => {
    const text =
      'relation_nickname="민지" user_email=minji@example.com relation_birth_date=1995-06-15 relation_birth_time=10:30';

    const result = redactSensitiveLogText(text);

    expect(result).not.toContain('민지');
    expect(result).not.toContain('minji@example.com');
    expect(result).not.toContain('1995-06-15');
    expect(result).not.toContain('10:30');
    expect(result).toContain('relation_nickname=[redacted]');
    expect(result).toContain('user_email=[redacted]');
    expect(result).toContain('relation_birth_date=[redacted]');
    expect(result).toContain('relation_birth_time=[redacted]');
  });

  it('formats Error objects without preserving raw stack contents', () => {
    const err = new Error('KASI failed for birth_date=1995-06-15 gender=F');

    const result = sanitizeErrorForLog(err);

    expect(result).toContain('Error:');
    expect(result).not.toContain('1995-06-15');
    expect(result).not.toContain('gender=F');
    expect(result).toContain('gender=[redacted]');
  });
});
