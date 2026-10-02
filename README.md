# DeepSeek Harness「星海书院」皮肤

> **非官方项目**：这是 DeepSeek Harness 桌面版的本地皮肤插件，与 DeepSeek 官方无关；只改外观，不修改应用本体和签名。
>
> **快速安装（v1.0）**：从 GitHub Releases 下载 `dsh-academy-skin-v1.0.zip`，按 [`docs/修改记录.md`](docs/修改记录.md) 「不想敲命令：纯复制安装」一节操作；或克隆仓库后运行 `node tools/install.mjs --apply`。

![星海书院皮肤预览](docs/layout-preview.png)

> 新会话 / 新协作者接手时先读 [`docs/交接说明.md`](docs/交接说明.md)（项目现状、流程、结构、待办）。
>
> 想把这套修改分享给别人，或自己继续改之前，先看 [`docs/修改记录.md`](docs/修改记录.md)：里面有复现步骤、调试方法、踩过的坑和版本记录。
>
> **任何改动之前先备份**：`node tools/backup.mjs <说明>`；改崩了用 `node tools/backup.mjs --restore <目录名>` 还原。

把参考图中的学院风 UI 做成可切换的本地皮肤：深蓝书院侧栏、横向书院全景底图、浅色金边聊天区、右侧托腮角色立绘，以及蓝金装饰输入框。聊天、模型选择、工作区和输入框仍使用 Harness 原生组件；皮肤只调整外观，不替换对话内容。

皮肤通过本地客户端插件安装，不修改 `/Applications/DeepSeek Harness.app`、应用签名或系统图标。安装前会在本项目的 `backup/ui-skin-original-20260930/` 保存原来的本地 logo 插件和 profile patch。

## 界面改动

| 区域 | 改动 |
| --- | --- |
| 左侧导航 | 悬浮圆角金边卡片（四角星饰）、圆形头像与大号 `DeepSeek` 字标、蓝色「新建对话」按钮、「最近对话」标题；按 `data-row-key` 隐藏工作区分组行，真实会话带图标正常显示，不伪造示例会话 |
| 中央聊天 | 整列（含顶栏标题、模型/菜单按钮）做成白色半透明圆角金边面板，四角星饰；右侧为陪伴栏让出位置，消息布局和功能仍由 Harness 控制 |
| 右侧陪伴栏 | 右上便签、托腮角色立绘、DeepSeek 对话气泡、四格表情切换（默认/开心/好奇/眨眼，选择保存在本机）；窗口窄于 1100px 时自动隐藏 |
| 输入框 | 占满对话面板宽度的白色圆角输入框，金色外描边与左右星饰（纯 CSS，不再用九宫格图，避免错位）；控件仍由 Harness 原生处理 |
| 皮肤开关 | 侧栏品牌行右下角的「原版」按钮可切回原生主题；选择保存在本机，重启后保留。侧栏收起时它随侧栏隐藏，不会压住顶栏的原生按钮 |
| 侧栏收起 / 右侧面板 | 侧栏收起时撤掉卡片样式，用顶栏原生按钮展开；打开文件/终端/浏览器右侧面板时，陪伴栏自动让位，右侧面板套同款金边 |
| 新会话品牌 | 使用彩色角色标替换鲸鱼图案；聊天页内容不受影响 |

## 文件说明

| 路径 | 内容 |
| --- | --- |
| `assets/academy-panorama.jpg` | 皮肤实际使用的横向全窗口书院背景 |
| `assets/academy-library.jpg`、`assets/academy-library.png` | 早期右侧竖幅背景素材，保留作旧版参考 |
| `assets/academy-sidebar.jpg` | 左侧导航专用压缩背景，中心留白供文字阅读 |
| `assets/academy-sidebar.png` | 左侧背景原始 PNG |
| `assets/academy-maid-pensive.png` | 参考图单手托腮、另一手臂搭在前方的新角色透明立绘，右侧栏使用 |
| `assets/generated-ui/` | 本次皮肤制作的生成图与处理后素材归档；含原始预览图和当前素材副本 |
| `assets/composer-frame.png` | 旧版输入框九宫格装饰框，当前版本未使用 |
| `assets/sidebar-name.png` | 原始透明立绘保留素材，用于图标制作或回退 |
| `assets/sidebar-mark.png`、`assets/hero-mark.png` | 侧栏小像和新会话标记 |
| `logo.config.json` | 图片源、显示尺寸、文字标和体积限制 |
| `brand-override/client.js` | 插件入口、主题切换、右侧陪伴栏与表情切换 |
| `brand-override/skin.css` | 皮肤全部布局样式（`$SKIN` 构建时展开），改外观主要改这里 |
| `brand-override/skin-art.css` | 素材装饰层（九宫格边框、星饰、侧栏道具、桌子），只在 `skin.art` 配置了素材时生效 |
| `assets/ui/` | GPT 生成的装饰素材 |
| `docs/codex-切图需求.md` | 交给 Codex 的切图规格：表情立绘、缩略图、便签、角饰、背景 |
| `docs/gpt-素材提示词.md` | 让 GPT 按效果图生成边框、星饰、侧栏道具、桌子等素材的提示词 |
| `docs/修改记录.md` | 每次修改的内容、原因、复现步骤、调试方法和踩坑记录，分享给他人时参照 |
| `tools/devtools.mjs` | 连接带调试端口运行的应用：执行 JS、截图、实时注入 CSS |
| `tools/backup.mjs` | 改动前备份项目文件与已安装插件，支持一键还原 |
| `tools/build.mjs` | 内联素材并生成可安装的单文件插件 |
| `tools/verify.mjs` | 检查插件结构、主题素材和皮肤样式 |
| `tools/install.mjs` | 安装、卸载或恢复本机原始插件 |
| `backup/ui-skin-original-20260930/` | 此电脑安装皮肤前的原插件快照，不是通用素材 |
| `backup/pre-layout-20261001/` | 2026-10-01 重排布局前的源码快照 |

最终插件将素材内联，构建时会检查体积上限。全景背景采用 16:10 横向构图并以 `cover` 填满窗口；不同窗口比例会适量裁切边缘，不会再把竖幅背景硬塞进右侧窄栏。中间区域刻意减少细节，聊天表面使用浅色半透明底以保持可读性。新角色保持透明底，独立置于最上层。

全景图由内置 ImageGen 根据参考图 2 的书院环境生成，只借鉴环境、蓝金配色和沉浸式氛围，不包含界面、文字或角色。原图约为 16:10 横图，压缩为 JPEG 后放在 `assets/academy-panorama.jpg`。复做时可使用这段提示词：

> Wide horizontal 16:10 anime-game academy library at blue twilight, continuous full-bleed environment with soaring gothic arches, tall luminous windows, distant academy towers, dark blue bookshelves, brass astronomical instruments, restrained gold star ornaments, natural floor and ceiling perspective. Keep the central 55% calm, softly lit, low-detail and low-contrast for readable chat panels; put richer details near the outer edges. Background only: no character, interface, text, logo, watermark, framing, or separate side panel.

## 安装与更新

安装需要 macOS、DeepSeek Harness 和 Node.js。克隆或下载项目后，在项目目录运行：

```bash
node tools/build.mjs
node tools/verify.mjs
node tools/install.mjs --apply
```

验证通过后退出并重新打开 DeepSeek Harness。客户端插件在启动时载入；更新皮肤后也需要重启。默认显示完整布局：左侧栏、中间对话框、底部输入框和右侧陪伴栏。按 `Option + Shift + B` 切换「只看背景」（检查背景图用）；按 `Option + Shift + F` 收起或展开右侧陪伴栏。安装脚本会保留第一次安装前的原插件快照，不会用后续版本覆盖该快照。

当前项目中的验证结果以最近一次 `node tools/verify.mjs` 输出为准。若构建失败，先看终端中失败的检查项，不要继续安装未验证的产物。

## 切换、恢复与卸载

- 只想暂时看原界面：点击左侧品牌旁的「原版」按钮；再点一次即可切回皮肤。
- 恢复这台电脑安装前的本地 logo 插件：运行 `node tools/install.mjs --restore-original`，然后重启应用。
- 完全卸载此覆盖插件：运行 `node tools/install.mjs --revert`，然后重启应用。Harness 原生品牌会重新显示。

「恢复原插件」和「卸载覆盖插件」不同：前者把已备份的本地 logo 插件放回去；后者移除本地插件和 profile 加载项。

## 替换素材与调整外观

1. 替换背景：左侧改 `assets/academy-sidebar.jpg` 与 `skin.sidebarBackground.source`；全窗口横向底图改 `assets/academy-panorama.jpg` 与 `skin.workspaceBackground.source`。推荐 16:10 或 16:9 横图，关键内容放在中间安全区，构建会将图内联。
2. 替换右侧角色与表情：默认立绘是 `skin.mascot`；其余表情、缩略图、便签和角饰在 `skin.expressions` / `skin.memo` / `skin.cornerStar` 中配置，规格见 `docs/codex-切图需求.md`。未提供的素材会自动回退到默认立绘或内置 CSS 样式。
3. 布局与层级都在 `brand-override/skin.css`：全景背景 0 < 对话列 20 < 右侧陪伴栏 25 < 角饰 30 < 「原版」开关 40。选择器尽量用 Harness 的 `data-slot` / `data-*` 属性，而不是会变的哈希类名。
4. 调颜色、边框、排版或右侧文案：样式改 `brand-override/skin.css`，便签与气泡文案改 `brand-override/client.js`（表情气泡文案也可以直接在 `logo.config.json` 的 `message` 中改）。输入框直接使用 Harness 原生的 `[data-composer-card]` 属性定位；Harness 更新后若这些属性变化，需要同步调整选择器。
5. 重新构建、验证、安装并重启：

```bash
node tools/build.mjs
node tools/verify.mjs
node tools/install.mjs --apply
```

标志图和新会话标记的尺寸、源文件与压缩上限由 `logo.config.json` 控制。彩色角色应使用 `fit: "img"`，不要套用单色 mask。

## 发布给其他用户

发布前请确认立绘、背景及其他素材允许再分发；如果没有相应授权，只发布代码并让使用者自行提供图片。README 中的命令均使用相对路径，无需照抄开发电脑的绝对路径。

建议分享源码、必要的 `assets/` 和 `src/`，不要附带 `backup/`、本机 profile 或应用副本。其他用户应先备份自己现有的本地插件，再运行安装命令；安装流程不会修改其应用包。

Harness 更新后如果主题插槽或页面结构变化，可能需要调整 CSS 选择器并重新通过 `tools/verify.mjs`。它仍是 Harness 原生工作区/会话结构的皮肤，不会凭空生成参考图里的会话列表，也没有接入右侧不同表情的动态切换。

## Dock / Finder 应用图标（可选，和皮肤安装分开）

替换 Dock、访达和窗口图标不是皮肤安装的一部分。项目另有 `tools/install_app_icon.py` 与 `tools/swap-app-icon.command`，会写入 `/Applications/DeepSeek Harness.app` 并重新签名应用。在没有 Developer ID 身份时只能 ad-hoc 重签，原签名和公证状态会被替换；首次启动还可能需要系统确认。普通皮肤用户无需运行它。运行前应退出应用并确认自己接受签名变化；不要把它作为插件安装步骤。

## 生成与验证素材

重新生成白底立绘素材时还需要 Python 3 和 Pillow。透明化采用柔和亮度渐变，而不是硬阈值，因为角色穿着白围裙和白领子。图标和预览素材可用以下命令重新生成：

```bash
python3 tools/compose_artwork.py
node tools/build.mjs
node tools/verify.mjs
```

如果系统没有 Pillow，先安装依赖：

```bash
python3 -m pip install Pillow
```

参考截图只用于确定布局和风格；应用中的导航、消息、输入框和工作区仍是 Harness 自己的界面。
