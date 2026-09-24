const STORE = 'databases';

// Resolve writes only on commit, including aborted transactions, and always close
// the connection. Leaving connections open prevents later upgrades/deletions.
async function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('swahili_app', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storageTransaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let value: T;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(tx.error ?? new Error('Saving was interrupted. Please retry.'));
      tx.onerror = () => reject(tx.error ?? new Error('Could not save progress.'));
      try { action(tx.objectStore(STORE), result => { value = result; }); }
      catch (error) { tx.abort(); reject(error); }
    });
  } finally { db.close(); }
}

export function idbLoad<T = Uint8Array>(key: string): Promise<T | null> {
  return storageTransaction('readonly', (store, result) => {
    const request = store.get(key);
    request.onsuccess = () => result(request.result ?? null);
  });
}
export function idbSave(key: string, data: Uint8Array | string): Promise<void> {
  return storageTransaction('readwrite', store => { store.put(data, key); });
}
export function idbDelete(key: string): Promise<void> {
  return storageTransaction('readwrite', store => { store.delete(key); });
}

export async function acquireDatabaseLock(): Promise<() => void> {
  if (!navigator.locks) throw new Error('This browser cannot safely lock local progress. Please use a current browser over HTTPS.');
  return new Promise((resolve, reject) => {
    void navigator.locks.request('swahili-app-database', { ifAvailable: true }, async lock => {
      if (!lock) { reject(new Error('The app is already open in another tab. Close that tab and try again.')); return; }
      await new Promise<void>(release => resolve(release));
    }).catch(reject);
  });
}

let saveError: string | null = null;
const listeners = new Set<() => void>();
export function getSaveError(): string | null { return saveError; }
export function subscribeSaveError(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function reportSaveError(error: unknown): void {
  saveError = error ? 'Progress could not be saved on this device. Keep this tab open, free some storage, then retry.' : null;
  listeners.forEach(listener => listener());
}
