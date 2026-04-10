import type { InMemoryLineageStore } from '@manifesto-ai/lineage';
import type {
  PersistedLineageState,
  TaskFlowAssistantUIMessage,
} from '@/types/taskflow-assistant';

const LEGACY_LINEAGE_STORAGE_KEY = 'taskflow:lineage-state:v1';
const LINEAGE_STORAGE_KEY = 'taskflow:lineage-state:v2';
const ASSISTANT_STORAGE_KEY = 'taskflow:assistant-chat:v1';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type StorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

function serializeCollections(value: unknown): JsonValue {
  if (value instanceof Map) {
    return {
      __type: 'Map',
      entries: [...value.entries()].map(([key, nestedValue]) => [
        key,
        serializeCollections(nestedValue),
      ]),
    };
  }

  if (value instanceof Set) {
    return {
      __type: 'Set',
      values: [...value.values()].map((nestedValue) => serializeCollections(nestedValue)),
    };
  }

  if (Array.isArray(value)) {
    return value.map((nestedValue) => serializeCollections(nestedValue));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        serializeCollections(nestedValue),
      ]),
    );
  }

  return value as JsonValue;
}

function deserializeCollections(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((nestedValue) => deserializeCollections(nestedValue));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (record.__type === 'Map' && Array.isArray(record.entries)) {
      return new Map(
        record.entries.map((entry) => {
          const [key, nestedValue] = entry as [string, unknown];
          return [key, deserializeCollections(nestedValue)];
        }),
      );
    }

    if (record.__type === 'Set' && Array.isArray(record.values)) {
      return new Set(record.values.map((nestedValue) => deserializeCollections(nestedValue)));
    }

    return Object.fromEntries(
      Object.entries(record).map(([key, nestedValue]) => [
        key,
        deserializeCollections(nestedValue),
      ]),
    );
  }

  return value;
}

export function serializeLineageStoreState(
  state: ReturnType<InMemoryLineageStore['snapshotState']>,
): string {
  return JSON.stringify(serializeCollections(state));
}

export function deserializeLineageStoreState(
  serialized: string,
): ReturnType<InMemoryLineageStore['snapshotState']> {
  return deserializeCollections(JSON.parse(serialized)) as ReturnType<
    InMemoryLineageStore['snapshotState']
  >;
}

export function loadPersistedLineageState(
  storage: StorageLike | null,
): PersistedLineageState | null {
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(LINEAGE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedLineageState;
    return parsed.schemaVersion === 2 && typeof parsed.schemaHash === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function savePersistedLineageState(
  storage: StorageLike | null,
  value: PersistedLineageState,
): void {
  if (!storage) {
    return;
  }

  storage.setItem(LINEAGE_STORAGE_KEY, JSON.stringify(value));
}

export function clearPersistedLineageState(storage: StorageLike | null): void {
  storage?.removeItem(LINEAGE_STORAGE_KEY);
  storage?.removeItem(LEGACY_LINEAGE_STORAGE_KEY);
}

export function loadPersistedAssistantMessages(
  storage: StorageLike | null,
): TaskFlowAssistantUIMessage[] {
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(ASSISTANT_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as TaskFlowAssistantUIMessage[];
  } catch {
    return [];
  }
}

export function savePersistedAssistantMessages(
  storage: StorageLike | null,
  messages: TaskFlowAssistantUIMessage[],
): void {
  if (!storage) {
    return;
  }

  storage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(messages));
}

export function clearPersistedAssistantMessages(storage: StorageLike | null): void {
  storage?.removeItem(ASSISTANT_STORAGE_KEY);
}

export type { StorageLike };
