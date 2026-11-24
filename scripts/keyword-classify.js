'use strict';
/**
 * Turns docs/seo/raw-suggestions.json (real Google autocomplete phrases) into a prioritised
 * keyword database. Search volume / competition / difficulty are deliberately left EMPTY:
 * they are not available from autocomplete and must be imported from Google Keyword Planner
 * (or a rank tool). Priority here is a fit-and-intent score, not a traffic estimate.
 *
 *   node scripts/keyword-classify.js  -> docs/seo/keyword-database.csv (+ .json)
 */
const fs = require('fs');
const path = require('path');
const raw = require('../docs/seo/raw-suggestions.json');

const FOREIGN = /\b(lagos|nairobi|dubai|uk|usa|canada|australia|sydney|melbourne|london|singapore|toronto|new york|nyc|texas|california|florida|abu dhabi|qatar|doha|kenya|nigeria|ghana|pakistan|islamabad|lahore|karachi|dhaka|manila|philippines|malaysia|kuala|south africa|johannesburg|cape town|ireland|dublin|manchester|birmingham|vancouver|ontario|chicago|houston|atlanta|seattle|boston|miami|denver|phoenix|las vegas|san |los angeles|hong kong|nz|new zealand|auckland|saudi|riyadh|kuwait|oman|bahrain|egypt|cairo|uganda|kampala|tanzania|zimbabwe|ethiopia|ghanaian|abuja|accra)\b/i;
const JUNK = /\b(meaning|definition|pdf|salary slip|resume|cv|template|sample|essay|quotes|jokes|lyrics|movie|song|wikipedia|tamil nadu government|ration card status|aadhar|aadhaar|pan card|passport status)\b/i;
const OFFTOPIC = /\b(crypto|forex|bitcoin|casino|betting|adult|massage|escort|dating|loan app|lottery|mlm|network marketing|data entry captcha|typing job|survey job|ludo|rummy)\b/i;
const INDIA_GEO = /\b(india|coimbatore|kovai|tamil|tamilnadu|tamil nadu|saravanampatti|rs puram|peelamedu|gandhipuram|singanallur|ganapathy|bengaluru|bangalore|chennai|kochi|cochin|hyderabad|mumbai|delhi|pune|madurai|trichy|salem|tiruppur|erode|kerala|karnataka)\b/i;
const LOWFIT = /\b(whatsapp|telegram|group link|vacancy for female|jobs for female|amazon|flipkart|blinkit|zomato|swiggy|zepto|bigbasket|meesho|delhivery|ola|uber|rapido|porter|salary)\b|\b(car|bike|auto|school|bus|cab|vehicle|truck|bicycle|scooter|two wheeler)\b.*\b(pickup|drop)|\b(pickup|drop)\b.*\b(car|bike|auto|school|bus|cab|vehicle)\b|\b(bank job|government job|govt job|work from home|online job|data entry)\b/i;
const TANGLISH = /\b(velai|vaippu|aal|nikka|kadai|vandi|sambalam|thevai)\b|[஀-௿]/i;

const CLUSTERS = [
  ['queue-standing', /\b(queue|stand in line|standing in line|wait in line|waiting service|line sitting|line stand)\b/i, '/coimbatore/queue-standing-services'],
  ['document-pickup-delivery', /\b(document|courier|parcel|pickup and drop|pick up and drop|pickup service|delivery service|same day)\b/i, '/coimbatore/document-pickup-delivery'],
  ['errands', /\b(errand|run errands|errand runner|help with errands|shopping help|grocery pickup)\b/i, '/coimbatore/errand-services'],
  ['personal-assistance', /\b(personal assistant|personal assistance|virtual assistant|senior citizen|companion|household help|home help|domestic help|helper)\b/i, '/coimbatore/personal-assistance'],
  ['odd-jobs-gig', /\b(odd job|gig|small task|handyman|task booking|task app|hire someone|taskrabbit|urban company|urbanclap)\b/i, '/coimbatore/odd-jobs'],
  ['earn-part-time', /\b(part time|part-time|weekend job|student|earn money|side hustle|extra income|free time|work from home|daily payment|daily wages|daily pay|same day pay|velai)\b/i, '/coimbatore/part-time-jobs'],
];
const COMPETITOR = /\b(taskrabbit|urban company|urbanclap|justdial|apna|indeed|workindia|porter|dunzo|rapido|thumbtack|fiverr|upwork|shadowfax|swiggy genie|genie)\b/i;
const EARN = /\b(jobs?|earn|income|hustle|work|hiring|vacanc|velai|part.?time|daily (payment|wages|pay))\b/i;
const NEED = /\b(services?|near me|app|someone|help|hire|book|pickup|delivery|assistant|queue|errand|price|cost|charges|rate)\b/i;

function classify(kw) {
  const k = kw.keyword;
  if (FOREIGN.test(k) || JUNK.test(k) || OFFTOPIC.test(k)) return null;
  let cluster = null, page = '/coimbatore';
  for (const [name, re, target] of CLUSTERS) if (re.test(k)) { cluster = name; page = target; break; }
  if (!cluster) return null;
  const competitor = COMPETITOR.test(k);
  const geo = /coimbatore|kovai|saravanampatti|rs puram|peelamedu|gandhipuram/i.test(k) ? 'coimbatore' : /bengaluru|bangalore/i.test(k) ? 'bengaluru' : /chennai/i.test(k) ? 'chennai' : INDIA_GEO.test(k) ? 'india' : 'unspecified';
  const near = /near me|nearby|in my area/i.test(k);
  const lang = TANGLISH.test(k) || kw.lang === 'ta' ? 'tamil/tanglish' : 'english';
  const side = EARN.test(k) && !/errand|queue|pickup|delivery|assistant|service/i.test(k) ? 'partner (earn)' : NEED.test(k) ? 'poster (need help)' : 'either';
  const intent = competitor ? 'comparison/competitor' : /\bhow (to|do)|what is|why\b/i.test(k) ? 'informational' : 'transactional';
  // fit-and-intent score, NOT traffic: higher = target sooner
  let score = 0;
  score += intent === 'transactional' ? 3 : intent === 'comparison/competitor' ? 2 : 1;
  score += geo === 'coimbatore' ? 3 : geo === 'bengaluru' ? 2 : geo === 'india' || geo === 'unspecified' ? 1 : 0;
  score += near ? 2 : 0;
  score += ['errands', 'queue-standing', 'document-pickup-delivery', 'earn-part-time'].includes(cluster) ? 2 : 1;
  const fit = LOWFIT.test(k) ? 'low' : 'high';
  const priority = fit === 'low' ? 'Skip' : score >= 8 ? 'P1' : score >= 6 ? 'P2' : 'P3';
  return { keyword: k, fit, cluster, side, intent, geo, language: lang, near_me: near ? 'yes' : '', competitor_mention: competitor ? 'yes' : '', target_page: page, priority, score, source: 'google-autocomplete', seed: kw.seed, volume: '', competition: '', difficulty: '', cpc: '' };
}

const rows = [];
const seen = new Set();
for (const kw of raw.items) {
  const r = classify(kw);
  if (r && !seen.has(r.keyword)) { seen.add(r.keyword); rows.push(r); }
}
rows.sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword));

const cols = ['keyword', 'priority', 'fit', 'score', 'cluster', 'side', 'intent', 'geo', 'language', 'near_me', 'competitor_mention', 'target_page', 'source', 'seed', 'volume', 'competition', 'difficulty', 'cpc'];
const cell = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const dir = path.join(__dirname, '..', 'docs', 'seo');
fs.writeFileSync(path.join(dir, 'keyword-database.csv'), '﻿' + cols.join(',') + '\n' + rows.map((r) => cols.map((c) => cell(r[c])).join(',')).join('\n') + '\n');
fs.writeFileSync(path.join(dir, 'keyword-database.json'), JSON.stringify({ collectedAt: raw.collectedAt, note: 'volume/competition/difficulty/cpc intentionally empty: import from Google Keyword Planner', rows }, null, 1));
const by = (f) => rows.reduce((m, r) => (m[r[f]] = (m[r[f]] || 0) + 1, m), {});
console.log('relevant keywords:', rows.length, 'of', raw.items.length, 'raw');
console.log('priority', by('priority'), '\ncluster', by('cluster'), '\ngeo', by('geo'), '\nlanguage', by('language'));
