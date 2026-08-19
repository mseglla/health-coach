function formatKg(value) {
  return value == null
    ? null
    : `${Number(value).toFixed(1).replace('.', ',')} kg`;
}

function formatNumber(value) {
  return Math.round(value).toLocaleString('ca-ES');
}

function formatDuration(minutes) {
  if (!minutes) return null;

  const rounded = Math.round(minutes);

  if (rounded < 60) return `${rounded} min`;

  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;

  return rest
    ? `${hours} h ${rest} min`
    : `${hours} h`;
}

function activityLabel(type) {
  const labels = {
    running: 'Running',
    walking: 'Caminar',
    cycling: 'Ciclisme',
    core_training: 'Core',
    strength_training: 'Força',
    functional_strength_training: 'Força funcional',
    hiit: 'HIIT',
    swimming: 'Natació',
    hiking: 'Senderisme',
    yoga: 'Ioga',
    pilates: 'Pilates',
    rowing: 'Rem',
    elliptical: 'El·líptica',
    stair_climbing: 'Escales',
    dance: 'Dansa',
    soccer: 'Futbol',
    tennis: 'Tennis',
    paddle_sports: 'Pàdel / pala'
  };

  return labels[type] || 'Entrenament';
}

function feelingLabel(score) {
  return {
    5: 'Molt bé',
    4: 'Bé',
    3: 'Normal',
    2: 'Cansat',
    1: 'Molt cansat'
  }[score] || null;
}

function daysBetween(fromDate, toDate) {
  if (!fromDate || !toDate) return null;

  const from = new Date(`${fromDate}T12:00:00`);
  const to = new Date(`${toDate}T12:00:00`);

  return Math.max(
    0,
    Math.ceil((to - from) / 86400000)
  );
}

function getWeightGoal(state) {
  const goals = (state.goals || []).filter(
    goal =>
      goal.goalType === 'weight' &&
      goal.isActive !== false
  );

  return (
    goals.find(goal => goal.isPrimary) ||
    goals[0] ||
    null
  );
}

function trajectoryFor(state, snapshot) {
  const goal = getWeightGoal(state);
  const average = snapshot.weight.average7d;
  const balance = snapshot.energy.balance;

  if (
    !goal ||
    average == null ||
    goal.targetValue == null ||
    !goal.targetDate ||
    !balance?.available
  ) {
    return {
      status: 'unknown'
    };
  }

  const target = Number(goal.targetValue);
  const remainingDays = daysBetween(
    snapshot.date,
    goal.targetDate
  );

  if (
    !remainingDays ||
    target >= average
  ) {
    return {
      status: 'unknown'
    };
  }

  const remainingKg = average - target;
  const requiredWeeklyLoss =
    remainingKg / (remainingDays / 7);

  const observedWeeklyLoss =
    -Number(balance.weeklyWeightChangeKg);

  const ratio =
    requiredWeeklyLoss > 0
      ? observedWeeklyLoss / requiredWeeklyLoss
      : null;

  let status = 'behind';

  if (observedWeeklyLoss > 0 &&
      ratio != null &&
      ratio >= 0.8) {
    status = 'on_track';
  }

  return {
    status,
    target,
    remainingDays,
    remainingKg,
    requiredWeeklyLoss,
    observedWeeklyLoss,
    confidence: balance.confidence
  };
}

export function createDailyInsight(state, snapshot) {
  const balance = snapshot.energy.balance;
  const trajectory = trajectoryFor(state, snapshot);

  let headline = 'ATLES encara està aprenent.';
  let summary =
    'Encara no hi ha prou senyal per interpretar amb confiança la teva evolució.';
  let action =
    'Continua acumulant dades sense canviar res només per una lectura puntual.';
  let tone = 'neutral';

  if (balance?.available) {
    if (balance.status === 'deficit') {
      headline = 'Vas en bona direcció.';
      summary =
        `La tendència del pes és compatible amb un dèficit d’uns ` +
        `${balance.absoluteBalanceKcal} kcal al dia.`;
      action =
        'Mantén la constància; no cal forçar més el ritme avui.';
      tone = 'good';
    }

    if (balance.status === 'maintenance') {
      headline = 'La tendència està estable.';
      summary =
        'El pes és compatible amb un balanç proper al manteniment.';
      action =
        'Observa uns dies més abans de treure conclusions o fer canvis grans.';
      tone = 'neutral';
    }

    if (balance.status === 'surplus') {
      headline = 'La tendència s’ha desviat.';
      summary =
        `La tendència del pes és compatible amb un superàvit d’uns ` +
        `${balance.absoluteBalanceKcal} kcal al dia.`;
      action =
        'Prioritza constància i observa si la tendència es manté abans d’ajustar el pla.';
      tone = 'warn';
    }
  }

  if (trajectory.status === 'on_track') {
    summary +=
      ` El ritme observat és compatible, provisionalment, amb l’objectiu de ` +
      `${formatKg(trajectory.target)}.`;
  }

  if (trajectory.status === 'behind') {
    if (balance?.status === 'deficit') {
      headline =
        'Estàs baixant, però per sota del ritme objectiu.';
    }

    summary +=
      ` El ritme observat és ara mateix inferior al necessari per arribar a ` +
      `${formatKg(trajectory.target)} en la data marcada.`;

    action =
      'Prioritza consistència avui; ATLES seguirà comprovant si aquesta desviació es confirma.';
  }

  const checkin = snapshot.wellbeing.checkin;

  if (
    checkin &&
    Number(checkin.feelingScore) <= 2
  ) {
    action =
      'Avui et notes cansat: evita convertir un sol dia en una prova de força i prioritza recuperar bé.';
  }

  const evidence = [];

  if (snapshot.weight.average7d != null) {
    evidence.push({
      label: 'PES',
      value: `Mitjana 7 dies · ${formatKg(snapshot.weight.average7d)}`
    });
  }

  if (snapshot.movement.steps != null) {
    evidence.push({
      label: 'MOVIMENT',
      value: `${formatNumber(snapshot.movement.steps)} passos avui`
    });
  }

  if (snapshot.training.latest) {
    const activity = snapshot.training.latest;
    const duration = formatDuration(
      activity.durationMinutes
    );

    evidence.push({
      label: 'ENTRENAMENT',
      value: [
        activityLabel(activity.type),
        duration
      ].filter(Boolean).join(' · ')
    });
  } else if (checkin) {
    evidence.push({
      label: 'SENSACIONS',
      value: feelingLabel(checkin.feelingScore)
    });
  }

  return {
    tone,
    headline,
    summary,
    action,
    trajectory,
    evidence: evidence.slice(0, 3)
  };
}
