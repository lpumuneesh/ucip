import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (compatible; UCIP-Bot/1.0; +https://ucip.example.com)';

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

export async function crawlSite(baseUrl) {
  const start = Date.now();
  const errors = [];
  let mainHtml = '';
  let status = 0;
  try {
    const r = await fetchWithTimeout(baseUrl, 20000);
    mainHtml = r.html;
    status = r.status;
  } catch (e) {
    errors.push('fetch_home: ' + e.message);
  }

  if (!mainHtml) {
    return { ok: false, errors, elapsedMs: Date.now() - start };
  }

  const $ = cheerio.load(mainHtml);
  const title = clean($('title').first().text());
  const description = clean($('meta[name="description"]').attr('content'));
  const canonical = clean($('link[rel="canonical"]').attr('href'));
  const ogTitle = clean($('meta[property="og:title"]').attr('content'));
  const ogDesc = clean($('meta[property="og:description"]').attr('content'));
  const ogImage = clean($('meta[property="og:image"]').attr('content'));
  const twitterCard = clean($('meta[name="twitter:card"]').attr('content'));

  const h1s = $('h1').map((_, el) => clean($(el).text())).get().filter(Boolean).slice(0, 30);
  const h2s = $('h2').map((_, el) => clean($(el).text())).get().filter(Boolean).slice(0, 60);
  const h3s = $('h3').map((_, el) => clean($(el).text())).get().filter(Boolean).slice(0, 100);

  // navigation links
  const navSet = new Set();
  $('nav a, header a').each((_, el) => {
    const t = clean($(el).text());
    if (t && t.length > 1 && t.length < 60) navSet.add(t);
  });
  const nav = Array.from(navSet).slice(0, 80);

  // footer links
  const footerSet = new Set();
  $('footer a').each((_, el) => {
    const t = clean($(el).text());
    if (t && t.length > 1 && t.length < 80) footerSet.add(t);
  });
  const footer = Array.from(footerSet).slice(0, 100);

  // CTAs / buttons
  const ctaSet = new Set();
  $('a.btn, button, a[class*="button"], a[class*="cta"], .btn a').each((_, el) => {
    const t = clean($(el).text());
    if (t && t.length > 1 && t.length < 40) ctaSet.add(t);
  });
  const ctas = Array.from(ctaSet).slice(0, 30);

  // Extract keywords / stats: look for text like numbers with words
  const bodyText = clean($('body').text()).slice(0, 20000);
  const statMatches = bodyText.match(/[0-9,]+\+?\s?(?:students|programs|courses|faculty|placements|companies|awards|patents|research|countries|ranked|rank|acres|crore|lakh|CTC|LPA|packages?)/gi) || [];
  const stats = Array.from(new Set(statMatches.map(clean))).slice(0, 40);

  // Images count
  const images = $('img').length;
  const scripts = $('script').length;
  const links = $('a').length;
  const internalLinks = $('a').filter((_, el) => {
    const h = $(el).attr('href') || '';
    return h.startsWith('/') || h.includes(new URL(baseUrl).hostname);
  }).length;

  // Alt tag coverage
  const imgsWithAlt = $('img[alt]').filter((_, el) => clean($(el).attr('alt')).length > 0).length;
  const altCoverage = images > 0 ? Math.round((imgsWithAlt / images) * 100) : 0;

  // Schema
  const schemas = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    schemas.push(clean($(el).html()).slice(0, 400));
  });

  // Text content sample (first meaningful paragraphs)
  const paragraphs = $('p').map((_, el) => clean($(el).text())).get().filter(t => t.length > 30).slice(0, 40);

  // Quick SEO score
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

  // Content hash for diff
  const contentSignature = [
    'T:' + title,
    'D:' + description,
    'H1:' + h1s.join('|'),
    'H2:' + h2s.slice(0, 20).join('|'),
    'NAV:' + nav.join('|'),
    'FOOT:' + footer.slice(0, 30).join('|'),
    'CTA:' + ctas.join('|'),
    'STATS:' + stats.join('|'),
  ].join('\n');

  return {
    ok: true,
    elapsedMs: Date.now() - start,
    status,
    seo: {
      title, description, canonical, ogTitle, ogDesc, ogImage, twitterCard,
      h1: h1s, h2: h2s, h3: h3s,
      schemaCount: schemas.length,
      altCoverage,
      seoScore,
    },
    structure: {
      nav, footer, ctas, stats,
      images, scripts, links, internalLinks,
    },
    content: {
      paragraphs,
      textSample: bodyText.slice(0, 5000),
    },
    contentSignature,
    bytesFetched: mainHtml.length,
    errors,
  };
}

// Diff two snapshots
export function diffSnapshots(prev, curr) {
  if (!prev) {
    return {
      isFirstSnapshot: true,
      changeCount: 0,
      changes: [],
    };
  }

  const changes = [];

  const compare = (label, a, b) => {
    if ((a || '') !== (b || '')) {
      changes.push({
        type: label,
        severity: 'medium',
        before: a || null,
        after: b || null,
      });
    }
  };

  compare('title', prev?.seo?.title, curr?.seo?.title);
  compare('description', prev?.seo?.description, curr?.seo?.description);
  compare('canonical', prev?.seo?.canonical, curr?.seo?.canonical);

  const arrDiff = (label, a = [], b = [], severity = 'low') => {
    const sa = new Set(a);
    const sb = new Set(b);
    const added = b.filter(x => !sa.has(x));
    const removed = a.filter(x => !sb.has(x));
    if (added.length || removed.length) {
      changes.push({ type: label, severity, added, removed });
    }
  };

  arrDiff('h1', prev?.seo?.h1, curr?.seo?.h1, 'high');
  arrDiff('h2', prev?.seo?.h2, curr?.seo?.h2, 'medium');
  arrDiff('navigation', prev?.structure?.nav, curr?.structure?.nav, 'high');
  arrDiff('footer', prev?.structure?.footer, curr?.structure?.footer, 'low');
  arrDiff('ctas', prev?.structure?.ctas, curr?.structure?.ctas, 'high');
  arrDiff('stats', prev?.structure?.stats, curr?.structure?.stats, 'medium');

  return {
    isFirstSnapshot: false,
    changeCount: changes.length,
    changes,
  };
}
