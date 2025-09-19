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

/**
 * A helper function to turn IndexedDB requests into Promises.
 * @param {IDBRequest} request The IndexedDB request to promisify.
 * @returns {Promise<any>}
 */
const promisifyRequest = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

/**
 * Gets a single record from a store by its key.
 * @param {string} storeName The name of the object store.
 * @param {IDBValidKey} key The key of the record to retrieve.
 * @returns {Promise<any>}
 */
export function dbGet(storeName, key) {
    const tx = db.transaction(storeName, 'readonly');
    return promisifyRequest(tx.objectStore(storeName).get(key));
}

/**
 * Gets all records from a store.
 * @param {string} storeName The name of the object store.
 * @returns {Promise<Array<any>>}
 */
export function dbGetAll(storeName) {
    const tx = db.transaction(storeName, 'readonly');
    return promisifyRequest(tx.objectStore(storeName).getAll());
}

/**
 * Gets all records from a store that match a query on an index.
 * @param {string} storeName The name of the object store.
 * @param {string} indexName The name of the index to query.
 * @param {IDBKeyRange} query The key range to use for the query.
 * @returns {Promise<Array<any>>}
 */
export function dbGetByIndex(storeName, indexName, query) {
    const tx = db.transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index(indexName);
    return promisifyRequest(index.getAll(query));
}

/**
 * Adds a new record to a store.
 * @param {string} storeName The name of the object store.
 * @param {any} value The record to add.
 * @returns {Promise<IDBValidKey>} The key of the newly added record.
 */
export function dbAdd(storeName, value) {
    const tx = db.transaction(storeName, 'readwrite');
    return promisifyRequest(tx.objectStore(storeName).add(value));
}

/**
 * Updates an existing record in a store.
 * @param {string} storeName The name of the object store.
 * @param {any} value The record to update.
 * @returns {Promise<IDBValidKey>} The key of the updated record.
 */
export function dbPut(storeName, value) {
    const tx = db.transaction(storeName, 'readwrite');
    return promisifyRequest(tx.objectStore(storeName).put(value));
}

/**
 * Deletes a record from a store by its key.
 * @param {string} storeName The name of the object store.
 * @param {IDBValidKey} key The key of the record to delete.
 * @returns {Promise<void>}
 */
export function dbDelete(storeName, key) {
    const tx = db.transaction(storeName, 'readwrite');
    return promisifyRequest(tx.objectStore(storeName).delete(key));
}

/**
 * Clears all records from a store.
 * @param {string} storeName The name of the object store.
 * @returns {Promise<void>}
 */
export function dbClear(storeName) {
    const tx = db.transaction(storeName, 'readwrite');
    return promisifyRequest(tx.objectStore(storeName).clear());
}

/**
 * Counts all records in a store.
 * @param {string} storeName The name of the object store.
 * @returns {Promise<number>}
 */
export function dbCount(storeName) {
    const tx = db.transaction(storeName, 'readonly');
    return promisifyRequest(tx.objectStore(storeName).count());
}