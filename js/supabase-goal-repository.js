export class SupabaseGoalRepository {
  constructor({ clientFactory } = {}) {
    if (!clientFactory) {
      throw new Error('SupabaseGoalRepository requires a client factory');
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
      goalType: row.goal_type,
      title: row.title,
      targetValue:
        row.target_value == null ? null : Number(row.target_value),
      targetUnit: row.target_unit,
      targetDate: row.target_date,
      metadata: row.metadata || {},
      isPrimary: Boolean(row.is_primary),
      isActive: Boolean(row.is_active),
      startWeightKg:
        row.start_weight_kg == null
          ? null
          : Number(row.start_weight_kg),
      targetWeightKg:
        row.target_weight_kg == null
          ? null
          : Number(row.target_weight_kg),
      weeklyGoalKg:
        row.weekly_goal_kg == null
          ? null
          : Number(row.weekly_goal_kg),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    };
  }

  requireUser() {
    if (!this.userId) {
      throw new Error(
        'Cal iniciar sessió per gestionar els objectius del compte'
      );
    }
  }

  fields() {
    return [
      'id',
      'goal_type',
      'title',
      'target_value',
      'target_unit',
      'target_date',
      'metadata',
      'is_primary',
      'is_active',
      'start_weight_kg',
      'target_weight_kg',
      'weekly_goal_kg',
      'created_at',
      'updated_at',
      'deleted_at'
    ].join(', ');
  }

  async initialize(state, { userId }) {
    if (!userId) {
      throw new Error('SupabaseGoalRepository requires a user id');
    }

    this.userId = userId;

    const client = await this.getClient();
    const result = await client
      .from('goals')
      .select(this.fields())
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('updated_at', { ascending: false });

    const rows = this.unwrap(
      result,
      'No s’han pogut carregar els objectius'
    );

    state.goals = rows.map(row => this.toRecord(row));
    return state;
  }

  findActiveWeightGoal(state) {
    return (state.goals || []).find(
      goal =>
        goal.goalType === 'weight' &&
        goal.isActive &&
        !goal.deletedAt
    ) || null;
  }

  async saveWeightGoal(
    state,
    {
      targetWeightKg,
      targetDate = null,
      startWeightKg = null
    }
  ) {
    this.requireUser();

    const target = Number(targetWeightKg);

    if (!Number.isFinite(target) || target <= 0) {
      throw new Error('Weight goal must be positive');
    }

    const existing = this.findActiveWeightGoal(state);
    const client = await this.getClient();

    const values = {
      goal_type: 'weight',
      title: 'Objectiu de pes',
      target_value: target,
      target_unit: 'kg',
      target_weight_kg: target,
      target_date: targetDate || null,
      metadata: {}
    };

    let query;

    if (existing) {
      query = client
        .from('goals')
        .update(values)
        .eq('id', existing.id)
        .eq('user_id', this.userId);
    } else {
      const hasPrimaryGoal = (state.goals || []).some(
        goal => goal.isPrimary && goal.isActive
      );

      query = client
        .from('goals')
        .insert({
          ...values,
          user_id: this.userId,
          start_weight_kg:
            Number.isFinite(Number(startWeightKg))
              ? Number(startWeightKg)
              : null,
          is_primary: !hasPrimaryGoal,
          is_active: true
        });
    }

    const result = await query
      .select(this.fields())
      .single();

    const row = this.unwrap(
      result,
      'No s’ha pogut guardar l’objectiu'
    );

    const goal = this.toRecord(row);
    const index = (state.goals || []).findIndex(
      item => item.id === goal.id
    );

    if (index >= 0) {
      state.goals[index] = goal;
    } else {
      state.goals.push(goal);
    }

    state.goals.sort(
      (a, b) =>
        Number(b.isPrimary) - Number(a.isPrimary) ||
        b.updatedAt.localeCompare(a.updatedAt)
    );

    return goal;
  }

  async deactivateWeightGoal(state) {
    this.requireUser();

    const existing = this.findActiveWeightGoal(state);
    if (!existing) return null;

    const client = await this.getClient();

    const result = await client
      .from('goals')
      .update({
        is_active: false,
        is_primary: false
      })
      .eq('id', existing.id)
      .eq('user_id', this.userId)
      .select(this.fields())
      .single();

    const row = this.unwrap(
      result,
      'No s’ha pogut desactivar l’objectiu'
    );

    state.goals = (state.goals || []).filter(
      goal => goal.id !== existing.id
    );

    return this.toRecord(row);
  }
}
