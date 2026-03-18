/**
 * Lightweight event bus for data change notifications.
 * Call emitDataChanged() after any card add / edit / delete / sell.
 * Subscribe with onDataChanged() — returns an unsubscribe function.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function onDataChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitDataChanged(): void {
  listeners.forEach((fn) => fn());
}
