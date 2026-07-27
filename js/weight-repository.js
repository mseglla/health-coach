const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export class WeightRepository {
  constructor({
    storageService,
    idFactory = () => globalThis.crypto.randomUUID(),
    now = () => new Date().toISOString()
  } = {}) {
    if (!storageService) {
      throw new Error('WeightRepository requires a storage service');
    }

    this.storageService = storageService;
    this.idFactory = idFactory;
    this.now = now;
  }

  createUniqueId(existingIds) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const id = this.idFactory();

      if (!isUuid(id)) {
        throw new Error('WeightRepository idFactory must return a UUID');
      }

      if (!existingIds.has(id)) return id;
    }

    throw new Error('Could not create a unique weight UUID');
  }

  async initialize(state) {
    const existingIds = new Set(
      state.weights
        .map(record => record.id)
        .filter(isUuid)
    );

    let changed = false;

    state.weights = state.weights.map(record => {
      let id = record.id;

      if (!isUuid(id)) {
        id = this.createUniqueId(existingIds);
        existingIds.add(id);
      }

      const createdAt =
        record.createdAt || this.now();

      const normalized = {
        ...record,
        id,
        value: Number(record.value),
        source: record.source || 'manual',
        createdAt,
        updatedAt: record.updatedAt || createdAt,
        deletedAt: record.deletedAt || null
      };

      if (
        id !== record.id ||
        normalized.value !== record.value ||
        normalized.source !== record.source ||
        normalized.createdAt !== record.createdAt ||
        normalized.updatedAt !== record.updatedAt ||
        normalized.deletedAt !== record.deletedAt
      ) {
        changed = true;
      }

      return normalized;
    });

    state.weights.sort(
      (a, b) => a.measuredAt.localeCompare(b.measuredAt)
    );

    if (changed) {
      await this.storageService.persistState(state);
    }

    return state;
  }

  list(state, { includeDeleted = false } = {}) {
    return state.weights.filter(
      record => includeDeleted || !record.deletedAt
    );
  }

  findById(state, id, { includeDeleted = false } = {}) {
    return this.list(state, { includeDeleted })
      .find(record => record.id === id) || null;
  }

  async save(state, { id = null, value, measuredAt }) {
    const numericValue = Number(value);

    if (
      !Number.isFinite(numericValue) ||
      numericValue <= 0
    ) {
      throw new Error('Weight value must be positive');
    }

    if (!measuredAt) {
      throw new Error('Weight measuredAt is required');
    }

    const timestamp = this.now();
    let record;

    if (id) {
      record = this.findById(state, id);

      if (!record) {
        throw new Error('Weight record not found');
      }

      record.value = numericValue;
      record.measuredAt = measuredAt;
      record.updatedAt = timestamp;
    } else {
      const existingIds = new Set(
        state.weights.map(item => item.id)
      );

      record = {
        id: this.createUniqueId(existingIds),
        value: numericValue,
        measuredAt,
        source: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null
      };

      state.weights.push(record);
    }

    state.weights.sort(
      (a, b) => a.measuredAt.localeCompare(b.measuredAt)
    );

    await this.storageService.persistState(state);
    return record;
  }

  async softDelete(state, id) {
    const record = this.findById(state, id);

    if (!record) {
      throw new Error('Weight record not found');
    }

    const timestamp = this.now();
    record.deletedAt = timestamp;
    record.updatedAt = timestamp;

    await this.storageService.persistState(state);
    return record;
  }
}
