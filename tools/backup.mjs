#!/usr/bin/env node
/**
 * 改动前先备份，改崩了一键还原。
 *
 * 每份备份放在 backup/<标签>-<时间>/ 下，包含两部分：
 *   project/  本项目的源码、文档、配置和素材（不含可重新生成的 dist 缓存图）
 *   profile/  已安装到应用里的插件目录和 cordis.patch.yml
 *
 * 用法：
 *   node tools/backup.mjs [标签]              备份当前状态，标签可省略（默认 manual）
 *   node tools/backup.mjs --list              列出已有备份
 *   node tools/backup.mjs --restore <目录名>   还原某份备份（还原前会自动再备份一次当前状态）
 *
 * 还原后需要重启 DeepSeek Harness。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP_ROOT = join(ROOT, 'backup');

/** 项目里需要备份的条目；目录会整体替换，文件直接覆盖。 */
const PROJECT_DIRS = ['brand-override', 'tools', 'docs', 'src'];
const PROJECT_FILES = ['logo.config.json', 'README.md', '.gitignore'];

function profileDir() {
  if (process.env.DSH_PROFILE_DIR) return process.env.DSH_PROFILE_DIR;
  /* homedir()，不用 process.env.HOME：Windows 上通常没有 HOME（和应用本身一样按系统用户目录 + .dsh） */
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  return join(home, 'profiles', process.env.DSH_PROFILE || 'desktop');
}

function profilePaths() {
  const profile = profileDir();
  return {
    plugin: join(profile, 'node_modules', '@local', 'dsh-logo'),
    patch: join(profile, 'cordis.patch.yml'),
  };
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** 素材目录只备份原图，跳过构建时生成的 *.maxN.png 缓存。 */
const skipCache = (source) => !/\.max\d+\.png$/.test(source);

function backup(label) {
  const safeLabel = (label || 'manual').replace(/[^\w一-龥-]+/g, '-');
  const target = join(BACKUP_ROOT, `${safeLabel}-${stamp()}`);
  const project = join(target, 'project');
  mkdirSync(project, { recursive: true });

  for (const dir of PROJECT_DIRS) {
    if (existsSync(join(ROOT, dir))) cpSync(join(ROOT, dir), join(project, dir), { recursive: true });
  }
  if (existsSync(join(ROOT, 'assets'))) {
    cpSync(join(ROOT, 'assets'), join(project, 'assets'), { recursive: true, filter: skipCache });
  }
  for (const file of PROJECT_FILES) {
    if (existsSync(join(ROOT, file))) cpSync(join(ROOT, file), join(project, file));
  }

  const { plugin, patch } = profilePaths();
  const profile = join(target, 'profile');
  mkdirSync(profile, { recursive: true });
  if (existsSync(plugin)) cpSync(plugin, join(profile, 'dsh-logo'), { recursive: true });
  if (existsSync(patch)) cpSync(patch, join(profile, 'cordis.patch.yml'));

  writeFileSync(
    join(target, 'README.txt'),
    [
      `备份时间：${new Date().toLocaleString('zh-CN')}`,
      `project/ 来自：${ROOT}`,
      `profile/ 来自：${dirname(patch)}`,
      `已安装插件：${existsSync(plugin) ? '有' : '无（当时未安装）'}`,
      '',
      `还原：node tools/backup.mjs --restore ${basename(target)}`,
      '',
    ].join('\n'),
  );
  console.log(`[backup] 已备份到 ${target}`);
  return target;
}

function list() {
  if (!existsSync(BACKUP_ROOT)) {
    console.log('还没有备份。');
    return;
  }
  const entries = readdirSync(BACKUP_ROOT)
    .filter((name) => statSync(join(BACKUP_ROOT, name)).isDirectory())
    .map((name) => ({ name, restorable: existsSync(join(BACKUP_ROOT, name, 'project')), time: statSync(join(BACKUP_ROOT, name)).mtime }))
    .sort((a, b) => b.time - a.time);
  for (const entry of entries) {
    const note = entry.restorable ? '' : '  （旧格式手动备份，需手动复制还原）';
    console.log(`${entry.time.toLocaleString('zh-CN')}  ${entry.name}${note}`);
  }
}

function restore(name) {
  if (!name) throw new Error('请指定要还原的备份目录名，可先运行 --list 查看');
  const source = join(BACKUP_ROOT, basename(name));
  const project = join(source, 'project');
  if (!existsSync(project)) throw new Error(`${source} 不是本脚本生成的备份（缺少 project/），请手动还原`);

  backup('before-restore');

  for (const dir of PROJECT_DIRS) {
    if (!existsSync(join(project, dir))) continue;
    rmSync(join(ROOT, dir), { recursive: true, force: true });
    cpSync(join(project, dir), join(ROOT, dir), { recursive: true });
  }
  /* 素材只覆盖不删除：备份之后新加的图片会保留。 */
  if (existsSync(join(project, 'assets'))) cpSync(join(project, 'assets'), join(ROOT, 'assets'), { recursive: true });
  for (const file of PROJECT_FILES) {
    if (existsSync(join(project, file))) cpSync(join(project, file), join(ROOT, file));
  }

  const { plugin, patch } = profilePaths();
  const savedPlugin = join(source, 'profile', 'dsh-logo');
  const savedPatch = join(source, 'profile', 'cordis.patch.yml');
  rmSync(plugin, { recursive: true, force: true });
  if (existsSync(savedPlugin)) cpSync(savedPlugin, plugin, { recursive: true });
  if (existsSync(savedPatch)) cpSync(savedPatch, patch);

  console.log(`[restore] 已还原 ${basename(source)}。请完全退出并重新打开 DeepSeek Harness。`);
}

const argv = process.argv.slice(2);
if (argv[0] === '--list') list();
else if (argv[0] === '--restore') restore(argv[1]);
else backup(argv[0]);
