import { describe, expect, it } from 'vitest';
import { filterTasksByDate, formatTaskDate } from '@/lib/date-filter';
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
});
