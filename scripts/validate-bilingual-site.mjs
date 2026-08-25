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
  ['/nuclear-scada-cybersecurity-africa/', '/fr/cybersecurite-ot-nucleaire-afrique/']
];

const failures = [];
const expectedUrls = new Set(pagePairs.flat());

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

    const jsonLdBlocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
    if (jsonLdBlocks.length === 0) fail(pagePath, 'no JSON-LD found');
    for (const [, rawJson] of jsonLdBlocks) {
      try {
        const data = JSON.parse(rawJson);
        if (data.inLanguage && data.inLanguage !== language) {
          fail(pagePath, `JSON-LD inLanguage should be ${language}`);
        }
        if (data.dateModified) {
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(data.dateModified) || Number.isNaN(Date.parse(data.dateModified))) {
            fail(pagePath, `invalid dateModified: ${data.dateModified}`);
          }
        }
      } catch (error) {
        fail(pagePath, `invalid JSON-LD: ${error.message}`);
      }
    }

    const hrefs = [...html.matchAll(/\shref=(["'])(.*?)\1/gi)].map((match) => match[2]);
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

console.log(`Bilingual validation passed: ${pagePairs.length * 2} pages, reciprocal hreflang, valid JSON-LD and complete internal links.`);
