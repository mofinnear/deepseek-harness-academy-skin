#!/usr/bin/env node
/**
 * Install, remove or restore the local DSH brand and skin override.
 *
 * `--apply` copies the built plugin into
 * `<profile>/node_modules/@local/dsh-logo` and merges one insert row into
 * `<profile>/cordis.patch.yml`. Because the loader resolves the row through the
 * profile directory, the row survives app updates: it is user configuration, not
 * app-bundle content.
 *
 * `--revert` removes both the row and the copied files.
 * Without a flag it prints the plan and touches nothing.
 *
 * Usage:
 *   node tools/install.mjs            # dry run
 *   node tools/install.mjs --apply
 *   node tools/install.mjs --restore-original
 *   node tools/install.mjs --revert          # only removes the plugin if it is this skin (--force to override)
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TOOLS_DIR, '..');
const PLUGIN_SRC = join(ROOT, 'brand-override');
const BACKUP_DIR = join(ROOT, 'backup', 'ui-skin-original-20260930');
const ROW_ID = 'local-dsh-logo';
const PACKAGE_SPEC = './node_modules/@local/dsh-logo/index.js';
const PATCH_BLOCK = [
  '# Local logo override. Added by dsh-logo/tools/install.mjs; remove with --revert.',
  '- insert:',
  `    - id: ${ROW_ID}`,
  `      name: ${PACKAGE_SPEC}`,
  '',
].join('\n');

const argv = process.argv.slice(2);
const mode = argv.includes('--apply') ? 'apply' : argv.includes('--restore-original') ? 'restore' : argv.includes('--revert') ? 'revert' : 'dry';

/** Resolve the profile directory from the environment, with the desktop default. */
function profileDir() {
  if (process.env.DSH_PROFILE_DIR) return process.env.DSH_PROFILE_DIR;
  /* homedir()，不用 process.env.HOME：Windows 上通常没有 HOME（和应用本身一样按系统用户目录 + .dsh） */
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  return join(home, 'profiles', process.env.DSH_PROFILE || 'desktop');
}

/** Any `- id: local-dsh-logo` row (`local-dsh-logo-extra` and the like do not match). */
const ROW_RE = /^[ \t]*- id: local-dsh-logo[ \t]*\r?$/m;
/** Our row: that id followed by our `name:` path. A row with the id but another path is someone else's. */
const OUR_ROW_RE = /^[ \t]*- id: local-dsh-logo[ \t]*\r?\n[ \t]+name: \.\/node_modules\/@local\/dsh-logo\/index\.js[ \t]*\r?$/m;
/**
 * The block the installers append: the newline before it, the comment (older
 * copies may lack it) and the `- insert:` / `id` / `name` rows, with our path
 * only. Same pattern as share/卸载.command and share/windows/uninstall.ps1.
 */
const BLOCK_RE = /\r?\n?(?:# Local logo override[^\r\n]*\r?\n)?- insert:\r?\n[ \t]+- id: local-dsh-logo[ \t]*\r?\n[ \t]+name: \.\/node_modules\/@local\/dsh-logo\/index\.js[ \t]*(?:\r?\n|$)/g;

/**
 * Add or remove this plugin's row. Only the appended block changes; the rest of
 * the user's file (blank lines, trailing newline, CRLF) is left byte for byte.
 * @param text - current patch file text.
 * @param enabled - true to add the row, false to strip it.
 * @returns the next patch file text.
 */
function mergePatch(text, enabled) {
  if (!enabled) return text.replace(BLOCK_RE, '');
  if (OUR_ROW_RE.test(text)) return text;
  if (ROW_RE.test(text)) {
    throw new Error('cordis.patch.yml already has an "- id: local-dsh-logo" row pointing at another path; left untouched. Check that entry by hand.');
  }
  return `${text}\n${PATCH_BLOCK}`;
}

/**
 * Whether the installed plugin directory is this skin. The same path
 * `@local/dsh-logo` was used before by a plain logo plugin (its description says
 * "brand override", ours "anime-academy skin"), so never delete it blindly.
 * @param target - installed plugin directory.
 * @returns true when absent or ours.
 */
function isOurPlugin(target) {
  if (!existsSync(target)) return true;
  try {
    const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'));
    return pkg.name === '@local/dsh-logo' && /anime-academy skin/.test(pkg.description ?? '');
  } catch {
    return false;
  }
}

/**
 * Copy the patch file and the installed plugin aside before changing either,
 * the same place the one-click scripts use. Throws if the copy fails.
 * @param patchPath - profile patch file.
 * @param target - installed plugin directory.
 * @param label - suffix such as 安装前 / 卸载前.
 * @returns the backup directory.
 */
function backupBeforeChange(patchPath, target, label) {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  const d = new Date();
  const two = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;   /* 本地时间，和安装脚本一致 */
  const dir = join(process.env.DSH_SKIN_BACKUP_DIR || join(home, 'academy-skin-backup'), `${stamp}-${label}`);
  mkdirSync(dir, { recursive: true });
  if (existsSync(patchPath)) cpSync(patchPath, join(dir, 'cordis.patch.yml'));
  if (existsSync(target)) cpSync(target, join(dir, 'dsh-logo'), { recursive: true });
  if (existsSync(patchPath) && !existsSync(join(dir, 'cordis.patch.yml'))) throw new Error(`backup failed: ${dir}`);
  if (existsSync(target) && !existsSync(join(dir, 'dsh-logo', 'package.json'))) throw new Error(`backup failed: ${dir}`);
  console.log(`[backup] ${dir}`);
  return dir;
}

/** Save the current working plugin and profile patch once before skin changes. */
function backupOriginal(patchPath, target) {
  if (existsSync(BACKUP_DIR)) {
    console.log(`\n[backup] keeping existing snapshot at ${BACKUP_DIR}`);
    return;
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  if (existsSync(target)) cpSync(target, join(BACKUP_DIR, 'dsh-logo'), { recursive: true });
  if (existsSync(patchPath)) cpSync(patchPath, join(BACKUP_DIR, 'cordis.patch.yml'));
  writeFileSync(
    join(BACKUP_DIR, 'README.txt'),
    'Original local DSH logo plugin and profile patch, saved before the anime skin was installed.\n' +
      'The app bundle was not changed. Use tools/install.mjs --restore-original to restore the plugin.\n',
  );
  console.log(`[backup] original plugin and profile saved to ${BACKUP_DIR}`);
}

function main() {
  const profile = profileDir();
  const patchPath = join(profile, 'cordis.patch.yml');
  const target = join(profile, 'node_modules', '@local', 'dsh-logo');
  const bundle = join(PLUGIN_SRC, 'dist', 'client.js');

  console.log(`profile      ${profile}`);
  console.log(`patch file   ${patchPath}`);
  console.log(`plugin files ${target}`);

  if (mode === 'dry') {
    console.log('\nDry run. Re-run with --apply to install, --revert to remove.');
    return;
  }

  if (mode === 'restore') {
    const originalPlugin = join(BACKUP_DIR, 'dsh-logo');
    if (!existsSync(originalPlugin)) throw new Error(`original plugin backup not found: ${originalPlugin}`);
    rmSync(target, { recursive: true, force: true });
    cpSync(originalPlugin, target, { recursive: true });
    console.log('\nRestored the original local logo plugin. The app bundle and profile entries were left intact.');
    console.log('Restart the DSH desktop app to apply the restored plugin.');
    return;
  }
  if (mode === 'apply') {
    backupOriginal(patchPath, target);
    /* Keep the installed bundle identical to the current sources and artwork. */
    const result = spawnSync(process.execPath, [join(ROOT, 'tools', 'build.mjs')], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`bundle build failed (exit ${result.status ?? 'unknown'})`);
  }
  if (mode === 'revert') {
    if (!isOurPlugin(target) && !argv.includes('--force')) {
      throw new Error(`${target} is not this skin (package.json does not say "anime-academy skin"); left untouched. Re-run with --force to remove it anyway.`);
    }
    backupBeforeChange(patchPath, target, '卸载前');
    /* Config first, plugin second: if the config cannot be written, nothing has been removed yet. */
    if (existsSync(patchPath)) writeFileSync(patchPath, mergePatch(readFileSync(patchPath, 'utf8'), false));
    rmSync(target, { recursive: true, force: true });
    console.log('\nReverted. Restart the DSH desktop app to drop the override.');
    return;
  }

  if (!existsSync(bundle)) throw new Error(`built bundle missing: ${bundle} — run \`node tools/build.mjs\` first`);
  backupBeforeChange(patchPath, target, '安装前');
  /* Work out the config change first so a conflicting row stops us before any file is touched. */
  const nextPatch = mergePatch(existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : '', true);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const entry of ['package.json', 'index.js', 'dist']) {
    cpSync(join(PLUGIN_SRC, entry), join(target, entry), { recursive: true });
  }
  writeFileSync(patchPath, nextPatch);
  console.log('\nInstalled. Restart the DSH desktop app, then reload the Web GUI page.');
}

try {
  main();
} catch (error) {
  console.error(`\n[install] ${error.message}`);
  process.exitCode = 1;
}
