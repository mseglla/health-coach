export class SupabaseHealthMetricsRepository {
  constructor({ clientFactory } = {}) {
    if (!clientFactory) {
      throw new Error(
        'SupabaseHealthMetricsRepository requires a client factory'
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
      date: row.metric_date,
      type: row.metric_type,
      value: row.value == null ? null : Number(row.value),
      unit: row.unit,
      source: row.source,
      timezone: row.timezone,
      importedAt: row.imported_at
    };
  }

  async initialize(state, { userId }) {
    if (!userId) {
      throw new Error(
        'SupabaseHealthMetricsRepository requires a user id'
      );
    }

    this.userId = userId;

    const client = await this.getClient();

    const pageSize = 500;
    let offset = 0;
    const rows = [];

    while (true) {
      const result = await client
        .from('health_daily_metrics')
        .select(
          'metric_date, metric_type, value, unit, source, timezone, imported_at'
        )
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('metric_date', { ascending: true })
        .order('metric_type', { ascending: true })
        .order('source', { ascending: true })
        .range(
          offset,
          offset + pageSize - 1
        );

      const page = this.unwrap(
        result,
        'No s’han pogut carregar les mètriques de salut'
      );

      rows.push(...page);

      if (page.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    state.healthMetrics =
      rows.map(row => this.toRecord(row));

    return state;
  }
}
