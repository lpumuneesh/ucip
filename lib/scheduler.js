// Simple in-process scheduler that runs a daily crawl + executive briefing at 10:00 AM IST.
// Also exposes a manual trigger for external cron systems.

import { crawlSite, diffSnapshots } from './crawler.js'
import { generateExecutiveSummary } from './ai.js'
import { v4 as uuidv4 } from 'uuid'

let _timer = null
let _lastRunAt = null
let _isRunning = false

export function getSchedulerStatus() {
  const next = nextIstRunAt()
  return {
    running: _isRunning,
    lastRunAt: _lastRunAt,
    nextRunAt: next,
    timezone: 'Asia/Kolkata',
    scheduleTime: '10:00 IST',
  }
}

function nextIstRunAt() {
  // Compute next occurrence of 10:00 IST as a UTC Date.
  // IST = UTC+5:30 (no DST). 10:00 IST == 04:30 UTC.
  const now = new Date()
  const target = new Date(now)
  target.setUTCHours(4, 30, 0, 0)
  if (target <= now) target.setUTCDate(target.getUTCDate() + 1)
  return target
}

export async function runDailyJob(db, opts = {}) {
  if (_isRunning) return { ok: false, error: 'already_running' }
  _isRunning = true
  const startedAt = new Date()
  const results = []
  try {
    const unis = await db.collection('universities').find({}).toArray()
    for (const uni of unis) {
      try {
        const r = await crawlSite(uni.url)
        const snapshotId = uuidv4()
        const prev = await db.collection('snapshots')
          .find({ universityId: uni.id }).sort({ createdAt: -1 }).limit(1).toArray()
        const prevData = prev[0]?.data
        const diff = diffSnapshots(prevData, r)

        await db.collection('snapshots').insertOne({
          id: snapshotId,
          universityId: uni.id,
          universityCode: uni.code,
          universityName: uni.name,
          url: uni.url,
          createdAt: startedAt,
          ok: r.ok,
          elapsedMs: r.elapsedMs,
          status: r.status || 0,
          bytesFetched: r.bytesFetched || 0,
          data: r.ok ? r : null,
          errors: r.errors || [],
        })

        if (r.ok && !diff.isFirstSnapshot && diff.changes.length > 0) {
          const pages = r.pages || {}
          const changeDocs = diff.changes.map(c => {
            const pk = c.page || 'home'
            const p = pages[pk]
            return {
              id: uuidv4(),
              universityId: uni.id,
              universityCode: uni.code,
              universityName: uni.name,
              snapshotId,
              previousSnapshotId: prev[0].id,
              detectedAt: startedAt,
              previousSnapshotDate: prev[0].createdAt,
              pageUrl: p?.finalUrl || p?.url || uni.url,
              ...c,
            }
          })
          await db.collection('changes').insertMany(changeDocs)
        }

        if (r.ok) {
          await db.collection('universities').updateOne({ id: uni.id }, {
            $set: {
              lastCrawledAt: startedAt,
              health: {
                status: 'healthy',
                seoScore: r.seo?.seoScore || 0,
                lastMs: r.elapsedMs,
                changes: diff.changeCount,
                pageCount: r.pageCount || 1,
                coverage: r.coverage || ['home'],
                lastOkAt: startedAt,
              }
            }
          })
        } else {
          const existing = uni.health || {}
          await db.collection('universities').updateOne({ id: uni.id }, {
            $set: {
              lastCrawledAt: startedAt,
              health: { ...existing, status: 'stale', lastError: (r.errors || []).join('; '), lastFailedAt: startedAt, lastMs: r.elapsedMs }
            }
          })
        }

        await db.collection('crawler_logs').insertOne({
          id: uuidv4(),
          universityId: uni.id,
          universityName: uni.name,
          ok: r.ok, status: r.status || 0, elapsedMs: r.elapsedMs,
          createdAt: startedAt, changes: diff.changeCount, errors: r.errors || [],
          source: opts.source || 'scheduler',
        })

        results.push({ code: uni.code, ok: r.ok, changes: diff.changeCount })
      } catch (e) {
        results.push({ code: uni.code, ok: false, error: e.message })
      }
    }

    // After all crawls, regenerate the executive briefing if any changes
    try {
      const snapshots = []
      for (const u of await db.collection('universities').find({}).toArray()) {
        const s = await db.collection('snapshots').find({ universityId: u.id }).sort({ createdAt: -1 }).limit(1).toArray()
        snapshots.push({ name: u.name, code: u.code, data: s[0]?.data })
      }
      const changes = await db.collection('changes').find({ detectedAt: { $gte: new Date(Date.now() - 48*3600*1000) } }).sort({ detectedAt: -1 }).limit(50).toArray()
      const summary = await generateExecutiveSummary({ snapshots, changes })
      await db.collection('executive_summaries').insertOne({ id: uuidv4(), summary, createdAt: new Date() })
    } catch (e) {
      console.error('exec briefing generation failed:', e.message)
    }

    _lastRunAt = startedAt
    return { ok: true, crawled: results.length, results }
  } finally {
    _isRunning = false
  }
}

export function startScheduler(getDb) {
  if (_timer) return
  const tick = async () => {
    try {
      const now = new Date()
      const utcH = now.getUTCHours(), utcM = now.getUTCMinutes()
      // 10:00 IST == 04:30 UTC. Fire if within [04:30, 04:35) UTC and not already run in last 22h.
      const inWindow = utcH === 4 && utcM >= 30 && utcM < 35
      const alreadyRunRecently = _lastRunAt && (Date.now() - new Date(_lastRunAt).getTime()) < 22 * 3600 * 1000
      if (inWindow && !alreadyRunRecently && !_isRunning) {
        const db = await getDb()
        console.log('[scheduler] Firing daily job at', now.toISOString())
        await runDailyJob(db, { source: 'scheduler' })
      }
    } catch (e) { console.error('[scheduler tick] error:', e.message) }
  }
  // Check every 60 seconds
  _timer = setInterval(tick, 60 * 1000)
  tick() // immediate check
  console.log('[scheduler] Started (10 AM IST = 04:30 UTC daily)')
}
