export class SupabaseDailySummaryRepository {
  constructor({ clientFactory } = {}) {
    if (!clientFactory) {
      throw new Error('SupabaseDailySummaryRepository requires a client factory');
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
      date: row.summary_date,
      steps: row.steps == null ? null : Number(row.steps),
      intake: row.intake_kcal == null ? null : Number(row.intake_kcal),
      active: row.active_kcal == null ? null : Number(row.active_kcal),
      total: row.total_kcal == null ? null : Number(row.total_kcal)
    };
  }

  requireUser() {
    if (!this.userId) {
      throw new Error('Cal iniciar sessió per gestionar els resums del compte');
    }
  }

  async initialize(state, { userId }) {
    if (!userId) {
      throw new Error('SupabaseDailySummaryRepository requires a user id');
    }

    this.userId = userId;
    const client = await this.getClient();
    const result = await client
      .from('daily_summaries')
      .select('summary_date, steps, intake_kcal, active_kcal, total_kcal')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('summary_date', { ascending: true });

    const rows = this.unwrap(result, 'No s’han pogut carregar els resums diaris');
    state.days = rows.map(row => this.toRecord(row));
    return state;
  }

  async save(state, data) {
    this.requireUser();
    if (!data?.date) {
      throw new Error('La data del resum és obligatòria');
    }

    const client = await this.getClient();
    const result = await client
      .from('daily_summaries')
      .upsert({
        user_id: this.userId,
        summary_date: data.date,
        steps: data.steps,
        intake_kcal: data.intake,
        active_kcal: data.active,
        total_kcal: data.total,
        source: 'manual',
        deleted_at: null
      }, { onConflict: 'user_id,summary_date' })
      .select('summary_date, steps, intake_kcal, active_kcal, total_kcal')
      .single();

    const row = this.unwrap(result, 'No s’ha pogut guardar el resum diari');
    const record = this.toRecord(row);
    const index = state.days.findIndex(day => day.date === record.date);
    if (index >= 0) state.days[index] = record;
    else state.days.push(record);
    state.days.sort((a, b) => a.date.localeCompare(b.date));
    return record;
  }
}
