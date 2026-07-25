const DEFAULT_DATABASE_NAME = 'atles-local';
const DEFAULT_DATABASE_VERSION = 1;
const DEFAULT_STORE_NAME = 'key-value';

export class IndexedDBAdapter {
  constructor({
    indexedDBFactory = globalThis.indexedDB,
    databaseName = DEFAULT_DATABASE_NAME,
    databaseVersion = DEFAULT_DATABASE_VERSION,
    storeName = DEFAULT_STORE_NAME
  } = {}) {
    if (!indexedDBFactory) {
      throw new Error('IndexedDB is not available in this browser');
    }

    this.indexedDBFactory = indexedDBFactory;
    this.databaseName = databaseName;
    this.databaseVersion = databaseVersion;
    this.storeName = storeName;
    this.databasePromise = null;
  }

  openDatabase() {
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.indexedDBFactory.open(
        this.databaseName,
        this.databaseVersion
      );

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(this.storeName)) {
          database.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = () => resolve(request.result);

      request.onerror = () => {
        this.databasePromise = null;
        reject(request.error || new Error('Could not open IndexedDB'));
      };

      request.onblocked = () => {
        this.databasePromise = null;
        reject(new Error('IndexedDB upgrade is blocked by another tab'));
      };
    });

    return this.databasePromise;
  }

  async getItem(key) {
    const database = await this.openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(this.storeName, 'readonly');
      const request = transaction.objectStore(this.storeName).get(key);

      request.onsuccess = () => {
        resolve(request.result === undefined ? null : request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error(`Could not read key: ${key}`));
      };

      transaction.onabort = () => {
        reject(transaction.error || new Error(`Read aborted for key: ${key}`));
      };
    });
  }

  async setItem(key, value) {
    const database = await this.openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(this.storeName, 'readwrite');

      transaction.oncomplete = () => resolve();

      transaction.onerror = () => {
        reject(transaction.error || new Error(`Could not write key: ${key}`));
      };

      transaction.onabort = () => {
        reject(transaction.error || new Error(`Write aborted for key: ${key}`));
      };

      transaction.objectStore(this.storeName).put(value, key);
    });
  }

  async close() {
    if (!this.databasePromise) return;

    try {
      const database = await this.databasePromise;
      database.close();
    } finally {
      this.databasePromise = null;
    }
  }
}
