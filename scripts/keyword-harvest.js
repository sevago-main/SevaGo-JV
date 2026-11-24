'use strict';
/**
 * Collects real Google autocomplete suggestions for SevaGo's seed topics.
 * Autocomplete proves a phrase is actually typed, but it does NOT give search volume.
 * Volume, competition and CPC must come from Google Keyword Planner (see docs/seo/README.md).
 *
 *   node scripts/keyword-harvest.js            -> docs/seo/raw-suggestions.json
 */
const fs = require('fs');
const path = require('path');

const SEEDS_EN = [
  'errand services', 'errand service near me', 'odd jobs near me', 'part time jobs near me', 'daily payment jobs',
  'weekend jobs for students', 'gig work near me', 'personal assistant near me', 'someone to run errands',
  'earn money in your free time', 'local helpers near me', 'queue waiting service', 'stand in line for me',
  'document pickup service', 'document delivery service', 'hospital companion service', 'household help near me',
  'task booking app', 'taskrabbit alternative india', 'taskrabbit india', 'hire someone for small tasks',
  'parcel pickup service', 'courier pickup near me', 'work from home part time', 'student part time jobs',
  'extra income side hustle', 'same day delivery service', 'help with errands', 'errand runner jobs',
  'urban company alternative', 'gig economy apps india', 'earn money app india', 'part time jobs for students india',
  'ration card queue help', 'bank work help', 'senior citizen helper near me', 'pickup and drop service',
];
const CITY = ['coimbatore', 'saravanampatti', 'rs puram', 'peelamedu', 'gandhipuram', 'bengaluru', 'chennai'];
const CITY_SEEDS = ['errand services', 'odd jobs', 'part time jobs', 'personal assistant', 'queue standing service', 'document pickup', 'helper', 'daily wages jobs', 'jobs for students', 'delivery boy jobs'];
const TA = ['part time velai coimbatore', 'coimbatore part time job', 'velai vaippu coimbatore', 'daily wages velai', 'ஆள் தேவை கோயம்புத்தூர்', 'பகுதி நேர வேலை கோயம்புத்தூர்', 'வீட்டு வேலை ஆள்', 'queue la nikka aal', 'student part time velai', 'errand velai near me'];
const SUFFIX = ['', ' near me', ' app', ' price', ' for students', ' in coimbatore', ' daily payment'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { collectedAt: new Date().toISOString(), source: 'google autocomplete (suggestqueries.google.com)', items: [] };

async function suggest(q, hl) {
  const url = 'https://suggestqueries.google.com/complete/search?client=firefox&gl=in&hl=' + hl + '&q=' + encodeURIComponent(q);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (research script; contact team@sevago.co.in)' } });
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j[1]) ? j[1] : [];
  } catch (e) { return []; }
}

(async () => {
  const jobs = [];
  SEEDS_EN.forEach((s) => SUFFIX.forEach((x) => jobs.push([s + x, 'en'])));
  CITY_SEEDS.forEach((s) => CITY.forEach((c) => jobs.push([s + ' ' + c, 'en'])));
  TA.forEach((s) => jobs.push([s, 'ta']));
  const seen = new Set();
  for (let i = 0; i < jobs.length; i++) {
    const [q, hl] = jobs[i];
    const sugg = await suggest(q, hl);
    for (const s of sugg) {
      const k = s.trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.items.push({ keyword: k, seed: q, lang: hl });
    }
    if (i % 25 === 0) console.log(i + '/' + jobs.length, 'unique so far:', out.items.length);
    await sleep(350);
  }
  fs.mkdirSync(path.join(__dirname, '..', 'docs', 'seo'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'seo', 'raw-suggestions.json'), JSON.stringify(out, null, 1));
  console.log('done', out.items.length);
})();
