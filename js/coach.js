import {
  inferEnergyBalance,
  latestWeight
} from './calculations.js';

export function getCoachDecision(state, _day) {
  const weights = state.weights || [];

  if (!latestWeight(weights)) {
    return {
      tone: 'neutral',
      label: 'SENSE DADES',
      title: 'Pesa’t per començar a entendre la teva evolució.',
      caption: 'Comença pel pes'
    };
  }

  const balance = inferEnergyBalance(state);

  if (!balance.available) {
    return {
      tone: 'neutral',
      label: 'APRENENT',
      title:
        'Encara necessito més dies de pes per estimar el teu balanç energètic.',
      caption: 'Construint tendència'
    };
  }

  if (balance.status === 'deficit') {
    return {
      tone: 'good',
      label: 'DÈFICIT INFERIT',
      title:
        'La tendència del pes indica que probablement estàs en dèficit energètic.',
      caption: `≈ ${balance.absoluteBalanceKcal} kcal/dia · confiança ${balance.confidence === 'medium' ? 'mitjana' : 'baixa'}`
    };
  }

  if (balance.status === 'surplus') {
    return {
      tone: 'warn',
      label: 'SUPERÀVIT INFERIT',
      title:
        'La tendència del pes indica que probablement estàs en superàvit energètic.',
      caption: `≈ ${balance.absoluteBalanceKcal} kcal/dia · confiança ${balance.confidence === 'medium' ? 'mitjana' : 'baixa'}`
    };
  }

  return {
    tone: 'neutral',
    label: 'MANTENIMENT',
    title:
      'La tendència del pes és compatible amb un balanç energètic proper al manteniment.',
    caption: `confiança ${balance.confidence === 'medium' ? 'mitjana' : 'baixa'}`
  };
}
