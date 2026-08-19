export class SupabaseCheckinRepository {
  constructor({ clientFactory } = {}) {
    if (!clientFactory) {
      throw new Error(
        'SupabaseCheckinRepository requires a client factory'
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

  toRecord(row) {
    return {
      id: row.id,
      date: row.checkin_date,
      feelingScore: Number(row.feeling_score),
      note: row.note,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    };
  }

  async initialize(state, { userId }) {
    if (!userId) {
      throw new Error(
        'SupabaseCheckinRepository requires a user id'
      );
    }

    this.userId = userId;

    const client = await this.getClient();

    const result = await client
      .from('contextual_checkins')
      .select(
        'id, checkin_date, feeling_score, note, source, created_at, updated_at, deleted_at'
      )
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('checkin_date', { ascending: false })
      .limit(90);

    const rows = this.unwrap(
      result,
      'No s’han pogut carregar els check-ins'
    );

    state.checkins = rows.map(row => this.toRecord(row));

    return state;
  }

  async save(state, { date, feelingScore, note = null }) {
    if (!this.userId) {
      throw new Error('Cal iniciar sessió per guardar el check-in');
    }

    const client = await this.getClient();

    const result = await client
      .from('contextual_checkins')
      .upsert({
        user_id: this.userId,
        checkin_date: date,
        feeling_score: feelingScore,
        note: note?.trim() || null,
        source: 'manual',
        deleted_at: null
      }, {
        onConflict: 'user_id,checkin_date'
      })
      .select(
        'id, checkin_date, feeling_score, note, source, created_at, updated_at, deleted_at'
      )
      .single();

    const row = this.unwrap(
      result,
      'No s’ha pogut guardar el check-in'
    );

    const record = this.toRecord(row);
    const index = state.checkins.findIndex(
      item => item.date === record.date
    );

    if (index >= 0) state.checkins[index] = record;
    else state.checkins.unshift(record);

    return record;
  }
}
