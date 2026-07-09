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

function summarizeSnapshot(snap, maxChars = 4000) {
  if (!snap) return 'NO DATA';
  const s = snap.seo || {};
  const st = snap.structure || {};
  const c = snap.content || {};
  const lines = [
    'TITLE: ' + (s.title || ''),
    'DESCRIPTION: ' + (s.description || ''),
    'H1: ' + (s.h1 || []).slice(0, 8).join(' | '),
    'H2: ' + (s.h2 || []).slice(0, 15).join(' | '),
    'H3: ' + (s.h3 || []).slice(0, 20).join(' | '),
    'NAV: ' + (st.nav || []).slice(0, 40).join(' | '),
    'FOOTER: ' + (st.footer || []).slice(0, 30).join(' | '),
    'CTAS: ' + (st.ctas || []).slice(0, 15).join(' | '),
    'STATS: ' + (st.stats || []).slice(0, 20).join(' | '),
    'PARAGRAPHS: ' + (c.paragraphs || []).slice(0, 15).join(' || '),
  ].join('\n');
  return lines.slice(0, maxChars);
}

export async function generateBenchmark({ lpu, competitor }) {
  const prompt = `You are a senior competitive intelligence analyst for higher education institutions.
Compare **LPU (Lovely Professional University)** with **${competitor.name}** based ONLY on the crawled data below.

=== LPU HOMEPAGE DATA ===
${summarizeSnapshot(lpu.data)}

=== ${competitor.name.toUpperCase()} HOMEPAGE DATA ===
${summarizeSnapshot(competitor.data)}

Return a strict JSON object matching this schema (no prose, no markdown):
{
  "executiveSummary": string,   // 2-3 sentence takeaway for senior leadership
  "lpuStrengths": string[],     // 3-6 things LPU does better
  "lpuWeaknesses": string[],    // 3-6 things where LPU trails
  "competitorStrengths": string[],
  "missingFeatures": string[],  // features on competitor site NOT on LPU
  "contentGaps": string[],
  "seoGaps": string[],
  "uxGaps": string[],
  "trustSignals": string[],     // rankings, accreditations, testimonials competitor uses
  "recommendations": [
    { "title": string, "detail": string, "priority": "critical"|"high"|"medium"|"low", "businessImpact": string, "effort": "low"|"medium"|"high" }
  ],
  "overallScore": { "lpu": number, "competitor": number }  // 0-100 attractiveness score based on evidence
}

IMPORTANT: Be specific, cite text seen in the data. Prioritize recommendations that increase applications, brand equity, and lead conversion.`;

  const res = await client().chat.completions.create({
    model: 'gpt-5-mini',
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
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: 'You write concise, high-signal executive briefings. Output valid JSON only.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(res.choices[0].message.content);
}
