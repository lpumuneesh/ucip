import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (compatible; UCIP-Bot/1.0; +https://ucip.example.com)';

// Category matchers: keyword patterns in url path OR anchor text.
// Ordered by importance. First match wins for each link.
// Limited to top ~10 categories to keep memory usage manageable.
const CATEGORIES = [
  { key: 'admissions',      url: /(admission|admit|apply|application|enrol)/i,        text: /(admission|apply now|application|enrol|how to apply)/i },
  { key: 'programs',        url: /(program|course|academic|school-of|departments?|faculty|faculties)/i, text: /(programme|program|course|academics|schools|department|faculty)/i },
  { key: 'placements',      url: /(placement|career|recruit|corporate|training-and-placement|tnp)/i,   text: /(placement|career|recruit|jobs?|training and placement)/i },
  { key: 'scholarships',    url: /(scholarship|financial-aid|fee-waiver|awards?)/i,   text: /(scholarship|financial aid|fee waiver)/i },
  { key: 'rankings',        url: /(ranking|nirf|qs-|qs_|the-ranking|accolade)/i,      text: /(ranking|nirf|qs|world ranking|accolade)/i },
  { key: 'research',        url: /(research|innovation|patent|publication|r-and-d)/i, text: /(research|innovation|patent|publication)/i },
  { key: 'international',   url: /(international|global|study-abroad|overseas|world)/i, text: /(international|global|study abroad|overseas)/i },
  { key: 'fees',            url: /(fee|tuition|cost)/i,                                text: /(fee structure|tuition|cost)/i },
  { key: 'news',            url: /(news|media|press)/i,                                text: /(news|press|media)/i },
  { key: 'about',           url: /(about|who-we-are|history|vision|mission)/i,         text: /(about|who we are|history|vision|mission)/i },
];

const IGNORE_URL_RE = /(login|signin|sign-in|register|signup|sign-up|portal|erp|cms|dashboard|logout|\.pdf$|\.jpg$|\.png$|\.jpeg$|\.gif$|\.zip$|\.doc$|\.docx$|\.xls$|\.xlsx$|\.ppt$|\.pptx$|search|javascript:|mailto:|tel:|#$)/i;

async function fetchWithTimeout(url, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const html = await res.text();
    return { status: res.status, html, finalUrl: res.url };
  } finally {
    clearTimeout(t);
  }
}

function clean(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(href, baseUrl) {
  if (!href) return null;
  try {
    const u = new URL(href, baseUrl);
    u.hash = '';
    // strip common tracking params
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid'].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch { return null; }
}

// Parse HTML and extract structured info. Reused for home + inner pages.
function parseHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const title = clean($('title').first().text());
  const description = clean($('meta[name="description"]').attr('content'));
  const canonical = clean($('link[rel="canonical"]').attr('href'));
  const ogTitle = clean($('meta[property="og:title"]').attr('content'));
  const ogDesc = clean($('meta[property="og:description"]').attr('content'));
  const ogImage = clean($('meta[property="og:image"]').attr('content'));
  const twitterCard = clean($('meta[name="twitter:card"]').attr('content'));

  const h1s = $('h1').map((_, el) => clean($(el).text())).get().filter(Boolean).slice(0, 20);
  const h2s = $('h2').map((_, el) => clean($(el).text())).get().filter(Boolean).slice(0, 40);
  const h3s = $('h3').map((_, el) => clean($(el).text())).get().filter(Boolean).slice(0, 60);

  const navSet = new Set();
  $('nav a, header a').each((_, el) => {
    const t = clean($(el).text());
    if (t && t.length > 1 && t.length < 60) navSet.add(t);
  });
  const nav = Array.from(navSet).slice(0, 80);

  const footerSet = new Set();
  $('footer a').each((_, el) => {
    const t = clean($(el).text());
    if (t && t.length > 1 && t.length < 80) footerSet.add(t);
  });
  const footer = Array.from(footerSet).slice(0, 100);

  const ctaSet = new Set();
  $('a.btn, button, a[class*="button"], a[class*="cta"], .btn a').each((_, el) => {
    const t = clean($(el).text());
    if (t && t.length > 1 && t.length < 40) ctaSet.add(t);
  });
  const ctas = Array.from(ctaSet).slice(0, 30);

  const bodyText = clean($('body').text()).slice(0, 15000);
  const statMatches = bodyText.match(/[0-9,]+\+?\s?(?:students|programs|programmes|courses|faculty|placements|companies|awards|patents|research|countries|ranked|rank|acres|crore|lakh|CTC|LPA|packages?|highest|average|median)/gi) || [];
  const stats = Array.from(new Set(statMatches.map(clean))).slice(0, 40);

  const images = $('img').length;
  const scripts = $('script').length;
  const links = $('a').length;

  const imgsWithAlt = $('img[alt]').filter((_, el) => clean($(el).attr('alt')).length > 0).length;
  const altCoverage = images > 0 ? Math.round((imgsWithAlt / images) * 100) : 0;

  const schemas = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    schemas.push(clean($(el).html()).slice(0, 300));
  });

  const paragraphs = $('p').map((_, el) => clean($(el).text())).get().filter(t => t.length > 30).slice(0, 30);

  // SEO score
  let seoScore = 0;
  if (title && title.length > 10 && title.length < 70) seoScore += 15;
  if (description && description.length > 50 && description.length < 180) seoScore += 15;
  if (canonical) seoScore += 10;
  if (h1s.length >= 1 && h1s.length <= 3) seoScore += 15;
  if (ogTitle) seoScore += 10;
  if (ogImage) seoScore += 5;
  if (twitterCard) seoScore += 5;
  if (schemas.length > 0) seoScore += 10;
  if (altCoverage >= 70) seoScore += 15;

  // Extract all internal links with their anchor text
  const linkMap = new Map(); // normalizedUrl -> anchor text
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const text = clean($(el).text());
    if (!href || !text) return;
    if (IGNORE_URL_RE.test(href)) return;
    const norm = normalizeUrl(href, baseUrl);
    if (!norm) return;
    // Same hostname only
    try {
      const u = new URL(norm);
      const base = new URL(baseUrl);
      if (u.hostname !== base.hostname) return;
    } catch { return; }
    // Skip index root
    const path = new URL(norm).pathname;
    if (path === '/' || path === '') return;
    if (!linkMap.has(norm)) linkMap.set(norm, text.slice(0, 100));
  });

  return {
    seo: {
      title, description, canonical, ogTitle, ogDesc, ogImage, twitterCard,
      h1: h1s, h2: h2s, h3: h3s,
      schemaCount: schemas.length,
      altCoverage,
      seoScore,
    },
    structure: {
      nav, footer, ctas, stats,
      images, scripts, links,
    },
    content: {
      paragraphs: paragraphs.slice(0, 15),
      textSample: bodyText.slice(0, 3000),
    },
    linkMap, // used for category classification
  };
}

// Classify links from home into category buckets. Returns { category: { url, text } }
function classifyLinks(linkMap) {
  const buckets = {};
  for (const [url, text] of linkMap.entries()) {
    let path = '';
    try { path = new URL(url).pathname; } catch { continue; }
    for (const cat of CATEGORIES) {
      if (buckets[cat.key]) continue; // already have one
      const hitUrl = cat.url.test(path);
      const hitText = cat.text.test(text);
      if (hitUrl || hitText) {
        buckets[cat.key] = { url, text, matchedBy: hitUrl ? 'url' : 'text' };
        break;
      }
    }
  }
  return buckets;
}

// Full crawl: home + categorized inner pages
export async function crawlSite(baseUrl) {
  const start = Date.now();
  const errors = [];
  let homeHtml = '';
  let homeStatus = 0;
  let finalHomeUrl = baseUrl;
  try {
    const r = await fetchWithTimeout(baseUrl, 20000);
    homeHtml = r.html;
    homeStatus = r.status;
    finalHomeUrl = r.finalUrl || baseUrl;
  } catch (e) {
    errors.push('fetch_home: ' + e.message);
  }
  if (!homeHtml) {
    return { ok: false, errors, elapsedMs: Date.now() - start };
  }

  const homeParsed = parseHtml(homeHtml, finalHomeUrl);
  const buckets = classifyLinks(homeParsed.linkMap);

  // Fetch up to N category pages in parallel with limited concurrency.
  const catEntries = Object.entries(buckets);
  const pages = { home: {
    url: finalHomeUrl,
    ok: true,
    status: homeStatus,
    seo: homeParsed.seo,
    structure: homeParsed.structure,
    content: homeParsed.content,
    bytes: homeHtml.length,
  }};

  const CONC = 2;
  for (let i = 0; i < catEntries.length; i += CONC) {
    const batch = catEntries.slice(i, i + CONC);
    const results = await Promise.all(batch.map(async ([cat, info]) => {
      try {
        const r = await fetchWithTimeout(info.url, 15000);
        if (r.status >= 200 && r.status < 400 && r.html) {
          const p = parseHtml(r.html, r.finalUrl || info.url);
          return [cat, {
            url: info.url,
            finalUrl: r.finalUrl || info.url,
            anchorText: info.text,
            ok: true,
            status: r.status,
            seo: p.seo,
            structure: { nav: p.structure.nav.slice(0, 20), stats: p.structure.stats, ctas: p.structure.ctas },
            content: { paragraphs: p.content.paragraphs.slice(0, 10) },
            bytes: r.html.length,
          }];
        }
        return [cat, { url: info.url, ok: false, status: r.status, error: 'bad status' }];
      } catch (e) {
        return [cat, { url: info.url, ok: false, error: e.message }];
      }
    }));
    for (const [k, v] of results) pages[k] = v;
  }

  // Backward-compatible flat fields from home
  const flat = {
    seo: homeParsed.seo,
    structure: homeParsed.structure,
    content: homeParsed.content,
  };

  // Aggregated stats
  const okPages = Object.values(pages).filter(p => p.ok).length;
  const avgSeo = Math.round(
    Object.values(pages).filter(p => p.ok && p.seo).reduce((a, p) => a + (p.seo.seoScore || 0), 0)
      / Math.max(1, Object.values(pages).filter(p => p.ok && p.seo).length)
  );

  return {
    ok: true,
    elapsedMs: Date.now() - start,
    status: homeStatus,
    bytesFetched: Object.values(pages).reduce((a, p) => a + (p.bytes || 0), 0),
    ...flat,
    pages,
    pageCount: okPages,
    coverage: Object.keys(pages),
    avgSeoScore: avgSeo,
    errors,
  };
}

// Diff two snapshots. Now aware of multi-page structure.
export function diffSnapshots(prev, curr) {
  if (!prev) {
    return { isFirstSnapshot: true, changeCount: 0, changes: [] };
  }

  const changes = [];

  const compare = (label, page, a, b, severity = 'medium') => {
    if ((a || '') !== (b || '')) {
      changes.push({ type: label, page, severity, before: a || null, after: b || null });
    }
  };

  const arrDiff = (label, page, a = [], b = [], severity = 'low') => {
    const sa = new Set(a);
    const sb = new Set(b);
    const added = b.filter(x => !sa.has(x));
    const removed = a.filter(x => !sb.has(x));
    if (added.length || removed.length) {
      changes.push({ type: label, page, severity, added, removed });
    }
  };

  const prevPages = prev.pages || { home: { seo: prev.seo, structure: prev.structure, content: prev.content } };
  const currPages = curr.pages || { home: { seo: curr.seo, structure: curr.structure, content: curr.content } };

  // Page-set changes (new/removed pages)
  const pa = Object.keys(prevPages), pb = Object.keys(currPages);
  const newPages = pb.filter(x => !pa.includes(x));
  const removedPages = pa.filter(x => !pb.includes(x));
  if (newPages.length) changes.push({ type: 'new_pages', page: 'site', severity: 'high', added: newPages, removed: [] });
  if (removedPages.length) changes.push({ type: 'removed_pages', page: 'site', severity: 'high', added: [], removed: removedPages });

  // Per-page diffs for pages present in both
  for (const key of pb) {
    if (!prevPages[key] || !prevPages[key].ok) continue;
    const p = prevPages[key];
    const c = currPages[key];
    if (!c || !c.ok) continue;

    compare('title', key, p.seo?.title, c.seo?.title, 'high');
    compare('description', key, p.seo?.description, c.seo?.description, 'medium');
    arrDiff('h1', key, p.seo?.h1, c.seo?.h1, 'high');
    arrDiff('h2', key, p.seo?.h2, c.seo?.h2, 'medium');
    if (key === 'home') {
      arrDiff('navigation', key, p.structure?.nav, c.structure?.nav, 'high');
      arrDiff('footer', key, p.structure?.footer, c.structure?.footer, 'low');
    }
    arrDiff('ctas', key, p.structure?.ctas, c.structure?.ctas, 'high');
    arrDiff('stats', key, p.structure?.stats, c.structure?.stats, 'medium');
  }

  return { isFirstSnapshot: false, changeCount: changes.length, changes };
}

export const CATEGORY_KEYS = CATEGORIES.map(c => c.key);
