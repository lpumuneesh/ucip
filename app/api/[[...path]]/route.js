import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import { SEED_UNIVERSITIES } from '@/lib/universities'
import { crawlSite, diffSnapshots } from '@/lib/crawler'
import { generateBenchmark, generateExecutiveSummary, generateDailyIntel } from '@/lib/ai'
import { sendOtpEmail, hashCode, generateOtp, generateToken, isAllowedEmail, ALLOWED_DOMAIN, getSessionUser } from '@/lib/auth'
import { startScheduler, runDailyJob, getSchedulerStatus } from '@/lib/scheduler'

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
    // Start the scheduler once DB is ready
    startScheduler(async () => db)
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
  // Seed initial admin users from env
  const adminEmails = (process.env.INITIAL_ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  for (const email of adminEmails) {
    const existing = await db.collection('users').findOne({ email })
    if (!existing) {
      await db.collection('users').insertOne({
        id: uuidv4(),
        email,
        name: email.split('@')[0],
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        invitedBy: 'system',
      })
    } else if (existing.role !== 'admin' || existing.status !== 'active') {
      await db.collection('users').updateOne(
        { email },
        { $set: { role: 'admin', status: 'active', updatedAt: new Date() } }
      )
    }
  }
  // Create indexes
  try {
    await db.collection('users').createIndex({ email: 1 }, { unique: true })
    await db.collection('sessions').createIndex({ token: 1 }, { unique: true })
    await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    await db.collection('otps').createIndex({ email: 1 })
    await db.collection('otps').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  } catch {}
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
    const pages = result.pages || {}
    const prevSnapshotDate = prev[0].createdAt
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
        previousSnapshotDate: prevSnapshotDate,
        pageUrl,
        ...c,
      }
    })
    await db.collection('changes').insertMany(changeDocs)
  }

  // Update university health — preserve last-good data on transient fetch failures
  if (result.ok) {
    const health = { status: 'healthy', seoScore: result.seo?.seoScore || 0, lastMs: result.elapsedMs, changes: diff.changeCount, pageCount: result.pageCount || 1, coverage: result.coverage || ['home'], lastOkAt: startedAt }
    await db.collection('universities').updateOne(
      { id: uni.id },
      { $set: { lastCrawledAt: startedAt, health } }
    )
  } else {
    // Fetch failed — mark stale but keep previous seo/pages data so the dashboard stays informative
    const existing = uni.health || {}
    const stale = { ...existing, status: 'stale', lastError: (result.errors || []).join('; '), lastFailedAt: startedAt, lastMs: result.elapsedMs }
    await db.collection('universities').updateOne(
      { id: uni.id },
      { $set: { lastCrawledAt: startedAt, health: stale } }
    )
  }

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

    // ==== AUTH ROUTES (public) ====
    // POST /api/auth/request-otp { email }
    if (route === '/auth/request-otp' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const email = String(body.email || '').trim().toLowerCase()

      if (!isAllowedEmail(email)) {
        return handleCORS(NextResponse.json({ error: `Only @${ALLOWED_DOMAIN} email addresses are allowed.` }, { status: 400 }))
      }

      // Check user exists and is active (block revoked users). Auto-provision on first login.
      let user = await db.collection('users').findOne({ email })
      if (user && user.status === 'revoked') {
        return handleCORS(NextResponse.json({ error: 'Your access has been revoked. Contact an admin.' }, { status: 403 }))
      }
      if (!user) {
        // Auto-provision as regular user
        user = {
          id: uuidv4(),
          email,
          name: email.split('@')[0],
          role: 'user',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
          invitedBy: 'self',
        }
        await db.collection('users').insertOne(user)
      }

      // Rate limit: max 3 OTPs per email per 10 minutes
      const recent = await db.collection('otps').countDocuments({
        email,
        createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
      })
      if (recent >= 3) {
        return handleCORS(NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 }))
      }

      // Invalidate previous OTPs for this email
      await db.collection('otps').deleteMany({ email })

      const code = generateOtp()
      const codeHash = hashCode(code, email)
      await db.collection('otps').insertOne({
        id: uuidv4(),
        email,
        codeHash,
        used: false,
        attempts: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      })

      const mailResult = await sendOtpEmail(email, code)
      // If SMTP not configured, expose the OTP in the response so the flow is testable.
      const payload = { ok: true, sent: mailResult.sent }
      if (mailResult.dev) payload.devOtp = code
      return handleCORS(NextResponse.json(payload))
    }

    // POST /api/auth/verify-otp { email, otp }
    if (route === '/auth/verify-otp' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const email = String(body.email || '').trim().toLowerCase()
      const otp = String(body.otp || '').trim()
      if (!isAllowedEmail(email) || !/^\d{6}$/.test(otp)) {
        return handleCORS(NextResponse.json({ error: 'Invalid email or OTP.' }, { status: 400 }))
      }
      const record = await db.collection('otps').findOne({ email, used: false })
      if (!record) return handleCORS(NextResponse.json({ error: 'No OTP requested. Request a new code.' }, { status: 400 }))
      if (new Date(record.expiresAt) < new Date()) return handleCORS(NextResponse.json({ error: 'OTP expired. Request a new code.' }, { status: 400 }))
      if (record.attempts >= 5) return handleCORS(NextResponse.json({ error: 'Too many wrong attempts. Request a new code.' }, { status: 429 }))

      const provided = hashCode(otp, email)
      if (provided !== record.codeHash) {
        await db.collection('otps').updateOne({ _id: record._id }, { $inc: { attempts: 1 } })
        return handleCORS(NextResponse.json({ error: 'Incorrect code.' }, { status: 400 }))
      }

      const user = await db.collection('users').findOne({ email })
      if (!user || user.status !== 'active') {
        return handleCORS(NextResponse.json({ error: 'Access revoked. Contact an admin.' }, { status: 403 }))
      }

      await db.collection('otps').updateOne({ _id: record._id }, { $set: { used: true } })

      const token = generateToken()
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      await db.collection('sessions').insertOne({
        id: uuidv4(),
        token,
        userId: user.id,
        email: user.email,
        role: user.role,
        createdAt: new Date(),
        expiresAt,
      })
      await db.collection('users').updateOne({ id: user.id }, { $set: { lastLoginAt: new Date() } })

      return handleCORS(NextResponse.json({
        ok: true,
        token,
        expiresAt,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      }))
    }

    // POST /api/auth/logout (requires auth)
    if (route === '/auth/logout' && method === 'POST') {
      const auth = request.headers.get('authorization') || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
      if (token) await db.collection('sessions').deleteOne({ token })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // GET /api/auth/me
    if (route === '/auth/me' && method === 'GET') {
      const user = await getSessionUser(db, request)
      if (!user) return handleCORS(NextResponse.json({ user: null }))
      return handleCORS(NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status },
      }))
    }

    // Health check (public)
    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(NextResponse.json({ service: 'UCIP', ok: true }))
    }

    // ==== AUTH GUARD for everything below ====
    const currentUser = await getSessionUser(db, request)
    if (!currentUser) {
      return handleCORS(NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }))
    }

    // ==== ADMIN ROUTES ====
    const requireAdmin = () => {
      if (currentUser.role !== 'admin') {
        return handleCORS(NextResponse.json({ error: 'Admin access required.' }, { status: 403 }))
      }
      return null
    }

    // GET /api/admin/users
    if (route === '/admin/users' && method === 'GET') {
      const err = requireAdmin(); if (err) return err
      const users = await db.collection('users').find({}).sort({ createdAt: -1 }).toArray()
      return handleCORS(NextResponse.json(users.map(clean)))
    }
    // POST /api/admin/users  { email, name?, role }
    if (route === '/admin/users' && method === 'POST') {
      const err = requireAdmin(); if (err) return err
      const body = await request.json().catch(() => ({}))
      const email = String(body.email || '').trim().toLowerCase()
      const role = body.role === 'admin' ? 'admin' : 'user'
      if (!isAllowedEmail(email)) {
        return handleCORS(NextResponse.json({ error: `Only @${ALLOWED_DOMAIN} emails allowed.` }, { status: 400 }))
      }
      const existing = await db.collection('users').findOne({ email })
      if (existing) return handleCORS(NextResponse.json({ error: 'User already exists.' }, { status: 400 }))
      const doc = {
        id: uuidv4(), email, name: body.name || email.split('@')[0], role, status: 'active',
        createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null, invitedBy: currentUser.email,
      }
      await db.collection('users').insertOne(doc)
      return handleCORS(NextResponse.json(clean(doc)))
    }
    // PATCH /api/admin/users/:id  { role?, status?, name? }
    if (route.startsWith('/admin/users/') && method === 'PATCH') {
      const err = requireAdmin(); if (err) return err
      const id = route.split('/').pop()
      const body = await request.json().catch(() => ({}))
      const upd = { updatedAt: new Date() }
      if (body.role && ['admin', 'user'].includes(body.role)) upd.role = body.role
      if (body.status && ['active', 'revoked'].includes(body.status)) upd.status = body.status
      if (typeof body.name === 'string') upd.name = body.name
      // Prevent self-lockout: an admin cannot demote/revoke themselves if they're the only admin
      if (id === currentUser.id && (upd.role === 'user' || upd.status === 'revoked')) {
        const admins = await db.collection('users').countDocuments({ role: 'admin', status: 'active' })
        if (admins <= 1) return handleCORS(NextResponse.json({ error: 'Cannot lock out the last active admin.' }, { status: 400 }))
      }
      await db.collection('users').updateOne({ id }, { $set: upd })
      // If revoking, kill their sessions
      if (upd.status === 'revoked') await db.collection('sessions').deleteMany({ userId: id })
      const updated = await db.collection('users').findOne({ id })
      return handleCORS(NextResponse.json(clean(updated)))
    }
    // DELETE /api/admin/users/:id
    if (route.startsWith('/admin/users/') && method === 'DELETE') {
      const err = requireAdmin(); if (err) return err
      const id = route.split('/').pop()
      if (id === currentUser.id) {
        return handleCORS(NextResponse.json({ error: 'You cannot delete yourself.' }, { status: 400 }))
      }
      await db.collection('users').deleteOne({ id })
      await db.collection('sessions').deleteMany({ userId: id })
      return handleCORS(NextResponse.json({ ok: true }))
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

    // GET /api/changes?limit=100&universityId=..&sinceHours=24
    if (route === '/changes' && method === 'GET') {
      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '100')
      const universityId = searchParams.get('universityId')
      const sinceHours = parseInt(searchParams.get('sinceHours') || '0')
      const q = {}
      if (universityId) q.universityId = universityId
      if (sinceHours > 0) q.detectedAt = { $gte: new Date(Date.now() - sinceHours * 3600 * 1000) }
      const changes = await db.collection('changes').find(q).sort({ detectedAt: -1 }).limit(limit).toArray()
      return handleCORS(NextResponse.json(changes.map(clean)))
    }

    // GET /api/audit/:universityId — SEO + performance breakdown
    if (route.startsWith('/audit/') && method === 'GET') {
      const id = route.split('/').pop()
      const uni = await db.collection('universities').findOne({ id })
      if (!uni) return handleCORS(NextResponse.json({ error: 'university not found' }, { status: 404 }))
      const snap = await db.collection('snapshots').find({ universityId: id }).sort({ createdAt: -1 }).limit(1).toArray()
      const s = snap[0]
      if (!s || !s.data) return handleCORS(NextResponse.json({ error: 'no snapshot' }, { status: 404 }))

      const pages = s.data.pages || { home: { seo: s.data.seo, structure: s.data.structure } }
      const seoAudit = []
      const performance = []
      for (const [key, p] of Object.entries(pages)) {
        if (!p || !p.ok) continue
        const seo = p.seo || {}; const st = p.structure || {}
        const t = seo.title || ''; const d = seo.description || ''
        const factors = [
          { name: 'Title tag', ok: t.length >= 30 && t.length <= 70, value: t ? `"${t}" (${t.length} chars)` : 'MISSING', ideal: '30-70 chars', weight: 15, source: 'HTML <title>' },
          { name: 'Meta description', ok: d.length >= 70 && d.length <= 180, value: d ? `"${d.slice(0,120)}${d.length>120?'…':''}" (${d.length} chars)` : 'MISSING', ideal: '70-180 chars', weight: 15, source: 'HTML <meta name="description">' },
          { name: 'Canonical URL', ok: !!seo.canonical, value: seo.canonical || 'MISSING', ideal: 'Present, absolute URL', weight: 10, source: 'HTML <link rel="canonical">' },
          { name: 'H1 heading count', ok: (seo.h1?.length || 0) >= 1 && (seo.h1?.length || 0) <= 3, value: `${seo.h1?.length || 0} found: ${(seo.h1||[]).slice(0,3).join(' | ') || '—'}`, ideal: '1–3 per page', weight: 15, source: 'HTML <h1> tags' },
          { name: 'OG Title', ok: !!seo.ogTitle, value: seo.ogTitle || 'MISSING', ideal: 'Present for social sharing', weight: 10, source: 'HTML <meta property="og:title">' },
          { name: 'OG Image', ok: !!seo.ogImage, value: seo.ogImage || 'MISSING', ideal: 'Present, 1200x630 preferred', weight: 5, source: 'HTML <meta property="og:image">' },
          { name: 'Twitter Card', ok: !!seo.twitterCard, value: seo.twitterCard || 'MISSING', ideal: 'summary_large_image', weight: 5, source: 'HTML <meta name="twitter:card">' },
          { name: 'Structured data (JSON-LD)', ok: (seo.schemaCount || 0) > 0, value: `${seo.schemaCount || 0} block(s)`, ideal: '≥1 schema.org block', weight: 10, source: 'HTML <script type="application/ld+json">' },
          { name: 'Image alt coverage', ok: (seo.altCoverage || 0) >= 70, value: `${seo.altCoverage || 0}%`, ideal: '≥70%', weight: 15, source: 'HTML <img alt="…">' },
        ]
        const gained = factors.reduce((a, f) => a + (f.ok ? f.weight : 0), 0)
        seoAudit.push({
          page: key, url: p.finalUrl || p.url, title: t,
          seoScore: seo.seoScore || gained,
          factors,
        })
        performance.push({
          page: key,
          url: p.finalUrl || p.url,
          status: p.status,
          bytes: p.bytes || 0,
          images: st.images || 0,
          scripts: st.scripts || 0,
          links: st.links || 0,
          altCoverage: seo.altCoverage || 0,
        })
      }

      return handleCORS(NextResponse.json({
        university: clean(uni),
        latestSnapshot: {
          id: s.id,
          createdAt: s.createdAt,
          elapsedMs: s.elapsedMs,
          bytesFetched: s.bytesFetched,
          pageCount: s.data.pageCount,
        },
        seoAudit,
        performance,
      }))
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

    // GET /api/pagespeed?url=... — Google PageSpeed Insights (Core Web Vitals + Lighthouse)
    if (route === '/pagespeed' && method === 'GET') {
      const { searchParams } = new URL(request.url)
      const target = searchParams.get('url')
      const strategy = searchParams.get('strategy') || 'mobile'
      const force = searchParams.get('force') === '1'
      if (!target) return handleCORS(NextResponse.json({ error: 'url required' }, { status: 400 }))
      // Serve from cache if fresh (<24h)
      const cached = await db.collection('pagespeed_cache').findOne({ url: target, strategy })
      if (cached && !force && (Date.now() - new Date(cached.createdAt).getTime()) < 24 * 3600 * 1000) {
        return handleCORS(NextResponse.json({ ...cached.result, cached: true, fetchedAt: cached.createdAt }))
      }
      const psUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
      psUrl.searchParams.set('url', target)
      psUrl.searchParams.set('strategy', strategy)
      for (const c of ['performance','seo','accessibility','best-practices']) psUrl.searchParams.append('category', c)
      if (process.env.PAGESPEED_API_KEY) psUrl.searchParams.set('key', process.env.PAGESPEED_API_KEY)
      try {
        const res = await fetch(psUrl.toString(), { signal: AbortSignal.timeout(45000) })
        if (!res.ok) {
          const txt = await res.text()
          return handleCORS(NextResponse.json({ error: `PageSpeed API ${res.status}: ${txt.slice(0,200)}` }, { status: res.status }))
        }
        const data = await res.json()
        const lh = data.lighthouseResult || {}
        const cats = lh.categories || {}
        const audits = lh.audits || {}
        const num = (k) => audits[k]?.numericValue
        const disp = (k) => audits[k]?.displayValue
        const summary = {
          fetchTime: lh.fetchTime,
          strategy,
          finalUrl: lh.finalUrl,
          scores: {
            performance: Math.round((cats.performance?.score || 0) * 100),
            accessibility: Math.round((cats.accessibility?.score || 0) * 100),
            bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
            seo: Math.round((cats.seo?.score || 0) * 100),
          },
          coreWebVitals: {
            lcp: { value: num('largest-contentful-paint'), display: disp('largest-contentful-paint') },
            cls: { value: num('cumulative-layout-shift'), display: disp('cumulative-layout-shift') },
            fcp: { value: num('first-contentful-paint'), display: disp('first-contentful-paint') },
            tbt: { value: num('total-blocking-time'), display: disp('total-blocking-time') },
            si:  { value: num('speed-index'), display: disp('speed-index') },
            inp: { value: num('interactive'), display: disp('interactive') },
          },
          opportunities: (lh.categories?.performance?.auditRefs || [])
            .filter(a => a.group === 'load-opportunities')
            .map(a => audits[a.id])
            .filter(a => a && a.score !== null && a.score < 0.9)
            .slice(0, 8)
            .map(a => ({ id: a.id, title: a.title, description: a.description, displayValue: a.displayValue, savingsMs: a.details?.overallSavingsMs })),
        }
        // Persist to cache
        try {
          await db.collection('pagespeed_cache').updateOne(
            { url: target, strategy },
            { $set: { url: target, strategy, result: summary, createdAt: new Date() } },
            { upsert: true }
          )
        } catch {}
        return handleCORS(NextResponse.json(summary))
      } catch (e) {
        return handleCORS(NextResponse.json({ error: 'PageSpeed fetch failed: ' + e.message }, { status: 500 }))
      }
    }

    // GET /api/scheduler/status
    if (route === '/scheduler/status' && method === 'GET') {
      return handleCORS(NextResponse.json(getSchedulerStatus()))
    }
    // POST /api/scheduler/run  { source?: 'manual' | 'external-cron' } — protected by session or CRON_SECRET
    if (route === '/scheduler/run' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const secret = request.headers.get('x-cron-secret')
      const okBySecret = process.env.CRON_SECRET && secret === process.env.CRON_SECRET
      if (!okBySecret && (!currentUser || currentUser.role !== 'admin')) {
        return handleCORS(NextResponse.json({ error: 'admin or CRON_SECRET required' }, { status: 403 }))
      }
      const r = await runDailyJob(db, { source: body.source || (okBySecret ? 'external-cron' : 'manual') })
      return handleCORS(NextResponse.json(r))
    }

    // GET /api/screenshot?url=... — proxy to WordPress mShots (free, no key required)
    if (route === '/screenshot' && method === 'GET') {
      const { searchParams } = new URL(request.url)
      const target = searchParams.get('url')
      const w = parseInt(searchParams.get('w') || '1200')
      const h = parseInt(searchParams.get('h') || '800')
      if (!target) return handleCORS(NextResponse.json({ error: 'url required' }, { status: 400 }))
      const shotUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(target)}?w=${w}&h=${h}`
      return handleCORS(NextResponse.json({ url: shotUrl }))
    }

    // POST /api/ai/action-plan — Aggregated LPU improvement plan across all competitors
    if (route === '/ai/action-plan' && method === 'POST') {
      const reports = await db.collection('ai_reports').find({}).sort({ createdAt: -1 }).limit(20).toArray()
      if (reports.length === 0) {
        return handleCORS(NextResponse.json({ error: 'Generate at least one AI benchmark first.' }, { status: 400 }))
      }
      const { generateLpuActionPlan } = await import('@/lib/ai')
      const plan = await generateLpuActionPlan({ reports })
      const doc = { id: uuidv4(), plan, basedOnReports: reports.map(r => r.competitorCode), createdAt: new Date() }
      await db.collection('action_plans').insertOne(doc)
      return handleCORS(NextResponse.json(clean(doc)))
    }
    // GET /api/ai/action-plan/latest
    if (route === '/ai/action-plan/latest' && method === 'GET') {
      const r = await db.collection('action_plans').find({}).sort({ createdAt: -1 }).limit(1).toArray()
      return handleCORS(NextResponse.json(clean(r[0]) || null))
    }

    // ================== DAILY COMPETITIVE INTELLIGENCE ==================
    // GET /api/ai/daily-intel/latest — cached; auto-refresh if older than 20h
    if (route === '/ai/daily-intel/latest' && method === 'GET') {
      const r = await db.collection('daily_intel').find({}).sort({ createdAt: -1 }).limit(1).toArray()
      return handleCORS(NextResponse.json(clean(r[0]) || null))
    }
    // POST /api/ai/daily-intel — regenerate now (respects 20h cache unless force=1)
    if (route === '/ai/daily-intel' && method === 'POST') {
      const { searchParams } = new URL(request.url)
      const force = searchParams.get('force') === '1'
      const existing = await db.collection('daily_intel').find({}).sort({ createdAt: -1 }).limit(1).toArray()
      const cacheOk = existing[0] && (Date.now() - new Date(existing[0].createdAt).getTime()) < 20 * 3600 * 1000
      if (cacheOk && !force) {
        return handleCORS(NextResponse.json(clean(existing[0])))
      }
      const changes = await db.collection('changes').find({
        detectedAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) }
      }).sort({ detectedAt: -1 }).limit(80).toArray()
      const intel = await generateDailyIntel({ changes })
      const doc = { id: uuidv4(), intel, basedOnChanges: changes.length, createdAt: new Date() }
      await db.collection('daily_intel').insertOne(doc)
      return handleCORS(NextResponse.json(clean(doc)))
    }

    // ================== SIDE-BY-SIDE COMPARE ==================
    // GET /api/compare?aId=&bId=
    if (route === '/compare' && method === 'GET') {
      const { searchParams } = new URL(request.url)
      const aId = searchParams.get('aId'); const bId = searchParams.get('bId')
      if (!aId || !bId) return handleCORS(NextResponse.json({ error: 'aId and bId required' }, { status: 400 }))
      const uniA = await db.collection('universities').findOne({ id: aId })
      const uniB = await db.collection('universities').findOne({ id: bId })
      if (!uniA || !uniB) return handleCORS(NextResponse.json({ error: 'university not found' }, { status: 404 }))
      const sa = await db.collection('snapshots').find({ universityId: aId, ok: true }).sort({ createdAt: -1 }).limit(1).toArray()
      const sb = await db.collection('snapshots').find({ universityId: bId, ok: true }).sort({ createdAt: -1 }).limit(1).toArray()
      // Attach cached pagespeed if available
      const psA = await db.collection('pagespeed_cache').findOne({ url: uniA.url, strategy: 'mobile' })
      const psB = await db.collection('pagespeed_cache').findOne({ url: uniB.url, strategy: 'mobile' })
      return handleCORS(NextResponse.json({
        a: { university: clean(uniA), snapshot: clean(sa[0]) || null, pagespeed: psA ? { ...psA.result, cached: true, fetchedAt: psA.createdAt } : null },
        b: { university: clean(uniB), snapshot: clean(sb[0]) || null, pagespeed: psB ? { ...psB.result, cached: true, fetchedAt: psB.createdAt } : null },
      }))
    }

    // GET /api/pagespeed/all?strategy=mobile — return cached PS for every uni
    if (route === '/pagespeed/all' && method === 'GET') {
      const { searchParams } = new URL(request.url)
      const strategy = searchParams.get('strategy') || 'mobile'
      const unis = await db.collection('universities').find({}).sort({ primary: -1, name: 1 }).toArray()
      const results = []
      for (const u of unis) {
        const cached = await db.collection('pagespeed_cache').findOne({ url: u.url, strategy })
        results.push({
          university: clean(u),
          pagespeed: cached ? { ...cached.result, cached: true, fetchedAt: cached.createdAt } : null,
        })
      }
      return handleCORS(NextResponse.json({ strategy, results }))
    }

    // ================== ADMIN: SEED BASELINE (creates yesterday-vs-today diffs) ==================
    // POST /api/admin/seed-baseline — Creates a synthetic prior snapshot for each uni so the diff engine
    // has meaningful before/after data to display. Uses REAL current crawled content as the source, then
    // mutates a handful of fields (title suffix, first H1, one CTA, one nav item, one stat, hero image URL,
    // meta description) to simulate a realistic day-over-day competitor move.
    if (route === '/admin/seed-baseline' && method === 'POST') {
      const err = requireAdmin(); if (err) return err
      const unis = await db.collection('universities').find({}).toArray()
      const summary = []
      for (const uni of unis) {
        const latest = await db.collection('snapshots').find({ universityId: uni.id, ok: true }).sort({ createdAt: -1 }).limit(1).toArray()
        if (!latest[0] || !latest[0].data) { summary.push({ code: uni.code, skipped: 'no snapshot yet' }); continue }
        const curr = latest[0]
        const prevData = JSON.parse(JSON.stringify(curr.data))

        // Mutate top-level (home) fields
        if (prevData.seo?.title) prevData.seo.title = prevData.seo.title.replace(/\s*[|·-].*$/, '') + ' | Admissions 2024 Open'
        if (prevData.seo?.description) {
          const d = prevData.seo.description
          prevData.seo.description = 'Legacy: ' + d.slice(0, Math.min(120, d.length))
        }
        if (Array.isArray(prevData.seo?.h1) && prevData.seo.h1.length) {
          prevData.seo.h1[0] = 'Welcome — 2024 Batch Applications Now Open'
        }
        if (Array.isArray(prevData.seo?.h2) && prevData.seo.h2.length > 2) {
          prevData.seo.h2 = prevData.seo.h2.slice(1) // drop first H2
        }
        if (prevData.seo?.ogImage) {
          prevData.seo.ogImage = prevData.seo.ogImage.replace(/(\.\w{2,4})(\?.*)?$/, '_legacy$1$2')
        }
        if (Array.isArray(prevData.structure?.ctas) && prevData.structure.ctas.length > 1) {
          prevData.structure.ctas = prevData.structure.ctas.slice(1)
        }
        if (Array.isArray(prevData.structure?.stats) && prevData.structure.stats.length) {
          prevData.structure.stats = ['500+ Legacy Awards'].concat(prevData.structure.stats.slice(1))
        }
        if (Array.isArray(prevData.structure?.nav) && prevData.structure.nav.length > 3) {
          prevData.structure.nav = prevData.structure.nav.slice(0, -1)
        }

        // Mutate each inner page (admissions, programs, placements, etc.)
        if (prevData.pages) {
          const inners = Object.keys(prevData.pages).filter(k => k !== 'home')
          for (const pk of inners) {
            const pg = prevData.pages[pk]
            if (!pg || !pg.ok) continue
            if (pg.seo?.title) pg.seo.title = pg.seo.title + ' — Previous Version'
            if (Array.isArray(pg.seo?.h1) && pg.seo.h1.length) pg.seo.h1[0] = `${pk.charAt(0).toUpperCase()+pk.slice(1)} — Legacy 2024`
            if (Array.isArray(pg.structure?.ctas) && pg.structure.ctas.length > 1) pg.structure.ctas = pg.structure.ctas.slice(1)
            if (pg.seo?.ogImage) pg.seo.ogImage = pg.seo.ogImage.replace(/(\.\w{2,4})(\?.*)?$/, '_legacy$1$2')
          }
          // Simulate a "new page discovered" by removing one inner page from prevData (its current existence = "added")
          if (inners.length >= 3) {
            const dropKey = inners[inners.length - 1]
            delete prevData.pages[dropKey]
          }
        }

        // Delete any prior snapshots for this uni EXCEPT the current one (clean baseline)
        await db.collection('snapshots').deleteMany({ universityId: uni.id, id: { $ne: curr.id } })
        // Delete any prior changes for this uni
        await db.collection('changes').deleteMany({ universityId: uni.id })

        // Insert synthetic prev snapshot backdated ~22 hours ago (so "prev vs curr" is intraday-ish)
        const prevCreatedAt = new Date(Date.now() - 22 * 3600 * 1000)
        const prevSnapshot = {
          id: uuidv4(), universityId: uni.id, universityCode: uni.code, universityName: uni.name, url: uni.url,
          createdAt: prevCreatedAt, ok: true, elapsedMs: curr.elapsedMs || 0, status: 200,
          bytesFetched: curr.bytesFetched || 0, data: prevData, errors: [], synthetic: true,
        }
        await db.collection('snapshots').insertOne(prevSnapshot)

        // Compute diff and insert change docs (detected "now" so they show in Last 24h)
        const diff = diffSnapshots(prevData, curr.data)
        const detectedAt = new Date()
        if (diff.changes.length > 0) {
          const pages = curr.data.pages || {}
          const changeDocs = diff.changes.map(c => {
            const pageKey = c.page || 'home'
            const p = pages[pageKey]
            return {
              id: uuidv4(), universityId: uni.id, universityCode: uni.code, universityName: uni.name,
              snapshotId: curr.id, previousSnapshotId: prevSnapshot.id,
              detectedAt, previousSnapshotDate: prevCreatedAt,
              pageUrl: p?.finalUrl || p?.url || uni.url,
              ...c,
            }
          })
          await db.collection('changes').insertMany(changeDocs)
        }

        // Bump the university's health.changes count to reflect the new baseline
        await db.collection('universities').updateOne({ id: uni.id }, {
          $set: {
            'health.changes': diff.changes.length,
            'health.status': 'healthy',
            'health.pageCount': curr.data?.pageCount || Object.keys(curr.data?.pages || {}).length || 1,
            'health.seoScore': curr.data?.seo?.seoScore || curr.data?.avgSeoScore || 0,
            lastCrawledAt: curr.createdAt,
          }
        })

        summary.push({ code: uni.code, changesCreated: diff.changes.length })
      }
      // Invalidate daily intel so it regenerates
      await db.collection('daily_intel').deleteMany({})
      return handleCORS(NextResponse.json({ ok: true, summary }))
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
