export class SupabaseProfileRepository {
  constructor({ clientFactory } = {}) {
    if (!clientFactory) {
      throw new Error('SupabaseProfileRepository requires a client factory');
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
    if (!row) return null;

    return {
      id: row.id,
      displayName: row.display_name,
      birthDate: row.birth_date,
      heightCm: row.height_cm == null ? null : Number(row.height_cm),
      metabolicSex: row.metabolic_sex,
      timezone: row.timezone,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  requireUser() {
    if (!this.userId) {
      throw new Error('Cal iniciar sessió per gestionar el perfil del compte');
    }
  }

  async initialize(state, { userId }) {
    if (!userId) {
      throw new Error('SupabaseProfileRepository requires a user id');
    }

    this.userId = userId;

    const client = await this.getClient();
    const result = await client
      .from('profiles')
      .select(
        'id, display_name, birth_date, height_cm, metabolic_sex, timezone, created_at, updated_at'
      )
      .eq('id', userId)
      .maybeSingle();

    const row = this.unwrap(
      result,
      'No s’ha pogut carregar el perfil'
    );

    state.profile = this.toRecord(row);
    return state;
  }

  async save(state, {
    displayName = null,
    birthDate = null,
    heightCm = null,
    metabolicSex = null,
    timezone = 'Europe/Madrid'
  }) {
    this.requireUser();

    const numericHeight = heightCm == null || heightCm === ''
      ? null
      : Number(heightCm);

    if (
      numericHeight != null &&
      (!Number.isFinite(numericHeight) || numericHeight <= 0)
    ) {
      throw new Error('Profile height must be positive');
    }

    const client = await this.getClient();

    const result = await client
      .from('profiles')
      .upsert({
        id: this.userId,
        display_name: displayName || null,
        birth_date: birthDate || null,
        height_cm: numericHeight,
        metabolic_sex: metabolicSex || null,
        timezone: timezone || 'Europe/Madrid'
      })
      .select(
        'id, display_name, birth_date, height_cm, metabolic_sex, timezone, created_at, updated_at'
      )
      .single();

    const row = this.unwrap(
      result,
      'No s’ha pogut guardar el perfil'
    );

    const profile = this.toRecord(row);
    state.profile = profile;

    return profile;
  }
}
