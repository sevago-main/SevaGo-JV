# SevaGo SEO: audit, keyword database, competitor analysis, 90-day roadmap

Prepared 24 Nov 2026. **Read "What this does not contain" first.**

## What this does not contain (and why)

| Asked for | Status |
|---|---|
| Search volume, competition, difficulty | **Not available to me.** Google Keyword Planner, Trends and Search Console need your Google account. The keyword database has those columns **empty on purpose**. I did not estimate or invent numbers. Export them from Keyword Planner and paste into `keyword-database.csv` (steps below). |
| Search Console / Bing Webmaster integration | **Needs you.** Both need to verify ownership with your account. Paste the two tokens into `seo/site.json` (`verification.google`, `verification.bing`), run `npm run build:seo`, deploy, then click Verify. Add `https://sevago.co.in/sitemap.xml` in both. |
| Indexing verification, rankings, Core Web Vitals at the 75th percentile | **Only possible after deploy**: use Search Console (Indexing, Core Web Vitals) and the CrUX report. Lab numbers I measured locally are below and are not field data. |
| "Top-three rankings" | No one can promise that. The plan below targets the searches where SevaGo can credibly be the best answer and measures progress weekly. |
| Bengaluru / Chennai pages | **Not built.** Bengaluru is live but I have no verified local detail for it; Chennai is not live. Publishing pages for places SevaGo does not serve would be a doorway page. Add them when you can supply real local facts (see roadmap). |
| Backlinks | No purchased or automated links. Opportunities below are manual and earned. |

## 1. Keyword research (what was actually done)

- **Source:** 904 real Google autocomplete suggestions (`gl=in`, English + Tamil) from 400+ seed queries covering your target list, 7 Coimbatore areas, and Tamil/Tanglish variants (`scripts/keyword-harvest.js`, raw output in `raw-suggestions.json`). Autocomplete proves people type a phrase, but gives no volume.
- **Database:** `keyword-database.csv` / `.json`. **668** relevant phrases after removing foreign locations, off-topic and junk; **563** judged a good fit (105 flagged `Skip`, e.g. vehicle pick-and-drop, brand-specific job searches, WhatsApp-group seekers, work-from-home).
- **Priority (P1/P2/P3)** = fit and intent score (transactional + Coimbatore + "near me" + core cluster). It is **not** a traffic estimate.
- **Not done:** Google Trends and related-search mining (need a browser session with your account), per-keyword competitor ranking checks.

### What the data says

| Finding | Evidence | Implication |
|---|---|---|
| Demand in Coimbatore is overwhelmingly **"part time jobs"**, not "errand services" | 275 of 563 fit keywords are earn-side; 88 are Coimbatore-specific, mostly "coimbatore part time jobs / for students / vacancy" | The partner side is where search volume is likely to be. But searchers want vacancies. SevaGo has none, so the Partner page must set the right expectation (task-based earning) and still win on honesty and freshness. |
| **"Errand services near me" exists but is thin and global** | 48 errand keywords, mostly US-style ("errand runner jobs near me", "senior errand service") | Little Indian competition. A Coimbatore errand page can plausibly lead. |
| **Queue-standing is a tiny, almost uncontested niche** | 11 queue-cluster phrases, none Coimbatore-specific | Low volume likely, but near-zero competition and very high fit. |
| "Courier / document pickup near me" is large (119) | "courier pickup near me", "courier service near me" | Strong overlap with SevaGo's document pickup. Compete on "in Coimbatore", not on national courier terms. |
| Tamil/Tanglish is real but small | 10 fit phrases ("coimbatore velai vaippu tamil") | Add Tamil sections to the Partner page once someone fluent writes them. Machine translation is not acceptable here. |
| Brand-alternative searches are weak | 13 TaskRabbit, 21 Urban Company phrases, mostly brand navigational | Do not build "alternative to X" pages yet; the audience is small and the claims are risky. |

## 2. Hyperlocal pages (built, indexable, no JS needed)

| URL | Targets |
|---|---|
| `/coimbatore` | hub: errands and local help in Coimbatore |
| `/coimbatore/errand-services` | errand services, errands near me |
| `/coimbatore/queue-standing-services` | queue standing / waiting service |
| `/coimbatore/document-pickup-delivery` | document pickup, courier-style pickups |
| `/coimbatore/personal-assistance` | personal assistant near me |
| `/coimbatore/odd-jobs` | odd jobs near me (both sides) |
| `/coimbatore/part-time-jobs` | earn in free time, student earning, Partner app |
| `/coimbatore/saravanampatti`, `/rs-puram`, `/peelamedu` | neighbourhood guides |

Rules followed: facts come only from SevaGo's two live Google Play listings; **no** partner counts, response times, per-task prices or neighbourhood-level coverage claims; every page says availability depends on partners nearby; the Partner page says plainly that SevaGo is task-based, not a job board; no fake reviews, no `aggregateRating`. A test (`tests/seo.test.js`) fails the build if banned claims such as "guarantee", "best", "within N minutes" or partner counts appear.

**Before you rely on the three neighbourhood pages:** they contain general local context (Saravanampatti on Sathy Road with IT offices; RS Puram around DB Road; Peelamedu on Avinashi Road with PSG College of Technology and the airport). Please check these facts and confirm you actually want to promote those areas. If SevaGo cannot serve an area yet, remove its entry from `seo/pages.js` and run `npm run build:seo`. Thin or inaccurate area pages are the fastest way to get a "doorway page" penalty.

## 3. Technical SEO changes shipped

- Static, server-delivered HTML pages (no client rendering). `sitemap.xml` and `robots.txt` generated by `scripts/build-seo.js` (`/admin/`, `/api/` disallowed; sitemap declared). A test fails if the committed files drift from the generator.
- Unique `<title>`/description per page (tested for length and uniqueness), one `<h1>`, canonical URLs, OG/Twitter tags, `lang="en"`, skip links, breadcrumb navigation.
- JSON-LD: Organization + WebSite + two MobileApplication nodes (home); BreadcrumbList + WebPage + Service (`areaServed` Coimbatore) + FAQPage (matches the visible FAQ, tested) on landing pages.
- Internal linking: home service cards and footer link to `/coimbatore`; hub links to every page; each page links to 3 related pages plus the hub; neighbourhood pages link to the service pages.
- Broken-link fixes found by the new test: dead Play listing `com.app.initio.sevago` (returned 404) in 11 places in `index.html`, plus the 404 and `/careers` pages, including the yellow "Download App & post a task" button; `#hiring` anchor that no longer exists (nav, mobile menu, footer); `careers.html` links (now `/careers`); `/careers` and 404 pages linking to removed `#investors` and using relative links that broke inside `/careers/`; old `privacy-policy.html` linking to non-existent `/terms-of-service` (removed; `/privacy-policy` and `/terms-and-conditions` now 308-redirect to `/privacy` and `/terms`).
- Performance (lab, local, desktop, no throttling): home page HTML went from ~1.6 MB to ~260 KB by moving three copies of eight base64 screenshots into cached image files; removed the `body{opacity:0}` fade that delayed first paint; replaced the always-running hero canvas with a lightweight SVG; all new animation is transform/opacity and stops under `prefers-reduced-motion`. Measured locally: LCP ~0.66 s, CLS 0.003, 17 requests. Field data will differ: check Search Console after launch.
- Not done: image CDN/AVIF, self-hosting fonts, splitting the remaining ~4,000 lines of inline CSS/JS in `index.html`. Worth doing in the next sprint to protect INP.

## 4. Competitor intelligence (pages fetched 24 Nov 2026)

| Competitor | What I could see | Gap for SevaGo |
|---|---|---|
| **Urban Company** (`/coimbatore`) | Title "Get Expert Professional Services at Home in Coimbatore": scheduled home services (salon, cleaning, repairs) | They own "home services". No errands, queue-standing or one-off "someone to be there" tasks. |
| **TaskRabbit** | "Same Day Handyman, Moving & Mounting Services" | No India presence on this page; US/UK handyman focus. Do not target "TaskRabbit alternative in India" until you have the coverage to back it. |
| **Justdial** (`/Coimbatore`) | Local business directory | Strong for "near me" directory queries; no task marketplace. Listing SevaGo there is a legitimate citation opportunity. |
| **WorkIndia** (`/jobs-in-coimbatore/`) | "Find 1479+ Jobs in Coimbatore, November 2026, Urgent Vacancies" | Owns "coimbatore part time jobs" with fresh vacancy counts. SevaGo cannot compete on listings; it competes on "earn per task, no application". |
| **Apna** | Sampled URL returned 404; could not assess | Check manually. |
| **Indeed** | Blocked automated fetch (security check) | Check manually. |
| **Porter, Dunzo** | Porter's sampled URL returned 404; Dunzo did not respond | Do not draw conclusions. Check manually. |

**Underserved searches SevaGo can own:** queue standing, "someone to stand in line", errand running in Indian cities, document pickup by a person (not a courier), "hospital/bank/office visit help", student task-based earning. **Content gaps:** nobody in the sample explains how to hire a person for a one-off errand safely, or how to price it.

**Earned backlink opportunities (all manual, none purchased):** Justdial and Google Business Profile listings once a verifiable Coimbatore address/contact exists (the registered office in Kurichi is on file); AIC RAISE incubator and Coimbatore start-up community pages; local colleges' placement/student-affairs pages (Peelamedu: PSG, CIT, etc.); local press/Instagram features; Product Hunt India; Play Store listing "website" link (already points to sevago.co.in).

## 5. Content clusters (next articles, none fabricated)

Write only from first-hand SevaGo experience; each should link to the matching landing page.

1. **Errands:** "How to describe an errand so a partner can do it right", "What to put in a pickup task", "How to set a fair budget".
2. **Queue and in-person help:** "Which offices and counters allow someone to stand in for you" (research each; cite official pages), "Preparing documents for someone else to submit".
3. **Flexible earning (Partner):** "How task-based earning works", "Student schedules and tasks", "How payouts work (Tuesday and Friday)".
4. **Safety and trust:** "How KYC verification works for partners", "Why payment stays protected until you approve".
5. **Tamil / Tanglish:** a fluent writer to produce a Tamil Partner page and FAQ. Target phrases are in the database (`language = tamil/tanglish`).

## 6. Conversion tracking (what exists now)

First-party events written to the Vercel runtime logs as `sevago_event` JSON lines (no personal data) and pushed to `dataLayer`/`gtag` if you add them: `download_view`, `play_store_click` (Poster), `partner_play_click`, `sticky_cta_click`, `app_store_click`, `waitlist_open/start/submit/success/duplicate/error`, `waitlist_cta_click` (from landing pages). Landing-page clicks carry `source = seo:/path`. Sign-ups are viewed and exported from the waitlist Google Sheet.

| Requested metric | Where it comes from |
|---|---|
| Organic impressions, clicks, rankings | Search Console (after verification) |
| Android download clicks | `play_store_click` / `partner_play_click` (clicks, not installs) |
| iOS waitlist registrations | `waitlist_success` events + rows in the waitlist Sheet |
| **Installs, partner registrations, completed tasks** | **Live inside the apps/back-end, not the website.** Connect with Play Console install reports and your task database, or add `pcampaignid`/UTM-tagged Play links and Firebase attribution. I could not wire this without access. |

## 7. 90-day organic growth roadmap

**Days 0-14: foundation (needs you)**
1. Merge, set the Google Sheets waitlist variables and deploy (see `docs/WAITLIST.md`).
2. Verify Search Console and Bing; submit `sitemap.xml`; request indexing for `/coimbatore` and its 9 pages.
3. Export Keyword Planner volumes for the 563 fit keywords into the CSV; re-sort P1/P2 by real volume.
4. Verify the neighbourhood-page facts; remove any area you cannot serve.
5. Create Google Business Profile (if you have a staffed address) and Justdial listing.

**Days 15-45: content and trust**
6. Publish 6 articles from the clusters above (2 per cluster, errands, queue, earning). One per week.
7. Add real, consented customer and partner testimonials (Review markup only after you have genuine reviews).
8. Record 1 real local fact per page (e.g. which landmark areas your first partners cover) once you have data.
9. Tamil Partner page, written by a fluent writer.

**Days 46-90: expand and measure**
10. Add Bengaluru pages once you can supply real local content for 3-4 areas; Chennai only after launch.
11. Earn links: college student-affairs pages, local start-up groups, press.
12. Weekly: Search Console queries, impressions/clicks per page, sign-ups in the waitlist Sheet and `sevago_event` logs; improve titles of pages with impressions but low CTR.
13. Day 90 review: which pages rank in positions 1-10? Double down on those intents; merge or remove pages that get no impressions.

**Success metrics (set targets after day 14 with real volumes):** indexed pages = 10/10; impressions and clicks per page (Search Console); position for "queue standing service Coimbatore", "errand services Coimbatore", "odd jobs near me Coimbatore"; Play and waitlist clicks per 100 organic sessions; LCP < 2.5 s, CLS < 0.1, INP < 200 ms in CrUX at p75.

## How to add Keyword Planner volumes

1. Keyword Planner → Get search volume and forecasts → upload `keyword-database.csv` (the `keyword` column).
2. Download results, copy "Avg. monthly searches", "Competition" and "Top of page bid" into `volume`, `competition`, `cpc`.
3. Do not fill `difficulty` from Keyword Planner (it has none); use Search Console positions or a rank tool.

## Regenerating

```
npm run harvest:keywords    # collect autocomplete (polite, ~3 min)
node scripts/keyword-classify.js
npm run build:seo           # pages, sitemap, robots, verification tags
npm test                    # includes link, schema and claim checks
```
