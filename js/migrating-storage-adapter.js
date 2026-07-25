export class MigratingStorageAdapter {
  constructor({ primary, fallback, onError = console.error } = {}) {
    if (!primary || !fallback) {
      throw new Error('Primary and fallback adapters are required');
    }

    this.primary = primary;
    this.fallback = fallback;
    this.onError = onError;
    this.status = {
      primaryAvailable: true,
      fallbackAvailable: true,
      lastError: null
    };
  }

  reportError(layer, operation, error) {
    this.status[`${layer}Available`] = false;
    this.status.lastError = {
      layer,
      operation,
      message: error?.message || String(error),
      occurredAt: new Date().toISOString()
    };

    this.onError(
      `Storage ${layer} failed during ${operation}`,
      error
    );
  }

  markAvailable(layer) {
    this.status[`${layer}Available`] = true;
  }

  getStatus() {
    return structuredClone(this.status);
  }

  async getItem(key) {
    let primaryValue = null;
    let primaryReadSucceeded = false;

    try {
      primaryValue = await this.primary.getItem(key);
      primaryReadSucceeded = true;
      this.markAvailable('primary');

      if (primaryValue !== null) return primaryValue;
    } catch (error) {
      this.reportError('primary', 'read', error);
    }

    let fallbackValue;

    try {
      fallbackValue = await this.fallback.getItem(key);
      this.markAvailable('fallback');
    } catch (error) {
      this.reportError('fallback', 'read', error);

      if (!primaryReadSucceeded) {
        throw new AggregateError(
          [error],
          `No storage backend could read key: ${key}`
        );
      }

      throw error;
    }

    if (fallbackValue === null) return null;

    try {
      await this.primary.setItem(key, fallbackValue);
    } catch (error) {
      this.reportError('primary', 'migration', error);
    }

    return fallbackValue;
  }

  async setItem(key, value) {
    const [primaryResult, fallbackResult] = await Promise.allSettled([
      this.primary.setItem(key, value),
      this.fallback.setItem(key, value)
    ]);

    if (primaryResult.status === 'fulfilled') {
      this.markAvailable('primary');
    } else {
      this.reportError('primary', 'write', primaryResult.reason);
    }

    if (fallbackResult.status === 'fulfilled') {
      this.markAvailable('fallback');
    } else {
      this.reportError('fallback', 'write', fallbackResult.reason);
    }

    if (
      primaryResult.status === 'rejected' &&
      fallbackResult.status === 'rejected'
    ) {
      throw new AggregateError(
        [primaryResult.reason, fallbackResult.reason],
        `No storage backend could write key: ${key}`
      );
    }
  }
}
