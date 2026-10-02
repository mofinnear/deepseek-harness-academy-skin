#!/usr/bin/env node
/**
 * Sanity-check the built bundle without a browser.
 *
 * Catches the failure modes that are silent at runtime:
 *   - a data URI that never made it into the bundle,
 *   - unquoted `url(...)` values (invalid CSS — the mask renders blank),
 *   - a mask-mode SVG that still hides its own artwork (`fill="none"` inherited,
 *     or `currentColor` left in place),
 *   - slots registered at priority 0, which would collide with the official
 *     registration instead of shadowing it.
 *
 * Usage: node tools/verify.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = join(ROOT, 'brand-override', 'dist', 'client.js');

const checks = [];
const record = (name, ok, detail) => {
  checks.push({ name, ok, detail });
};

const source = readFileSync(BUNDLE, 'utf8');

record('bundle parses as a module script', (() => {
  try {
    new Function(source.replace('window.__ModuleLoader__.load', 'void'));
    return true;
  } catch (error) {
    return String(error);
  }
})() === true);

record('module id is the package name', source.includes("id: '@local/dsh-logo'"));
record('skin switcher is an accessible dropdown driven by the SKINS list', source.includes('var SKINS = [') && source.includes("setAttribute('aria-haspopup', 'menu')") && source.includes("'menuitemradio'") && source.includes("event.key === 'Escape'"));
record('sidebar column backdrop is cleared so the panorama reads as one surface', source.includes('[class*=\\"_sidebarCol\\"] { background: transparent !important; }'));
record('skin choice persists locally', source.includes("window.localStorage.setItem(SKIN_STORAGE_KEY"));
record('background, focus and panel stages are reversible by keyboard', source.includes('SKIN_STAGE_STORAGE_KEY') && source.includes("event.code !== 'KeyB' && event.code !== 'KeyF'") && source.includes("setSkinStage(current === 'background-only' ? 'panels' : 'background-only', true)") && source.includes("setSkinStage(current === 'focus' ? 'panels' : 'focus', true)"));
record('skin uses the DSH theme override service', source.includes('themeService.overrideTokens(SKIN_THEME_SOURCE, tokens)'));
record('skin selects a non-persisted light theme and restores the saved one', source.includes("colorScheme: 'light'") && source.includes('preferenceBeforeSkin') && source.includes('useAcademyTheme(false)'));
record('dark-theme tokens are pinned to light values under the skin', source.includes('function skinTokenSet()') && source.includes("indexOf('data-ds-dark-theme')"));
record('skin can remove its token layer', source.includes('disposeSkinTokens()'));
record('code blocks use the readable academy palette', source.includes("'--dsw-alias-markdown-code-block':") && source.includes("'--dsw-alias-markdown-code-block-banner':"));
record('right rail mounts portrait, bubble and expression picker', source.includes('data-dsh-academy-rail') && source.includes('dsh-academy-character') && source.includes('dsh-academy-bubble') && source.includes('dsh-academy-expression'));
record('skin toggle removes the right rail', source.includes("document.querySelector('[data-dsh-academy-rail]')?.remove()"));
record('expression choice persists locally', source.includes('SKIN_EXPRESSION_STORAGE_KEY') && source.includes("button.setAttribute('aria-pressed'"));
record('sidebar labels adapt to the academy skin', source.includes('data-dsh-academy-new-chat') && source.includes('最近对话'));
record('sidebar relabel pass is throttled and keeps running while hidden', source.includes('relabelQueued') && source.includes('}, 60);'));
record('sessions are never hidden by text matching', !source.includes('默认工作区'));
/* Only meaningful on a machine where install.mjs already ran; a fresh clone has no backup/. */
if (existsSync(join(ROOT, 'backup', 'ui-skin-original-20260930'))) {
  record('original plugin snapshot is preserved', existsSync(join(ROOT, 'backup', 'ui-skin-original-20260930', 'dsh-logo', 'dist', 'client.js')));
}

const tokensMatch = /var SKIN_TOKENS = (\{[\s\S]*?\n    \});/.exec(source);
record('anime skin token pairs are present', tokensMatch !== null);
if (tokensMatch) {
  const tokens = Function(`return (${tokensMatch[1]})`)();
  const malformed = Object.entries(tokens).filter(([, value]) =>
    typeof value.light !== 'string' || typeof value.dark !== 'string',
  );
  record('every anime skin token supports light and dark', malformed.length === 0, `${malformed.length} invalid`);
}

const themeCssMatch = /var themeCss = ("(?:\\.|[^"\\])*");/.exec(source);
record('generated skin stylesheet is present', themeCssMatch !== null);
if (themeCssMatch) {
  const css = JSON.parse(themeCssMatch[1]);
  const SKIN = 'html body[data-dsh-anime-skin="active"]';
  const rule = (selector) => {
    const start = css.indexOf(`${selector} {`);
    return start < 0 ? '' : css.slice(start, css.indexOf('}', start));
  };
  record('skin.css $SKIN placeholders are expanded', !css.includes('$SKIN'));
  record('panoramic background fills the viewport beneath content', /body\[data-dsh-anime-skin="active"\]::before\s*\{[^}]*z-index:\s*0;[^}]*inset:\s*0;[^}]*background-size:\s*cover, cover;/.test(css));
  record('calibration stage hides interface children but preserves body background', /body\[data-dsh-anime-skin-stage="background-only"\]\s*>\s*:not\(style\):not\(script\)\s*\{\s*visibility:\s*hidden\s*!important;/.test(css));
  const sidebar = rule(`${SKIN} div:has(> div > [data-slot="sidebar.workspaces"])`);
  record('sidebar is a floating rounded card with its own background', sidebar.includes('border-radius: 22px') && sidebar.includes('var(--dsh-anime-sidebar-background-src)'));
  record('workspace header row is hidden by row key, sessions stay visible', css.includes(`${SKIN} [role="treeitem"][data-row-key^="workspace:"] { display: none !important; }`));
  const column = rule(`${SKIN} div:has(> [data-slot="main"])`);
  const panel = rule(`${SKIN} div[data-phase]:has(> [data-conversation-content])`);
  record('conversation column reserves room for the right rail', column.includes('calc(var(--dsh-rail-w) + 6px)'));
  record('conversation panel (with header) gets the gold frame', panel.includes('border: 1.5px solid var(--dsh-academy-gold)') && panel.includes('border-radius: 22px'));
  const composer = rule(`${SKIN} [data-composer-card]`);
  record('composer fills the panel width instead of a fixed width', composer.includes('width: 100% !important') && !/calc\(100vw/.test(composer));
  record('composer ornaments do not intercept input', /\[data-composer-card\]::before,\s*\n[^{]*\[data-composer-card\]::after \{[^}]*pointer-events: none/.test(css));
  const zOf = (text) => Number(/z-index:\s*(\d+)/.exec(text)?.[1]);
  const railZ = zOf(rule('[data-dsh-academy-rail]'));
  record('chat column and rail stay below native header seat (15) and menus (20)', zOf(column) === 1 && railZ === 12, `${zOf(column)}/${railZ}`);
  record('sidebar card styling is dropped when the sidebar collapses', css.includes(`${SKIN} [data-sidebar-collapsed="true"] div:has(> div > [data-slot="sidebar.workspaces"]) {`));
  record('right rail yields to the native right panel', css.includes(`${SKIN}:not(:has([data-rightbar-collapsed="true"])) [data-dsh-academy-rail] { display: none; }`));
  record('skin toggle is mounted in the sidebar brand row, not fixed over the header', source.includes('row.appendChild(control)') && !/\.dsh-anime-skin-toggle \{[^}]*position: fixed/.test(css));
  record('right rail and focus stage collapse cleanly', css.includes('body[data-dsh-anime-skin-stage="focus"] [data-dsh-academy-rail]') && /@media \(max-width: 1100px\)[\s\S]*\[data-dsh-academy-rail\] \{ display: none; \}/.test(css));
  record('right panel stays inside its column', css.includes('width: calc(100% - 21px) !important'));
  const config = JSON.parse(readFileSync(join(ROOT, 'logo.config.json'), 'utf8'));
  for (const [key, entry] of Object.entries(config.skin?.art ?? {})) {
    if (key.startsWith('$') || !entry?.source) continue;
    const varName = `--dsh-academy-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}-src`;
    record(`art ${key} is bundled and its section is active`, css.includes(`${varName}: url("data:image/`) && css.includes(`/* art: ${key} */`));
  }
  record('composer frame scales with the composer height', source.includes('--dsh-composer-h') && source.includes('new ResizeObserver') && css.includes('calc(var(--dsh-ch) * 1.533)'));
  record('nine-slice frames are not downscaled', ['panelFrame', 'sidebarFrame', 'composerFrame'].every((key) => !config.skin?.art?.[key]?.maxPx));
  record('frame ornaments leave room for header controls', !config.skin?.art?.panelFrame?.source || css.includes('header { padding-right: 46px !important; padding-left: 46px !important; }'));
  record('workspace surfaces allow the panorama to show through', /'--dsw-alias-bg-base': \{ light: '#[\da-f]{8}'/i.test(source));
  record('panoramic workspace background is bundled as JPEG', /--dsh-anime-workspace-background-src: url\("data:image\/jpeg;base64,/.test(css));
  record('sidebar background is bundled as JPEG', /--dsh-anime-sidebar-background-src: url\("data:image\/jpeg;base64,/.test(css));
}

const skinAssetsMatch = /var skinAssets = (\{.*?\});\n/.exec(source);
record('right-rail asset table is inlined', skinAssetsMatch !== null);
if (skinAssetsMatch) {
  const assets = JSON.parse(skinAssetsMatch[1]);
  let size = 'missing';
  if (assets.mascot?.startsWith('data:image/png;base64,')) {
    const png = Buffer.from(assets.mascot.split(',')[1], 'base64');
    size = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
  }
  record('mascot portrait is bundled (PNG or WebP)', /^data:image\/(png|webp);base64,/.test(assets.mascot ?? ''));
  record('portrait is shipped once (not also as a CSS variable)', !source.includes('--dsh-anime-skin-mascot-src'));
  record('every expression has a label', Array.isArray(assets.expressions) && assets.expressions.every((entry) => typeof entry.label === 'string' && entry.label));
}

const registered = [...source.matchAll(/priority: SHADOW_PRIORITY/g)].length;
record('all three slots register through the shadow priority', registered === 3, `found ${registered}`);

for (const slot of ['sidebar.brand.mark', 'sidebar.brand.name', 'conversation.hero.brand.mark']) {
  record(`registers ${slot}`, source.includes(`name: '${slot}'`));
}

record('no unquoted data URI in a CSS url()', !/url\(data:/.test(source));

const generated = /var artworks = (\{.*?\});\n/.exec(source);
record('artwork table is inlined', generated !== null);
if (generated) {
  const artworks = JSON.parse(generated[1]);
  for (const key of ['sidebarMark', 'sidebarName', 'heroMark']) {
    const entry = artworks[key];
    if (entry.kind === 'text') {
      record(`${key} is a text lockup`, true);
      continue;
    }
    for (const mode of ['light', 'dark']) {
      const variant = entry[mode];
      const prefix = `${key}.${mode}`;
      record(`${prefix} has a data URI`, typeof variant.src === 'string' && variant.src.startsWith('data:'));
      record(`${prefix} has positive geometry`, variant.width > 0 && variant.height > 0, `${variant.width}x${variant.height}`);
      if (variant.fit === 'mask' && variant.src.startsWith('data:image/svg+xml')) {
        const svg = Buffer.from(variant.src.split(',')[1], 'base64').toString('utf8');
        const root = /<svg[^>]*>/i.exec(svg);
        const rootTag = root ? root[0] : '';
        record(`${prefix} paints its paths`, /fill="(#[0-9a-f]{3,8}|black|#000)"/i.test(rootTag), rootTag.trim());
        record(`${prefix} has no inheriting fill="none"`, !/fill="none"/i.test(svg));
        record(`${prefix} has no currentColor`, !/currentColor/i.test(svg));
        record(`${prefix} keeps its viewBox`, /viewBox="[^"]+"/i.test(svg));
      }
    }
  }
}

let failed = 0;
for (const check of checks) {
  if (!check.ok) failed += 1;
  const mark = check.ok ? 'ok  ' : 'FAIL';
  console.log(`${mark} ${check.name}${check.detail && !check.ok ? ` — ${check.detail}` : ''}`);
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exitCode = failed === 0 ? 0 : 1;
