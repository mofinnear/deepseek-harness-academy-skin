#!/usr/bin/env node
/**
 * 「星海书院」皮肤的安装 / 卸载（三种安装方式共用这一份）：
 *   - 分享包里的 安装.command / 卸载.command（macOS）、windows/install.ps1 / uninstall.ps1（Windows）
 *     用 DeepSeek Harness 自带的 node 运行它；
 *   - 源码里的 tools/install.mjs 先构建，再用它安装。
 * 只用 Node 自带模块，不需要另外装任何东西。
 *
 * 装在哪里（都在配置目录 <profile> = ~/.dsh/profiles/desktop 里，不改应用本体和签名）：
 *   <profile>/local-plugins/dsh-logo/          插件文件，连同安装记录 .academy-install
 *   <profile>/package.json、pnpm-lock.yaml     依赖 "@local/dsh-logo": "link:local-plugins/dsh-logo"（用 Harness 自带的 pnpm 加）
 *   <profile>/node_modules/@local/dsh-logo     pnpm 建的链接，指向上面的插件目录
 *   <profile>/cordis.patch.yml                 一条加载项 ./node_modules/@local/dsh-logo/index.js
 *
 * 为什么要交给 pnpm：Harness 的插件页装 / 卸插件时会在配置目录跑 pnpm，pnpm 会把 node_modules 里
 * 不归它管的东西挪进 node_modules/.ignored。v1.1.9 以前插件直接复制进 node_modules，装一次别的插件
 * 皮肤就消失了（2026-10-19 用户发现）。登记成 link: 依赖以后，pnpm 每次都会保留它。
 *
 * 用法：node installer.mjs install|uninstall [--plugin <插件目录>] [--force]
 *   --plugin  要安装的插件文件所在目录（含 package.json、index.js、dist/），默认是本文件旁边的 plugin/dsh-logo
 *   --force   卸载时，即使插件目录不是本皮肤也删除
 * 环境变量：DSH_HOME、DSH_PROFILE_DIR、DSH_SKIN_BACKUP_DIR、DSH_PRIMARY_RUNTIME（测试或非默认安装位置时用）
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_NAME = '@local/dsh-logo';
const LINK_SPEC = 'link:local-plugins/dsh-logo';
/** pnpm 记下的写法可能带 ./ 或反斜杠，都算本皮肤的依赖 */
const OUR_SPEC_RE = /^link:(?:\.[\\/])?local-plugins[\\/]dsh-logo[\\/]?$/;
const RECORD_NAME = '.academy-install';
const PATCH_BLOCK = [
  '# Local logo override. Added by dsh-logo/tools/install.mjs; remove with --revert.',
  '- insert:',
  '    - id: local-dsh-logo',
  '      name: ./node_modules/@local/dsh-logo/index.js',
  '',
].join('\n');
/** 任何 id 为 local-dsh-logo 的加载项（local-dsh-logo-extra 之类不算） */
const ROW_RE = /^[ \t]*- id: local-dsh-logo[ \t]*\r?$/m;
/** 本皮肤的那一条：这个 id 加上本皮肤的路径。id 相同、路径不同的是别人的 */
const OUR_ROW_RE = /^[ \t]*- id: local-dsh-logo[ \t]*\r?\n[ \t]+name: \.\/node_modules\/@local\/dsh-logo\/index\.js[ \t]*\r?$/m;
/** 安装时追加的那一段：前面的换行、注释（老版本可能没有）和 insert / id / name 三行；文件其余部分一个字节都不动 */
const BLOCK_RE = /\r?\n?(?:# Local logo override[^\r\n]*\r?\n)?- insert:\r?\n[ \t]+- id: local-dsh-logo[ \t]*\r?\n[ \t]+name: \.\/node_modules\/@local\/dsh-logo\/index\.js[ \t]*(?:\r?\n|$)/g;

const argv = process.argv.slice(2);
const command = argv[0];
const option = (name) => {
  const index = argv.indexOf(name);
  return index > 0 ? argv[index + 1] : undefined;
};

const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh');
const profile = process.env.DSH_PROFILE_DIR || join(dshHome, 'profiles', process.env.DSH_PROFILE || 'desktop');
const backupRoot = process.env.DSH_SKIN_BACKUP_DIR || join(dshHome, 'academy-skin-backup');
const patchPath = join(profile, 'cordis.patch.yml');
const manifestPath = join(profile, 'package.json');
const lockPath = join(profile, 'pnpm-lock.yaml');
/** 插件文件的新位置（pnpm 管不着，也不会挪） */
const localDir = join(profile, 'local-plugins', 'dsh-logo');
/** node_modules 里的位置：新装法是 pnpm 建的链接，v1.1.9 以前是复制进来的真目录 */
const linkPath = join(profile, 'node_modules', '@local', 'dsh-logo');
/** 被 pnpm 挪走的老插件 */
const ignoredDir = join(profile, 'node_modules', '.ignored', '@local', 'dsh-logo');

class InstallError extends Error {}
const fail = (message) => { throw new InstallError(message); };
const say = (message) => console.log(message);

/** 路径存在（链接本身也算，哪怕它指向的目录已经没了） */
function present(path) {
  try { lstatSync(path); return true; } catch { return false; }
}
const isLink = (path) => { try { return lstatSync(path).isSymbolicLink(); } catch { return false; } };
/** 是真目录（不是链接） */
const isRealDir = (path) => { try { const s = lstatSync(path); return s.isDirectory() && !s.isSymbolicLink(); } catch { return false; } };

/**
 * 同一个路径 @local/dsh-logo 以前也被一个只换 logo 的本地插件用过（它的说明是 "brand override"，
 * 本皮肤是 "anime-academy skin"），不能见到就删。
 */
function isOurPlugin(dir) {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    return pkg.name === PACKAGE_NAME && /anime-academy skin/.test(pkg.description ?? '');
  } catch {
    return false;
  }
}

/**
 * 安装记录（插件目录里的 .academy-install），卸载时据此还原到安装前：
 *   added_row=1        加载项是本皮肤加的（卸载时删掉）；0 = 安装前就有（保留）
 *   previous_plugin=…  安装前 node_modules/@local/dsh-logo 另有一个插件，它的备份位置（卸载时放回去）
 *   created_patch=1    cordis.patch.yml 是本皮肤新建的（卸载后变空就删掉）
 * package.json 里的依赖不用记：卸载时插件目录要删掉，依赖指向的目录没了 pnpm 会出错，所以只要是本皮肤的就去掉。
 */
function readRecord(dir) {
  const file = join(dir, RECORD_NAME);
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');
  const get = (key) => (new RegExp(`^${key}=(.*?)\\r?$`, 'm').exec(text) || [])[1];
  return {
    addedRow: get('added_row') !== '0',
    previousPlugin: (get('previous_plugin') ?? '').trim(),
    createdPatch: get('created_patch') === '1',
  };
}
const recordText = (r) => `added_row=${r.addedRow ? 1 : 0}\nprevious_plugin=${r.previousPlugin}\ncreated_patch=${r.createdPatch ? 1 : 0}\n`;

/**
 * 已经装着的本皮肤，按记录可信程度排：新位置 → 被 pnpm 挪走的那份 → node_modules 里的老位置。
 * 被挪走的那份排在老位置前面：用户在它被挪走后用老脚本重装过的话，老位置上的记录会把
 * 「本皮肤自己加的加载项」误记成「安装前就有」，挪走的那份才是原来的记录。
 */
function installedCopies() {
  const copies = [];
  if (existsSync(localDir) && isOurPlugin(localDir)) copies.push(localDir);
  if (isRealDir(ignoredDir) && isOurPlugin(ignoredDir)) copies.push(ignoredDir);
  if (isRealDir(linkPath) && isOurPlugin(linkPath)) copies.push(linkPath);
  return copies;
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return fail(`读不了 ${manifestPath}（${error.message}）。请先打开一次新版 DeepSeek Harness 再安装。`);
  }
}
const dependencySpec = (manifest) => manifest.dependencies?.[PACKAGE_NAME];

/** Harness 自带的 node 和 pnpm（插件页装插件用的也是这一套） */
function pnpmRunner() {
  const runtime = process.env.DSH_PRIMARY_RUNTIME || join(dshHome, 'dsh-runtimes', 'dsh-primary-runtime');
  const deps = join(runtime, 'dependencies');
  const pnpm = join(deps, 'pnpm', 'bin', 'pnpm.mjs');
  const bundledNode = join(deps, 'node', 'bin', process.platform === 'win32' ? 'node.exe' : 'node');
  if (!existsSync(pnpm)) fail(`找不到 DeepSeek Harness 自带的 pnpm（${pnpm}）。请先安装并打开一次新版 DeepSeek Harness 桌面版。`);
  const node = existsSync(bundledNode) ? bundledNode : process.execPath;
  const env = { ...process.env, PATH: `${dirname(node)}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}` };
  return (args) => {
    const result = spawnSync(node, [pnpm, ...args], { cwd: profile, env, encoding: 'utf8' });
    return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`.trim() };
  };
}

function timestamp() {
  const d = new Date();
  const two = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
}

/**
 * 改动前把要动的东西复制一份；任何一份复制失败都停下，什么都不改。
 * @param label - 安装前 / 卸载前
 * @param dirs - 要备份的插件目录 [目录, 备份里的名字]，不存在的跳过
 */
function backup(label, dirs) {
  const base = join(backupRoot, `${timestamp()}-${label}`);
  let dir = base;
  for (let n = 1; existsSync(dir); n += 1) dir = `${base}-${n}`;   /* 同一秒里运行两次也不共用备份目录 */
  try {
    mkdirSync(dir, { recursive: true });
    for (const file of [patchPath, manifestPath, lockPath]) {
      if (existsSync(file)) cpSync(file, join(dir, file.slice(profile.length + 1)));
    }
    for (const [from, name] of dirs) {
      if (from && existsSync(from)) cpSync(from, join(dir, name), { recursive: true, dereference: true });
    }
  } catch (error) {
    fail(`备份失败，没有做任何改动：${error.message}`);
  }
  say(`已备份原来的设置到：${dir}`);
  return dir;
}

/** 把配置文件放回备份时的样子（备份里没有的，说明原来就没有，删掉） */
function restoreConfig(backupDir) {
  for (const file of [patchPath, manifestPath, lockPath]) {
    const saved = join(backupDir, file.slice(profile.length + 1));
    if (existsSync(saved)) cpSync(saved, file);
    else rmSync(file, { force: true });
  }
}

function removeEmptyDirs(...dirs) {
  for (const dir of dirs) {
    try { if (readdirSync(dir).length === 0) rmdirSync(dir); } catch { /* 不存在或不是空的 */ }
  }
}

function install() {
  const src = resolve(option('--plugin') ?? join(HERE, 'plugin', 'dsh-logo'));
  say('== 星海书院皮肤 · 安装 ==');
  for (const file of ['package.json', 'index.js', join('dist', 'client.js')]) {
    if (!existsSync(join(src, file))) fail(`找不到插件文件（${src}）。请先把压缩包完整解压，再在解压出的文件夹里运行。`);
  }
  if (!existsSync(profile)) fail(`没有找到 DeepSeek Harness 的配置目录（${profile}）。请先安装并打开一次 DeepSeek Harness 桌面版。`);
  const pnpm = pnpmRunner();

  /* 先把所有要改的地方算好，有冲突就在动任何文件之前停下 */
  const patchExisted = existsSync(patchPath);
  const patchText = patchExisted ? readFileSync(patchPath, 'utf8') : '';
  const rowExisted = OUR_ROW_RE.test(patchText);
  if (ROW_RE.test(patchText) && !rowExisted) {
    fail(`${patchPath} 里已经有一条 id 为 local-dsh-logo、但指向别的路径的加载项，为安全起见没有做任何改动。请先手动检查那一条。`);
  }
  const spec = dependencySpec(readManifest());
  if (spec !== undefined && !OUR_SPEC_RE.test(spec)) {
    fail(`${manifestPath} 里已经有一个 ${PACKAGE_NAME} 依赖（${spec}），不是本皮肤的，为安全起见没有做任何改动。`);
  }
  if (existsSync(localDir) && !isOurPlugin(localDir)) {
    fail(`${localDir} 已经存在但不是星海书院皮肤，为安全起见没有做任何改动。`);
  }
  if (isLink(linkPath) && !(existsSync(localDir) && realpathSync(linkPath) === realpathSync(localDir))) {
    fail(`${linkPath} 是一个指向别处的链接，不是本皮肤装的，为安全起见没有做任何改动。`);
  }

  const copies = installedCopies();
  const current = copies[0];
  /* node_modules/@local/dsh-logo 上别人的插件（不是本皮肤）：备份后移走，卸载时放回去 */
  const foreign = isRealDir(linkPath) && !isOurPlugin(linkPath);
  const backupDir = backup('安装前', [[current, 'dsh-logo'], [foreign ? linkPath : undefined, 'previous-dsh-logo']]);
  const foreignBackup = foreign ? join(backupDir, 'previous-dsh-logo') : '';

  /* 安装记录：升级沿用旧记录；老版本没有记录的，从装皮肤之前的备份推断；第一次装照实记 */
  let record = current ? readRecord(current) : null;
  if (!record && current) record = recordFromPreSkinBackup(backupDir);
  if (!record) record = { addedRow: false, previousPlugin: '', createdPatch: !patchExisted };
  if (foreign && !record.previousPlugin) record.previousPlugin = foreignBackup;
  if (!rowExisted) record.addedRow = true;

  /* 新插件连同记录先放进临时目录，全部成功再一步换上去 */
  const stage = join(dirname(localDir), `.dsh-logo-staging-${process.pid}`);
  try {
    rmSync(stage, { recursive: true, force: true });
    mkdirSync(stage, { recursive: true });
    for (const entry of ['package.json', 'index.js', 'dist']) cpSync(join(src, entry), join(stage, entry), { recursive: true });
    writeFileSync(join(stage, RECORD_NAME), recordText(record));
  } catch (error) {
    rmSync(stage, { recursive: true, force: true });
    fail(`准备插件文件失败，没有做任何改动：${error.message}`);
  }

  /* 出错时回到安装前：配置文件从备份放回，插件文件放回原来的位置 */
  const rollback = () => {
    restoreConfig(backupDir);
    if (isLink(linkPath)) rmSync(linkPath, { force: true });
    rmSync(localDir, { recursive: true, force: true });
    if (current && !existsSync(current)) cpSync(join(backupDir, 'dsh-logo'), current, { recursive: true });
    if (foreign && !present(linkPath)) cpSync(foreignBackup, linkPath, { recursive: true });
    removeEmptyDirs(dirname(localDir));
  };

  try {
    rmSync(localDir, { recursive: true, force: true });
    renameSync(stage, localDir);
    /* 老位置上的真目录（老版本皮肤，或已经备份的别人的插件）让给 pnpm 的链接；被挪走的那份老皮肤一起清掉 */
    if (isRealDir(linkPath)) rmSync(linkPath, { recursive: true, force: true });
    if (isRealDir(ignoredDir) && isOurPlugin(ignoredDir)) rmSync(ignoredDir, { recursive: true, force: true });
    removeEmptyDirs(dirname(ignoredDir), dirname(dirname(ignoredDir)));
  } catch (error) {
    rmSync(stage, { recursive: true, force: true });
    rollback();
    fail(`替换插件文件失败，已恢复原来的样子：${error.message}`);
  }

  /* 登记依赖：先离线（只用本机已有的包，不联网），不行再正常装 */
  let result = pnpm(['add', `${PACKAGE_NAME}@${LINK_SPEC}`, '--offline']);
  if (!result.ok) result = pnpm(['add', `${PACKAGE_NAME}@${LINK_SPEC}`]);
  const linked = result.ok && existsSync(join(linkPath, 'package.json')) && realpathSync(linkPath) === realpathSync(localDir);
  if (!linked) {
    rollback();
    fail(`用 pnpm 登记插件失败，已恢复原来的样子。pnpm 的输出：\n${result.output}`);
  }

  if (!rowExisted) {
    try {
      writeFileSync(patchPath, `${patchText}\n${PATCH_BLOCK}`);
      if (!OUR_ROW_RE.test(readFileSync(patchPath, 'utf8'))) throw new Error('写入后没有找到加载项');
    } catch (error) {
      pnpm(['remove', PACKAGE_NAME]);
      rollback();
      fail(`写入 ${patchPath} 失败，已恢复原来的样子：${error.message}`);
    }
    say('已添加插件加载项。');
  } else {
    say('插件加载项已存在，不重复添加。');
  }
  say('已用 DeepSeek Harness 自带的 pnpm 登记插件：以后在插件页安装、卸载别的插件，皮肤不会再被挪走。');
  if (record.previousPlugin) say(`安装前这里有另一个插件，已备份到 ${record.previousPlugin}，卸载时会放回去。`);
}

/**
 * 老版本（没有安装记录）升级：从「安装前」备份里找装皮肤之前的原状——从新到旧，跳过里面是本皮肤的
 * （以前升级时留的），第一份就是这一串安装开始前的样子。找不到就按老版本的做法：加载项是当时加的。
 */
function recordFromPreSkinBackup(skip) {
  let names = [];
  try { names = readdirSync(backupRoot).filter((name) => name.includes('-安装前')).sort().reverse(); } catch { /* 还没有备份 */ }
  for (const name of names) {
    const dir = join(backupRoot, name);
    if (dir === skip) continue;
    if (existsSync(join(dir, 'dsh-logo')) && isOurPlugin(join(dir, 'dsh-logo'))) continue;
    say(`旧版没有安装记录，按装皮肤之前的备份推断：${dir}`);
    const origPatch = join(dir, 'cordis.patch.yml');
    const createdPatch = !existsSync(origPatch);
    return {
      addedRow: createdPatch || !OUR_ROW_RE.test(readFileSync(origPatch, 'utf8')),
      previousPlugin: existsSync(join(dir, 'dsh-logo')) ? join(dir, 'dsh-logo') : '',
      createdPatch,
    };
  }
  return { addedRow: true, previousPlugin: '', createdPatch: false };
}

function uninstall() {
  say('== 星海书院皮肤 · 卸载 ==');
  const force = argv.includes('--force');
  const patchText = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : '';
  const spec = existsSync(manifestPath) ? dependencySpec(readManifest()) : undefined;
  const ourDep = spec !== undefined && OUR_SPEC_RE.test(spec);
  const copies = installedCopies();
  if (!copies.length && !ourDep && !OUR_ROW_RE.test(patchText) && !present(localDir)) {
    say('没有发现已安装的皮肤，不需要卸载。');
    return;
  }
  for (const dir of [localDir, linkPath]) {
    if (isRealDir(dir) && !isOurPlugin(dir) && !force) {
      fail(`${dir} 不是星海书院皮肤（package.json 里没有 anime-academy skin），为安全起见没有删除。如确定要删，请手动处理。`);
    }
  }

  const current = copies[0];
  const record = (current && readRecord(current)) || { addedRow: true, previousPlugin: '', createdPatch: false };
  if (record.previousPlugin && !existsSync(record.previousPlugin)) {
    fail(`安装前那里另有一个插件，它的备份 ${record.previousPlugin} 已经不在了，卸载后没法放回去。为安全起见没有做任何改动；如确定不需要它，请先删掉 ${join(current, RECORD_NAME)} 再卸载。`);
  }
  const backupDir = backup('卸载前', [[current, 'dsh-logo']]);

  /* 先去掉 pnpm 依赖：它失败时什么都还没删，皮肤照常可用 */
  if (ourDep) {
    const result = pnpmRunner()(['remove', PACKAGE_NAME]);
    if (!result.ok) {
      restoreConfig(backupDir);
      fail(`用 pnpm 去掉插件登记失败，没有做其他改动。pnpm 的输出：\n${result.output}`);
    }
  }
  /* 再改加载项；安装前就有的那条保留 */
  if (record.addedRow && existsSync(patchPath)) {
    try {
      writeFileSync(patchPath, readFileSync(patchPath, 'utf8').replace(BLOCK_RE, ''));
      if (OUR_ROW_RE.test(readFileSync(patchPath, 'utf8'))) throw new Error('改完以后加载项还在');
    } catch (error) {
      fail(`修改 ${patchPath} 失败，插件文件没有删除（可能没有写权限）。备份在 ${backupDir}：${error.message}`);
    }
  } else if (!record.addedRow) {
    say('加载项是安装前就有的，保留不动。');
  }
  /* 配置文件是安装时新建的、现在只剩空白：删掉，回到安装前「没有这个文件」的样子 */
  if (record.createdPatch && existsSync(patchPath) && !readFileSync(patchPath, 'utf8').trim()) rmSync(patchPath);

  rmSync(localDir, { recursive: true, force: true });
  if (present(linkPath) && (isLink(linkPath) || isOurPlugin(linkPath) || force)) rmSync(linkPath, { recursive: true, force: true });
  if (isRealDir(ignoredDir) && isOurPlugin(ignoredDir)) rmSync(ignoredDir, { recursive: true, force: true });
  if (record.previousPlugin) {
    cpSync(record.previousPlugin, linkPath, { recursive: true });
    say('已把安装前的插件放回原处。');
  }
  removeEmptyDirs(
    dirname(localDir),
    dirname(ignoredDir), dirname(dirname(ignoredDir)),
    dirname(linkPath), dirname(dirname(linkPath)),
  );
  say('已卸载，恢复到安装前的状态。');
}

try {
  if (command === 'install') install();
  else if (command === 'uninstall') uninstall();
  else fail('用法：node installer.mjs install|uninstall [--plugin <插件目录>] [--force]');
} catch (error) {
  console.error(`\n❌ ${error instanceof InstallError ? error.message : error.stack}`);
  process.exitCode = 1;
}
