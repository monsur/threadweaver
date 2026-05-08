const DB_NAME = 'threadweaver';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDB().then(
    db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE_NAME, mode);
      const req = fn(t.objectStore(STORE_NAME));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    })
  );
}

export const getAll = () => tx('readonly', s => s.getAll());
export const get = id => tx('readonly', s => s.get(id));
export const put = draft => tx('readwrite', s => s.put(draft));
export const remove = id => tx('readwrite', s => s.delete(id));

export async function getUpdatedAfter(ts) {
  const all = await getAll();
  return all.filter(d => d.updated_at > ts);
}

export function _resetDb() {
  dbPromise = null;
}
