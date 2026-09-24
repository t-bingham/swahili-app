import { useState, useSyncExternalStore } from 'react';
import { getSaveError, subscribeSaveError } from '../database/persistence';
import { flushDatabase } from '../database/db';

export default function StorageStatus() {
  const error = useSyncExternalStore(subscribeSaveError, getSaveError);
  const [retrying, setRetrying] = useState(false);
  if (!error) return null;
  return <div role="alert" className="bg-red-950 text-red-100 p-4">
    <p>{error}</p>
    <button className="underline mt-2" disabled={retrying} onClick={async () => {
      setRetrying(true);
      try { await flushDatabase(); } catch { /* The error stays visible until a save succeeds. */ }
      finally { setRetrying(false); }
    }}>{retrying ? 'Saving…' : 'Retry saving'}</button>
  </div>;
}
