// Minimal promise-based key/value store on IndexedDB, for data too big for
// localStorage (a personal ADE calendar can weigh several MB). Every call
// rejects when IndexedDB is unavailable (old private modes, tests): callers
// fall back to localStorage.
const DB_NAME = "icsexplorer";
const STORE = "kv";

let dbPromise = null;

const openDb = () => {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB indisponible"));
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB bloquée"));
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
};

const run = (mode, op) =>
  openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = op(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error("Transaction annulée"));
      })
  );

export const kvGet = (key) => run("readonly", (store) => store.get(key));
export const kvSet = (key, value) => run("readwrite", (store) => store.put(value, key));
export const kvDelete = (key) => run("readwrite", (store) => store.delete(key));
