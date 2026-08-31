import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDirectory, '..');
const origin = 'https://nicolas-hamel.africa';

const pagePairs = [
  ['/', '/fr/'],
  ['/panorama-suite-africa/', '/fr/panorama-suite-afrique/'],
  ['/west-africa/', '/fr/afrique-de-l-ouest/'],
  ['/central-africa/', '/fr/afrique-centrale/'],
  ['/east-africa/', '/fr/afrique-de-l-est/'],
  ['/southern-africa/', '/fr/afrique-australe/'],
  ['/it-ot-convergence-africa/', '/fr/convergence-ot-it-afrique/'],
  ['/scada-south-africa/', '/fr/centre-de-controle-unifie-afrique-du-sud/'],
  ['/nuclear-scada-cybersecurity-africa/', '/fr/cybersecurite-ot-nucleaire-afrique/'],
  ['/bms-ems-africa/', '/fr/bms-ems-afrique/'],
  ['/industrial-historian-africa/', '/fr/historian-industriel-afrique/'],
  ['/psim-unified-control-centres-africa/', '/fr/psim-centres-controle-unifies-afrique/'],
  ['/mes-africa-panorama-coox/', '/fr/mes-afrique-panorama-coox/'],
  ['/unified-operations-centre-africa/', '/fr/centre-operations-unifie-afrique/'],
  ['/airports-unified-control-centres-africa/', '/fr/aeroports-centres-controle-unifies-afrique/'],
  ['/healthcare-unified-control-centres-africa/', '/fr/sante-centres-controle-unifies-afrique/'],
  ['/agri-food-unified-control-centres-africa/', '/fr/agroalimentaire-centres-controle-unifies-afrique/']
];

const failures = [];
const expectedUrls = new Set(pagePairs.flat());
const frenchDaaPages = new Set([
  '/fr/',
  '/fr/panorama-suite-afrique/',
  '/fr/afrique-de-l-ouest/',
  '/fr/afrique-centrale/',
  '/fr/afrique-de-l-est/',
  '/fr/afrique-australe/'
]);
const frenchDaaSource = 'https://codra.net/fr/actualite/2026/08/daa-detecter-lanormal-avant-lincident/';
const englishAfdSource = 'https://codra.net/en/news/2026/08/afd-detect-the-abnormal-before-it-becomes-an-incident/';

function fail(page, message) {
  failures.push(`${page}: ${message}`);
}

function fileForUrl(urlPath) {
  return path.join(siteRoot, urlPath.replace(/^\//, ''), 'index.html');
}

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)].map((match) => [match[1].toLowerCase(), match[3]])
  );
}

function linkElements(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => attributes(match[0]));
}

function metaElements(html) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => attributes(match[0]));
}

function visitStructuredData(value, visitor) {
  if (Array.isArray(value)) {
    for (const item of value) visitStructuredData(item, visitor);
    return;
  }
  if (!value || typeof value !== 'object') return;
  visitor(value);
  for (const nested of Object.values(value)) visitStructuredData(nested, visitor);
}

function ownPath(href) {
  if (href.startsWith('/')) return new URL(href, origin).pathname;
  if (href.startsWith(`${origin}/`) || href === origin) return new URL(href).pathname;
  return null;
}

async function exists(target) {
  try {
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
}

async function validateInternalLink(page, href) {
  const pathname = ownPath(href);
  if (!pathname || pathname.startsWith('/#')) return;

  const decoded = decodeURIComponent(pathname);
  const target = decoded.endsWith('/')
    ? path.join(siteRoot, decoded.replace(/^\//, ''), 'index.html')
    : path.join(siteRoot, decoded.replace(/^\//, ''));

  if (!(await exists(target))) fail(page, `internal link does not resolve: ${href}`);
}

for (const [englishPath, frenchPath] of pagePairs) {
  for (const [pagePath, language, counterpart] of [
    [englishPath, 'en', frenchPath],
    [frenchPath, 'fr', englishPath]
  ]) {
    const filename = fileForUrl(pagePath);
    const html = await readFile(filename, 'utf8');
    const links = linkElements(html);
    const metas = metaElements(html);
    const canonical = links.find((link) => link.rel === 'canonical');
    const alternates = Object.fromEntries(
      links.filter((link) => link.rel === 'alternate' && link.hreflang).map((link) => [link.hreflang, link.href])
    );

    if (!new RegExp(`<html\\s+lang=["']${language}["']`, 'i').test(html)) {
      fail(pagePath, `expected html lang=${language}`);
    }
    if (canonical?.href !== `${origin}${pagePath}`) {
      fail(pagePath, `canonical should be ${origin}${pagePath}`);
    }
    if (alternates.en !== `${origin}${englishPath}`) {
      fail(pagePath, `English hreflang should be ${origin}${englishPath}`);
    }
    if (alternates.fr !== `${origin}${frenchPath}`) {
      fail(pagePath, `French hreflang should be ${origin}${frenchPath}`);
    }
    if (alternates['x-default'] !== `${origin}${englishPath}`) {
      fail(pagePath, `x-default should be ${origin}${englishPath}`);
    }
    if (!html.includes(`href="${counterpart}"`)) {
      fail(pagePath, `visible language switcher should link to ${counterpart}`);
    }
    if (!html.includes('src="/assets/language.js"')) {
      fail(pagePath, 'shared language behaviour is missing');
    }

    const title = html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim();
    const description = metas.find((meta) => meta.name === 'description')?.content;
    const openGraph = Object.fromEntries(
      metas.filter((meta) => meta.property?.startsWith('og:')).map((meta) => [meta.property, meta.content])
    );
    const twitter = Object.fromEntries(
      metas.filter((meta) => meta.name?.startsWith('twitter:')).map((meta) => [meta.name, meta.content])
    );
    const expectedLocale = language === 'en' ? 'en_ZA' : 'fr_FR';
    const expectedAlternateLocale = language === 'en' ? 'fr_FR' : 'en_ZA';

    if (!title || title.length < 20 || title.length > 70) {
      fail(pagePath, `title length should be 20-70 characters, found ${title?.length ?? 0}`);
    }
    if (!description || description.length < 120 || description.length > 170) {
      fail(pagePath, `meta description length should be 120-170 characters, found ${description?.length ?? 0}`);
    }
    if (!openGraph['og:title'] || !openGraph['og:description'] || openGraph['og:url'] !== canonical?.href) {
      fail(pagePath, 'Open Graph title, description or canonical URL is incomplete');
    }
    if (openGraph['og:locale'] !== expectedLocale || openGraph['og:locale:alternate'] !== expectedAlternateLocale) {
      fail(pagePath, `Open Graph locales should be ${expectedLocale} and ${expectedAlternateLocale}`);
    }
    if (!twitter['twitter:title'] || !twitter['twitter:description'] || twitter['twitter:card'] !== 'summary_large_image') {
      fail(pagePath, 'X/Twitter summary metadata is incomplete');
    }

    const ids = [...html.matchAll(/\sid=(["'])(.*?)\1/gi)].map((match) => match[2]);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    if (duplicateIds.length > 0) fail(pagePath, `duplicate HTML ids: ${duplicateIds.join(', ')}`);
    if ((html.match(/<h1\b/gi) || []).length !== 1) fail(pagePath, 'expected exactly one h1');

    const jsonLdBlocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
    const structuredTypes = new Set();
    if (jsonLdBlocks.length === 0) fail(pagePath, 'no JSON-LD found');
    for (const [, rawJson] of jsonLdBlocks) {
      try {
        const data = JSON.parse(rawJson);
        visitStructuredData(data, (item) => {
          const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
          for (const type of types.filter(Boolean)) structuredTypes.add(type);
          if (item.inLanguage && item['@type'] !== 'VideoObject' && item.inLanguage !== language) {
            fail(pagePath, `JSON-LD inLanguage should be ${language}`);
          }
          for (const property of ['datePublished', 'dateModified']) {
            if (item[property] && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(item[property]) || Number.isNaN(Date.parse(item[property])))) {
              fail(pagePath, `invalid ${property}: ${item[property]}`);
            }
          }
        });
      } catch (error) {
        fail(pagePath, `invalid JSON-LD: ${error.message}`);
      }
    }

    if (pagePath === '/' || pagePath === '/fr/') {
      const terminology = language === 'en'
        ? ['Unified Control Centre', 'Unified Control Center', 'Unified Operations Centre', 'Integrated Operations Centre', 'Hypervision', 'Manager of Managers', 'umbrella system']
        : ['Centre de contrôle unifié', 'Centre des opérations unifié', 'Centre des opérations intégré', 'hypervision', 'Manager of Managers', 'système chapeau'];
      for (const term of terminology) {
        if (!html.toLocaleLowerCase(language).includes(term.toLocaleLowerCase(language))) {
          fail(pagePath, `homepage terminology is missing: ${term}`);
        }
      }
      if (!structuredTypes.has('FAQPage')) fail(pagePath, 'homepage FAQPage structured data is missing');
      if (!structuredTypes.has('DefinedTermSet')) fail(pagePath, 'homepage DefinedTermSet structured data is missing');
    }

    if (language === 'fr') {
      if (/\bAFD\b|détection automatique des défaillances|codra\.net\/en\/news\/2026\/08\/afd-/i.test(html)) {
        fail(pagePath, 'French content contains deprecated English AFD terminology or source');
      }
      if (frenchDaaPages.has(pagePath) && !html.includes('Détection Automatique d’Anomalies (DAA)')) {
        fail(pagePath, 'official French DAA terminology is missing');
      }
      if ((pagePath === '/fr/' || pagePath === '/fr/panorama-suite-afrique/') && !html.includes(frenchDaaSource)) {
        fail(pagePath, 'official French DAA source is missing');
      }
    }

    if (pagePath === '/' || pagePath === '/panorama-suite-africa/') {
      if (!html.includes('Automatic Fault Detection') || !html.includes('AFD') || !html.includes(englishAfdSource)) {
        fail(pagePath, 'English AFD terminology or official source is missing');
      }
      if (html.includes(frenchDaaSource)) fail(pagePath, 'English content links to the French DAA source');
    }

    const hrefs = [...html.matchAll(/\shref=(["'])(.*?)\1/gi)].map((match) => match[2]);
    for (const href of hrefs.filter((value) => value.startsWith('#'))) {
      const fragment = decodeURIComponent(href.slice(1));
      if (fragment && !ids.includes(fragment)) fail(pagePath, `local anchor does not resolve: ${href}`);
    }
    await Promise.all(hrefs.map((href) => validateInternalLink(pagePath, href)));
  }
}

const sitemap = await readFile(path.join(siteRoot, 'sitemap.xml'), 'utf8');
const sitemapUrls = new Set(
  [...sitemap.matchAll(/<loc>https:\/\/nicolas-hamel\.africa(.*?)<\/loc>/g)].map((match) => match[1] || '/')
);

for (const pagePath of expectedUrls) {
  if (!sitemapUrls.has(pagePath)) fail('sitemap.xml', `missing ${origin}${pagePath}`);
}
for (const pagePath of sitemapUrls) {
  if (!expectedUrls.has(pagePath)) fail('sitemap.xml', `unexpected URL ${origin}${pagePath}`);
}

for (const requiredAsset of ['assets/language.css', 'assets/language.js', 'llms.txt', 'robots.txt']) {
  if (!(await exists(path.join(siteRoot, requiredAsset)))) fail('site', `missing ${requiredAsset}`);
}

const frenchFiles = (await readdir(path.join(siteRoot, 'fr'), { recursive: true }))
  .filter((entry) => entry.endsWith('index.html'));
if (frenchFiles.length !== pagePairs.length) {
  fail('/fr/', `expected ${pagePairs.length} French pages, found ${frenchFiles.length}`);
}

if (failures.length > 0) {
  console.error(`Bilingual validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Bilingual validation passed: ${pagePairs.length * 2} pages, coherent metadata, reciprocal hreflang, valid JSON-LD and complete internal links.`);
