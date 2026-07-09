'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, AlertCircle, ArrowUpRight, BarChart3, Bot, CheckCircle2, ChevronRight,
  Command as CommandIcon, Download, ExternalLink, Eye, FileText, Globe,
  GraduationCap, Layers, LineChart as LineChartIcon, Loader2, Minus,
  Plus, RefreshCw, Search, Send, ShieldCheck, Sparkles, TrendingUp,
  Zap, Building2, Calendar, Bell, Filter, X, LogOut, User as UserIcon, Users, Mail,
  KeyRound, ShieldAlert, UserPlus, Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { toast } from 'sonner'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts'

const TOKEN_KEY = 'ucip_token'

function getToken() { if (typeof window === 'undefined') return null; return localStorage.getItem(TOKEN_KEY) }
function setToken(t) { if (typeof window === 'undefined') return; if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) }

const api = (path, opts = {}) =>
  fetch(`/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(opts.headers || {}),
    },
  }).then(async r => {
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      if (r.status === 401) {
        // token invalid - force re-login
        setToken(null)
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('ucip:unauth'))
      }
      throw new Error(j.error || r.statusText)
    }
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

function relTime(d) {
  const now = Date.now(); const t = new Date(d).getTime(); const diff = Math.max(1, now - t) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff/60)}m ago`
  if (diff < 86400) return `${Math.round(diff/3600)}h ago`
  return `${Math.round(diff/86400)}d ago`
}

function formatEvidenceText(c) {
  const lines = []
  lines.push(`## Change detected: ${c.type} on ${c.universityName}${c.page && c.page !== 'site' ? ` (${c.page})` : ''}`)
  lines.push(`Detected: ${new Date(c.detectedAt).toLocaleString()}  |  Severity: ${c.severity}`)
  if (c.pageUrl) lines.push(`Source URL: ${c.pageUrl}`)
  lines.push('')
  if (c.before !== undefined || c.after !== undefined) {
    lines.push(`BEFORE:\n  ${c.before || '(empty)'}\n`)
    lines.push(`AFTER:\n  ${c.after || '(empty)'}`)
  }
  if (c.added && c.added.length) {
    lines.push(`\n+ ADDED (${c.added.length}):`)
    for (const a of c.added) {
      const url = c.addedUrls?.[a]
      lines.push(url ? `  + ${a} — ${url}` : `  + ${a}`)
    }
  }
  if (c.removed && c.removed.length) {
    lines.push(`\n- REMOVED (${c.removed.length}):`)
    for (const a of c.removed) {
      const url = c.removedUrls?.[a]
      lines.push(url ? `  - ${a} — ${url}` : `  - ${a}`)
    }
  }
  return lines.join('\n')
}

function ChangeIcon({ type }) {
  const cls = 'h-4 w-4'
  if (type === 'title' || type === 'description' || type === 'og_title') return <FileText className={cx(cls, 'text-blue-300')} />
  if (type === 'hero_image') return <Eye className={cx(cls, 'text-pink-300')} />
  if (type === 'navigation') return <Layers className={cx(cls, 'text-purple-300')} />
  if (type === 'ctas') return <Zap className={cx(cls, 'text-yellow-300')} />
  if (type === 'new_pages' || type === 'removed_pages') return <Layers className={cx(cls, 'text-emerald-300')} />
  if (type?.startsWith('h')) return <ArrowUpRight className={cx(cls, 'text-emerald-300')} />
  return <Activity className={cx(cls, 'text-orange-300')} />
}

function isImageUrl(s) {
  return typeof s === 'string' && /^https?:\/\/.+\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i.test(s)
}

function PageContentEvidence({ pageKey, content, kind = 'added' }) {
  if (!content) return null
  const isRemoved = kind === 'removed'
  const accent = isRemoved ? 'red' : 'emerald'
  return (
    <div className="w-[520px] max-w-[92vw] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className={cx('text-[10px] uppercase',
          isRemoved ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
        )}>{isRemoved ? '− Removed page' : '+ New page'}</Badge>
        <Badge variant="outline" className="text-[10px] border-indigo-500/40 bg-indigo-500/10 text-indigo-200 uppercase">{pageKey}</Badge>
      </div>
      {content.url && (
        <a href={content.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="block truncate text-[11px] text-indigo-300 hover:text-indigo-200 hover:underline mb-2">
          <ExternalLink className="h-3 w-3 inline mr-1" />{content.url}
        </a>
      )}
      {content.heroImage && (
        <div className="mb-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1"><Eye className="h-3 w-3" />Hero image</div>
          <img src={content.heroImage} alt="hero" className="w-full max-h-32 object-cover rounded-md border border-white/10" onError={e => { e.currentTarget.style.display='none' }} />
        </div>
      )}
      {content.title && (
        <div className="mb-2 rounded-lg border border-white/10 bg-white/[0.02] p-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Page title</div>
          <div className="text-sm text-white leading-snug">{content.title}</div>
        </div>
      )}
      {content.description && (
        <div className="mb-2 rounded-lg border border-white/10 bg-white/[0.02] p-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Meta description</div>
          <div className="text-xs text-zinc-200 leading-relaxed">{content.description}</div>
        </div>
      )}
      {content.h1 && content.h1.length > 0 && (
        <div className="mb-2 rounded-lg border border-white/10 bg-white/[0.02] p-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">H1 headlines</div>
          <ul className="space-y-0.5 text-xs text-zinc-100">
            {content.h1.map((h, i) => <li key={i} className="flex gap-1"><ArrowUpRight className="h-3 w-3 text-indigo-400 shrink-0 mt-0.5" /><span>{h}</span></li>)}
          </ul>
        </div>
      )}
      {content.h2 && content.h2.length > 0 && (
        <div className="mb-2 rounded-lg border border-white/10 bg-white/[0.02] p-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Sections / H2 ({content.h2.length})</div>
          <div className="flex flex-wrap gap-1">
            {content.h2.map((h, i) => <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-200">{h}</span>)}
          </div>
        </div>
      )}
      {content.ctas && content.ctas.length > 0 && (
        <div className="mb-2 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.05] p-2">
          <div className="text-[10px] uppercase tracking-wider text-yellow-300 mb-1 flex items-center gap-1"><Zap className="h-3 w-3" />CTAs</div>
          <div className="flex flex-wrap gap-1">
            {content.ctas.map((cta, i) => <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-100">{cta}</span>)}
          </div>
        </div>
      )}
      {content.stats && content.stats.length > 0 && (
        <div className="mb-2 rounded-lg border border-indigo-500/20 bg-indigo-500/[0.05] p-2">
          <div className="text-[10px] uppercase tracking-wider text-indigo-300 mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" />Key stats</div>
          <div className="flex flex-wrap gap-1">
            {content.stats.map((s, i) => <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-100">{s}</span>)}
          </div>
        </div>
      )}
      {content.paragraphs && content.paragraphs.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Content preview</div>
          <div className="space-y-1 text-[11px] text-zinc-300 leading-relaxed max-h-24 overflow-y-auto">
            {content.paragraphs.map((p, i) => <p key={i}>{p.slice(0, 220)}{p.length > 220 ? '…' : ''}</p>)}
          </div>
        </div>
      )}
      <div className={cx('text-[10px] mt-2 italic', isRemoved ? 'text-red-400/70' : 'text-emerald-400/70')}>
        {isRemoved ? 'Captured from last snapshot before removal' : 'Captured from first snapshot after addition'}
      </div>
    </div>
  )
}

function PageChip({ pageKey, url, content, kind }) {
  const isRemoved = kind === 'removed'
  const cls = isRemoved
    ? 'bg-red-500/15 border-red-500/40 hover:bg-red-500/25 text-red-50 hover:text-white'
    : 'bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25 text-emerald-50 hover:text-white'
  const accent = isRemoved ? 'text-red-300/80' : 'text-emerald-300/80'
  const chip = (
    <a href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className={cx('inline-flex items-center gap-1 px-2 py-0.5 border rounded-md text-[11px] transition', cls)}>
      <ExternalLink className="h-2.5 w-2.5" />
      <span className={cx('font-medium', isRemoved && 'line-through')}>{pageKey}</span>
      {url && <span className={cx('truncate max-w-[240px]', accent)}>— {url.replace(/^https?:\/\//,'')}</span>}
    </a>
  )
  if (!content) return chip
  return (
    <HoverCard openDelay={80} closeDelay={100}>
      <HoverCardTrigger asChild>{chip}</HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions
        onClick={e => e.stopPropagation()}
        className={cx('w-auto p-0 bg-zinc-950/95 border backdrop-blur-xl shadow-2xl z-50',
          isRemoved ? 'border-red-500/30 shadow-red-950/50' : 'border-emerald-500/30 shadow-emerald-950/50')}
      >
        <PageContentEvidence pageKey={pageKey} content={content} kind={kind} />
      </HoverCardContent>
    </HoverCard>
  )
}

function EvidenceBody({ c, compact }) {
  const beforeIsImg = isImageUrl(c.before)
  const afterIsImg = isImageUrl(c.after)
  return (
    <div className={cx('space-y-2', compact && 'text-xs')}>
      {(c.before !== undefined || c.after !== undefined) && (
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-red-500/25 bg-red-500/[0.06] p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-red-300 mb-1 flex items-center gap-1"><Minus className="h-3 w-3" />Before (previous crawl)</div>
            {beforeIsImg ? (
              <div className="space-y-1">
                <img src={c.before} alt="before" className="max-h-40 w-full object-contain rounded-md border border-white/10 bg-black/40" onError={e => { e.currentTarget.style.display='none' }} />
                <a href={c.before} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-red-300 hover:text-red-200 hover:underline break-all">{c.before}</a>
              </div>
            ) : (
              <div className="text-zinc-100 break-words leading-relaxed">{c.before || <em className="text-zinc-500">(empty)</em>}</div>
            )}
          </div>
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 mb-1 flex items-center gap-1"><Plus className="h-3 w-3" />After (current)</div>
            {afterIsImg ? (
              <div className="space-y-1">
                <img src={c.after} alt="after" className="max-h-40 w-full object-contain rounded-md border border-white/10 bg-black/40" onError={e => { e.currentTarget.style.display='none' }} />
                <a href={c.after} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-emerald-300 hover:text-emerald-200 hover:underline break-all">{c.after}</a>
              </div>
            ) : (
              <div className="text-zinc-100 break-words leading-relaxed">{c.after || <em className="text-zinc-500">(empty)</em>}</div>
            )}
          </div>
        </div>
      )}
      {c.added && c.added.length > 0 && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300 mb-1.5">+ Added ({c.added.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {c.added.map((a, i) => {
              const url = c.addedUrls?.[a]
              const content = c.addedContents?.[a]
              // Use PageChip only for new_pages events (where each item is a page key with rich content)
              if (c.type === 'new_pages' && (url || content)) {
                return <PageChip key={i} pageKey={a} url={url} content={content} kind="added" />
              }
              return url ? (
                <a key={i} href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 rounded-md text-[11px] text-emerald-50 hover:text-white transition">
                  <ExternalLink className="h-2.5 w-2.5" /><span className="font-medium">{a}</span>
                  <span className="text-emerald-300/80 truncate max-w-[240px]">— {url.replace(/^https?:\/\//,'')}</span>
                </a>
              ) : (
                <span key={i} className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded-md text-[11px] text-emerald-50">{a}</span>
              )
            })}
          </div>
          {c.type === 'new_pages' && <div className="text-[10px] text-emerald-400/70 mt-1.5 italic">Hover a page for content evidence</div>}
        </div>
      )}
      {c.removed && c.removed.length > 0 && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/[0.06] p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-red-300 mb-1.5">− Removed ({c.removed.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {c.removed.map((a, i) => {
              const url = c.removedUrls?.[a]
              const content = c.removedContents?.[a]
              if (c.type === 'removed_pages' && (url || content)) {
                return <PageChip key={i} pageKey={a} url={url} content={content} kind="removed" />
              }
              return url ? (
                <a key={i} href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/15 border border-red-500/40 hover:bg-red-500/25 rounded-md text-[11px] text-red-50 hover:text-white transition">
                  <ExternalLink className="h-2.5 w-2.5" /><span className="font-medium line-through">{a}</span>
                  <span className="text-red-300/80 truncate max-w-[240px]">— {url.replace(/^https?:\/\//,'')}</span>
                </a>
              ) : (
                <span key={i} className="px-2 py-0.5 bg-red-500/15 border border-red-500/30 rounded-md text-[11px] text-red-50 line-through">{a}</span>
              )
            })}
          </div>
          {c.type === 'removed_pages' && <div className="text-[10px] text-red-400/70 mt-1.5 italic">Hover a page to see what content was on it before removal</div>}
        </div>
      )}
    </div>
  )
}

function ChangeHoverPreview({ c }) {
  return (
    <div className="w-[520px] max-h-[420px] overflow-y-auto p-1">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <ChangeIcon type={c.type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="truncate">{c.universityName}</span>
            {c.page && c.page !== 'site' && (
              <Badge variant="outline" className="text-[10px] border-indigo-500/40 bg-indigo-500/10 text-indigo-200 h-4 px-1.5">{c.page}</Badge>
            )}
          </div>
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <span className="uppercase tracking-wide">{c.type}</span>
            <span>·</span>
            <span>{relTime(c.detectedAt)}</span>
            <SeverityChip severity={c.severity} />
          </div>
        </div>
      </div>
      {c.pageUrl && (
        <a href={c.pageUrl} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-indigo-300 hover:text-indigo-200 hover:underline mb-2">
          <ExternalLink className="h-3 w-3 inline mr-1" />{c.pageUrl}
        </a>
      )}
      <EvidenceBody c={c} compact />
      <div className="text-[10px] text-zinc-600 mt-2 italic">Click row to expand · management-ready evidence view</div>
    </div>
  )
}

function ChangeUrlEvidence({ c, shortUrl }) {
  // Compact, presentation-ready evidence card showed when hovering the URL chip
  return (
    <div className="w-[540px] max-w-[92vw] p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <ChangeIcon type={c.type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="truncate">{c.universityName}</span>
            {c.page && c.page !== 'site' && (
              <Badge variant="outline" className="text-[10px] border-indigo-500/40 bg-indigo-500/10 text-indigo-200 h-4 px-1.5">{c.page}</Badge>
            )}
            <SeverityChip severity={c.severity} />
          </div>
          <div className="text-[11px] text-zinc-500">
            <span className="uppercase tracking-wide">{c.type}</span> · {relTime(c.detectedAt)}
          </div>
        </div>
      </div>
      {c.pageUrl && (
        <a href={c.pageUrl} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-indigo-300 hover:text-indigo-200 hover:underline mb-2">
          <ExternalLink className="h-3 w-3 inline mr-1" />{c.pageUrl}
        </a>
      )}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1">
          <FileText className="h-3 w-3" />Evidence — what changed
        </div>
        <EvidenceBody c={c} compact />
      </div>
      <div className="text-[10px] text-zinc-600 mt-2 italic">Click row for full evidence · Copy for management report</div>
    </div>
  )
}

function ChangeRow({ c }) {
  const [open, setOpen] = useState(false)
  const shortUrl = c.pageUrl ? c.pageUrl.replace(/^https?:\/\//, '').slice(0, 60) : null

  function copyEvidence() {
    navigator.clipboard.writeText(formatEvidenceText(c))
      .then(() => toast.success('Evidence copied — paste into your report'))
      .catch(() => toast.error('Copy failed'))
  }

  return (
    <div className="border border-white/5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition">
      <button onClick={() => setOpen(!open)} className="w-full text-left p-3 flex items-center gap-3 rounded-xl">
        <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <ChangeIcon type={c.type} />
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
            <span>·</span>
            <span>{relTime(c.detectedAt)}</span>
            {shortUrl && (
              <>
                <span>·</span>
                <HoverCard openDelay={80} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <a
                      href={c.pageUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:text-white hover:bg-indigo-500/20 transition"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="max-w-[280px] truncate">{shortUrl}</span>
                      <span className="text-[9px] uppercase tracking-wider text-indigo-300/80 ml-1">evidence</span>
                    </a>
                  </HoverCardTrigger>
                  <HoverCardContent
                    side="bottom"
                    align="start"
                    sideOffset={8}
                    collisionPadding={16}
                    avoidCollisions
                    className="w-auto p-0 bg-zinc-950/95 border border-indigo-500/30 backdrop-blur-xl shadow-2xl shadow-indigo-950/50 z-50"
                    onClick={e => e.stopPropagation()}
                  >
                    <ChangeUrlEvidence c={c} shortUrl={shortUrl} />
                  </HoverCardContent>
                </HoverCard>
              </>
            )}
          </div>
        </div>
        <SeverityChip severity={c.severity} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 space-y-3 border-t border-white/5 bg-white/[0.01]">
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline" className="border-indigo-500/40 bg-indigo-500/10 text-indigo-200 text-[10px] uppercase">Evidence</Badge>
            {c.pageUrl && (
              <a href={c.pageUrl} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-300 hover:text-indigo-200 hover:underline break-all">
                <ExternalLink className="h-3 w-3 inline mr-1" />{c.pageUrl}
              </a>
            )}
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={copyEvidence} className="h-7 text-zinc-300 hover:text-white hover:bg-white/10 text-xs">
                <FileText className="h-3.5 w-3.5 mr-1" />Copy evidence
              </Button>
              {c.pageUrl && (
                <a href={c.pageUrl} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="ghost" className="h-7 text-zinc-300 hover:text-white hover:bg-white/10 text-xs">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />Open page
                  </Button>
                </a>
              )}
            </div>
          </div>
          <div className="text-[11px] text-zinc-500">
            <span className="uppercase tracking-wider">{c.type}</span>
            <span className="mx-2">·</span>
            <span>{new Date(c.detectedAt).toLocaleString()}</span>
            <span className="mx-2">·</span>
            <span>severity: <span className="capitalize text-zinc-300">{c.severity}</span></span>
          </div>
          <EvidenceBody c={c} />
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

function LoginGate({ onLogin }) {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('email') // email | otp
  const [loading, setLoading] = useState(false)
  const [devOtp, setDevOtp] = useState(null)

  async function requestOtp(e) {
    e?.preventDefault()
    setLoading(true)
    try {
      const r = await api('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email }) })
      setStep('otp')
      if (r.devOtp) {
        setDevOtp(r.devOtp)
        toast.info(`Dev mode: your code is ${r.devOtp}`)
      } else {
        toast.success('Check your inbox for the code.')
      }
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  async function verifyOtp(e) {
    e?.preventDefault()
    setLoading(true)
    try {
      const r = await api('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) })
      setToken(r.token)
      onLogin(r.user)
      toast.success(`Welcome, ${r.user.name}`)
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.18),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(139,92,246,0.12),_transparent_50%)] bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-lg font-semibold">UCIP</div>
            <div className="text-xs text-zinc-500">University Competitor Intelligence</div>
          </div>
        </div>

        <Glass className="p-6">
          {step === 'email' ? (
            <form onSubmit={requestOtp} className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Sign in</h2>
                <p className="text-sm text-zinc-400 mt-1">Enter your LPU email to receive a one-time code.</p>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Email address</label>
                <div className="relative">
                  <Mail className="h-4 w-4 absolute left-3 top-2.5 text-zinc-500" />
                  <Input
                    type="email"
                    placeholder="you@lpu.co.in"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500/40"
                  />
                </div>
                <div className="text-[11px] text-zinc-500 mt-1.5">Only <span className="text-indigo-300">@lpu.co.in</span> emails are allowed.</div>
              </div>
              <Button type="submit" disabled={loading || !email} className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white shadow-md">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Send verification code
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Enter code</h2>
                <p className="text-sm text-zinc-400 mt-1">We sent a 6-digit code to <span className="text-white">{email}</span></p>
              </div>
              {devOtp && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <div><b>Development mode</b> — SMTP is not configured. Your code is <span className="font-mono text-white">{devOtp}</span>. Configure SMTP env vars to email real users.</div>
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">6-digit code</label>
                <div className="relative">
                  <KeyRound className="h-4 w-4 absolute left-3 top-2.5 text-zinc-500" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    className="pl-9 tracking-[0.4em] font-mono text-lg bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-indigo-500/40"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => { setStep('email'); setOtp(''); setDevOtp(null) }} className="text-zinc-300 hover:text-white hover:bg-white/10">
                  Back
                </Button>
                <Button type="submit" disabled={loading || otp.length !== 6} className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white shadow-md">
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Verify & sign in
                </Button>
              </div>
            </form>
          )}
        </Glass>
        <div className="text-center text-[11px] text-zinc-600 mt-4">Secured with one-time codes · No passwords</div>
      </div>
    </div>
  )
}

function AdminPanel({ me, onClose }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('user')
  const [adding, setAdding] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const list = await api('/admin/users')
      setUsers(list)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  async function addUser(e) {
    e?.preventDefault()
    setAdding(true)
    try {
      await api('/admin/users', { method: 'POST', body: JSON.stringify({ email: newEmail, role: newRole }) })
      toast.success('User added')
      setNewEmail(''); setNewRole('user')
      refresh()
    } catch (err) { toast.error(err.message) }
    finally { setAdding(false) }
  }
  async function updateUser(id, patch) {
    try {
      await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      toast.success('Updated')
      refresh()
    } catch (err) { toast.error(err.message) }
  }
  async function deleteUser(id, email) {
    if (!confirm(`Delete ${email}? This cannot be undone.`)) return
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE' })
      toast.success('User deleted')
      refresh()
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="space-y-4">
      <Glass className="p-4">
        <form onSubmit={addUser} className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="text-xs text-zinc-400 mb-1 block">Email</label>
            <div className="relative">
              <Mail className="h-4 w-4 absolute left-3 top-2.5 text-zinc-500" />
              <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@lpu.co.in" className="pl-9 bg-white/5 border-white/10 text-white" required />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Role</label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={adding || !newEmail} className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white">
            {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
            Add user
          </Button>
        </form>
      </Glass>

      <Glass className="p-0 overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div>
            <div className="text-sm font-medium">Users ({users.length})</div>
            <div className="text-xs text-zinc-500">Manage roles and access</div>
          </div>
          <Button variant="ghost" size="sm" onClick={refresh} className="text-zinc-300 hover:text-white hover:bg-white/10">
            <RefreshCw className={cx('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />Refresh
          </Button>
        </div>
        <div className="divide-y divide-white/5">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 m-3" />)
          ) : users.length === 0 ? (
            <div className="p-10 text-center text-zinc-500 text-sm">No users yet</div>
          ) : users.map(u => (
            <div key={u.id} className="p-3 flex items-center gap-3 hover:bg-white/[0.02]">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500/40 to-violet-500/40 border border-white/10 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                {u.email.slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white flex items-center gap-2">
                  <span className="truncate">{u.email}</span>
                  {u.id === me?.id && <Badge variant="outline" className="text-[10px] border-indigo-500/40 bg-indigo-500/10 text-indigo-200">you</Badge>}
                </div>
                <div className="text-[11px] text-zinc-500 flex items-center gap-2">
                  <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                  {u.lastLoginAt && <span>· Last login {new Date(u.lastLoginAt).toLocaleString()}</span>}
                  {u.invitedBy && u.invitedBy !== 'self' && u.invitedBy !== 'system' && <span>· Invited by {u.invitedBy}</span>}
                </div>
              </div>
              <Select value={u.role} onValueChange={v => updateUser(u.id, { role: v })}>
                <SelectTrigger className="w-28 h-8 bg-white/5 border-white/10 text-white text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
              </Select>
              {u.status === 'active' ? (
                <Button size="sm" variant="ghost" className="h-8 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10" onClick={() => updateUser(u.id, { status: 'revoked' })}>
                  <ShieldAlert className="h-3.5 w-3.5 mr-1" />Revoke
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="h-8 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10" onClick={() => updateUser(u.id, { status: 'active' })}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Restore
                </Button>
              )}
              <Badge variant="outline" className={cx('text-[10px]', u.status === 'active' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300')}>{u.status}</Badge>
              {u.id !== me?.id && (
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-300 hover:text-red-200 hover:bg-red-500/10" onClick={() => deleteUser(u.id, u.email)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </Glass>
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
  // Auth state
  const [me, setMe] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  // Bootstrap: check current session
  useEffect(() => {
    if (!getToken()) { setAuthChecked(true); return }
    api('/auth/me').then(r => { if (r.user) setMe(r.user) }).catch(() => setToken(null)).finally(() => setAuthChecked(true))
  }, [])

  // Listen for unauth events (e.g. 401)
  useEffect(() => {
    const h = () => { setMe(null); setDash(null); setExecSummary(null) }
    window.addEventListener('ucip:unauth', h)
    return () => window.removeEventListener('ucip:unauth', h)
  }, [])

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

  useEffect(() => { if (me) refresh() }, [me])

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

  // === AUTH GATE ===
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
      </div>
    )
  }
  if (!me) {
    return <LoginGate onLogin={setMe} />
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }) } catch {}
    setToken(null); setMe(null); setDash(null); setExecSummary(null)
    toast.success('Signed out')
  }

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
          {me?.role === 'admin' && (
            <Button size="sm" variant="secondary" className="h-8 bg-white/10 hover:bg-white/20 text-zinc-100 hover:text-white border border-white/10" onClick={() => setAdminOpen(true)}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />Admin
            </Button>
          )}
          <Button size="sm" variant="secondary" className="h-8 bg-white/10 hover:bg-white/20 text-zinc-100 hover:text-white border border-white/10" onClick={refresh}>
            <RefreshCw className={cx('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />Refresh
          </Button>
          <Button size="sm" className="h-8 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white shadow-md" onClick={() => runCrawl('all')} disabled={crawling}>
            {crawling ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
            Run Daily Crawl
          </Button>
          <div className="flex items-center gap-2 ml-2 pl-3 border-l border-white/10">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500/60 to-violet-500/60 border border-white/10 flex items-center justify-center text-[11px] font-semibold text-white">
              {me.email.slice(0,2).toUpperCase()}
            </div>
            <div className="hidden md:block text-xs leading-none">
              <div className="text-white">{me.name || me.email.split('@')[0]}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{me.role}</div>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10" onClick={logout} title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
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

      {/* Admin Panel Dialog */}
      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent className="max-w-4xl bg-zinc-950 border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-400" />Admin — User Management
            </DialogTitle>
            <DialogDescription>Add users, change roles, revoke or restore access</DialogDescription>
          </DialogHeader>
          {adminOpen && <AdminPanel me={me} onClose={() => setAdminOpen(false)} />}
        </DialogContent>
      </Dialog>

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
