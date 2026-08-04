// ---------------------------------------------------------------------
// Cienka warstwa nad IndexedDB — dwa magazyny:
// "meta" (profil, plan, wpisy wagi, PR, własne achievementy — po jednym
// kluczu na całość) i "dni" (realizacja, jeden rekord na datę).
// ---------------------------------------------------------------------

const DB_NAME = "po-co-mi-to-bylo";
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB niedostępne w tej przeglądarce."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("dni")) db.createObjectStore("dni");
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getDB() {
  if (!dbPromise) dbPromise = openDB();
  return dbPromise;
}

export async function dbGet(store, key) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbSet(store, key, value) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbGetAll(store) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const objStore = tx.objectStore(store);
    const keysReq = objStore.getAllKeys();
    const valsReq = objStore.getAll();
    tx.oncomplete = () => {
      const wynik = {};
      keysReq.result.forEach((klucz, i) => {
        wynik[klucz] = valsReq.result[i];
      });
      resolve(wynik);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbClearAll() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["meta", "dni"], "readwrite");
    tx.objectStore("meta").clear();
    tx.objectStore("dni").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
