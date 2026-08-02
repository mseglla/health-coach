export class SupabaseWeightRepository {
  constructor({ clientFactory } = {}) {
    if (!clientFactory) {
      throw new Error('SupabaseWeightRepository requires a client factory');
    }

    this.clientFactory = clientFactory;
    this.userId = null;
  }

  async getClient() {
    return this.clientFactory();
  }

  unwrap(result, fallbackMessage) {
    if (result?.error) {
      throw new Error(result.error.message || fallbackMessage);
    }
    return result?.data ?? null;
  }

  toLocalDateTime(value) {
    const date = new Date(value);
    const pad = number => String(number).padStart(2, '0');

    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join('-') + 'T' + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join(':');
  }

  toRecord(row) {
    return {
      id: row.id,
      value: Number(row.value_kg),
      measuredAt: this.toLocalDateTime(row.measured_at),
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    };
  }

  requireUser() {
    if (!this.userId) {
      throw new Error('Cal iniciar sessió per gestionar els pesos del compte');
    }
  }

  async initialize(state, { userId }) {
    if (!userId) {
      throw new Error('SupabaseWeightRepository requires a user id');
    }

    this.userId = userId;
    const client = await this.getClient();
    const result = await client
      .from('weight_logs')
      .select('id, value_kg, measured_at, source, created_at, updated_at, deleted_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('measured_at', { ascending: true });

    const rows = this.unwrap(result, 'No s’han pogut carregar els pesos');
    state.weights = rows.map(row => this.toRecord(row));
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
    this.requireUser();

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      throw new Error('Weight value must be positive');
    }
    if (!measuredAt) {
      throw new Error('Weight measuredAt is required');
    }

    const client = await this.getClient();
    const values = {
      value_kg: numericValue,
      measured_at: new Date(measuredAt).toISOString()
    };

    let query;
    if (id) {
      query = client
        .from('weight_logs')
        .update(values)
        .eq('id', id)
        .eq('user_id', this.userId);
    } else {
      query = client
        .from('weight_logs')
        .insert({
          ...values,
          user_id: this.userId,
          source: 'manual'
        });
    }

    const result = await query
      .select('id, value_kg, measured_at, source, created_at, updated_at, deleted_at')
      .single();
    const row = this.unwrap(result, 'No s’ha pogut guardar el pes');
    const record = this.toRecord(row);
    const index = state.weights.findIndex(item => item.id === record.id);

    if (index >= 0) state.weights[index] = record;
    else state.weights.push(record);

    state.weights.sort(
      (a, b) => a.measuredAt.localeCompare(b.measuredAt)
    );
    return record;
  }

  async softDelete(state, id) {
    this.requireUser();

    const client = await this.getClient();
    const result = await client
      .from('weight_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', this.userId)
      .select('id, value_kg, measured_at, source, created_at, updated_at, deleted_at')
      .single();

    const row = this.unwrap(result, 'No s’ha pogut eliminar el pes');
    const record = this.toRecord(row);
    state.weights = state.weights.filter(item => item.id !== id);
    return record;
  }
}
