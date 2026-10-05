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
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
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

const RECORD_NAME = '.academy-install';

/**
 * Install record kept inside the plugin directory, the same file the one-click
 * scripts write: `added_row` (1 = we added the loader row, so uninstall removes
 * it; 0 = it was there before) and `previous_plugin` (backup of a different
 * plugin that sat at this path before install, put back on uninstall).
 * @param target - installed plugin directory.
 * @returns the record, or null when there is none (older installs).
 */
function readRecord(target) {
  const file = join(target, RECORD_NAME);
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');
  const get = (key) => (new RegExp(`^${key}=(.*)$`, 'm').exec(text) || [])[1] ?? '';
  return { addedRow: get('added_row') !== '0', previousPlugin: get('previous_plugin').trim(), createdPatch: get('created_patch') === '1' };
}

/**
 * For an older install without a record: the backup taken just before this
 * chain of installs began. Newest first, skipping backups that already hold
 * this skin (those come from upgrades); the first remaining one shows how
 * things were before the skin. Falls back to the project's first snapshot.
 * @param skip - the backup made by the current run.
 * @returns a backup directory or ''.
 */
function findPreSkinBackup(skip) {
  const root = process.env.DSH_SKIN_BACKUP_DIR || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'academy-skin-backup');
  let names = [];
  try { names = readdirSync(root).filter((name) => name.includes('-安装前')).sort().reverse(); } catch { /* no backups yet */ }
  for (const name of names) {
    const dir = join(root, name);
    if (dir === skip) continue;
    if (existsSync(join(dir, 'dsh-logo')) && isOurPlugin(join(dir, 'dsh-logo'))) continue;
    return dir;
  }
  return existsSync(BACKUP_DIR) ? BACKUP_DIR : '';
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
  const base = join(process.env.DSH_SKIN_BACKUP_DIR || join(home, 'academy-skin-backup'), `${stamp}-${label}`);
  let dir = base;
  for (let n = 1; existsSync(dir); n += 1) dir = `${base}-${n}`;   /* 同一秒里运行两次也不共用备份目录 */
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
    const record = (existsSync(target) && readRecord(target)) || { addedRow: true, previousPlugin: '', createdPatch: false };
    if (record.previousPlugin && !existsSync(record.previousPlugin)) {
      throw new Error(`a different plugin sat here before install, but its backup ${record.previousPlugin} is gone; left untouched. Delete ${join(target, RECORD_NAME)} first if you do not need it back.`);
    }
    backupBeforeChange(patchPath, target, '卸载前');
    /* Config first, plugin second: if the config cannot be written, nothing has been removed yet.
     * A loader row that was there before install stays. */
    if (record.addedRow && existsSync(patchPath)) writeFileSync(patchPath, mergePatch(readFileSync(patchPath, 'utf8'), false));
    /* The patch file was created by install and holds nothing else now: remove it again. */
    if (record.createdPatch && existsSync(patchPath) && !readFileSync(patchPath, 'utf8').trim()) rmSync(patchPath);
    rmSync(target, { recursive: true, force: true });
    if (record.previousPlugin) {
      cpSync(record.previousPlugin, target, { recursive: true });
      console.log(`[restore] put back the plugin that was here before install (${record.previousPlugin})`);
    }
    /* Remove node_modules/@local and node_modules only if install left them empty. */
    for (const dir of [dirname(target), dirname(dirname(target))]) {
      try { if (readdirSync(dir).length === 0) rmdirSync(dir); } catch { /* not there or not empty */ }
    }
    console.log('\nReverted to the state before install. Restart the DSH desktop app.');
    return;
  }

  if (!existsSync(bundle)) throw new Error(`built bundle missing: ${bundle} — run \`node tools/build.mjs\` first`);
  /* Work out the config change first so a conflicting row stops us before any file is touched. */
  const currentPatch = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : '';
  const nextPatch = mergePatch(currentPatch, true);
  const rowExisted = OUR_ROW_RE.test(currentPatch);
  const targetExisted = existsSync(target);
  const targetIsOurs = targetExisted && isOurPlugin(target);
  const oldRecord = targetIsOurs ? readRecord(target) : null;
  const backupDir = backupBeforeChange(patchPath, target, '安装前');

  /* Install record. Upgrading keeps the old one; an older install without a record
   * is reconstructed from the backup taken before the skin first went in. A newer
   * install of ours is never "the plugin from before". */
  let addedRow; let previousPlugin; let createdPatch;
  if (targetIsOurs && oldRecord) {
    ({ addedRow, previousPlugin, createdPatch } = oldRecord);
  } else if (targetIsOurs) {
    const orig = findPreSkinBackup(backupDir);
    if (orig) {
      console.log(`[record] older install without a record; reconstructed from ${orig}`);
      const origPatch = join(orig, 'cordis.patch.yml');
      previousPlugin = existsSync(join(orig, 'dsh-logo')) ? join(orig, 'dsh-logo') : '';
      createdPatch = !existsSync(origPatch);
      addedRow = createdPatch || !OUR_ROW_RE.test(readFileSync(origPatch, 'utf8'));
    } else {
      addedRow = true; previousPlugin = ''; createdPatch = false;
    }
  } else {
    addedRow = false;
    previousPlugin = targetExisted ? join(backupDir, 'dsh-logo') : '';
    createdPatch = !existsSync(patchPath);
  }
  if (!rowExisted) addedRow = true;

  /* Stage the new plugin and its record next to the target, then swap it in with one
   * rename: a failure while copying leaves everything as it was. */
  const stage = join(dirname(target), `.dsh-logo-staging-${process.pid}`);
  try {
    rmSync(stage, { recursive: true, force: true });
    mkdirSync(stage, { recursive: true });
    for (const entry of ['package.json', 'index.js', 'dist']) {
      cpSync(join(PLUGIN_SRC, entry), join(stage, entry), { recursive: true });
    }
    writeFileSync(join(stage, RECORD_NAME), `added_row=${addedRow ? 1 : 0}\nprevious_plugin=${previousPlugin}\ncreated_patch=${createdPatch ? 1 : 0}\n`);
  } catch (error) {
    rmSync(stage, { recursive: true, force: true });
    throw new Error(`could not prepare the plugin files; nothing was changed (${error.message})`);
  }
  const restoreOldPlugin = () => {
    rmSync(target, { recursive: true, force: true });
    if (existsSync(join(backupDir, 'dsh-logo'))) cpSync(join(backupDir, 'dsh-logo'), target, { recursive: true });
  };
  try {
    rmSync(target, { recursive: true, force: true });
    renameSync(stage, target);
  } catch (error) {
    rmSync(stage, { recursive: true, force: true });
    restoreOldPlugin();
    throw new Error(`could not swap in the plugin; the old plugin was put back (${error.message})`);
  }
  try {
    if (nextPatch !== currentPatch || !existsSync(patchPath)) writeFileSync(patchPath, nextPatch);
  } catch (error) {
    restoreOldPlugin();
    throw new Error(`could not write ${patchPath}; the plugin was put back as before (${error.message})`);
  }
  if (previousPlugin) console.log(`[record] a different plugin was here before install; backed up to ${previousPlugin} and put back on --revert`);
  console.log('\nInstalled. Restart the DSH desktop app, then reload the Web GUI page.');
}

try {
  main();
} catch (error) {
  console.error(`\n[install] ${error.message}`);
  process.exitCode = 1;
}
