export class SupabaseBodyMeasurementRepository {
  constructor({ clientFactory } = {}) {
    if (!clientFactory) {
      throw new Error(
        'SupabaseBodyMeasurementRepository requires a client factory'
      );
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
      type: row.measurement_type,
      value: Number(row.value),
      unit: row.unit,
      measuredAt: this.toLocalDateTime(row.measured_at),
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    };
  }

  requireUser() {
    if (!this.userId) {
      throw new Error(
        'Cal iniciar sessió per gestionar les mesures corporals'
      );
    }
  }

  fields() {
    return [
      'id',
      'measurement_type',
      'value',
      'unit',
      'measured_at',
      'source',
      'created_at',
      'updated_at',
      'deleted_at'
    ].join(', ');
  }

  async initialize(state, { userId }) {
    if (!userId) {
      throw new Error(
        'SupabaseBodyMeasurementRepository requires a user id'
      );
    }

    this.userId = userId;
    const client = await this.getClient();

    const result = await client
      .from('body_measurements')
      .select(this.fields())
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('measured_at', { ascending: true });

    const rows = this.unwrap(
      result,
      'No s’han pogut carregar les mesures corporals'
    );

    state.bodyMeasurements = rows.map(row => this.toRecord(row));
    return state;
  }

  list(state, { type = null } = {}) {
    return (state.bodyMeasurements || []).filter(
      record =>
        !record.deletedAt &&
        (!type || record.type === type)
    );
  }

  findById(state, id) {
    return this.list(state).find(record => record.id === id) || null;
  }

  async save(
    state,
    {
      id = null,
      type,
      value,
      unit,
      measuredAt
    }
  ) {
    this.requireUser();

    const numericValue = Number(value);

    if (!type) {
      throw new Error('Measurement type is required');
    }

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      throw new Error('Measurement value must be positive');
    }

    if (!unit) {
      throw new Error('Measurement unit is required');
    }

    if (!measuredAt) {
      throw new Error('Measurement measuredAt is required');
    }

    const client = await this.getClient();

    const values = {
      measurement_type: type,
      value: numericValue,
      unit,
      measured_at: new Date(measuredAt).toISOString()
    };

    let query;

    if (id) {
      query = client
        .from('body_measurements')
        .update(values)
        .eq('id', id)
        .eq('user_id', this.userId);
    } else {
      query = client
        .from('body_measurements')
        .insert({
          ...values,
          user_id: this.userId,
          source: 'manual'
        });
    }

    const result = await query
      .select(this.fields())
      .single();

    const row = this.unwrap(
      result,
      'No s’ha pogut guardar la mesura corporal'
    );

    const record = this.toRecord(row);
    const index = (state.bodyMeasurements || []).findIndex(
      item => item.id === record.id
    );

    if (index >= 0) {
      state.bodyMeasurements[index] = record;
    } else {
      state.bodyMeasurements.push(record);
    }

    state.bodyMeasurements.sort(
      (a, b) => a.measuredAt.localeCompare(b.measuredAt)
    );

    return record;
  }

  async softDelete(state, id) {
    this.requireUser();

    const client = await this.getClient();

    const result = await client
      .from('body_measurements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', this.userId)
      .select(this.fields())
      .single();

    const row = this.unwrap(
      result,
      'No s’ha pogut eliminar la mesura corporal'
    );

    state.bodyMeasurements = (state.bodyMeasurements || [])
      .filter(item => item.id !== id);

    return this.toRecord(row);
  }
}
