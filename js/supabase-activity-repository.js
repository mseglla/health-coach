export class SupabaseActivityRepository {
  constructor({ clientFactory } = {}) {
    if (!clientFactory) {
      throw new Error(
        'SupabaseActivityRepository requires a client factory'
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
      type: row.activity_type,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationMinutes:
        row.duration_minutes == null
          ? null
          : Number(row.duration_minutes),
      activeCalories:
        row.active_calories == null
          ? null
          : Number(row.active_calories),
      distanceMeters:
        row.distance_meters == null
          ? null
          : Number(row.distance_meters),
      steps:
        row.steps == null
          ? null
          : Number(row.steps),
      notes: row.notes,
      source: row.source,
      externalId: row.external_id,
      sourceBundleId: row.source_bundle_id,
      sourceDevice: row.source_device,
      timezone: row.timezone,
      metadata: row.metadata || {},
      importedAt: row.imported_at,
      deletedAt: row.deleted_at
    };
  }

  async initialize(state, { userId }) {
    if (!userId) {
      throw new Error(
        'SupabaseActivityRepository requires a user id'
      );
    }

    this.userId = userId;

    const client = await this.getClient();

    const result = await client
      .from('activity_logs')
      .select(`
        id,
        activity_type,
        started_at,
        ended_at,
        duration_minutes,
        active_calories,
        distance_meters,
        steps,
        notes,
        source,
        external_id,
        source_bundle_id,
        source_device,
        timezone,
        metadata,
        imported_at,
        deleted_at
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(100);

    const rows = this.unwrap(
      result,
      'No s’han pogut carregar els entrenaments'
    );

    state.activities = rows.map(row => this.toRecord(row));

    return state;
  }
}
