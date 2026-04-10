import { endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { filterTasksByDate, formatTaskDate, getDateRangeFromType } from '@/lib/date-filter';
import { getReferenceDate } from '@/lib/taskflow-clock';
import { TASK_FIXTURES } from '@/lib/taskflow-fixtures';

describe('date filtering helpers', () => {
  it('filters tasks by due-date custom ranges', () => {
    const tasks = filterTasksByDate(TASK_FIXTURES, {
      field: 'dueDate',
      type: 'custom',
      startDate: new Date('2026-03-21T00:00:00.000Z'),
      endDate: new Date('2026-03-22T23:59:59.999Z'),
    });

    expect(tasks.map((task) => task.id)).toEqual(['task-1', 'task-2']);
  });

  it('filters tasks by created-at custom ranges and formats null dates', () => {
    const tasks = filterTasksByDate(TASK_FIXTURES, {
      field: 'createdAt',
      type: 'custom',
      startDate: new Date('2026-03-08T00:00:00.000Z'),
      endDate: new Date('2026-03-10T23:59:59.999Z'),
    });

    expect(tasks.map((task) => task.id)).toEqual(['task-3', 'task-4']);
    expect(formatTaskDate(null, 'No date')).toBe('No date');
  });

  it('uses the injected reference timestamp for preset ranges', () => {
    const referenceNow = '2026-03-22T12:34:56.000Z';
    const referenceDate = getReferenceDate(referenceNow);

    const todayRange = getDateRangeFromType('today', referenceNow);
    const weekRange = getDateRangeFromType('week', referenceNow);
    const monthRange = getDateRangeFromType('month', referenceNow);

    expect(todayRange).toEqual({
      startDate: startOfDay(referenceDate),
      endDate: endOfDay(referenceDate),
    });
    expect(weekRange).toEqual({
      startDate: startOfWeek(referenceDate, { weekStartsOn: 0 }),
      endDate: endOfWeek(referenceDate, { weekStartsOn: 0 }),
    });
    expect(monthRange).toEqual({
      startDate: startOfMonth(referenceDate),
      endDate: endOfMonth(referenceDate),
    });
  });

  it('filters preset date ranges against the injected reference timestamp', () => {
    const dueToday = filterTasksByDate(
      TASK_FIXTURES,
      {
        field: 'dueDate',
        type: 'today',
      },
      '2026-03-21T12:00:00.000Z',
    );

    const dueThisWeek = filterTasksByDate(
      TASK_FIXTURES,
      {
        field: 'dueDate',
        type: 'week',
      },
      '2026-03-22T12:00:00.000Z',
    );

    expect(dueToday.map((task) => task.id)).toEqual(['task-1']);
    expect(dueThisWeek.map((task) => task.id)).toEqual(['task-2', 'task-3']);
  });
});
