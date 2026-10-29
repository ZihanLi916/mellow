export const NIGHT_BOUNDARY_POLICY = 'local-0600-v1' as const;

export function validatedTimezoneOffsetMinutes(value: unknown): number {
  if (value === undefined) return 0;
  if (!Number.isInteger(value) || Number(value) < -840 || Number(value) > 840)
    throw new Error('INVALID_TIMEZONE_OFFSET');
  return Number(value);
}

/** The server clock determines the occasion; the client offset is only a validated timezone hint. */
export function occasionKey(serverNow: Date, timezoneOffsetMinutes: number): string {
  const at = serverNow.getTime();
  if (!Number.isFinite(at)) throw new Error('INVALID_NIGHT_TIME');
  const offset = validatedTimezoneOffsetMinutes(timezoneOffsetMinutes);
  return new Date(at - offset * 60_000 - 6 * 3_600_000).toISOString().slice(0, 10);
}

export function sessionOccasionKey(
  session: { startedAt: string; occasionKey?: string; timezoneOffsetMinutes?: number },
  fallbackOffset = 0,
): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(session.occasionKey ?? '')) return session.occasionKey!;
  return occasionKey(new Date(session.startedAt), validatedTimezoneOffsetMinutes(session.timezoneOffsetMinutes ?? fallbackOffset));
}

export function sameOccasion(a: string, b: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(a) && a === b;
}

/**
 * The user's LOCAL calendar day (YYYY-MM-DD) for an instant, using an explicit timezone offset.
 *
 * This is the contract M5 requires for follow-up "next day" eligibility: a night's local day must be
 * computed from the night's own `timezoneOffsetMinutes`, never from `toISOString().slice(0, 10)`
 * (which is UTC and silently shifts the day for anyone east/west of Greenwich). `occasionKey` above
 * uses a 06:00 night boundary; this is the plain midnight-boundary calendar day the follow-up prompt
 * means by "the day after".
 */
export function localCalendarDay(iso: string, timezoneOffsetMinutes: number): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) throw new Error('INVALID_TIME');
  const offset = validatedTimezoneOffsetMinutes(timezoneOffsetMinutes);
  return new Date(ms - offset * 60_000).toISOString().slice(0, 10);
}
