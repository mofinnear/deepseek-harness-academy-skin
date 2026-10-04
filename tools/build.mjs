#!/usr/bin/env node
/**
 * Turn the artwork files named by `logo.config.json` into the single
 * self-contained client bundle DSH serves:
 *
 *   brand-override/dist/client.js
 *
 * Why one file: `dsh-client-modules` serves exactly one script per package
 * (`/plugins/<id>/client.js`) and only rewrites `require.async` chunks named
 * `client.<name>.js`. Nested relative imports are therefore not resolvable, so
 * every theme, text and artwork value is inlined here as data URIs.
 *
 * Authoring source: brand-override/client.js (the `__GENERATED_ARTWORK__` marker
 * is where the generated table lands).
 *
 * Usage: node tools/build.mjs
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TOOLS_DIR, '..');
const CONFIG_PATH = join(ROOT, 'logo.config.json');
const SOURCE_CLIENT = join(ROOT, 'brand-override', 'client.js');
const OUT_BUNDLE = join(ROOT, 'brand-override', 'dist', 'client.js');
const SKIN_CSS = join(ROOT, 'brand-override', 'skin.css');
const SKIN_ART_CSS = join(ROOT, 'brand-override', 'skin-art.css');
/**
 * Optional artwork under `skin.art`. Each key becomes `--dsh-academy-<kebab>-src`
 * and switches on the `/* @art <key> *\/` section of skin-art.css. Nine-slice
 * frames must ship at source size because skin-art.css slices them in source px.
 */
const ART_KEYS = ['panelFrame', 'panelFillMask', 'sidebarFrame', 'composerFrame', 'starLarge', 'starSparkles', 'sidebarProps', 'desk', 'deskBooks', 'deskGlobe', 'bubbleFrame', 'bubbleTail', 'sidebarLamp', 'hangingNotes'];
const NINE_SLICE = new Set(['panelFrame', 'panelFillMask', 'sidebarFrame', 'composerFrame', 'bubbleFrame']);
const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const MARKER = '/* __GENERATED_ARTWORK__ */';
/** What `$SKIN` in skin.css expands to; the extra `html` outranks host rules. */
const SKIN_SELECTOR = 'html body[data-dsh-anime-skin="active"]';

/** Slot keys the client plugin renders. */
const SLOT_KEYS = ['sidebarMark', 'sidebarName', 'heroMark'];

const RASTER_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/** Read and validate the manifest. */
function readConfig() {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  for (const key of SLOT_KEYS) {
    if (!config.artworks?.[key]) throw new Error(`logo.config.json is missing artworks.${key}`);
  }
  return config;
}

/**
 * Keep one artwork within its display budget.
 *
 * The bundle carries every asset as a data URI, so an oversized source would
 * bloat the served client script for no visible gain. Large rasters are
 * downscaled in place with Pillow (already a project dependency) and the result
 * is cached next to the source as `<name>.max<N>.png`.
 * @param file - resolved source path.
 * @param maxPx - longest allowed side in px, or undefined for no limit.
 * @returns the path to use.
 */
function withinBudget(file, maxPx, webp = false) {
  const limit = Number(maxPx);
  if (!Number.isFinite(limit) || limit <= 0 || extname(file).toLowerCase() === '.svg') return file;
  /* webp: lossy WebP with alpha (Chromium renders it); far smaller for large painted art. */
  const cached = `${file}.max${limit}.${webp ? 'webp' : 'png'}`;
  /* Keyed on the source's content, not mtime: a regenerated source can keep an
   * older mtime (seen with tools/char_layers.py output), and a stale cache then
   * ships the old art silently. The hash sits next to the cache in `<cache>.src`. */
  const stamp = `${cached}.src`;
  const digest = createHash('sha1').update(readFileSync(file)).digest('hex');
  if (existsSync(cached) && existsSync(stamp) && readFileSync(stamp, 'utf8') === digest) return cached;
  const script = [
    'import sys',
    'from PIL import Image',
    'src, dst, limit = sys.argv[1], sys.argv[2], int(sys.argv[3])',
    'im = Image.open(src).convert("RGBA")',
    'if max(im.size) > limit:',
    '    scale = limit / max(im.size)',
    '    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)',
    'im.save(dst, quality=90, method=6) if dst.endswith(".webp") else im.save(dst, optimize=True)',
    'print(f"[scale] {src} -> {im.width}x{im.height}")',
  ].join('\n');
  const run = spawnSync('python3', ['-c', script, file, cached, String(limit)], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`downscale failed for ${file}: ${run.stderr || run.stdout}`);
  if (run.stdout.trim()) process.stdout.write(run.stdout);
  writeFileSync(stamp, digest);
  return cached;
}

/**
 * Read the intrinsic size and viewBox of an SVG.
 * @param text - SVG source.
 * @returns width and height in user units.
 */
function svgMetrics(text) {
  const viewBox = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(text);
  if (viewBox) {
    const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n)) && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const w = /\bwidth\s*=\s*["']([\d.]+)/i.exec(text);
  const h = /\bheight\s*=\s*["']([\d.]+)/i.exec(text);
  if (w && h) return { width: Number(w[1]), height: Number(h[1]) };
  return { width: 24, height: 24 };
}

/**
 * Raster size straight from the file header, so no image library is needed.
 * @param buffer - file bytes.
 * @param ext - lower-case extension.
 * @returns width and height.
 */
function rasterMetrics(buffer, ext) {
  if (ext === '.png') return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (ext === '.gif') return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  if (ext === '.webp' && buffer.toString('ascii', 12, 16) === 'VP8X') {
    return {
      width: 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)),
      height: 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)),
    };
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return { width: 0, height: 0 };
}

/**
 * Make one mask-mode SVG theme-neutral.
 *
 * Every baked color is stripped and the root element is given an opaque
 * `fill`, so the mask alpha is exactly the artwork silhouette. Two details
 * matter and were both bugs at first:
 *
 *  1. `fill="none"` inherits down the whole subtree, so a root `fill="none"`
 *     left in place makes every path invisible — the mask then renders nothing
 *     with no console error.
 *  2. `currentColor` inside a mask-image document does not follow the element
 *     that references the mask, so the mask paints black instead of the host
 *     text color.
 *
 * The visible paint therefore comes from the CSS `background-color` of the
 * masked element, never from the artwork.
 * @param text - SVG source.
 * @param metrics - intrinsic size.
 * @returns rewritten SVG source.
 */
function neutralizeSvg(text, metrics) {
  let out = text;
  out = out.replace(/\sfill\s*=\s*["'][^"']*["']/gi, '');
  out = out.replace(/\sstroke\s*=\s*["'][^"']*["']/gi, '');
  out = out.replace(/\sstyle\s*=\s*["'][^"']*["']/gi, (match) =>
    /fill|stroke|color|background/i.test(match) ? '' : match,
  );
  out = out.replace(/\swidth\s*=\s*["'][^"']*["']/i, '');
  out = out.replace(/\sheight\s*=\s*["'][^"']*["']/i, '');
  out = out.replace(
    /<svg\b/i,
    `<svg width="${metrics.width}" height="${metrics.height}" fill="#000"`,
  );
  return out;
}

/**
 * Resolve the artwork file for one slot, preferring an explicit `-dark` sibling.
 * @param source - configured source path.
 * @param dark - whether the dark variant is requested.
 * @returns an absolute path that exists.
 */
function resolveSource(source, dark) {
  const abs = resolve(ROOT, source);
  if (!existsSync(abs)) throw new Error(`artwork not found: ${source} (looked in ${abs})`);
  if (!dark) return abs;
  const ext = extname(abs);
  const darkAbs = abs.slice(0, -ext.length) + `-dark${ext}`;
  return existsSync(darkAbs) ? darkAbs : abs;
}

/**
 * Build one variant record for the inlined artwork table.
 * @param entry - config entry for the slot.
 * @param dark - whether this is the dark variant.
 * @returns the variant record.
 */
function buildVariant(entry, dark) {
  const file = withinBudget(resolveSource(entry.source, dark), entry.maxPx, entry.webp === true);
  const ext = extname(file).toLowerCase();
  const fit = entry.fit === 'img' ? 'img' : 'mask';
  const variant = { fit, src: '', width: 24, height: 24 };
  if (ext === '.svg') {
    const raw = readFileSync(file, 'utf8');
    const metrics = svgMetrics(raw);
    const svg = fit === 'mask' ? neutralizeSvg(raw, metrics) : raw;
    variant.src = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
    variant.width = metrics.width;
    variant.height = metrics.height;
  } else {
    const mime = RASTER_MIME[ext];
    if (!mime) throw new Error(`unsupported artwork format: ${file}`);
    const buffer = readFileSync(file);
    const metrics = rasterMetrics(buffer, ext);
    variant.src = `data:${mime};base64,${buffer.toString('base64')}`;
    variant.width = metrics.width || 24;
    variant.height = metrics.height || 24;
  }
  if (entry.aspect && entry.aspect !== 'auto') {
    const aspect = Number(entry.aspect);
    if (Number.isFinite(aspect) && aspect > 0) variant.height = variant.width / aspect;
  }
  variant.revision = createHash('sha256')
    .update(JSON.stringify({ file, mtimeMs: statSync(file).mtimeMs, src: variant.src.slice(0, 64) }))
    .digest('hex')
    .slice(0, 12);
  return variant;
}

/**
 * Build the theme CSS: one light variable set, one dark override matched on the
 * harness `data-ds-dark-theme` marker, and the image-variant display rules.
 *
 * The data URIs must be quoted: base64 contains `/` and `+`, and an unquoted
 * `url(...)` token is an invalid CSS value, which would make the mask render
 * blank with no console error.
 * @param data - generated table carrying `sidebarMark` and `heroMark` variants.
 * @returns CSS text.
 */
function themeCss(data) {
  const light = { sidebar: data.sidebarMark.light.src, hero: data.heroMark.light.src };
  const dark = { sidebar: data.sidebarMark.dark.src, hero: data.heroMark.dark.src };
  const skin = readFileSync(SKIN_CSS, 'utf8').replaceAll('$SKIN', SKIN_SELECTOR);
  const overrides = [];
  if (data.skinCornerStar) overrides.push(`${SKIN_SELECTOR} { --dsh-academy-star: url("${data.skinCornerStar.src}"); }`);
  const art = data.skinArt;
  const artVars = Object.entries(art).map(([key, variant]) => `  --dsh-academy-${kebab(key)}-src: url("${variant.src}");`);
  if (artVars.length) overrides.push(':root {', ...artVars, '}');
  if (art.starLarge) overrides.push(`${SKIN_SELECTOR} { --dsh-academy-star: var(--dsh-academy-star-large-src); }`);
  const artCss = readFileSync(SKIN_ART_CSS, 'utf8');
  for (const [, key, body] of artCss.matchAll(/\/\* @art (\w+) \*\/([\s\S]*?)\/\* @end \*\//g)) {
    if (!ART_KEYS.includes(key)) throw new Error(`skin-art.css has an unknown section: ${key}`);
    if (art[key]) overrides.push(`/* art: ${key} */`, body.replaceAll('$SKIN', SKIN_SELECTOR).trim());
  }
  if (data.skinMemo) overrides.push(`:root { --dsh-academy-memo-src: url("${data.skinMemo.src}"); }`);
  return [
    ':root {',
    `  --dsh-logo-mark-src: url("${light.sidebar}");`,
    `  --dsh-hero-mark-src: url("${light.hero}");`,
    `  --dsh-anime-workspace-background-src: url("${data.skinWorkspaceBackground.src}");`,
    `  --dsh-anime-sidebar-background-src: url("${data.skinSidebarBackground.src}");`,
    '}',
    'body[data-ds-dark-theme] {',
    `  --dsh-logo-mark-src: url("${dark.sidebar}");`,
    `  --dsh-hero-mark-src: url("${dark.hero}");`,
    '}',
    '@media (prefers-color-scheme: dark) {',
    '  :root {',
    `    --dsh-logo-mark-src: url("${dark.sidebar}");`,
    `    --dsh-hero-mark-src: url("${dark.hero}");`,
    '  }',
    '}',
    '.dsh-logo-dark-only { display: none; }',
    'body[data-ds-dark-theme] .dsh-logo-light-only { display: none !important; }',
    'body[data-ds-dark-theme] .dsh-logo-dark-only { display: block !important; }',
    '@media (prefers-color-scheme: dark) {',
    '  .dsh-logo-light-only { display: none !important; }',
    '  .dsh-logo-dark-only { display: block !important; }',
    '}',
    skin,
    ...overrides,
  ].join('\n');
}

/**
 * Build the right-rail asset table the client reads directly (the portrait is
 * too large to ship twice, so it is not also exposed as a CSS variable).
 * @param config - parsed manifest.
 * @returns mascot, memo and expression records.
 */
function buildSkinAssets(config) {
  const mascot = buildVariant({ ...config.skin.mascot, fit: 'img' }, false);
  const optional = (entry) => (entry?.source ? buildVariant({ ...entry, fit: 'img' }, false) : null);
  const expressions = (config.skin.expressions ?? []).map((entry) => {
    const portrait = optional(entry);
    const thumb = optional(entry.thumb ? { source: entry.thumb, maxPx: 160 } : null);
    const hair = optional(entry.hair ? { source: entry.hair, maxPx: 700, webp: true } : null);
    const shadow = optional(entry.shadow ? { source: entry.shadow, maxPx: 1352, webp: true } : null);
    return {
      label: entry.label,
      message: entry.message ?? null,
      src: portrait ? portrait.src : null,
      thumb: thumb ? thumb.src : null,
      hair: hair ? hair.src : null,
      shadow: shadow ? shadow.src : null,
    };
  });
  const art = Object.fromEntries(ART_KEYS.map((key) => [key, Boolean(config.skin.art?.[key]?.source)]));
  // 固定书桌 + 人物层：书桌和前景物件（羽毛笔、墨水瓶）各一张，不随表情切换
  const comboLayer = (key) => {
    const source = config.skin.mascot?.combo === true ? config.skin.mascot?.[key] : null;
    return source ? buildVariant({ source, maxPx: key === 'desk' ? 1405 : 1120, webp: true, fit: 'img' }, false).src : null;
  };
  return {
    mascot: mascot.src,
    combo: config.skin.mascot?.combo === true,
    comboDesk: comboLayer('desk'),
    comboFront: comboLayer('front'),
    expressions,
    hasMemoArt: Boolean(config.skin.memo?.source),
    art,
  };
}

/**
 * Inline the generated table into the authoring source.
 * @param source - authoring client.js text.
 * @param data - generated table, theme CSS and text config.
 * @returns the served bundle text.
 */
function inject(source, data) {
  if (!source.includes(MARKER)) throw new Error(`authoring source lost its ${MARKER} marker`);
  const generated = [
    '/** Artwork, inlined by tools/build.mjs. */',
    `var artworks = ${JSON.stringify(data.artworks)};`,
    '/** Theme CSS, inlined by tools/build.mjs. */',
    `var themeCss = ${JSON.stringify(data.themeCss)};`,
    '/** Optional text lockup, inlined by tools/build.mjs. */',
    `var text = ${JSON.stringify(data.text)};`,
    '/** Right-rail portrait, expressions and memo flags, inlined by tools/build.mjs. */',
    `var skinAssets = ${JSON.stringify(data.skinAssets)};`,
  ].join('\n    ');
  return source.replace(MARKER, generated);
}

function main() {
  const config = readConfig();
  const artworks = {};
  for (const key of SLOT_KEYS) {
    const entry = config.artworks[key];
    if (entry.source === null) {
      artworks[key] = { kind: 'text' };
      continue;
    }
    artworks[key] = { light: buildVariant(entry, false), dark: buildVariant(entry, true) };
  }
  for (const key of ['mascot', 'workspaceBackground', 'sidebarBackground']) {
    if (!config.skin?.[key]?.source) throw new Error(`logo.config.json is missing skin.${key}.source`);
  }
  const skinWorkspaceBackground = buildVariant({ ...config.skin.workspaceBackground, fit: 'img' }, false);
  const skinSidebarBackground = buildVariant({ ...config.skin.sidebarBackground, fit: 'img' }, false);
  const optional = (entry) => (entry?.source ? buildVariant({ ...entry, fit: 'img' }, false) : null);
  const skinCornerStar = optional(config.skin.cornerStar);
  const skinArt = {};
  for (const key of ART_KEYS) {
    const entry = config.skin.art?.[key];
    if (!entry?.source) continue;
    const variant = buildVariant({ ...entry, fit: 'img' }, false);
    if (NINE_SLICE.has(key)) {
      const original = rasterMetrics(readFileSync(resolve(ROOT, entry.source)), extname(entry.source).toLowerCase());
      if (variant.width !== original.width || variant.height !== original.height) {
        throw new Error(`skin.art.${key} must not be downscaled (skin-art.css slices it in source pixels); remove its maxPx`);
      }
    }
    skinArt[key] = variant;
  }
  const skinMemo = optional(config.skin.memo);
  const data = {
    artworks,
    skinAssets: buildSkinAssets(config),
    themeCss: themeCss({ ...artworks, skinWorkspaceBackground, skinSidebarBackground, skinCornerStar, skinMemo, skinArt }),
    text: {
      useCustomText: config.text?.useCustomText === true,
      value: config.text?.value ?? 'DeepSeek Harness',
      family: config.text?.family ?? null,
      weight: config.text?.weight ?? 600,
      letterSpacing: config.text?.letterSpacing ?? '0.01em',
    },
  };
  const bundle = inject(readFileSync(SOURCE_CLIENT, 'utf8'), data);
  mkdirSync(dirname(OUT_BUNDLE), { recursive: true });
  writeFileSync(OUT_BUNDLE, bundle);
  for (const key of SLOT_KEYS) {
    const record = artworks[key];
    const shape = record.kind === 'text'
      ? 'text lockup'
      : `${record.light.width}x${record.light.height} ${record.light.fit} ${record.light.src.length}B`;
    console.log(`[build] ${key.padEnd(12)} ${shape}`);
  }
  const budget = Number(config.maxBundleBytes);
  console.log(`[build] wrote ${OUT_BUNDLE} (${bundle.length} B)`);
  if (Number.isFinite(budget) && budget > 0 && bundle.length > budget) {
    throw new Error(
      `bundle is ${bundle.length} B, over the ${budget} B budget in logo.config.json — ` +
      'lower an artwork\'s maxPx or shrink the sources',
    );
  }
}

main();
