## Testing Protocol
This file records testing history. Do not modify the protocol.

- Backend testing before frontend.
- Frontend testing requires explicit user permission.
- Never re-fix an already fixed issue.

## User Problem Statement
University Competitor Intelligence Platform (UCIP) — daily automated monitoring of LPU vs 7 competitor university websites, snapshot diffing, GPT-5 competitive benchmark reports, and executive briefings on a beautiful enterprise dashboard.

## MVP Delivered (June 2025)
- Cheerio-based crawler for 8 universities (LPU + CUCHD, SRM, VIT, Manipal, Stanford, UPenn, Masters' Union)
- Snapshot storage in MongoDB with day-over-day diff engine (title, description, H1/H2, nav, footer, CTAs, stats)
- Per-uni SEO scoring (title, meta, H1, OG, Twitter, schema, alt coverage)
- GPT-5 AI Benchmark Engine (via Emergent LLM Key) — outputs strengths, weaknesses, missing features, content/SEO/UX gaps, trust signals, ranked recommendations with priority/impact/effort, and overall score (LPU vs competitor).
- GPT-5 Daily Executive Briefing generator (headline, summary, critical issues, today's focus, competitor movements)
- Enterprise glassmorphic dashboard: KPI cards with animated counters, SEO chart (Recharts), university cards with health chips, expandable change rows with before/after diff highlighting, crawler logs tab, command palette (Cmd/Ctrl+K), toast notifications, dialog-based AI report viewer.
- OTP auth (dev mode returns devOtp in the request-otp response) with admin panel
- Daily 10 AM IST scheduler for automated crawl + briefing
- Google PageSpeed Insights integration with 24h caching

## New in this session (July 2025)
- **POST /api/admin/seed-baseline** — admin-only endpoint that creates a synthetic previous snapshot for each uni (from the current one, with subtle mutations to titles/H1/CTAs/stats/hero image) and runs the diff engine to produce realistic, presentable day-over-day changes.
- **POST /api/ai/daily-intel** and **GET /api/ai/daily-intel/latest** — GPT-5 daily competitive intelligence briefing based on last 24h of detected changes. Cached: only regenerates if latest doc is > 20h old (unless `?force=1`).
- **GET /api/compare?aId=&bId=** — Side-by-side comparison endpoint returning both unis' latest snapshots and cached PageSpeed scores.
- **GET /api/pagespeed/all?strategy=** — Return cached PageSpeed data for every uni (Mobile / Desktop).
- **GET /api/pagespeed** now caches results in Mongo `pagespeed_cache` (24h TTL). Pass `?force=1` to bypass.
- Frontend: new **Compare** tab (dual dropdowns + page picker + field-by-field diff view), new **PageSpeed** tab (grid of cards with Run per uni + Run all + comparison bar chart), new **Daily Competitive Intelligence** widget on the Overview tab, and admin-only **Seed Baseline** button in the header.

## Key Endpoints
- GET  /api/universities
- POST /api/crawl { universityId: 'all' | id }
- GET  /api/snapshots?universityId=
- GET  /api/snapshots/latest?universityId=
- GET  /api/changes?sinceHours=24&limit=100
- POST /api/ai/benchmark { competitorId }
- GET  /api/ai/reports
- GET  /api/ai/reports/latest?competitorId=
- POST /api/ai/executive-summary
- GET  /api/ai/executive-summary/latest
- POST /api/ai/daily-intel               (NEW)
- GET  /api/ai/daily-intel/latest         (NEW)
- POST /api/ai/action-plan
- GET  /api/ai/action-plan/latest
- GET  /api/compare?aId=&bId=             (NEW)
- GET  /api/pagespeed?url=&strategy=      (now cached)
- GET  /api/pagespeed/all?strategy=       (NEW)
- POST /api/admin/seed-baseline           (NEW admin)
- GET  /api/dashboard
- GET  /api/trends?days=30
- GET  /api/audit/:universityId
- GET  /api/scheduler/status              /  POST /api/scheduler/run

## Manual Verification (this session)
- POST /api/admin/seed-baseline → produced 168 realistic changes across 8 universities.
- POST /api/ai/daily-intel?force=1 → GPT-5 returned a valid daily intel JSON with headline, 5 competitor moves, 3 concrete actions for LPU, risk signals, opportunities.
- GET  /api/compare → returned both LPU and CU snapshots with pages, seo, structure fields intact.
- GET  /api/pagespeed/all → returned rows with `pagespeed: null` (as no PS run yet); ready for user-triggered per-uni runs.
- UI screenshots confirmed: Overview tab shows Daily Intel widget; Compare tab renders side-by-side comparison with 168 detected differences; PageSpeed tab renders per-uni cards with Run buttons.

## Backend testing agent request (this session)
Test the following newly added endpoints with an admin OTP session:
1. Auth flow: POST /api/auth/request-otp {email:'muneesh.kumar@lpu.co.in'} → capture devOtp → POST /api/auth/verify-otp → store token.
2. POST /api/admin/seed-baseline → expect { ok: true, summary: [...] } and totalChanges > 0.
3. GET /api/dashboard → expect stats.totalChanges > 0 and recentChanges non-empty.
4. GET /api/changes?sinceHours=24 → expect non-empty array; each item should have detectedAt, universityCode, type, severity.
5. POST /api/ai/daily-intel?force=1 → expect JSON with intel.headline, intel.todayForLpu (length 3), intel.competitiveMoves.
6. GET /api/ai/daily-intel/latest → should return the same doc.
7. GET /api/compare?aId=<LPU id>&bId=<any competitor id> → expect a.snapshot.data.seo.title and b.snapshot.data.seo.title populated.
8. GET /api/pagespeed?url=https://www.lpu.in&strategy=mobile → expect scores.performance number 0-100 (or a cached=true if already fetched).
9. GET /api/pagespeed/all → expect results array with 8 entries.
Do NOT modify seeded data. Report any 4xx/5xx or wrong shapes.

## Manual Verification
- Crawl all: 8 universities crawled in <5s each. HTTP 200 responses.
- AI benchmark (LPU vs Chandigarh): returned 11-field structured report with LPU 76 / CU 86, 10 prioritized recommendations. Real citations from crawled content.
- Executive briefing: real headline mentioning specific insights.
- Dashboard renders all data, charts, cards.

## Next Enhancements (deferred)
- Multi-page crawl per uni (currently homepage; extend to admissions/programs/placements pages)
- Screenshot capture with Playwright (Docker required for browser)
- Email delivery of daily reports
- Lighthouse performance scoring
- User auth & RBAC
- Reports export (PDF/Excel)

## Backend Testing Results (July 13, 2026)

### Test Execution Summary
**All 10 backend tests PASSED** ✅

Tested by: Testing Agent  
Test file: `/app/backend_test.py`  
Base URL: `https://rival-track-2.preview.emergentagent.com/api`  
Admin email: `muneesh.kumar@lpu.co.in`

### Detailed Test Results

#### 1. Authentication Flow (OTP) ✅
- **POST /api/auth/request-otp**: Successfully returned `devOtp` in dev mode
- **POST /api/auth/verify-otp**: Token obtained, user role confirmed as `admin`
- Status: WORKING

#### 2. Dashboard Unauthorized Access ✅
- **GET /api/dashboard** (without auth): Correctly returns 401
- Status: WORKING

#### 3. Seed Baseline (Admin) ✅
- **POST /api/admin/seed-baseline**: Created 168 changes across 8 universities in 0.4s
- Response shape: `{ ok: true, summary: [8 items] }`
- Total changes: 168 (>100 as required)
- Status: WORKING

#### 4. Dashboard (Authenticated) ✅
- **GET /api/dashboard**: Returns complete dashboard data
- `stats.totalChanges`: 168 (>0 ✓)
- `stats.totalSnapshots`: 16 (≥16 ✓)
- `universities.length`: 8 ✓
- `recentChanges`: 15 items (non-empty ✓)
- Status: WORKING

#### 5. Get Changes ✅
- **GET /api/changes?sinceHours=24&limit=100**: Returns 100 changes
- Each change has required fields: `id`, `universityCode`, `type`, `severity`, `detectedAt`, `pageUrl`
- Status: WORKING

#### 6. Generate Daily Intel (AI) ✅
- **POST /api/ai/daily-intel?force=1**: Generated in 53.7s
- Response includes: `id`, `intel`, `basedOnChanges` (80), `createdAt`
- `intel.headline`: Present ✓
- `intel.competitiveMoves`: 5 items ✓
- `intel.todayForLpu`: 3 items (length 3 ✓)
- `intel.riskSignals`: Present ✓
- `intel.opportunities`: Present ✓
- Status: WORKING

#### 7. Get Latest Daily Intel ✅
- **GET /api/ai/daily-intel/latest**: Returns same document from test 6
- Status: WORKING

#### 8. Compare Universities ✅
- **GET /api/universities**: Returns 8 universities
- **GET /api/compare?aId=<LPU>&bId=<CU>**: Returns comparison data
- `a.snapshot.data.seo.title`: "India's Best Private University in Punjab - LPU" ✓
- `b.snapshot.data.seo.title`: "Best Private University in Punjab, North India (India) - Chandigarh University" ✓
- Both snapshots have complete data
- Status: WORKING

#### 9. PageSpeed All Universities ✅
- **GET /api/pagespeed/all?strategy=mobile**: Returns 8 results
- Response shape: `{ strategy: "mobile", results: [8 items] }`
- Each result has `university` field
- Status: WORKING

#### 10. PageSpeed Single URL (with caching) ✅
- **GET /api/pagespeed?url=https://www.stanford.edu&strategy=mobile**:
  - First call: 23.5s, `cached: false`, scores present (perf: 48, seo: 100, a11y: 100, bp: 77)
  - Second call: 0.2s, `cached: true` ✓
- All scores are integers 0-100 ✓
- `coreWebVitals` present ✓
- Status: WORKING

### Performance Metrics
- Auth flow: <1s
- Seed baseline: 0.4s (168 changes)
- Dashboard: <1s
- Changes query: <1s
- Daily Intel generation: 53.7s (GPT-5 LLM call)
- Compare: <1s
- PageSpeed first call: 23.5s (Google API)
- PageSpeed cached: 0.2s

### Issues Found
**NONE** - All endpoints working as expected with correct response shapes and timing.

### Notes
- All endpoints require authentication except `/api/auth/request-otp`, `/api/auth/verify-otp`, and health check
- OTP-based auth working correctly in dev mode with `devOtp` exposure
- Admin-only endpoints properly protected (seed-baseline tested)
- PageSpeed caching working correctly (24h TTL)
- Daily Intel caching working (20h cache unless `force=1`)
- All response shapes match specifications
- No 4xx/5xx errors encountered during testing
- Seeded data not modified during testing
