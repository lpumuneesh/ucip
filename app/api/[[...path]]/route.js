import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import { SEED_UNIVERSITIES } from '@/lib/universities'
import { crawlSite, diffSnapshots } from '@/lib/crawler'
import { generateBenchmark, generateExecutiveSummary } from '@/lib/ai'

let client
let db

async function connectToMongo() {
  if (!client || !db) {
    if (!client) {
      client = new MongoClient(process.env.MONGO_URL)
      await client.connect()
    }
    db = client.db(process.env.DB_NAME)
    await ensureSeed(db)
  }
  return db
}

async function ensureSeed(db) {
  const count = await db.collection('universities').countDocuments()
  if (count === 0) {
    const docs = SEED_UNIVERSITIES.map(u => ({
      id: uuidv4(),
      ...u,
      createdAt: new Date(),
      lastCrawledAt: null,
      health: null,
    }))
    await db.collection('universities').insertMany(docs)
  }
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

function clean(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return rest
}

async function crawlOneUniversity(db, uni) {
  const startedAt = new Date()
  const result = await crawlSite(uni.url)
  const snapshotId = uuidv4()

  // Previous snapshot for diff
  const prev = await db.collection('snapshots')
    .find({ universityId: uni.id })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()

  const prevData = prev[0]?.data
  const diff = diffSnapshots(prevData, result)

  const snapshot = {
    id: snapshotId,
    universityId: uni.id,
    universityCode: uni.code,
    universityName: uni.name,
    url: uni.url,
    createdAt: startedAt,
    ok: result.ok,
    elapsedMs: result.elapsedMs,
    status: result.status || 0,
    bytesFetched: result.bytesFetched || 0,
    data: result.ok ? result : null,
    errors: result.errors || [],
  }
  await db.collection('snapshots').insertOne(snapshot)

  // Store detected changes as individual documents
  if (result.ok && !diff.isFirstSnapshot && diff.changes.length > 0) {
    // Resolve page URL for each change from current snapshot's pages map
    const pages = result.pages || {}
    const changeDocs = diff.changes.map(c => {
      const pageKey = c.page || 'home'
      const p = pages[pageKey]
      const pageUrl = p?.finalUrl || p?.url || (pageKey === 'site' ? uni.url : uni.url)
      return {
        id: uuidv4(),
        universityId: uni.id,
        universityCode: uni.code,
        universityName: uni.name,
        snapshotId,
        previousSnapshotId: prev[0].id,
        detectedAt: startedAt,
        pageUrl,
        ...c,
      }
    })
    await db.collection('changes').insertMany(changeDocs)
  }

  // Update university health
  const health = result.ok
    ? { status: 'healthy', seoScore: result.seo?.seoScore || 0, lastMs: result.elapsedMs, changes: diff.changeCount, pageCount: result.pageCount || 1, coverage: result.coverage || ['home'] }
    : { status: 'error', seoScore: 0, lastMs: result.elapsedMs, changes: 0, pageCount: 0, coverage: [] }

  await db.collection('universities').updateOne(
    { id: uni.id },
    { $set: { lastCrawledAt: startedAt, health } }
  )

  // Crawler log
  await db.collection('crawler_logs').insertOne({
    id: uuidv4(),
    universityId: uni.id,
    universityName: uni.name,
    ok: result.ok,
    status: result.status || 0,
    elapsedMs: result.elapsedMs,
    createdAt: startedAt,
    changes: diff.changeCount,
    errors: result.errors || [],
  })

  return { snapshot, diff }
}

async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await connectToMongo()

    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(NextResponse.json({ service: 'UCIP', ok: true }))
    }

    // GET /api/universities
    if (route === '/universities' && method === 'GET') {
      const list = await db.collection('universities').find({}).sort({ primary: -1, name: 1 }).toArray()
      return handleCORS(NextResponse.json(list.map(clean)))
    }

    // POST /api/crawl  { universityId?: 'all' | id }
    if (route === '/crawl' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const target = body.universityId || 'all'
      const query = target === 'all' ? {} : { id: target }
      const unis = await db.collection('universities').find(query).toArray()
      // Crawl sequentially to respect memory (~512MB heap)
      const results = []
      for (const u of unis) {
        try {
          const r = await crawlOneUniversity(db, u)
          results.push(r)
          // give GC a chance
          if (global.gc) global.gc()
        } catch (e) {
          results.push({ error: e.message, uni: u.code })
        }
      }
      return handleCORS(NextResponse.json({
        ok: true,
        crawled: results.length,
        summary: results.map(r => r.error ? { code: r.uni, error: r.error } : {
          code: r.snapshot.universityCode,
          ok: r.snapshot.ok,
          elapsedMs: r.snapshot.elapsedMs,
          changes: r.diff.changeCount,
          firstSnapshot: r.diff.isFirstSnapshot,
        })
      }))
    }

    // GET /api/snapshots?universityId=...
    if (route === '/snapshots' && method === 'GET') {
      const { searchParams } = new URL(request.url)
      const universityId = searchParams.get('universityId')
      const q = universityId ? { universityId } : {}
      const snaps = await db.collection('snapshots').find(q).sort({ createdAt: -1 }).limit(50).toArray()
      return handleCORS(NextResponse.json(snaps.map(clean)))
    }

    // GET /api/snapshots/latest?universityId=..
    if (route === '/snapshots/latest' && method === 'GET') {
      const { searchParams } = new URL(request.url)
      const universityId = searchParams.get('universityId')
      const snap = await db.collection('snapshots').find({ universityId }).sort({ createdAt: -1 }).limit(1).toArray()
      return handleCORS(NextResponse.json(clean(snap[0]) || null))
    }

    // GET /api/changes?limit=100&universityId=..
    if (route === '/changes' && method === 'GET') {
      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '100')
      const universityId = searchParams.get('universityId')
      const q = universityId ? { universityId } : {}
      const changes = await db.collection('changes').find(q).sort({ detectedAt: -1 }).limit(limit).toArray()
      return handleCORS(NextResponse.json(changes.map(clean)))
    }

    // POST /api/ai/benchmark { competitorId }
    if (route === '/ai/benchmark' && method === 'POST') {
      const body = await request.json()
      const competitorId = body.competitorId
      if (!competitorId) {
        return handleCORS(NextResponse.json({ error: 'competitorId required' }, { status: 400 }))
      }
      const lpu = await db.collection('universities').findOne({ code: 'LPU' })
      const competitor = await db.collection('universities').findOne({ id: competitorId })
      if (!lpu || !competitor) {
        return handleCORS(NextResponse.json({ error: 'university not found' }, { status: 404 }))
      }
      const lpuSnap = await db.collection('snapshots').find({ universityId: lpu.id }).sort({ createdAt: -1 }).limit(1).toArray()
      const compSnap = await db.collection('snapshots').find({ universityId: competitor.id }).sort({ createdAt: -1 }).limit(1).toArray()
      if (!lpuSnap[0] || !compSnap[0]) {
        return handleCORS(NextResponse.json({ error: 'need snapshots for both LPU and competitor. Run crawl first.' }, { status: 400 }))
      }

      const report = await generateBenchmark({
        lpu: { name: lpu.name, code: lpu.code, data: lpuSnap[0].data },
        competitor: { name: competitor.name, code: competitor.code, data: compSnap[0].data },
      })

      const doc = {
        id: uuidv4(),
        competitorId: competitor.id,
        competitorName: competitor.name,
        competitorCode: competitor.code,
        lpuSnapshotId: lpuSnap[0].id,
        competitorSnapshotId: compSnap[0].id,
        report,
        createdAt: new Date(),
      }
      await db.collection('ai_reports').insertOne(doc)
      return handleCORS(NextResponse.json(clean(doc)))
    }

    // GET /api/ai/reports
    if (route === '/ai/reports' && method === 'GET') {
      const reports = await db.collection('ai_reports').find({}).sort({ createdAt: -1 }).limit(50).toArray()
      return handleCORS(NextResponse.json(reports.map(clean)))
    }

    // GET /api/ai/reports/latest?competitorId=..
    if (route === '/ai/reports/latest' && method === 'GET') {
      const { searchParams } = new URL(request.url)
      const competitorId = searchParams.get('competitorId')
      const q = competitorId ? { competitorId } : {}
      const r = await db.collection('ai_reports').find(q).sort({ createdAt: -1 }).limit(1).toArray()
      return handleCORS(NextResponse.json(clean(r[0]) || null))
    }

    // POST /api/ai/executive-summary
    if (route === '/ai/executive-summary' && method === 'POST') {
      const unis = await db.collection('universities').find({}).toArray()
      const snapshots = []
      for (const u of unis) {
        const s = await db.collection('snapshots').find({ universityId: u.id }).sort({ createdAt: -1 }).limit(1).toArray()
        snapshots.push({ name: u.name, code: u.code, data: s[0]?.data })
      }
      const changes = await db.collection('changes').find({}).sort({ detectedAt: -1 }).limit(50).toArray()
      const summary = await generateExecutiveSummary({ snapshots, changes })
      const doc = {
        id: uuidv4(),
        summary,
        createdAt: new Date(),
      }
      await db.collection('executive_summaries').insertOne(doc)
      return handleCORS(NextResponse.json(clean(doc)))
    }

    // GET /api/ai/executive-summary/latest
    if (route === '/ai/executive-summary/latest' && method === 'GET') {
      const r = await db.collection('executive_summaries').find({}).sort({ createdAt: -1 }).limit(1).toArray()
      return handleCORS(NextResponse.json(clean(r[0]) || null))
    }

    // GET /api/dashboard
    if (route === '/dashboard' && method === 'GET') {
      const unis = await db.collection('universities').find({}).sort({ primary: -1, name: 1 }).toArray()
      const totalSnaps = await db.collection('snapshots').countDocuments()
      const totalChanges = await db.collection('changes').countDocuments()
      const totalReports = await db.collection('ai_reports').countDocuments()
      const recentChanges = await db.collection('changes').find({}).sort({ detectedAt: -1 }).limit(15).toArray()
      const recentLogs = await db.collection('crawler_logs').find({}).sort({ createdAt: -1 }).limit(20).toArray()

      // healthy = crawled ok in last 24h
      const healthy = unis.filter(u => u.health?.status === 'healthy').length
      const avgSeo = unis.filter(u => u.health?.seoScore).reduce((a, u) => a + u.health.seoScore, 0) / Math.max(1, unis.filter(u => u.health?.seoScore).length)

      // per-uni changes count (last 100)
      const perUniChanges = {}
      const allChanges = await db.collection('changes').find({}).limit(500).toArray()
      for (const c of allChanges) {
        perUniChanges[c.universityCode] = (perUniChanges[c.universityCode] || 0) + 1
      }

      return handleCORS(NextResponse.json({
        universities: unis.map(clean),
        stats: {
          totalUniversities: unis.length,
          healthyCount: healthy,
          totalSnapshots: totalSnaps,
          totalChanges,
          totalAiReports: totalReports,
          avgSeoScore: Math.round(avgSeo || 0),
        },
        recentChanges: recentChanges.map(clean),
        recentLogs: recentLogs.map(clean),
        perUniChanges,
      }))
    }

    // GET /api/trends?universityId=&days=30
    if (route === '/trends' && method === 'GET') {
      const { searchParams } = new URL(request.url)
      const universityId = searchParams.get('universityId')
      const days = Math.min(365, parseInt(searchParams.get('days') || '30'))
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const snapQuery = universityId ? { universityId, createdAt: { $gte: cutoff } } : { createdAt: { $gte: cutoff } }
      const changeQuery = universityId ? { universityId, detectedAt: { $gte: cutoff } } : { detectedAt: { $gte: cutoff } }

      const snaps = await db.collection('snapshots').find(snapQuery).sort({ createdAt: 1 }).toArray()
      const changes = await db.collection('changes').find(changeQuery).sort({ detectedAt: 1 }).toArray()

      // Build per-snapshot data points and per-day aggregates
      const seoSeries = {}    // universityCode -> [{t, home, avg, pageCount}]
      const changeByDay = {}  // day (YYYY-MM-DD) -> { day, [code]: count, total }

      for (const s of snaps) {
        const code = s.universityCode
        if (!seoSeries[code]) seoSeries[code] = []
        seoSeries[code].push({
          t: s.createdAt,
          snapshotId: s.id,
          home: s.data?.seo?.seoScore ?? null,
          avg: s.data?.avgSeoScore ?? s.data?.seo?.seoScore ?? null,
          pageCount: s.data?.pageCount ?? 1,
        })
      }

      for (const c of changes) {
        const d = new Date(c.detectedAt)
        const day = d.toISOString().slice(0, 10)
        if (!changeByDay[day]) changeByDay[day] = { day, total: 0 }
        changeByDay[day][c.universityCode] = (changeByDay[day][c.universityCode] || 0) + 1
        changeByDay[day].total += 1
      }

      // Severity mix
      const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 }
      for (const c of changes) severityCounts[c.severity] = (severityCounts[c.severity] || 0) + 1

      // Type mix
      const typeCounts = {}
      for (const c of changes) typeCounts[c.type] = (typeCounts[c.type] || 0) + 1

      // Per-university totals
      const perUni = {}
      for (const c of changes) {
        perUni[c.universityCode] = (perUni[c.universityCode] || 0) + 1
      }

      return handleCORS(NextResponse.json({
        rangeDays: days,
        totalSnapshots: snaps.length,
        totalChanges: changes.length,
        seoSeries,
        changeByDay: Object.values(changeByDay).sort((a, b) => a.day.localeCompare(b.day)),
        severityCounts,
        typeCounts,
        perUniChanges: perUni,
      }))
    }

    return handleCORS(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute

export const maxDuration = 300
