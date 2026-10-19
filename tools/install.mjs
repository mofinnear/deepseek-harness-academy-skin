#!/usr/bin/env node
/**
 * Install, remove or restore the local DSH brand and skin override from the sources.
 *
 * `--apply` builds the bundle and installs it with share/installer.mjs, the same
 * installer the one-click scripts in the share package run: the plugin files go
 * to `<profile>/local-plugins/dsh-logo`, Harness's bundled pnpm records them as a
 * `link:` dependency (so plugin installs from the Plugins page no longer move the
 * skin into node_modules/.ignored), and one insert row goes into
 * `<profile>/cordis.patch.yml`. Everything is user configuration, not app-bundle
 * content, so app updates do not revert it.
 *
 * `--revert` undoes that (share/installer.mjs uninstall; `--force` passes through).
 * Without a flag it prints the plan and touches nothing.
 *
 * Usage:
 *   node tools/install.mjs            # dry run
 *   node tools/install.mjs --apply
 *   node tools/install.mjs --restore-original
 *   node tools/install.mjs --revert          # only removes the plugin if it is this skin (--force to override)
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TOOLS_DIR, '..');
const PLUGIN_SRC = join(ROOT, 'brand-override');
const INSTALLER = join(ROOT, 'share', 'installer.mjs');
const BACKUP_DIR = join(ROOT, 'backup', 'ui-skin-original-20260930');

const argv = process.argv.slice(2);
const mode = argv.includes('--apply') ? 'apply' : argv.includes('--restore-original') ? 'restore' : argv.includes('--revert') ? 'revert' : 'dry';

/** Resolve the profile directory from the environment, with the desktop default (same rule as share/installer.mjs). */
function profileDir() {
  if (process.env.DSH_PROFILE_DIR) return process.env.DSH_PROFILE_DIR;
  /* homedir()，不用 process.env.HOME：Windows 上通常没有 HOME（和应用本身一样按系统用户目录 + .dsh） */
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  return join(home, 'profiles', process.env.DSH_PROFILE || 'desktop');
}

/** Run share/installer.mjs with this node; throws when it fails (it has already printed why). */
function runInstaller(args) {
  const result = spawnSync(process.execPath, [INSTALLER, ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`share/installer.mjs ${args[0]} failed (exit ${result.status ?? 'unknown'})`);
}

/** Save the current working plugin and profile patch once before skin changes. */
function backupOriginal(profile) {
  if (existsSync(BACKUP_DIR)) {
    console.log(`\n[backup] keeping existing snapshot at ${BACKUP_DIR}`);
    return;
  }
  const target = join(profile, 'node_modules', '@local', 'dsh-logo');
  const patchPath = join(profile, 'cordis.patch.yml');
  mkdirSync(BACKUP_DIR, { recursive: true });
  if (existsSync(target)) cpSync(target, join(BACKUP_DIR, 'dsh-logo'), { recursive: true, dereference: true });
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
  console.log(`profile      ${profile}`);
  console.log(`patch file   ${join(profile, 'cordis.patch.yml')}`);
  console.log(`plugin files ${join(profile, 'local-plugins', 'dsh-logo')} (pnpm link: node_modules/@local/dsh-logo)`);

  if (mode === 'dry') {
    console.log('\nDry run. Re-run with --apply to install, --revert to remove.');
    return;
  }
  if (mode === 'restore') {
    const originalPlugin = join(BACKUP_DIR, 'dsh-logo');
    if (!existsSync(originalPlugin)) throw new Error(`original plugin backup not found: ${originalPlugin}`);
    runInstaller(['uninstall']);
    const target = join(profile, 'node_modules', '@local', 'dsh-logo');
    rmSync(target, { recursive: true, force: true });
    cpSync(originalPlugin, target, { recursive: true });
    console.log('\nRestored the original local logo plugin (copied into node_modules, so a later pnpm run may move it aside).');
    console.log('Restart the DSH desktop app to apply the restored plugin.');
    return;
  }
  if (mode === 'revert') {
    runInstaller(['uninstall', ...(argv.includes('--force') ? ['--force'] : [])]);
    console.log('\nRestart the DSH desktop app.');
    return;
  }

  backupOriginal(profile);
  /* Keep the installed bundle identical to the current sources and artwork. */
  const build = spawnSync(process.execPath, [join(ROOT, 'tools', 'build.mjs')], { stdio: 'inherit' });
  if (build.status !== 0) throw new Error(`bundle build failed (exit ${build.status ?? 'unknown'})`);
  runInstaller(['install', '--plugin', PLUGIN_SRC]);
  console.log('\nInstalled. Restart the DSH desktop app, then reload the Web GUI page.');
}

try {
  main();
} catch (error) {
  console.error(`\n[install] ${error.message}`);
  process.exitCode = 1;
}
