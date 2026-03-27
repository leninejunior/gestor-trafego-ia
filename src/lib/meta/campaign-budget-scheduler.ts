export const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terca-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sabado' }
] as const;

export const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Nao repetir' },
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' }
] as const;

export type RecurrenceType = (typeof RECURRENCE_OPTIONS)[number]['value'];

type TimeZoneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function getPartsInTimeZone(date: Date, timeZone: string): TimeZoneDateParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));

  const year = Number(map.get('year'));
  const month = Number(map.get('month'));
  const day = Number(map.get('day'));
  const hour = Number(map.get('hour'));
  const minute = Number(map.get('minute'));
  const second = Number(map.get('second'));

  return {
    year,
    month,
    day,
    hour,
    minute,
    second
  };
}

function getDateInTimeZone(date: Date, timeZone: string): Date {
  const parts = getPartsInTimeZone(date, timeZone);
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getPartsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );
  return asUtc - date.getTime();
}

function zonedLocalDateTimeToUtc(parts: TimeZoneDateParts, timeZone: string): Date {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );

  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const firstPass = new Date(utcGuess - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(firstPass, timeZone);

  if (secondOffset !== firstOffset) {
    return new Date(utcGuess - secondOffset);
  }

  return firstPass;
}

function addMonthsClamped(
  year: number,
  month: number,
  day: number,
  interval: number
): DateParts {
  const base = new Date(year, month - 1, 1);
  base.setMonth(base.getMonth() + interval);
  const lastDayOfMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();

  return {
    year: base.getFullYear(),
    month: base.getMonth() + 1,
    day: Math.min(day, lastDayOfMonth)
  };
}

export function normalizeRecurrenceType(value: unknown): RecurrenceType {
  return value === 'daily' || value === 'weekly' || value === 'monthly'
    ? value
    : 'none';
}

export function normalizeRecurrenceInterval(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
    return 1;
  }
  return parsed;
}

export function parseScheduleDate(value: unknown): DateParts | null {
  if (typeof value !== 'string') {
    return null;
  }

  const input = value.trim();
  if (!input) {
    return null;
  }

  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const candidate = new Date(year, month - 1, day);
    if (
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day
    ) {
      return { year, month, day };
    }
    return null;
  }

  const brMatch = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]);
    const year = Number(brMatch[3]);
    const candidate = new Date(year, month - 1, day);
    if (
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day
    ) {
      return { year, month, day };
    }
    return null;
  }

  return null;
}

export function formatDatePartsToIso(parts: DateParts): string {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function formatIsoDateToBr(isoDate: string): string {
  const parsed = parseScheduleDate(isoDate);
  if (!parsed) return isoDate;
  return `${String(parsed.day).padStart(2, '0')}/${String(parsed.month).padStart(2, '0')}/${String(parsed.year).padStart(4, '0')}`;
}

export function computeRunAtFromDate(input: {
  date: string;
  hour: number;
  minute: number;
  timeZone: string;
}): Date | null {
  const safeTimeZone = isValidTimeZone(input.timeZone) ? input.timeZone : null;
  if (!safeTimeZone) return null;

  const parsedDate = parseScheduleDate(input.date);
  if (!parsedDate) return null;

  const hour = Number(input.hour);
  const minute = Number(input.minute);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;

  return zonedLocalDateTimeToUtc(
    {
      year: parsedDate.year,
      month: parsedDate.month,
      day: parsedDate.day,
      hour,
      minute,
      second: 0
    },
    safeTimeZone
  );
}

function addRecurrenceToRunAt(input: {
  currentRunAt: Date;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number;
  timeZone: string;
}): Date {
  const safeInterval = normalizeRecurrenceInterval(input.recurrenceInterval);
  const parts = getPartsInTimeZone(input.currentRunAt, input.timeZone);
  let nextYear = parts.year;
  let nextMonth = parts.month;
  let nextDay = parts.day;

  if (input.recurrenceType === 'daily') {
    const base = new Date(parts.year, parts.month - 1, parts.day);
    base.setDate(base.getDate() + safeInterval);
    nextYear = base.getFullYear();
    nextMonth = base.getMonth() + 1;
    nextDay = base.getDate();
  } else if (input.recurrenceType === 'weekly') {
    const base = new Date(parts.year, parts.month - 1, parts.day);
    base.setDate(base.getDate() + (7 * safeInterval));
    nextYear = base.getFullYear();
    nextMonth = base.getMonth() + 1;
    nextDay = base.getDate();
  } else {
    const next = addMonthsClamped(parts.year, parts.month, parts.day, safeInterval);
    nextYear = next.year;
    nextMonth = next.month;
    nextDay = next.day;
  }

  return zonedLocalDateTimeToUtc(
    {
      year: nextYear,
      month: nextMonth,
      day: nextDay,
      hour: parts.hour,
      minute: parts.minute,
      second: 0
    },
    input.timeZone
  );
}

export function computeNextScheduledRun(input: {
  scheduledDate: string;
  hour: number;
  minute: number;
  timeZone: string;
  recurrenceType?: RecurrenceType;
  recurrenceInterval?: number;
  fromDate?: Date;
}): Date | null {
  const firstRunAt = computeRunAtFromDate({
    date: input.scheduledDate,
    hour: input.hour,
    minute: input.minute,
    timeZone: input.timeZone
  });

  if (!firstRunAt) {
    return null;
  }

  const recurrenceType = normalizeRecurrenceType(input.recurrenceType);
  const recurrenceInterval = normalizeRecurrenceInterval(input.recurrenceInterval);
  const fromDate = input.fromDate ?? new Date();

  if (firstRunAt.getTime() > fromDate.getTime()) {
    return firstRunAt;
  }

  if (recurrenceType === 'none') {
    return null;
  }

  let next = firstRunAt;
  for (let i = 0; i < 500; i += 1) {
    next = addRecurrenceToRunAt({
      currentRunAt: next,
      recurrenceType,
      recurrenceInterval,
      timeZone: input.timeZone
    });

    if (next.getTime() > fromDate.getTime()) {
      return next;
    }
  }

  return null;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat('pt-BR', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function computeNextWeeklyRun(input: {
  dayOfWeek: number;
  hour: number;
  minute: number;
  timeZone: string;
  fromDate?: Date;
}): Date {
  const { dayOfWeek, hour, minute } = input;
  const fromDate = input.fromDate ?? new Date();
  const safeTimeZone = isValidTimeZone(input.timeZone) ? input.timeZone : 'UTC';

  const zonedNow = getDateInTimeZone(fromDate, safeTimeZone);
  const target = new Date(zonedNow);

  const currentDay = target.getDay();
  const dayDiff = (dayOfWeek - currentDay + 7) % 7;
  target.setDate(target.getDate() + dayDiff);
  target.setHours(hour, minute, 0, 0);

  if (dayDiff === 0 && target.getTime() <= zonedNow.getTime()) {
    target.setDate(target.getDate() + 7);
  }

  const offsetMs = target.getTime() - zonedNow.getTime();
  return new Date(fromDate.getTime() + offsetMs);
}
