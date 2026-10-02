// GCCAI website builder — no dependencies, just Node.js.
// Run `node build.js` (Vercel runs it for you). Output goes to /dist.
//
// You normally never need to edit this file. To change the site:
//   - Blog posts:   content/blog/*.md
//   - Cause pages:  content/causes/*.md
//   - Photos:       content/gallery/ (+ captions in content/gallery/captions.json)
//   - Page text:    src/pages/*.html
//   - Contacts, form links, numbers: site.config.json

import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, "dist");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));

// ---------- helpers ----------
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function formatDate(d) {
  const dt = new Date(d + "T12:00:00Z");
  if (isNaN(dt)) return d;
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ---------- front matter ----------
function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) {
      v = v.slice(1, -1).split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      v = v.replace(/^["']|["']$/g, "");
      if (v === "true") v = true;
      else if (v === "false") v = false;
      else if (/^\d+$/.test(v)) v = Number(v);
    }
    data[kv[1]] = v;
  }
  return { data, body: m[2] };
}

// ---------- tiny markdown ----------
function inline(s) {
  let out = esc(s);
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const ext = /^https?:\/\//.test(u);
    return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

function markdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let i = 0;
  const isBlockStart = (l) =>
    /^(#{1,6})\s/.test(l) || /^\s*[-*]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l) || /^>\s?/.test(l) || /^(-{3,}|\*{3,})\s*$/.test(l) || /^</.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      const lvl = m[1].length;
      const id = m[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      html.push(`<h${lvl} id="${id}">${inline(m[2])}</h${lvl}>`);
      i++; continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { html.push("<hr>"); i++; continue; }
    if (/^</.test(line)) { // raw HTML block, until blank line
      const buf = [];
      while (i < lines.length && lines[i].trim()) buf.push(lines[i++]);
      html.push(buf.join("\n")); continue;
    }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      html.push(`<blockquote>${markdown(buf.join("\n"))}</blockquote>`); continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const re = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/;
      const items = [];
      while (i < lines.length && re.test(lines[i])) {
        let item = lines[i++].replace(re, "");
        while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) item += " " + lines[i++].trim();
        items.push(`<li>${inline(item)}</li>`);
      }
      html.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`); continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++].trim());
    html.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return html.join("\n");
}

// ---------- content ----------
function loadCollection(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => {
      const { data, body } = parseFrontMatter(fs.readFileSync(path.join(full, f), "utf8"));
      const words = body.split(/\s+/).filter(Boolean).length;
      return { ...data, slug: f.replace(/\.md$/, ""), body, html: markdown(body), minutes: Math.max(1, Math.round(words / 220)) };
    });
}

const posts = loadCollection("content/blog")
  .filter((p) => p.draft !== true)
  .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (a.order || 99) - (b.order || 99));
const causes = loadCollection("content/causes").sort((a, b) => (a.order || 99) - (b.order || 99));

const IMG_RE = /\.(jpe?g|png|webp|gif|avif)$/i;
const galleryDir = path.join(ROOT, "content/gallery");
let captions = {};
try { captions = JSON.parse(fs.readFileSync(path.join(galleryDir, "captions.json"), "utf8")); } catch {}
const galleryFiles = fs.existsSync(galleryDir) ? fs.readdirSync(galleryDir).filter((f) => IMG_RE.test(f)) : [];
const captionOrder = Object.keys(captions);
const gallery = galleryFiles
  .sort((a, b) => {
    const ia = captionOrder.indexOf(a), ib = captionOrder.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
  })
  .map((f) => ({
    src: `/images/gallery/${f}`,
    caption: captions[f] || f.replace(IMG_RE, "").replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
  }));

// ---------- layout ----------
const NAV = [
  ["/", "Home"], ["/about/", "About"], ["/causes/", "Our causes"], ["/gallery/", "Gallery"],
  ["/blog/", "Blog"], ["/contact/", "Contact"],
];

function link(href, label, cls = "btn") {
  return `<a class="${cls}" href="${esc(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ""}>${label}</a>`;
}
const mailto = (subject) => `mailto:${cfg.email}?subject=${encodeURIComponent(subject)}`;

function layout({ title, description, body, current = "/", image }) {
  const fullTitle = title ? `${title} | ${cfg.shortName}` : `${cfg.name} (${cfg.shortName})`;
  const desc = description || cfg.description;
  const ogImage = cfg.siteUrl + (image || cfg.defaultShareImage);
  const nav = NAV.map(([href, label]) => {
    const active = href === "/" ? current === "/" : current.startsWith(href);
    return `<li><a href="${href}"${active ? ' aria-current="page"' : ""}>${label}</a></li>`;
  }).join("");
  const social = Object.entries(cfg.social || {}).filter(([, v]) => v && v.url)
    .map(([, v]) => `<li><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.label)}</a></li>`).join("");
  return `<!doctype html>
<html lang="en-NG">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/images/logo.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="GCCAI Blog" href="/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/" aria-label="${esc(cfg.name)} home">
      <img src="/images/logo.svg" alt="" width="48" height="48">
      <span class="brand-text"><span class="brand-name">Girl Child Care<br>Advancement Initiative</span></span>
    </a>
    <button class="menu-toggle" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav id="site-nav" class="site-nav" aria-label="Main">
      <ul>${nav}</ul>
      <a class="btn btn-small" href="/get-involved/">Get involved</a>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <a class="brand" href="/"><img src="/images/logo.svg" alt="" width="56" height="56"></a>
      <p class="footer-name">${esc(cfg.name)}</p>
      <p class="footer-tag">${esc(cfg.tagline)}</p>
    </div>
    <div>
      <h2 class="footer-h">Contact</h2>
      <ul class="plain">
        <li><a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a></li>
        ${cfg.phones.map((p) => `<li><a href="tel:${p.replace(/\s/g, "")}">${esc(p)}</a></li>`).join("")}
        <li>${esc(cfg.address)}</li>
      </ul>
    </div>
    <div>
      <h2 class="footer-h">Explore</h2>
      <ul class="plain">${NAV.slice(1).map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join("")}<li><a href="/get-involved/">Get involved</a></li></ul>
    </div>
    <div>
      <h2 class="footer-h">Follow</h2>
      <ul class="plain">${social}</ul>
    </div>
  </div>
  <div class="wrap footer-base">
    <p>Registered with the Corporate Affairs Commission, Nigeria: ${esc(cfg.registration)}. Founded 2018.</p>
    <p>We protect the privacy of the girls we work with. We publish photos only with consent and never share girls' personal details.</p>
    <p>© ${new Date().getFullYear()} ${esc(cfg.name)}</p>
  </div>
</footer>
<dialog class="lightbox" aria-label="Photo viewer">
  <button class="lightbox-close" aria-label="Close">×</button>
  <img alt="">
  <p class="lightbox-caption"></p>
</dialog>
<script src="/js/site.js" defer></script>
</body>
</html>`;
}

// ---------- reusable blocks (usable as {{tokens}} inside src/pages/*.html) ----------
function postCard(p) {
  const img = p.image ? `<img src="${esc(p.image)}" alt="${esc(p.imageAlt || "")}" loading="lazy">` : "";
  return `<article class="card post-card">
  ${img ? `<a class="card-img" href="/blog/${p.slug}/" tabindex="-1" aria-hidden="true">${img}</a>` : `<a class="card-img card-ph" href="/blog/${p.slug}/" tabindex="-1" aria-hidden="true"><img src="/images/logo.svg" alt="" loading="lazy"></a>`}
  <div class="card-body">
    <p class="eyebrow">${esc(p.category || "Blog")}</p>
    <h3><a href="/blog/${p.slug}/">${esc(p.title)}</a></h3>
    <p>${esc(p.summary || "")}</p>
    <p class="meta">${p.minutes} min read</p>
  </div>
</article>`;
}

function causeCard(c) {
  return `<article class="card cause-card">
  ${c.image ? `<a class="card-img" href="/causes/${c.slug}/" tabindex="-1" aria-hidden="true"><img src="${esc(c.image)}" alt="${esc(c.imageAlt || "")}" loading="lazy"></a>` : ""}
  <div class="card-body">
    <p class="eyebrow">${esc(c.programme || "")}</p>
    <h3><a href="/causes/${c.slug}/">${esc(c.title)}</a></h3>
    <p>${esc(c.summary || "")}</p>
    <a class="arrow" href="/causes/${c.slug}/">Read more<span aria-hidden="true"> →</span></a>
  </div>
</article>`;
}

function newsletterBlock() {
  const url = cfg.forms.newsletter;
  const action = url
    ? link(url, "Subscribe to the newsletter")
    : link(mailto("Subscribe me to the GCCAI newsletter"), "Subscribe by email");
  return `<section class="panel newsletter">
  <div>
    <p class="eyebrow">Newsletter</p>
    <h2>Stay close to the work</h2>
    <p>One email a month: what we are learning, opportunities for girls, and ways to help. No spam.</p>
  </div>
  <div class="newsletter-action">${action}</div>
</section>`;
}

function galleryGrid(items) {
  return `<div class="gallery">${items.map((g) => `<figure>
  <button class="gallery-item" data-full="${esc(g.src)}" data-caption="${esc(g.caption)}" aria-label="View photo: ${esc(g.caption)}">
    <img src="${esc(g.src)}" alt="${esc(g.caption)}" loading="lazy">
  </button>
  <figcaption>${esc(g.caption)}</figcaption>
</figure>`).join("")}</div>`;
}

// Partners: content/partners.json (logo = path under public/, e.g. /images/partners/name.png)
let partnersData = { partners: [] };
try { partnersData = JSON.parse(fs.readFileSync(path.join(ROOT, "content/partners.json"), "utf8")); } catch {}
function partnersBlock() {
  const list = (partnersData.partners || []).filter((p) => p && p.name);
  if (!list.length) return "";
  const tiles = list.map((p) => {
    const inner = p.logo
      ? `<img src="${esc(p.logo)}" alt="${esc(p.name)}" loading="lazy">`
      : `<span class="partner-name">${esc(p.name)}</span>`;
    const body = `${inner}${p.role ? `<span class="partner-role">${esc(p.role)}</span>` : ""}`;
    return p.url
      ? `<a class="partner" href="${esc(p.url)}" target="_blank" rel="noopener">${body}</a>`
      : `<div class="partner">${body}</div>`;
  }).join("");
  return `<section class="wrap section partners-section">
  <p class="eyebrow">Partners</p>
  <h2 class="section-title">${esc(partnersData.title || "Our partners")}</h2>
  <div class="partners">${tiles}</div>
  ${partnersData.note ? `<p class="stats-note">${esc(partnersData.note)}</p>` : ""}
</section>`;
}

// Board: content/board.json (names and roles only)
let boardData = { members: [] };
try { boardData = JSON.parse(fs.readFileSync(path.join(ROOT, "content/board.json"), "utf8")); } catch {}
function boardBlock() {
  const list = (boardData.members || []).filter((m) => m && m.name);
  if (!list.length) return "";
  const cards = list.map((m) => `<div class="board-card"><h3>${esc(m.name)}</h3><p>${esc(m.role || "")}</p></div>`).join("");
  return `<section class="wrap section board-section" id="board">
  <p class="eyebrow">Governance</p>
  <h2 class="section-title">${esc(boardData.title || "Our board")}</h2>
  ${boardData.intro ? `<p class="board-intro">${esc(boardData.intro)}</p>` : ""}
  <div class="board">${cards}</div>
</section>`;
}

const tokens = {
  board: boardBlock(),
  partners: partnersBlock(),
  email: esc(cfg.email),
  address: esc(cfg.address),
  registration: esc(cfg.registration),
  phones: cfg.phones.map((p) => `<a href="tel:${p.replace(/\s/g, "")}">${esc(p)}</a>`).join("<br>"),
  causes: `<div class="grid grid-3">${causes.map(causeCard).join("")}</div>`,
  latest_posts: `<div class="grid grid-3">${posts.slice(0, 3).map(postCard).join("")}</div>`,
  newsletter: newsletterBlock(),
  gallery_preview: galleryGrid(gallery.slice(0, 4)),
  stats: `<dl class="stats">${(cfg.stats || []).map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join("")}</dl>
<p class="stats-note">${esc(cfg.statsNote || "")}</p>`,
  volunteer_button: link(cfg.forms.volunteer || mailto("I would like to volunteer with GCCAI"), "Apply to volunteer"),
  partner_button: link(cfg.forms.partner || mailto("Partnership enquiry"), "Start a partnership conversation"),
  sponsor_button: link(mailto("Supporting a girl's education"), "Email us about giving", "btn btn-outline"),
  contact_button: link(`mailto:${cfg.email}`, "Email us"),
};

function fillTokens(html) {
  return html.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (all, k) => (k in tokens ? tokens[k] : all));
}

// ---------- build ----------
fs.rmSync(OUT, { recursive: true, force: true });
copyDir(path.join(ROOT, "public"), OUT);
for (const f of galleryFiles) {
  fs.mkdirSync(path.join(OUT, "images/gallery"), { recursive: true });
  fs.copyFileSync(path.join(galleryDir, f), path.join(OUT, "images/gallery", f));
}

// Pages from src/pages/*.html (first line: <!-- title: ... | description: ... -->)
const pagesDir = path.join(ROOT, "src/pages");
for (const f of fs.readdirSync(pagesDir).filter((f) => f.endsWith(".html"))) {
  let raw = fs.readFileSync(path.join(pagesDir, f), "utf8");
  const meta = {};
  const head = raw.match(/^<!--([\s\S]*?)-->/);
  if (head) {
    for (const part of head[1].split("|")) {
      const [k, ...v] = part.split(":");
      if (k && v.length) meta[k.trim()] = v.join(":").trim();
    }
    raw = raw.slice(head[0].length);
  }
  const name = f.replace(/\.html$/, "");
  const url = name === "index" ? "/" : name === "404" ? "/404" : `/${name}/`;
  const outFile = name === "index" ? "index.html" : name === "404" ? "404.html" : `${name}/index.html`;
  write(outFile, layout({ title: name === "index" ? "" : meta.title, description: meta.description, body: fillTokens(raw), current: url }));
}

// Causes
write("causes/index.html", layout({
  title: "Our causes",
  description: "GCCAI's three causes: education access, mentorship, and advocacy and awareness.",
  current: "/causes/",
  body: `<section class="page-head wrap">
  <p class="eyebrow">Our causes</p>
  <h1>Three ways we open doors for girls</h1>
  <p class="lede">Each cause tackles a specific barrier: the cost of school, the lack of guidance, and the silence around issues that harm girls. We are rebuilding each one in 2026 around what girls need.</p>
</section>
<section class="wrap section">{{causes}}</section>`.replace("{{causes}}", tokens.causes),
}));
for (const c of causes) {
  const others = causes.filter((x) => x.slug !== c.slug);
  write(`causes/${c.slug}/index.html`, layout({
    title: c.title, description: c.summary, current: "/causes/", image: c.image,
    body: `<article>
<section class="page-head wrap">
  <p class="eyebrow"><a href="/causes/">Our causes</a> · ${esc(c.programme || "")}</p>
  <h1>${esc(c.title)}</h1>
  <p class="lede">${esc(c.summary || "")}</p>
  ${c.status ? `<p class="status">${esc(c.status)}</p>` : ""}
</section>
${c.image ? `<figure class="wrap hero-figure"><img src="${esc(c.image)}" alt="${esc(c.imageAlt || "")}"><figcaption>${esc(c.imageAlt || "")}</figcaption></figure>` : ""}
<div class="wrap prose">${c.html}</div>
<section class="wrap section">
  <div class="panel cta-panel">
    <div><h2>Help us build this</h2><p>We are looking for volunteers, partners and supporters for this work.</p></div>
    <div class="btn-row">${tokens.volunteer_button}${tokens.partner_button}</div>
  </div>
</section>
<section class="wrap section"><h2 class="section-title">Other causes</h2><div class="grid grid-2">${others.map(causeCard).join("")}</div></section>
</article>`,
  }));
}

// Blog
write("blog/index.html", layout({
  title: "Blog", description: "Ideas, evidence and practical guides on girls' rights and opportunity in Nigeria.", current: "/blog/",
  body: `<section class="page-head wrap">
  <p class="eyebrow">Blog</p>
  <h1>Ideas, evidence and practical guides</h1>
  <p class="lede">Writing on girls' rights, safety and opportunity in Nigeria, grounded in Nigerian data.</p>
</section>
<section class="wrap section"><div class="grid grid-3">${posts.map(postCard).join("")}</div></section>
<section class="wrap section">${tokens.newsletter}</section>`,
}));
posts.forEach((p, idx) => {
  const more = posts.filter((x) => x.slug !== p.slug).slice(0, 3);
  write(`blog/${p.slug}/index.html`, layout({
    title: p.title, description: p.summary, current: "/blog/", image: p.image,
    body: `<article class="post">
<header class="page-head wrap narrow">
  <p class="eyebrow"><a href="/blog/">Blog</a> · ${esc(p.category || "")}</p>
  <h1>${esc(p.title)}</h1>
  <p class="lede">${esc(p.summary || "")}</p>
  <p class="meta">${esc(p.author || "GCCAI Team")} · <time datetime="${esc(p.date)}">${formatDate(p.date)}</time> · ${p.minutes} min read</p>
</header>
${p.image ? `<figure class="wrap narrow hero-figure"><img src="${esc(p.image)}" alt="${esc(p.imageAlt || "")}"></figure>` : ""}
<div class="wrap narrow prose">${p.html}</div>
</article>
<section class="wrap section"><h2 class="section-title">Keep reading</h2><div class="grid grid-3">${more.map(postCard).join("")}</div></section>
<section class="wrap section">${tokens.newsletter}</section>`,
  }));
});

// Gallery
write("gallery/index.html", layout({
  title: "Gallery", description: "Photos from GCCAI's school visits, outreaches and campaigns.", current: "/gallery/",
  body: `<section class="page-head wrap">
  <p class="eyebrow">Gallery</p>
  <h1>Moments from our work</h1>
  <p class="lede">School visits, outreaches and campaigns since 2018. Photos are shared with consent.</p>
</section>
<section class="wrap section">${galleryGrid(gallery)}</section>`,
}));

// RSS + sitemap
const rssItems = posts.map((p) => `<item><title>${esc(p.title)}</title><link>${cfg.siteUrl}/blog/${p.slug}/</link><guid>${cfg.siteUrl}/blog/${p.slug}/</guid><pubDate>${new Date(p.date + "T09:00:00Z").toUTCString()}</pubDate><description>${esc(p.summary || "")}</description></item>`).join("");
write("rss.xml", `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>GCCAI Blog</title><link>${cfg.siteUrl}/blog/</link><description>${esc(cfg.description)}</description>${rssItems}</channel></rss>`);
const urls = ["/", "/about/", "/causes/", "/gallery/", "/blog/", "/get-involved/", "/contact/",
  ...causes.map((c) => `/causes/${c.slug}/`), ...posts.map((p) => `/blog/${p.slug}/`)];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${cfg.siteUrl}${u}</loc></url>`).join("")}</urlset>`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);

console.log(`Built ${posts.length} posts, ${causes.length} causes, ${gallery.length} photos → dist/`);
