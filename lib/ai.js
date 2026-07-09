import OpenAI from 'openai';

let _client = null;
function client() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.EMERGENT_LLM_KEY,
      baseURL: 'https://integrations.emergentagent.com/llm',
    });
  }
  return _client;
}

function summarizeSnapshot(snap, maxChars = 6000) {
  if (!snap) return 'NO DATA';
  const pages = snap.pages || { home: { seo: snap.seo, structure: snap.structure, content: snap.content } };
  const parts = [];
  const pageOrder = ['home','admissions','programs','placements','scholarships','rankings','accreditations','research','international','online','fees','campus_life','news','events','about','contact'];
  const ordered = pageOrder.filter(k => pages[k]).concat(Object.keys(pages).filter(k => !pageOrder.includes(k)));
  for (const k of ordered) {
    const p = pages[k];
    if (!p || !p.ok) continue;
    const s = p.seo || {}; const st = p.structure || {}; const c = p.content || {};
    parts.push(`--- PAGE: ${k.toUpperCase()} (${p.url || ''}) ---`);
    parts.push('TITLE: ' + (s.title || ''));
    parts.push('DESCRIPTION: ' + (s.description || ''));
    parts.push('H1: ' + (s.h1 || []).slice(0, 6).join(' | '));
    parts.push('H2: ' + (s.h2 || []).slice(0, 12).join(' | '));
    if (k === 'home') {
      parts.push('NAV: ' + (st.nav || []).slice(0, 30).join(' | '));
      parts.push('FOOTER: ' + (st.footer || []).slice(0, 20).join(' | '));
    }
    parts.push('CTAS: ' + (st.ctas || []).slice(0, 10).join(' | '));
    parts.push('STATS: ' + (st.stats || []).slice(0, 15).join(' | '));
    parts.push('PARAGRAPHS: ' + (c.paragraphs || []).slice(0, 6).join(' || '));
  }
  return parts.join('\n').slice(0, maxChars);
}

export async function generateBenchmark({ lpu, competitor }) {
  const prompt = `You are a senior competitive intelligence analyst for higher education institutions.
Compare **LPU (Lovely Professional University)** with **${competitor.name}** based ONLY on the crawled MULTI-PAGE data below. Data covers homepage plus discovered category pages (admissions, programs, placements, scholarships, rankings, research, international, online, fees, campus_life, news, events, about, contact).

=== LPU CRAWLED PAGES ===
${summarizeSnapshot(lpu.data)}

=== ${competitor.name.toUpperCase()} CRAWLED PAGES ===
${summarizeSnapshot(competitor.data)}

Return a strict JSON object matching this schema (no prose, no markdown):
{
  "executiveSummary": string,   // 2-3 sentence takeaway for senior leadership
  "lpuStrengths": string[],     // 4-6 things LPU does better (cite specific pages/quotes)
  "lpuWeaknesses": string[],    // 4-6 things where LPU trails
  "competitorStrengths": string[],
  "missingFeatures": string[],  // features/sections on competitor NOT on LPU
  "contentGaps": string[],
  "seoGaps": string[],
  "uxGaps": string[],
  "trustSignals": string[],
  "pageByPage": [               // 3-6 specific per-page comparisons
    { "page": string, "verdict": "LPU wins"|"Competitor wins"|"Tie", "note": string }
  ],
  "recommendations": [
    { "title": string, "detail": string, "priority": "critical"|"high"|"medium"|"low", "businessImpact": string, "effort": "low"|"medium"|"high", "targetPage": string }
  ],
  "overallScore": { "lpu": number, "competitor": number }
}

IMPORTANT: Be specific, cite actual text seen in the crawled data. Reference which page (home, admissions, placements, etc.) an insight comes from. Prioritize recommendations that increase applications, brand equity, and lead conversion.`;

  const res = await client().chat.completions.create({
    model: 'gpt-5',
    messages: [
      { role: 'system', content: 'You are a rigorous competitive intelligence analyst. Always output valid JSON only.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const text = res.choices[0].message.content;
  return JSON.parse(text);
}

export async function generateExecutiveSummary({ snapshots, changes }) {
  const uniSummaries = snapshots.map(s => `- ${s.name} (${s.code}): SEO ${s.data?.seo?.seoScore ?? 'n/a'}, ${(s.data?.structure?.nav||[]).length} nav items, ${(s.data?.structure?.stats||[]).length} stats blocks, title="${s.data?.seo?.title||''}"`).join('\n');
  const changeSummary = changes.slice(0, 30).map(c => `- ${c.universityName}: ${c.type} (${c.severity})`).join('\n');

  const prompt = `You are writing the daily executive briefing for LPU leadership on competitor intelligence.

MONITORED UNIVERSITIES:
${uniSummaries}

RECENT DETECTED CHANGES ACROSS COMPETITORS:
${changeSummary || 'No changes detected in the current window.'}

Return strict JSON:
{
  "headline": string,
  "summary": string,           // 3-4 sentence C-suite briefing
  "criticalIssues": string[],
  "highlights": string[],
  "todaysFocus": string[],     // 3 action items for LPU marketing/admissions today
  "competitorMovements": string[]
}`;

  const res = await client().chat.completions.create({
    model: 'gpt-5',
    messages: [
      { role: 'system', content: 'You write concise, high-signal executive briefings. Output valid JSON only.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(res.choices[0].message.content);
}
