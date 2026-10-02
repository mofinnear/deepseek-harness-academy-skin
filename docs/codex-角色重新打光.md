# Codex 任务：角色 + 书桌合成图重新打光（新话题用）

> 2026-10-02。旧话题（「Deepseek Harness 皮肤5」）频繁断连、跑得很慢，用户改为新开话题，下面整段直接粘贴给 Codex。
> 输出目录改为 `relight-v2/`，避免和旧话题可能写入的 `relight/` 冲突。

```
任务：给 4 张「角色 + 书桌」合成图的角色重新打光（重画明暗），让角色和书桌融为一体。这是一个新话题，下面是完整信息。

【文件】
- 工作目录：/Volumes/LQ1000/Code/Deepseek Harness UI设计/assets/round7/
- 输入：combo-default.png、combo-happy.png、combo-curious.png、combo-wink.png。都是 2000×2200 RGBA 透明 PNG；角色在 x 400–1599、y 0–1312（就是原立绘逐像素贴上去的）；书桌桌面后沿在 y≈1150，桌面前沿在 y≈1376，书桌宽约 x 88–1914。
- 原立绘（角色轮廓 = 它们的 alpha，贴在画布 x 400、y 0）：~/Documents/deepseek-harness/default-workspace/dsh-logo/assets/relit/ 下的 academy-maid-pensive.png（默认）、expr-happy.png、expr-curious.png、expr-wink.png。
- 背景（做对比图用）：~/Documents/deepseek-harness/default-workspace/dsh-logo/assets/academy-panorama-day.jpg
- 参考：relight-claude/ 里是用程序做的一版（脚本 relight-claude/relight.py），明暗方向和强度可以参考，但它是乘法蒙版，不够自然。你的目标是比它更像画出来的。

【现在的问题】
角色像浮在书桌上：角色是原立绘直接贴上去的，明暗没有随书桌和光源变化。桌面上没有角色的阴影，手臂正下方的桌面反而最亮；角色贴近桌面的部分（手臂、袖子、手、白色袖口）也还是很亮。

【光源】
只有一个主光源：画面左侧偏左后方的窗户暖白日光。暗部是浅蓝紫色。

【要画出来的效果】
1. 书桌上的阴影：角色挡住了光，桌面上靠近角色的地方（手臂、手、袖口、垂到桌上的发梢的下方和右前方）明显变暗，越靠近角色越暗，向外柔和过渡；手臂和手压着桌面的地方有清晰的接触暗线；光滑桌面上可以有很淡的手臂倒影。
2. 角色靠近书桌的部分变暗：前臂、袖子、手、白色袖口荷叶边、胸前衣服下沿，越靠近桌面越暗。白色袖口和手臂靠桌的一面不要那么白，要有偏冷的蓝紫灰阴影（靠桌处亮度大约是现在的 60–75%）。皮肤的暗部偏暖（粉紫），不要发灰。
3. 画面右侧（远离光源的一侧）整体变暗：角色右侧的头发、手臂、肩膀比左侧暗约 15–25%。
4. 保留：左侧头发和肩膀的细亮轮廓光；脸和上半身中间保持清楚明亮（表情要看得清），脸只允许很轻微的明暗变化。

【不能改】
- 角色的轮廓、姿势、线稿、表情、五官、服装细节、位置（仍在 x 400–1599、y 0–1312）；画布仍是 2000×2200 RGBA。
- 书桌的造型、颜色和桌上物件（现在的书桌颜色可以，不要改色），只允许在角色附近加阴影。
- 四张图的光影要一致（同样的光源、同样深浅的阴影）。

【做法】
可以用图像编辑重绘明暗，也可以按角色轮廓用程序生成明暗层再手动修饰，或两者结合；最终要像画出来的，不能像一层灰色蒙版。

【交付（网络不稳定，请每完成一张就立刻存盘）】
- 先做 combo-default.png，存盘并跑完自检后，再做其余三张；每张做完马上存。
- 存到 round7/relight-v2/，文件名仍是 combo-default.png、combo-happy.png、combo-curious.png、combo-wink.png。不要覆盖 round7/ 里现有的任何文件，也不要写 relight/ 和 relight-claude/。
- 每张都铺到上面的背景上，做一张前后对比图（左原图、右新图，可放大手臂与桌面接触区域），存为 relight-v2/对比-<表情>.jpg。

【自检（每张都跑，报告数字）】
脚本：~/Documents/deepseek-harness/default-workspace/dsh-logo/tools/combo_relight_check.py
用法：python3 <脚本> <原 combo.png> <新 combo.png> <对应原立绘.png>
通过标准：
- 与原 combo 的 alpha 轮廓 IoU ≥ 0.98；
- 脸部区域（画布 x 650–1250、y 150–650）平均差 < 6；
- 手臂下方桌面亮度比原图至少降低 15%；
- 靠桌白色像素的平均亮度降到原来的 0.6–0.8；
- 角色右半边平均亮度低于左半边；
- 书桌不透明区域没有 248–254 的 alpha（统一为 255）。
```
