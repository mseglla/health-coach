import fs from 'node:fs';

const files = ['index.html','css/tokens.css','css/base.css','css/components.css','css/screens.css','js/app.js','js/state.js','js/storage.js','js/calculations.js','js/coach.js','js/charts.js','js/ui.js','manifest.webmanifest','sw.js'];
for (const file of files) {
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${file}`);
}

const html = fs.readFileSync('index.html', 'utf8');
const ids = Array.from(html.matchAll(/id="([^"]+)"/g), match => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) throw new Error(`Duplicate ids: ${Array.from(new Set(duplicateIds)).join(', ')}`);

const requiredIds = ['home','diary','stats','settings','quickSheet','fab','weightForm','mealForm','activityForm','energyForm','diaryDate','diaryTimeline','weightChart','calorieChart'];
for (const id of requiredIds) {
  if (!ids.includes(id)) throw new Error(`Missing id: ${id}`);
}

const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
if (!manifest.name || !manifest.short_name || !manifest.start_url || !manifest.display) {
  throw new Error('Manifest missing required fields');
}

console.log(`Validation passed: ${files.length} files and ${ids.length} unique ids.`);
