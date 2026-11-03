const CLEANUP_DONE_KEY = 'zhenji_legacy_firebase_cleaned_v1';

const KNOWN_FIREBASE_IDB_NAMES = [
  'firebaseLocalStorageDb',
  'firebase-heartbeat-database',
  'firebase-installations-database',
];

const LEGACY_LOCAL_STORAGE_KEYS = [
  'zhenji_demo_state_v3',
  'zhenji_use_demo',
];

export async function runOneTimeLegacyStorageCleanup(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (window.localStorage.getItem(CLEANUP_DONE_KEY) === '1') {
      return;
    }
  } catch {
    return;
  }

  // 1. Delete legacy localStorage keys
  for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  // 2. Delete legacy Firebase IndexedDB databases
  const idb = window.indexedDB;
  if (idb && typeof idb.deleteDatabase === 'function') {
    const dbNamesToDelete = new Set<string>(KNOWN_FIREBASE_IDB_NAMES);

    if (typeof idb.databases === 'function') {
      try {
        const dbs = await idb.databases();
        for (const dbInfo of dbs) {
          const name = dbInfo?.name;
          if (name && (name.startsWith('firestore/') || KNOWN_FIREBASE_IDB_NAMES.includes(name))) {
            dbNamesToDelete.add(name);
          }
        }
      } catch {
        // Fallback to KNOWN_FIREBASE_IDB_NAMES when indexedDB.databases() fails
      }
    }

    for (const dbName of dbNamesToDelete) {
      try {
        idb.deleteDatabase(dbName);
      } catch {
        // ignore individual delete errors
      }
    }
  }

  try {
    window.localStorage.setItem(CLEANUP_DONE_KEY, '1');
  } catch {
    // ignore
  }
}
