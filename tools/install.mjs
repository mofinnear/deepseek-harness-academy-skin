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
 *   node tools/install.mjs --revert
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
const ROW_MARK = `id: ${ROW_ID}`;
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

/**
 * Merge the insert row into a patch file, replacing any previous copy of it.
 * @param text - current patch file text.
 * @param enabled - true to add the row, false to strip it.
 * @returns the next patch file text.
 */
function mergePatch(text, enabled) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes(ROW_MARK)) {
      out.push(lines[i]);
      continue;
    }
    /* Drop the row and its `- insert:` owner line, plus any preceding comment. */
    if (out.length && out[out.length - 1].trim() === '- insert:') out.pop();
    if (out.length && out[out.length - 1].startsWith('# Local logo override')) out.pop();
    i += 1; /* skip the `name:` line */
  }
  let next = out.join('\n').replace(/\n{3,}/g, '\n\n');
  if (enabled) next = `${next.replace(/\s*$/, '')}\n\n${PATCH_BLOCK}`;
  return next.replace(/\s*$/, '') + '\n';
}

/** Save the current working plugin and profile patch once before skin changes. */
function backupOriginal(patchPath, target) {
  if (existsSync(BACKUP_DIR)) {
    console.log(`\n[backup] keeping existing snapshot at ${BACKUP_DIR}`);
    return;
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  if (existsSync(target)) cpSync(target, join(BACKUP_DIR, 'dsh-logo'), { recursive: true });
  cpSync(patchPath, join(BACKUP_DIR, 'cordis.patch.yml'));
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

  if (!existsSync(patchPath)) throw new Error(`profile patch file not found: ${patchPath}`);
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
  if (!existsSync(bundle)) throw new Error(`built bundle missing: ${bundle} — run \`node tools/build.mjs\` first`);

  if (mode === 'revert') {
    rmSync(target, { recursive: true, force: true });
    writeFileSync(patchPath, mergePatch(readFileSync(patchPath, 'utf8'), false));
    console.log('\nReverted. Restart the DSH desktop app to drop the override.');
    return;
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const entry of ['package.json', 'index.js', 'dist']) {
    cpSync(join(PLUGIN_SRC, entry), join(target, entry), { recursive: true });
  }
  writeFileSync(patchPath, mergePatch(readFileSync(patchPath, 'utf8'), true));
  console.log('\nInstalled. Restart the DSH desktop app, then reload the Web GUI page.');
}

main();
