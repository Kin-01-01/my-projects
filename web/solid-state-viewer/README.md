# solid_state_viewer

Solid-State Sodium Batteries 双栏同步阅读器产物目录（由 `dual-pane-reader` skill 生成）。

| 文件 | 说明 |
|---|---|
| `viewer.html` | 成品：左双语正文 / 右 PDF 原页 + 橙色指针实时同步 + 标注/笔记/护眼 |
| `assets/page-01..20.png` | PDF 逐页渲染图（相对引用） |
| `TEST-PLAN.md` | 测试方案（29 条用例，工程保障团队 Tessa） |
| `build_viewer.py` | **已废弃**，仅作兼容转发层；生成逻辑在 `../skills/dual-pane-reader/` |

## 重新生成

```bash
PY="C:/Users/Wpengz/.workbuddy/binaries/python/envs/default/Scripts/python.exe"

"$PY" ../skills/dual-pane-reader/scripts/build_dual_viewer.py \
  --html "D:/微信/.../Solid-State_Sodium_Batteries_中英对照(1).html" \
  --pdf  "D:/微信/.../Solid‐State Sodium Batteries(科研通-ablesci.com)(3).pdf" \
  --out  . \
  --no-render \
  --title "Solid-State Sodium Batteries · 双栏同步阅读器"
```

说明：
- `--no-render` 复用现有 `assets/`（若要重新渲染可去掉）。
- `--title` 与原版保持一致，DOCID 不变 → 之前存的笔记/标注可继续读取。
- 不带参数运行 `build_viewer.py` 会打印迁移说明。

## 已验证（2026-10-21）

- 20 页 / 61 段；p1/p3/p6/p10/p15 指针 `withinPage=true`，`当前 p.X` 正确，右栏跟随。
- 「仅中文」真实隐藏英文（`display:none`）。
- 四色高亮/下划线/加粗落库；笔记落库；护眼 PDF 滤镜生效；无 JS 报错。
