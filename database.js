// database.js

let db;

const DB_NAME = 'checkbookDB_v3';
const DB_VERSION = 1;

/**
 * Initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database object.
 */
export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = e => {
            const dbInstance = e.target.result;
            if (!dbInstance.objectStoreNames.contains('accounts')) {
                dbInstance.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
            }
            if (!dbInstance.objectStoreNames.contains('transactions')) {
                const txStore = dbInstance.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                txStore.createIndex('accountId_date', ['accountId', 'date'], { unique: false });
            }
        };

        request.onsuccess = e => {
            db = e.target.result;
            resolve(db);
        };

        request.onerror = e => {
            console.error("Database error:", e.target.errorCode);
            reject(e.target.errorCode);
        };
    });
}

const promisifyRequest = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

export function dbGet(storeName, key) {
    const tx = db.transaction(storeName, 'readonly');
    return promisifyRequest(tx.objectStore(storeName).get(key));
}

export function dbGetAll(storeName) {
    const tx = db.transaction(storeName, 'readonly');
    return promisifyRequest(tx.objectStore(storeName).getAll());
}

export function dbGetByIndex(storeName, indexName, query) {
    const tx = db.transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index(indexName);
    return promisifyRequest(index.getAll(query));
}

export function dbAdd(storeName, value) {
    const tx = db.transaction(storeName, 'readwrite');
    return promisifyRequest(tx.objectStore(storeName).add(value));
}

export function dbPut(storeName, value) {
    const tx = db.transaction(storeName, 'readwrite');
    return promisifyRequest(tx.objectStore(storeName).put(value));
}

export function dbDelete(storeName, key) {
    const tx = db.transaction(storeName, 'readwrite');
    return promisifyRequest(tx.objectStore(storeName).delete(key));
}

export function dbClear(storeName) {
    const tx = db.transaction(storeName, 'readwrite');
    return promisifyRequest(tx.objectStore(storeName).clear());
}

export function dbCount(storeName) {
    const tx = db.transaction(storeName, 'readonly');
    return promisifyRequest(tx.objectStore(storeName).count());
}