export const parseNumber = value => { const n = Number.parseFloat(String(value ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const pad = value => String(value).padStart(2, '0');
export const localDateISO = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
export const todayISO = () => localDateISO();
export const nowLocalDateTime = (date = new Date()) => `${localDateISO(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const createId = (prefix='record') => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
export const recordDate = value => String(value || '').slice(0,10);
export const getDay = (state, date) => state.days.find(day => day.date === date) || { date };
export const recordsForDate = (records, key, date) => (records || []).filter(item => recordDate(item[key]) === date);
export const latestWeightRecord = weights => [...(weights || [])].sort((a,b) => b.measuredAt.localeCompare(a.measuredAt))[0] || null;
export const latestWeight = weights => latestWeightRecord(weights)?.value ?? null;
export function dailyWeightSeries(weights=[]) { const map=new Map(); [...weights].sort((a,b)=>a.measuredAt.localeCompare(b.measuredAt)).forEach(r=>map.set(recordDate(r.measuredAt),r)); return [...map.values()]; }
export function bmr(settings, weight) { if (!weight || !settings.age || !settings.height) return null; return 10*weight + 6.25*settings.height - 5*settings.age + (settings.sex==='male'?5:-161); }
export function totalBurn(state, day) { if (day?.total != null) return Math.round(day.total); const basal=bmr(state.settings, latestWeight(state.weights)); return basal ? Math.round(basal + (day?.active || 0)) : null; }
export const burnSource = day => day?.total != null ? 'Apple Watch' : day?.active != null ? 'estimació' : 'pendent';
export function mealCaloriesForDate(state,date) { const vals=recordsForDate(state.meals,'loggedAt',date).map(m=>Number(m.calories)).filter(Number.isFinite); return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)) : null; }
export function totalIntake(state,day) { return day?.intake != null ? Math.round(day.intake) : mealCaloriesForDate(state,day?.date); }
export function averageWeight(weights,count=7,offset=0) { const s=dailyWeightSeries(weights); const end=offset?-offset:undefined; const vals=s.slice(-(count+offset),end).map(r=>r.value); return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null; }
export function weightTrend(weights) { const a=averageWeight(weights,7,0), b=averageWeight(weights,7,7); return a!=null&&b!=null?a-b:null; }
export function averageDeficit(state,count=7) { const vals=[...state.days].slice(-count).map(d=>{const burn=totalBurn(state,d), intake=totalIntake(state,d); return burn!=null&&intake!=null?burn-intake:null;}).filter(v=>v!=null); return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null; }
export function adherenceScore(state,date=todayISO()) { const day=getDay(state,date); let score=0; if(recordsForDate(state.weights,'measuredAt',date).length) score+=25; if(recordsForDate(state.meals,'loggedAt',date).length || day.intake!=null) score+=25; if(day.total!=null || day.active!=null) score+=25; if(day.steps!=null) score+=15; if(recordsForDate(state.activities,'startedAt',date).length) score+=10; return Math.min(100,score); }
export function daysUntil(date) { if(!date)return null; return Math.max(0,Math.ceil((new Date(`${date}T12:00:00`)-new Date())/86400000)); }
export const formatKg = value => value!=null?`${Number(value).toFixed(1).replace('.',',')} kg`:'—';
export const formatKcal = value => value!=null?Math.round(value).toLocaleString('ca-ES'):'—';
export const formatDateShort = value => value?new Intl.DateTimeFormat('ca-ES',{day:'numeric',month:'short'}).format(new Date(`${value}T12:00:00`)):'—';
export const formatDateTime = value => value?new Intl.DateTimeFormat('ca-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—';
export const mealLabel = type => ({breakfast:'Esmorzar',morning:'Mig matí',lunch:'Dinar',snack:'Berenar',dinner:'Sopar',other:'Altres',summary:'Resum del dia'})[type] || 'Àpat';
export function suggestedMealType(date=new Date()) { const h=date.getHours(); if(h<10)return'breakfast'; if(h<12)return'morning'; if(h<16)return'lunch'; if(h<19)return'snack'; return'dinner'; }
