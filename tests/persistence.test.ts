import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBDatabase, IDBObjectStore } from 'fake-indexeddb';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import * as persistence from '../src/database/persistence';
import {
  openDatabase, closeDatabase, getCurrentUser, getCurrentLanguage, getDb,
  createProfile, getProfile, flushDatabase, resetCurrentUserData, openGoogleDatabase,
  LegacyProfileFoundError, setCardStarred, mergeRemoteDb, getDailyStats, getDailyActivity,
} from '../src/database/db';
import { googleUsername } from '../src/auth/profileIdentity';

vi.mock('sql.js', async importOriginal => {
  const real = await importOriginal<typeof import('sql.js')>();
  return { ...real, default: () => real.default({ locateFile: () => path.join(process.cwd(), 'public/sql-wasm.wasm') }) };
});

const settings = { new_words_per_day: 10, reviews_per_day: 20, new_word_rate: 20 };
let locked = false;

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, action: (lock: object | null) => Promise<unknown>) => {
    if (locked) return action(null);
    locked = true;
    try { return await action({}); } finally { locked = false; }
  } } });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(fs.readFileSync(path.join(process.cwd(), 'public', url.slice(1))))));
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await closeDatabase();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('local database lifecycle', () => {
  it('serializes duplicate opens and profile/language switches', async () => {
    await Promise.all([openDatabase('a', 'ko'), openDatabase('a', 'ko')]);
    expect(fetch).toHaveBeenCalledTimes(1);
    await createProfile('Alice', settings);
    await Promise.all([openDatabase('b', 'mi'), openDatabase('a', 'ko')]);
    expect(getCurrentUser()).toBe('a');
    expect(getCurrentLanguage()).toBe('ko');
    expect((await getProfile())?.display_name).toBe('Alice');
  });

  it('retains unsaved memory on quota failure and clears the warning after retry', async () => {
    await openDatabase('a', 'ko');
    await createProfile('Unsaved', settings);
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    await expect(closeDatabase()).rejects.toThrow('Full');
    expect(getCurrentUser()).toBe('a');
    expect(persistence.getSaveError()).toContain('Keep this tab open');
    put.mockRestore();
    await flushDatabase();
    expect(persistence.getSaveError()).toBeNull();
    await closeDatabase();
    await openDatabase('a', 'ko');
    expect((await getProfile())?.display_name).toBe('Unsaved');
  });

  it('closes connections on success and on abort', async () => {
    const close = vi.spyOn(IDBDatabase.prototype, 'close');
    await persistence.idbSave('test', new Uint8Array([1]));
    await persistence.idbLoad('test');
    expect(close).toHaveBeenCalledTimes(2);
    await expect(persistence.storageTransaction('readwrite', store => { store.transaction.abort(); })).rejects.toThrow();
    expect(close).toHaveBeenCalledTimes(3);
  });

  it('rejects a second tab until the first closes its database', async () => {
    await openDatabase('a', 'ko');
    await expect(persistence.acquireDatabaseLock()).rejects.toThrow('another tab');
    await closeDatabase();
    const release = await persistence.acquireDatabaseLock();
    release();
  });

  it('does not let a pending flush recreate a reset database', async () => {
    await openDatabase('a', 'ko');
    await createProfile('A', settings);
    const save = flushDatabase();
    const reset = resetCurrentUserData();
    await Promise.all([save, reset]);
    expect(await persistence.idbLoad('db_ko_a')).toBeNull();
    expect(getCurrentUser()).toBeNull();
  });

  it('releases the lock after a failed initial open and permits a retry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(openDatabase('a', 'ko')).rejects.toThrow('template');
    expect(getCurrentUser()).toBeNull();
    await openDatabase('a', 'ko');
    expect(getCurrentUser()).toBe('a');
  });

  it('keeps the old profile usable if its replacement cannot load', async () => {
    await openDatabase('a', 'ko');
    await createProfile('Alice', settings);
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(openDatabase('b', 'mi')).rejects.toThrow('template');
    expect(getCurrentUser()).toBe('a');
    expect(getCurrentLanguage()).toBe('ko');
    expect((await getProfile())?.display_name).toBe('Alice');
  });
});

describe('legacy ownership migration', () => {
  it('requires explicit ownership, preserves the source, and isolates a colliding account', async () => {
    await openDatabase('alex', 'ko');
    await createProfile('Legacy Alex', settings);
    await closeDatabase();
    await expect(openGoogleDatabase('alex@first.example', 'ko')).rejects.toBeInstanceOf(LegacyProfileFoundError);
    await openGoogleDatabase('alex@first.example', 'ko', 'import');
    expect((await getProfile())?.display_name).toBe('Legacy Alex');
    expect(await persistence.idbLoad('db_ko_alex')).not.toBeNull();
    await closeDatabase();
    await openGoogleDatabase('alex@second.example', 'ko');
    expect(getCurrentUser()).toBe(googleUsername({ email: 'alex@second.example' }));
    expect(await getProfile()).toBeNull();
  });

  it('requires a separate ownership decision for each language', async () => {
    await openDatabase('alex', 'ko');
    await createProfile('Korean Alex', settings);
    await openDatabase('alex', 'mi');
    await createProfile('Maori Alex', settings);
    await closeDatabase();
    await openGoogleDatabase('alex@first.example', 'ko', 'import');
    await closeDatabase();
    await expect(openGoogleDatabase('alex@first.example', 'mi')).rejects.toBeInstanceOf(LegacyProfileFoundError);
    await openGoogleDatabase('alex@second.example', 'mi', 'import');
    expect((await getProfile())?.display_name).toBe('Maori Alex');
  });

  it('starting fresh never claims or overwrites legacy progress', async () => {
    await openDatabase('alex', 'ko');
    await createProfile('Legacy', settings);
    await closeDatabase();
    const before = await persistence.idbLoad('db_ko_alex');
    await openGoogleDatabase('alex@first.example', 'ko', 'fresh');
    expect(await getProfile()).toBeNull();
    expect(await persistence.idbLoad('legacy-owner:ko:alex')).toBeNull();
    expect(Buffer.from((await persistence.idbLoad('db_ko_alex'))!).equals(Buffer.from(before!))).toBe(true);
  });
});

describe('real SQLite merge and local statistics', () => {
  it('preserves concurrent equal-count review events and converges on the latest schedule', async () => {
    await openDatabase('a', 'ko');
    const local = getDb();
    const id = local.exec('SELECT card_id FROM card_states LIMIT 1')[0].values[0][0] as string;
    const SQL = await initSqlJs();
    const remote = new SQL.Database(local.export());
    for (const [db, event, time, stability] of [[local, 'local', '2026-09-22T01:00:00.000Z', 5], [remote, 'remote', '2026-09-22T02:00:00.000Z', 10]] as const) {
      db.run('UPDATE card_states SET last_review=?, review_count=1, stability=?, depth_level=2 WHERE card_id=?', [time, stability, id]);
      db.run('INSERT INTO review_logs (id,card_id,session_id,reviewed_at,rating,response_ms,exercise_type) VALUES (?,?,?,?,?,?,?)', [event, id, 's', time, 3, 1000, 'flashcard']);
    }
    const bytes = remote.export();
    expect((await mergeRemoteDb(bytes)).merged).toBe(true);
    expect((await mergeRemoteDb(bytes)).merged).toBe(true);
    expect(local.exec('SELECT review_count,stability FROM card_states WHERE card_id=?', [id])[0].values).toEqual([[2, 10]]);
    expect(local.exec('SELECT COUNT(*) FROM review_logs')[0].values).toEqual([[2]]);
    remote.close();
  });

  it('keeps an unstar when merging an old device, then accepts a newer star', async () => {
    await openDatabase('a', 'ko');
    const id = getDb().exec('SELECT card_id FROM card_states LIMIT 1')[0].values[0][0] as string;
    await setCardStarred(id, true);
    const oldBytes = getDb().export();
    await setCardStarred(id, false);
    expect((await mergeRemoteDb(oldBytes)).merged).toBe(true);
    expect(getDb().exec('SELECT starred FROM card_states WHERE card_id=?', [id])[0].values).toEqual([[0]]);
    const SQL = await initSqlJs();
    const remote = new SQL.Database(oldBytes);
    remote.run("UPDATE card_states SET starred=1, starred_updated_at='2099-01-01T00:00:00.000Z', starred_change_id='new' WHERE card_id=?", [id]);
    expect((await mergeRemoteDb(remote.export())).merged).toBe(true);
    expect(getDb().exec('SELECT starred FROM card_states WHERE card_id=?', [id])[0].values).toEqual([[1]]);
    remote.close();
  });

  it('counts reviews and sessions using local midnight, with an exclusive end', async () => {
    await openDatabase('a', 'ko');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 23, 1, 30));
    const db = getDb();
    // Query behavior is independent of curriculum foreign keys; use the real schema.
    const card = db.exec('SELECT card_id FROM card_states LIMIT 1')[0].values[0][0];
    for (const [id, time] of [['before', new Date(new Date(2026, 8, 23).getTime() - 1).toISOString()], ['today', new Date(2026, 8, 23).toISOString()], ['tomorrow', new Date(2026, 8, 24).toISOString()]]) {
      db.run('INSERT INTO review_logs (id,card_id,session_id,reviewed_at,rating,response_ms,exercise_type) VALUES (?,?,?,?,?,?,?)', [id, card, 's', time, 3, 1000, 'flashcard']);
    }
    expect((await getDailyStats()).reviewsToday).toBe(1);
    expect(await getDailyActivity(1)).toEqual([{ date: '2026-09-23', count: 1 }]);
  });
});
