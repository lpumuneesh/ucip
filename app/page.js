'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, AlertCircle, ArrowUpRight, BarChart3, Bot, CheckCircle2, ChevronRight,
  Command as CommandIcon, Download, ExternalLink, Eye, FileText, Globe,
  GraduationCap, Layers, LineChart as LineChartIcon, Loader2, Minus,
  Plus, RefreshCw, Search, Send, ShieldCheck, Sparkles, TrendingUp,
  Zap, Building2, Calendar, Bell, Filter, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { toast } from 'sonner'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts'

const api = (path, opts = {}) =>
  fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  }).then(async r => {
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || r.statusText)
    return j
  })

function cx(...c) { return c.filter(Boolean).join(' ') }

function AnimatedCounter({ value, duration = 900, prefix = '', suffix = '' }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf; const start = performance.now(); const from = 0; const to = Number(value) || 0
    const step = t => {
      const p = Math.min(1, (t - start) / duration)
      setN(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <span>{prefix}{n.toLocaleString()}{suffix}</span>
}

function StatusChip({ status }) {
  const map = {
    healthy: { c: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'Healthy' },
    error:   { c: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Error' },
    idle:    { c: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30', label: 'Idle' },
  }
  const s = map[status] || map.idle
  return <span className={cx('px-2 py-0.5 text-[10px] font-medium rounded-full border', s.c)}>{s.label}</span>
}

function SeverityChip({ severity }) {
  const map = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/40',
    high:     'bg-orange-500/15 text-orange-400 border-orange-500/40',
    medium:   'bg-amber-500/15 text-amber-400 border-amber-500/40',
    low:      'bg-sky-500/15 text-sky-400 border-sky-500/40',
  }
  return <span className={cx('px-2 py-0.5 text-[10px] font-medium rounded-full border', map[severity] || map.low)}>{severity}</span>
}

function Glass({ className, children }) {
  return (
    <div className={cx(
      'relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl',
      'shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_20px_60px_-30px_rgba(0,0,0,0.7)]',
      className
    )}>
      {children}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, tint = 'from-indigo-500/20 to-violet-500/10', accent = 'text-indigo-300' }) {
  return (
    <Glass className="p-5 overflow-hidden group">
      <div className={cx('absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-60 bg-gradient-to-br', tint)} />
      <div className="flex items-start justify-between relative">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-400">{label}</div>
          <div className="text-3xl font-semibold mt-1 tabular-nums">
            <AnimatedCounter value={value} />
          </div>
          {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
        </div>
        <div className={cx('h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center', accent)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Glass>
  )
}

function UniversityCard({ uni, onView, onBenchmark, benchmarking }) {
  const seo = uni.health?.seoScore || 0
  const status = uni.health?.status || 'idle'
  const changes = uni.health?.changes || 0
  const pageCount = uni.health?.pageCount || 0
  return (
    <Glass className="p-4 hover:border-white/20 transition group">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white text-sm font-semibold shrink-0" style={{ background: `linear-gradient(135deg, ${uni.color}, ${uni.color}90)` }}>
          {uni.code.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium truncate">{uni.name}</div>
            {uni.primary && <Badge variant="secondary" className="text-[10px] bg-indigo-500/15 text-indigo-300 border-indigo-500/30">Primary</Badge>}
          </div>
          <div className="text-xs text-zinc-500 truncate flex items-center gap-1">
            <Globe className="h-3 w-3" />{uni.url.replace(/^https?:\/\//, '')}
          </div>
        </div>
        <StatusChip status={status} />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
        <div>
          <div className="text-zinc-500">SEO</div>
          <div className="font-semibold tabular-nums">{seo}<span className="text-zinc-500">/100</span></div>
          <Progress value={seo} className="h-1 mt-1" />
        </div>
        <div>
          <div className="text-zinc-500">Pages</div>
          <div className="font-semibold tabular-nums text-indigo-300">{pageCount}</div>
        </div>
        <div>
          <div className="text-zinc-500">Changes</div>
          <div className="font-semibold tabular-nums text-orange-300">{changes}</div>
        </div>
        <div>
          <div className="text-zinc-500">Last</div>
          <div className="font-semibold text-xs">
            {uni.lastCrawledAt ? new Date(uni.lastCrawledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1 h-8 bg-white/10 hover:bg-white/20 text-zinc-100 hover:text-white border border-white/10" onClick={() => onView(uni)}>
          <Eye className="h-3.5 w-3.5 mr-1" />View
        </Button>
        {!uni.primary && (
          <Button size="sm" className="flex-1 h-8 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white shadow-md" onClick={() => onBenchmark(uni)} disabled={benchmarking === uni.id}>
            {benchmarking === uni.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            AI Benchmark
          </Button>
        )}
      </div>
    </Glass>
  )
}

function ChangeRow({ c }) {
  const [open, setOpen] = useState(false)
  const shortUrl = c.pageUrl ? c.pageUrl.replace(/^https?:\/\//, '').slice(0, 60) : null
  return (
    <div className="border border-white/5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition">
      <button onClick={() => setOpen(!open)} className="w-full text-left p-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          {c.type === 'title' || c.type === 'description' ? <FileText className="h-4 w-4 text-blue-300" /> :
           c.type === 'navigation' ? <Layers className="h-4 w-4 text-purple-300" /> :
           c.type === 'ctas' ? <Zap className="h-4 w-4 text-yellow-300" /> :
           c.type === 'new_pages' || c.type === 'removed_pages' ? <Layers className="h-4 w-4 text-emerald-300" /> :
           c.type?.startsWith('h') ? <ArrowUpRight className="h-4 w-4 text-emerald-300" /> :
           <Activity className="h-4 w-4 text-orange-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            <span className="truncate">{c.universityName}</span>
            {c.page && c.page !== 'site' && (
              <Badge variant="outline" className="text-[10px] border-indigo-500/30 bg-indigo-500/10 text-indigo-200 h-4 px-1.5">{c.page}</Badge>
            )}
            <ChevronRight className={cx('h-3 w-3 text-zinc-500 transition', open && 'rotate-90')} />
          </div>
          <div className="text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
            <span className="uppercase tracking-wide">{c.type}</span>
            <span>•</span>
            <span>{new Date(c.detectedAt).toLocaleString()}</span>
            {shortUrl && (
              <>
                <span>•</span>
                <a href={c.pageUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200 hover:underline">
                  <ExternalLink className="h-3 w-3" />{shortUrl}
                </a>
              </>
            )}
          </div>
        </div>
        <SeverityChip severity={c.severity} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 text-xs">
          {c.pageUrl && (
            <div className="text-[11px] text-zinc-500 break-all">
              Full URL: <a href={c.pageUrl} target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline">{c.pageUrl}</a>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-2">
            {c.before !== undefined && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                <div className="text-[10px] uppercase tracking-wider text-red-300 mb-1 flex items-center gap-1"><Minus className="h-3 w-3" />Before</div>
                <div className="text-zinc-300 break-words">{c.before || <em className="text-zinc-500">(empty)</em>}</div>
              </div>
            )}
            {c.after !== undefined && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300 mb-1 flex items-center gap-1"><Plus className="h-3 w-3" />After</div>
                <div className="text-zinc-300 break-words">{c.after || <em className="text-zinc-500">(empty)</em>}</div>
              </div>
            )}
            {c.added && c.added.length > 0 && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 md:col-span-2">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300 mb-1">+ Added ({c.added.length})</div>
                <div className="flex flex-wrap gap-1">
                  {c.added.map((a, i) => {
                    const url = c.addedUrls?.[a]
                    return url ? (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 rounded text-[11px] text-emerald-100 hover:text-white transition">
                        <ExternalLink className="h-2.5 w-2.5" /><span>{a}</span>
                        <span className="text-emerald-400/70 truncate max-w-[240px]">— {url.replace(/^https?:\/\//,'')}</span>
                      </a>
                    ) : (
                      <span key={i} className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[11px]">{a}</span>
                    )
                  })}
                </div>
              </div>
            )}
            {c.removed && c.removed.length > 0 && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2 md:col-span-2">
                <div className="text-[10px] uppercase tracking-wider text-red-300 mb-1">− Removed ({c.removed.length})</div>
                <div className="flex flex-wrap gap-1">
                  {c.removed.map((a, i) => {
                    const url = c.removedUrls?.[a]
                    return url ? (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 rounded text-[11px] text-red-100 hover:text-white transition">
                        <ExternalLink className="h-2.5 w-2.5" /><span>{a}</span>
                        <span className="text-red-400/70 truncate max-w-[240px]">— {url.replace(/^https?:\/\//,'')}</span>
                      </a>
                    ) : (
                      <span key={i} className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[11px]">{a}</span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AiReportView({ report }) {
  if (!report) return null
  const r = report.report
  return (
    <div className="space-y-4">
      <Glass className="p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-indigo-300 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Executive Summary</div>
            <div className="text-sm text-zinc-200 leading-relaxed">{r.executiveSummary}</div>
          </div>
        </div>
        {r.overallScore && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
              <div className="text-xs text-indigo-300">LPU Score</div>
              <div className="text-2xl font-semibold tabular-nums">{r.overallScore.lpu}<span className="text-zinc-500 text-sm">/100</span></div>
              <Progress value={r.overallScore.lpu} className="h-1 mt-1" />
            </div>
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3">
              <div className="text-xs text-orange-300">{report.competitorName}</div>
              <div className="text-2xl font-semibold tabular-nums">{r.overallScore.competitor}<span className="text-zinc-500 text-sm">/100</span></div>
              <Progress value={r.overallScore.competitor} className="h-1 mt-1" />
            </div>
          </div>
        )}
      </Glass>

      <div className="grid md:grid-cols-2 gap-4">
        <Glass className="p-4">
          <div className="text-xs uppercase tracking-wider text-emerald-300 mb-2 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />LPU Strengths</div>
          <ul className="space-y-1.5 text-sm">{r.lpuStrengths?.map((s, i) => <li key={i} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>{s}</span></li>)}</ul>
        </Glass>
        <Glass className="p-4">
          <div className="text-xs uppercase tracking-wider text-red-300 mb-2 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />LPU Weaknesses</div>
          <ul className="space-y-1.5 text-sm">{r.lpuWeaknesses?.map((s, i) => <li key={i} className="flex gap-2"><AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /><span>{s}</span></li>)}</ul>
        </Glass>
        <Glass className="p-4">
          <div className="text-xs uppercase tracking-wider text-orange-300 mb-2 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />Competitor Strengths</div>
          <ul className="space-y-1.5 text-sm">{r.competitorStrengths?.map((s, i) => <li key={i} className="flex gap-2"><ArrowUpRight className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" /><span>{s}</span></li>)}</ul>
        </Glass>
        <Glass className="p-4">
          <div className="text-xs uppercase tracking-wider text-purple-300 mb-2 flex items-center gap-1"><Layers className="h-3.5 w-3.5" />Missing Features</div>
          <ul className="space-y-1.5 text-sm">{r.missingFeatures?.map((s, i) => <li key={i} className="flex gap-2"><Plus className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" /><span>{s}</span></li>)}</ul>
        </Glass>
      </div>

      {r.pageByPage && r.pageByPage.length > 0 && (
        <Glass className="p-4">
          <div className="text-xs uppercase tracking-wider text-cyan-300 mb-2 flex items-center gap-1"><Layers className="h-3.5 w-3.5" />Page-by-Page Comparison</div>
          <div className="space-y-1.5">
            {r.pageByPage.map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-xs rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <Badge variant="outline" className="text-[10px] border-indigo-500/30 bg-indigo-500/10 text-indigo-200 shrink-0">{p.page}</Badge>
                <Badge variant="outline" className={cx('text-[10px] shrink-0',
                  p.verdict === 'LPU wins' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' :
                  p.verdict === 'Competitor wins' ? 'border-red-500/40 bg-red-500/10 text-red-300' :
                  'border-zinc-500/40 bg-zinc-500/10 text-zinc-300')}>{p.verdict}</Badge>
                <span className="text-zinc-300">{p.note}</span>
              </div>
            ))}
          </div>
        </Glass>
      )}

      <Glass className="p-4">
        <div className="text-xs uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" />AI Recommendations</div>
        <div className="space-y-2">
          {r.recommendations?.map((rec, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-start gap-2">
                <div className="text-sm font-medium flex-1">{rec.title}</div>
                <SeverityChip severity={rec.priority} />
              </div>
              <div className="text-xs text-zinc-400 mt-1">{rec.detail}</div>
              <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-zinc-500">
                {rec.targetPage && <span>📄 Page: <span className="text-zinc-300">{rec.targetPage}</span></span>}
                <span>💼 Impact: <span className="text-zinc-300">{rec.businessImpact}</span></span>
                <span>⚙️ Effort: <span className="text-zinc-300 capitalize">{rec.effort}</span></span>
              </div>
            </div>
          ))}
        </div>
      </Glass>

      <div className="grid md:grid-cols-3 gap-4">
        {['contentGaps', 'seoGaps', 'uxGaps'].map(k => (
          <Glass key={k} className="p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">{k.replace(/Gaps/, ' Gaps')}</div>
            <ul className="space-y-1 text-xs text-zinc-300">
              {r[k]?.map((g, i) => <li key={i} className="flex gap-1"><span className="text-zinc-600">•</span><span>{g}</span></li>)}
            </ul>
          </Glass>
        ))}
      </div>

      {r.trustSignals && r.trustSignals.length > 0 && (
        <Glass className="p-4">
          <div className="text-xs uppercase tracking-wider text-yellow-300 mb-2 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Competitor Trust Signals</div>
          <div className="flex flex-wrap gap-2">
            {r.trustSignals.map((t, i) => <Badge key={i} variant="outline" className="bg-yellow-500/5 border-yellow-500/20 text-yellow-200">{t}</Badge>)}
          </div>
        </Glass>
      )}
    </div>
  )
}

function TrendsView({ universities }) {
  const [trends, setTrends] = useState(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api(`/trends?days=${days}`).then(d => alive && setTrends(d)).catch(e => toast.error(e.message)).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [days])

  const seoLineData = useMemo(() => {
    if (!trends) return []
    // Build unified time axis: all snapshot timestamps sorted
    const points = new Map() // timestamp -> { t, LPU:.., CU:.. }
    for (const [code, series] of Object.entries(trends.seoSeries || {})) {
      for (const p of series) {
        const key = new Date(p.t).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        if (!points.has(key)) points.set(key, { t: key, ts: new Date(p.t).getTime() })
        points.get(key)[code] = p.avg ?? p.home
      }
    }
    return Array.from(points.values()).sort((a, b) => a.ts - b.ts)
  }, [trends])

  const changeVelocity = useMemo(() => trends?.changeByDay || [], [trends])
  const perUniChanges = useMemo(() => {
    if (!trends?.perUniChanges) return []
    return Object.entries(trends.perUniChanges).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count)
  }, [trends])
  const severityData = useMemo(() => {
    if (!trends?.severityCounts) return []
    return Object.entries(trends.severityCounts).map(([name, value]) => ({ name, value })).filter(x => x.value > 0)
  }, [trends])
  const typeData = useMemo(() => {
    if (!trends?.typeCounts) return []
    return Object.entries(trends.typeCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [trends])

  const UNI_COLORS = { LPU:'#E30613', CU:'#0057A0', SRM:'#004990', VIT:'#003B71', MANIPAL:'#F58220', STANFORD:'#8C1515', UPENN:'#011F5B', MASTERSUNION:'#a855f7' }
  const SEV_COLORS = { critical:'#ef4444', high:'#f97316', medium:'#f59e0b', low:'#38bdf8' }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-xs text-zinc-500 mr-2">Range:</div>
        {[7, 14, 30, 60, 90].map(d => (
          <button key={d} onClick={() => setDays(d)} className={cx(
            'text-xs px-3 py-1.5 rounded-lg border transition',
            days === d ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200' : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:bg-white/5'
          )}>{d}d</button>
        ))}
        <div className="ml-auto text-xs text-zinc-500">
          {loading ? <Loader2 className="h-3 w-3 animate-spin inline" /> : `${trends?.totalSnapshots ?? 0} snapshots · ${trends?.totalChanges ?? 0} changes in window`}
        </div>
      </div>

      <Glass className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium">SEO Score over time</div>
            <div className="text-xs text-zinc-500">Avg SEO score per snapshot across all crawled pages</div>
          </div>
          <Badge variant="outline" className="border-white/10 text-zinc-400">{Object.keys(trends?.seoSeries || {}).length} unis</Badge>
        </div>
        <div className="h-72">
          {seoLineData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm">
              <LineChartIcon className="h-8 w-8 mb-2 opacity-40" />
              No snapshots in this window
            </div>
          ) : (
            <ResponsiveContainer>
              <LineChart data={seoLineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="t" stroke="#71717a" fontSize={10} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} stroke="#71717a" fontSize={11} />
                <RTooltip contentStyle={{ background: '#18181b', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {Object.keys(trends?.seoSeries || {}).map(code => (
                  <Line key={code} type="monotone" dataKey={code} stroke={UNI_COLORS[code] || '#8b5cf6'} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Glass>

      <div className="grid lg:grid-cols-3 gap-4">
        <Glass className="p-5 lg:col-span-2">
          <div className="text-sm font-medium mb-3">Change velocity per day</div>
          <div className="h-64">
            {changeVelocity.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">No changes in this window</div>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={changeVelocity}>
                  <defs>
                    <linearGradient id="gvel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="day" stroke="#71717a" fontSize={11} />
                  <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
                  <RTooltip contentStyle={{ background: '#18181b', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="total" stroke="#818cf8" strokeWidth={2} fill="url(#gvel)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Glass>

        <Glass className="p-5">
          <div className="text-sm font-medium mb-3">Severity mix</div>
          <div className="h-64">
            {severityData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">No changes</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={severityData} dataKey="value" innerRadius={45} outerRadius={80} paddingAngle={4}>
                    {severityData.map((e, i) => <Cell key={i} fill={SEV_COLORS[e.name] || '#71717a'} />)}
                  </Pie>
                  <RTooltip contentStyle={{ background: '#18181b', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Glass>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Glass className="p-5">
          <div className="text-sm font-medium mb-3">Changes by university</div>
          <div className="h-64">
            {perUniChanges.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">No changes</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={perUniChanges} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis type="number" stroke="#71717a" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="code" stroke="#71717a" fontSize={11} width={90} />
                  <RTooltip contentStyle={{ background: '#18181b', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {perUniChanges.map((e, i) => <Cell key={i} fill={UNI_COLORS[e.code] || '#8b5cf6'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Glass>

        <Glass className="p-5">
          <div className="text-sm font-medium mb-3">Change types</div>
          <div className="h-64">
            {typeData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">No changes</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={typeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} angle={-20} textAnchor="end" height={60} />
                  <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
                  <RTooltip contentStyle={{ background: '#18181b', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="url(#gtyp)" />
                  <defs>
                    <linearGradient id="gtyp" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Glass>
      </div>
    </div>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [dash, setDash] = useState(null)
  const [crawling, setCrawling] = useState(false)
  const [benchmarking, setBenchmarking] = useState(null)
  const [selectedUni, setSelectedUni] = useState(null)
  const [aiReport, setAiReport] = useState(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [latestSnap, setLatestSnap] = useState(null)
  const [execSummary, setExecSummary] = useState(null)
  const [execLoading, setExecLoading] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [tab, setTab] = useState('overview')

  async function refresh() {
    try {
      setLoading(true)
      const d = await api('/dashboard')
      setDash(d)
      const e = await api('/ai/executive-summary/latest')
      setExecSummary(e)
    } catch (e) {
      toast.error('Failed to load: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault(); setCmdOpen(x => !x)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function runCrawl(universityId = 'all') {
    setCrawling(true)
    const t = toast.loading(universityId === 'all' ? 'Crawling all universities…' : 'Crawling…')
    try {
      const r = await api('/crawl', { method: 'POST', body: JSON.stringify({ universityId }) })
      toast.success(`Crawled ${r.crawled} universities`, { id: t })
      await refresh()
    } catch (e) {
      toast.error(e.message, { id: t })
    } finally { setCrawling(false) }
  }

  async function benchmark(uni) {
    setBenchmarking(uni.id)
    const t = toast.loading(`Generating AI benchmark for ${uni.code}…`)
    try {
      const r = await api('/ai/benchmark', { method: 'POST', body: JSON.stringify({ competitorId: uni.id }) })
      setAiReport(r)
      setAiOpen(true)
      toast.success('AI benchmark ready', { id: t })
    } catch (e) {
      toast.error(e.message, { id: t })
    } finally { setBenchmarking(null) }
  }

  async function viewUni(uni) {
    setSelectedUni(uni)
    setSnapshotOpen(true)
    setLatestSnap(null)
    try {
      const s = await api(`/snapshots/latest?universityId=${uni.id}`)
      setLatestSnap(s)
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function generateExec() {
    setExecLoading(true)
    const t = toast.loading('Generating executive briefing…')
    try {
      const r = await api('/ai/executive-summary', { method: 'POST' })
      setExecSummary(r)
      toast.success('Executive briefing ready', { id: t })
    } catch (e) {
      toast.error(e.message, { id: t })
    } finally { setExecLoading(false) }
  }

  const stats = dash?.stats || {}
  const unis = dash?.universities || []
  const changes = dash?.recentChanges || []
  const logs = dash?.recentLogs || []

  const seoChart = useMemo(() => unis.map(u => ({ name: u.code, seo: u.health?.seoScore || 0, changes: u.health?.changes || 0 })), [unis])
  const changeSpread = useMemo(() => {
    const map = {}
    changes.forEach(c => { map[c.type] = (map[c.type] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [changes])
  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e', '#84cc16']

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.15),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(139,92,246,0.10),_transparent_50%)] bg-zinc-950 text-zinc-100">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-zinc-950/70 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-none">UCIP</div>
              <div className="text-[10px] text-zinc-500 leading-none mt-0.5">Competitor Intelligence</div>
            </div>
          </div>
          <div className="flex-1" />
          <button onClick={() => setCmdOpen(true)} className="hidden md:flex items-center gap-2 text-xs text-zinc-400 border border-white/10 rounded-lg px-3 py-1.5 bg-white/[0.02] hover:bg-white/5">
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <span className="ml-6 text-[10px] border border-white/10 rounded px-1.5 py-0.5 text-zinc-500">⌘K</span>
          </button>
          <Button size="sm" variant="secondary" className="h-8 bg-white/10 hover:bg-white/20 text-zinc-100 hover:text-white border border-white/10" onClick={refresh}>
            <RefreshCw className={cx('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />Refresh
          </Button>
          <Button size="sm" className="h-8 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white shadow-md" onClick={() => runCrawl('all')} disabled={crawling}>
            {crawling ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
            Run Daily Crawl
          </Button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Hero */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Glass className="lg:col-span-2 p-6 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs text-indigo-300 mb-2">
                <Bot className="h-3.5 w-3.5" />
                <span className="uppercase tracking-widest">GPT-5 Executive Briefing</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">{execSummary ? new Date(execSummary.createdAt).toLocaleString() : 'Not yet generated'}</span>
              </div>
              {execSummary?.summary ? (
                <>
                  <h1 className="text-2xl md:text-3xl font-semibold leading-tight">{execSummary.summary.headline}</h1>
                  <p className="text-zinc-400 mt-2 text-sm leading-relaxed">{execSummary.summary.summary}</p>
                  <div className="grid md:grid-cols-3 gap-3 mt-4">
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                      <div className="text-[10px] uppercase text-red-300 tracking-wider mb-1">Critical Issues</div>
                      <ul className="text-xs space-y-1">{execSummary.summary.criticalIssues?.slice(0,3).map((s,i)=><li key={i} className="text-zinc-300">• {s}</li>)}</ul>
                    </div>
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="text-[10px] uppercase text-emerald-300 tracking-wider mb-1">Today's Focus</div>
                      <ul className="text-xs space-y-1">{execSummary.summary.todaysFocus?.slice(0,3).map((s,i)=><li key={i} className="text-zinc-300">• {s}</li>)}</ul>
                    </div>
                    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
                      <div className="text-[10px] uppercase text-orange-300 tracking-wider mb-1">Competitor Movements</div>
                      <ul className="text-xs space-y-1">{execSummary.summary.competitorMovements?.slice(0,3).map((s,i)=><li key={i} className="text-zinc-300">• {s}</li>)}</ul>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-2xl md:text-3xl font-semibold leading-tight">Daily competitive intelligence for LPU</h1>
                  <p className="text-zinc-400 mt-2 text-sm max-w-2xl">Automatically monitor and benchmark LPU against 7 elite competitors. Crawl → Diff → AI Insights → Recommendations.</p>
                </>
              )}
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={generateExec} disabled={execLoading} className="bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 hover:text-white shadow-sm">
                  {execLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  Generate Executive Briefing
                </Button>
                <Button size="sm" variant="ghost" className="text-zinc-200 hover:text-white hover:bg-white/10" onClick={() => setTab('changes')}>
                  View all changes <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </Glass>

          <div className="grid grid-cols-2 gap-4">
            <KpiCard icon={Building2} label="Universities" value={stats.totalUniversities || 0} sub={`${stats.healthyCount || 0} healthy`} tint="from-indigo-500/30 to-blue-500/10" accent="text-indigo-300" />
            <KpiCard icon={Activity} label="Snapshots" value={stats.totalSnapshots || 0} sub="Daily captures" tint="from-emerald-500/30 to-teal-500/10" accent="text-emerald-300" />
            <KpiCard icon={Bell} label="Changes" value={stats.totalChanges || 0} sub="All-time" tint="from-orange-500/30 to-red-500/10" accent="text-orange-300" />
            <KpiCard icon={Sparkles} label="AI Reports" value={stats.totalAiReports || 0} sub={`Avg SEO ${stats.avgSeoScore || 0}`} tint="from-violet-500/30 to-pink-500/10" accent="text-violet-300" />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white/[0.03] border border-white/10">
            <TabsTrigger value="overview"><BarChart3 className="h-3.5 w-3.5 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="universities"><GraduationCap className="h-3.5 w-3.5 mr-1" />Universities</TabsTrigger>
            <TabsTrigger value="changes"><Activity className="h-3.5 w-3.5 mr-1" />Changes</TabsTrigger>
            <TabsTrigger value="trends"><LineChartIcon className="h-3.5 w-3.5 mr-1" />Trends</TabsTrigger>
            <TabsTrigger value="logs"><FileText className="h-3.5 w-3.5 mr-1" />Crawler Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid lg:grid-cols-3 gap-4">
              <Glass className="p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium">SEO Health across universities</div>
                    <div className="text-xs text-zinc-500">Score /100 · higher is better</div>
                  </div>
                  <Badge variant="outline" className="border-white/10 text-zinc-400">Live</Badge>
                </div>
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={seoChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
                      <YAxis stroke="#71717a" fontSize={11} />
                      <RTooltip contentStyle={{ background: '#18181b', border: '1px solid #ffffff20', borderRadius: 8 }} />
                      <Bar dataKey="seo" radius={[6,6,0,0]} fill="url(#gseo)" />
                      <defs>
                        <linearGradient id="gseo" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" />
                          <stop offset="100%" stopColor="#4f46e5" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Glass>

              <Glass className="p-5">
                <div className="text-sm font-medium mb-3">Change type distribution</div>
                <div className="h-64">
                  {changeSpread.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500">
                      <Activity className="h-8 w-8 mb-2 opacity-40" />
                      <div className="text-sm">No changes yet</div>
                      <div className="text-xs">Run crawl twice to detect changes</div>
                    </div>
                  ) : (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={changeSpread} dataKey="value" innerRadius={45} outerRadius={80} paddingAngle={4}>
                          {changeSpread.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <RTooltip contentStyle={{ background: '#18181b', border: '1px solid #ffffff20', borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Glass>
            </div>

            <Glass className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium">Recent Detected Changes</div>
                  <div className="text-xs text-zinc-500">Automatically diff'd against previous snapshot</div>
                </div>
                <Badge variant="outline" className="border-white/10 text-zinc-400">{changes.length}</Badge>
              </div>
              {changes.length === 0 ? (
                <div className="py-10 text-center text-zinc-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <div className="text-sm">No changes detected yet</div>
                  <div className="text-xs">Run the daily crawl twice to see day-over-day changes</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {changes.slice(0, 8).map(c => <ChangeRow key={c.id} c={c} />)}
                </div>
              )}
            </Glass>
          </TabsContent>

          <TabsContent value="universities" className="mt-4">
            {loading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {unis.map(u => <UniversityCard key={u.id} uni={u} onView={viewUni} onBenchmark={benchmark} benchmarking={benchmarking} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="changes" className="mt-4">
            <Glass className="p-5">
              <div className="text-sm font-medium mb-3">All Detected Changes</div>
              {changes.length === 0 ? (
                <div className="py-10 text-center text-zinc-500">No changes yet</div>
              ) : (
                <div className="space-y-2">{changes.map(c => <ChangeRow key={c.id} c={c} />)}</div>
              )}
            </Glass>
          </TabsContent>

          <TabsContent value="trends" className="mt-4">
            <TrendsView universities={unis} />
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Glass className="p-5">
              <div className="text-sm font-medium mb-3">Crawler Activity</div>
              <div className="space-y-1">
                {logs.map(l => (
                  <div key={l.id} className="flex items-center gap-3 text-xs py-2 border-b border-white/5 last:border-0">
                    {l.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-red-400" />}
                    <div className="font-medium w-40 truncate">{l.universityName}</div>
                    <div className="text-zinc-500">HTTP {l.status}</div>
                    <div className="text-zinc-500">{l.elapsedMs}ms</div>
                    <div className="text-zinc-500">{l.changes} change{l.changes!==1?'s':''}</div>
                    <div className="ml-auto text-zinc-600">{new Date(l.createdAt).toLocaleString()}</div>
                  </div>
                ))}
                {logs.length === 0 && <div className="py-6 text-center text-zinc-500 text-sm">No crawls yet — click "Run Daily Crawl"</div>}
              </div>
            </Glass>
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Report Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-4xl bg-zinc-950 border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />AI Benchmark: LPU vs {aiReport?.competitorName}
            </DialogTitle>
            <DialogDescription>Generated by GPT-5 • {aiReport && new Date(aiReport.createdAt).toLocaleString()}</DialogDescription>
          </DialogHeader>
          <AiReportView report={aiReport} />
        </DialogContent>
      </Dialog>

      {/* Snapshot Dialog */}
      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent className="max-w-3xl bg-zinc-950 border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-indigo-400" />{selectedUni?.name}
              <a href={selectedUni?.url} target="_blank" rel="noreferrer" className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
                Visit <ExternalLink className="h-3 w-3" />
              </a>
            </DialogTitle>
            <DialogDescription>Latest snapshot data captured by the crawler</DialogDescription>
          </DialogHeader>
          {!latestSnap ? (
            <div className="py-10 text-center text-zinc-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Loading snapshot…
            </div>
          ) : !latestSnap.data ? (
            <div className="py-10 text-center text-zinc-500">
              No snapshot yet for this university. Run the crawler first.
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="text-xs text-zinc-500">Home SEO</div>
                  <div className="text-2xl font-semibold">{latestSnap.data.seo?.seoScore}<span className="text-zinc-500 text-sm">/100</span></div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="text-xs text-zinc-500">Pages</div>
                  <div className="text-2xl font-semibold text-indigo-300">{latestSnap.data.pageCount || 1}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="text-xs text-zinc-500">Avg SEO</div>
                  <div className="text-2xl font-semibold">{latestSnap.data.avgSeoScore ?? latestSnap.data.seo?.seoScore}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="text-xs text-zinc-500">Fetch Time</div>
                  <div className="text-2xl font-semibold">{Math.round(latestSnap.elapsedMs/1000)}s</div>
                </div>
              </div>

              {latestSnap.data.pages && Object.keys(latestSnap.data.pages).length > 1 && (
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="text-xs text-zinc-500 mb-2 flex items-center justify-between">
                    <span>Crawled Pages ({Object.keys(latestSnap.data.pages).length})</span>
                    <span className="text-zinc-600">Click title → open</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    {Object.entries(latestSnap.data.pages).map(([key, p]) => (
                      <a key={key} href={p.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-white/5 hover:border-white/20 bg-white/[0.01] p-2 transition group">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] border-indigo-500/30 bg-indigo-500/10 text-indigo-200 h-4 px-1.5">{key}</Badge>
                          {p.ok ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <AlertCircle className="h-3 w-3 text-red-400" />}
                          {p.seo?.seoScore !== undefined && <span className="text-[10px] text-zinc-500 ml-auto">SEO {p.seo.seoScore}</span>}
                        </div>
                        <div className="text-xs text-zinc-300 truncate mt-1 group-hover:text-white">{p.seo?.title || p.anchorText || <em className="text-zinc-500">no title</em>}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{p.url}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-xs text-zinc-500 mb-1">Home Title</div>
                <div>{latestSnap.data.seo?.title}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-xs text-zinc-500 mb-1">Home Description</div>
                <div className="text-zinc-300">{latestSnap.data.seo?.description || <em className="text-zinc-500">Missing</em>}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-xs text-zinc-500 mb-2">Navigation ({latestSnap.data.structure?.nav?.length})</div>
                <div className="flex flex-wrap gap-1">
                  {latestSnap.data.structure?.nav?.slice(0, 40).map((n, i) => <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">{n}</span>)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-xs text-zinc-500 mb-2">Key Stats detected across site</div>
                <div className="flex flex-wrap gap-1">
                  {latestSnap.data.structure?.stats?.map((n, i) => <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-200">{n}</span>)}
                  {(!latestSnap.data.structure?.stats || latestSnap.data.structure?.stats?.length === 0) && <span className="text-zinc-500 text-xs">None detected</span>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Command palette */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Search universities, actions, changes…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => { setCmdOpen(false); runCrawl('all') }}><Zap className="h-4 w-4 mr-2" />Run daily crawl (all)</CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); generateExec() }}><Sparkles className="h-4 w-4 mr-2" />Generate executive briefing</CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); setTab('changes') }}><Activity className="h-4 w-4 mr-2" />View all changes</CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); setTab('logs') }}><FileText className="h-4 w-4 mr-2" />View crawler logs</CommandItem>
          </CommandGroup>
          <CommandGroup heading="Universities">
            {unis.map(u => (
              <CommandItem key={u.id} onSelect={() => { setCmdOpen(false); viewUni(u) }}>
                <GraduationCap className="h-4 w-4 mr-2" />{u.name}
                {!u.primary && <button className="ml-auto text-xs text-indigo-300" onClick={e => { e.stopPropagation(); setCmdOpen(false); benchmark(u) }}>AI Benchmark</button>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <footer className="max-w-[1400px] mx-auto px-6 py-8 text-xs text-zinc-600 flex items-center justify-between">
        <div>UCIP · Powered by GPT-5 · MongoDB · Cheerio</div>
        <div>Press <kbd className="px-1.5 py-0.5 border border-white/10 rounded bg-white/5">⌘K</kbd> for search</div>
      </footer>
    </div>
  )
}
