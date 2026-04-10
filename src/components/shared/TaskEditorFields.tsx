'use client';

import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  Task,
  TaskDraft,
  TaskPriority,
  TaskStatus,
} from '@/types/taskflow';

export interface TaskEditorValues {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string;
  tags: string;
}

export const EMPTY_TASK_EDITOR_VALUES: TaskEditorValues = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  assignee: '',
  dueDate: '',
  tags: '',
};

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export function createTaskEditorValues(task?: Task | null): TaskEditorValues {
  if (!task) {
    return { ...EMPTY_TASK_EDITOR_VALUES };
  }

  return {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    assignee: task.assignee ?? '',
    dueDate: task.dueDate ? format(parseISO(task.dueDate), 'yyyy-MM-dd') : '',
    tags: task.tags.join(', '),
  };
}

export function toTaskDraft(values: TaskEditorValues): TaskDraft {
  return {
    title: values.title,
    description: values.description,
    status: values.status,
    priority: values.priority,
    assignee: values.assignee,
    dueDate: values.dueDate,
    tags: [...new Set(values.tags.split(',').map((tag) => tag.trim()).filter(Boolean))],
  };
}

interface TaskEditorFieldsProps {
  idPrefix: string;
  value: TaskEditorValues;
  onChange: (nextValue: TaskEditorValues) => void;
}

export function TaskEditorFields({
  idPrefix,
  value,
  onChange,
}: TaskEditorFieldsProps) {
  const updateField = <Key extends keyof TaskEditorValues>(
    field: Key,
    nextValue: TaskEditorValues[Key],
  ) => {
    onChange({
      ...value,
      [field]: nextValue,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          value={value.title}
          onChange={(event) => updateField('title', event.target.value)}
          placeholder="Ship the runtime-backed UI"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          rows={4}
          value={value.description}
          onChange={(event) => updateField('description', event.target.value)}
          placeholder="Describe the work, expected outcome, or open questions."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-status`}>Status</Label>
          <Select
            value={value.status}
            onValueChange={(nextValue) => updateField('status', nextValue as TaskStatus)}
          >
            <SelectTrigger id={`${idPrefix}-status`} className="w-full">
              <SelectValue placeholder="Select a status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-priority`}>Priority</Label>
          <Select
            value={value.priority}
            onValueChange={(nextValue) => updateField('priority', nextValue as TaskPriority)}
          >
            <SelectTrigger id={`${idPrefix}-priority`} className="w-full">
              <SelectValue placeholder="Select a priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-assignee`}>Assignee</Label>
          <Input
            id={`${idPrefix}-assignee`}
            value={value.assignee}
            onChange={(event) => updateField('assignee', event.target.value)}
            placeholder="Core Team"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-due-date`}>Due Date</Label>
          <Input
            id={`${idPrefix}-due-date`}
            type="date"
            value={value.dueDate}
            onChange={(event) => updateField('dueDate', event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-tags`}>Tags</Label>
        <Input
          id={`${idPrefix}-tags`}
          value={value.tags}
          onChange={(event) => updateField('tags', event.target.value)}
          placeholder="sdk, ui, lineage"
        />
        <p className="text-xs text-muted-foreground">
          Separate tags with commas.
        </p>
      </div>
    </div>
  );
}
