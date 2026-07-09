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

## Key Endpoints
- GET /api/universities
- POST /api/crawl { universityId: 'all' | id }
- GET /api/snapshots?universityId=
- GET /api/snapshots/latest?universityId=
- GET /api/changes
- POST /api/ai/benchmark { competitorId }
- GET /api/ai/reports
- GET /api/ai/reports/latest?competitorId=
- POST /api/ai/executive-summary
- GET /api/ai/executive-summary/latest
- GET /api/dashboard

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
