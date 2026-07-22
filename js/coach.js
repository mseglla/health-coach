import { totalBurn, totalIntake, averageWeight, latestWeight } from './calculations.js';

export function getCoachDecision(state, day) {
  const burn = totalBurn(state, day);
  const intake = totalIntake(state, day);
  const deficit = burn != null && intake != null ? burn - intake : null;
  const weights = state.weights || [];

  if (!latestWeight(weights)) return { tone: 'neutral', label: 'SENSE DADES', title: 'Pesa’t per començar a personalitzar el pla.', caption: 'Comença pel pes' };
  if (intake == null || burn == null) return { tone: 'warn', label: 'DIA INCOMPLET', title: 'Completa la ingesta i la despesa total o activa.', caption: 'Falten dades' };

  if (weights.length >= 14) {
    const first = averageWeight(weights, 7, 7);
    const second = averageWeight(weights, 7, 0);
    if (first != null && second != null && second >= first - 0.1) {
      return { tone: 'bad', label: 'CAL INTERVENIR', title: 'La tendència és plana. Aquesta setmana caldrà una mesura petita i concreta.', caption: 'Estancament real' };
    }
  }

  if (deficit > 850) return { tone: 'warn', label: 'DÈFICIT ALT', title: 'No forcis més avui. Menja prou per recuperar-te.', caption: 'Prioritza recuperar' };
  if (deficit >= 300) return { tone: 'good', label: 'EN RUTA', title: `Dèficit estimat de ${Math.round(deficit)} kcal. Mantén el pla.`, caption: 'Objectiu assolit' };
  if (deficit >= 0) return { tone: 'warn', label: 'MARGE PETIT', title: 'Una caminada curta o un sopar una mica més lleuger poden completar el dia.', caption: 'Encara hi ha marge' };
  return { tone: 'bad', label: 'FORA DE RUTA', title: 'No ho compensis amb càstig. Reprèn el pla amb normalitat demà.', caption: 'Superàvit estimat' };
}
