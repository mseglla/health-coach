import { adherenceScore, averageDeficit, averageWeight, totalBurn, totalIntake, weightTrend } from './calculations.js';
export function getCoachDecision(state, day) {
  const burn=totalBurn(state,day), intake=totalIntake(state,day), deficit=burn!=null&&intake!=null?burn-intake:null;
  const score=adherenceScore(state,day.date);
  if(score<25) return {tone:'neutral',label:'COMENÇA',title:'Registra una dada ràpida: pes, àpat o activitat.',caption:'Primer pas'};
  if(intake==null) return {tone:'warn',label:'FALTA MENJAR',title:'Afegeix els àpats d’avui per entendre el balanç real.',caption:'Completa el dia'};
  if(burn==null) return {tone:'warn',label:'FALTA ACTIVITAT',title:'Introdueix calories totals o actives de l’Apple Watch.',caption:'Falten dades'};
  if(deficit>900) return {tone:'warn',label:'DÈFICIT ALT',title:'Ja n’hi ha prou per avui. Prioritza sopar bé i recuperar.',caption:'No forcis més'};
  if(deficit>=300) return {tone:'good',label:'EN RUTA',title:`Dèficit estimat de ${Math.round(deficit)} kcal. Mantén el pla.`,caption:'Objectiu assolit'};
  if(deficit>=0) return {tone:'warn',label:'MARGE PETIT',title:'No cal compensar. Una decisió lleugera pot completar el dia.',caption:'Encara hi ha marge'};
  const trend=weightTrend(state.weights), avg=averageWeight(state.weights,7), avgDef=averageDeficit(state,7);
  if(state.weights.length>=14 && trend!=null && trend>-0.1 && avg!=null && avgDef!=null) return {tone:'bad',label:'REVISAR TENDÈNCIA',title:'La tendència de dues setmanes és plana. Proposa un únic ajust petit.',caption:'Possible estancament'};
  return {tone:'bad',label:'FORA DE RUTA',title:'No ho castiguis demà. Tanca el dia i reprèn el pla normal.',caption:'Superàvit estimat'};
}
