import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { TaskFlowClockStamp } from '@/types/taskflow';

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

export function resolveHostTimeZone(): string {
  if (typeof Intl === 'undefined') {
    return 'UTC';
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function getReferenceDate(referenceNow?: string | null): Date {
  if (!referenceNow) {
    return new Date();
  }

  const parsed = new Date(referenceNow);
  return isValidDate(parsed) ? parsed : new Date();
}

export function createClockStamp(referenceDate?: Date): TaskFlowClockStamp {
  const reference = referenceDate && isValidDate(referenceDate) ? referenceDate : new Date();
  const todayStart = startOfDay(reference);
  const todayEnd = endOfDay(reference);
  const weekStart = startOfWeek(reference, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(reference, { weekStartsOn: 0 });
  const monthStart = startOfMonth(reference);
  const monthEnd = endOfMonth(reference);

  return {
    now: reference.toISOString(),
    timezone: resolveHostTimeZone(),
    todayStartAt: todayStart.toISOString(),
    todayEndAt: todayEnd.toISOString(),
    todayStartTs: todayStart.getTime(),
    todayEndTs: todayEnd.getTime(),
    weekStartAt: weekStart.toISOString(),
    weekEndAt: weekEnd.toISOString(),
    weekStartTs: weekStart.getTime(),
    weekEndTs: weekEnd.getTime(),
    monthStartAt: monthStart.toISOString(),
    monthEndAt: monthEnd.toISOString(),
    monthStartTs: monthStart.getTime(),
    monthEndTs: monthEnd.getTime(),
  };
}
