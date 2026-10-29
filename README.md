# CHARON STUDIO

Personal studio site. First project: **MONTHLY REPORT**.

## 在另一台电脑上打开

本项目是纯静态站点，不依赖 Node 安装也能预览。

### 方法一：Python（推荐）

在项目文件夹里打开终端，运行：

```bash
# Windows
py -m http.server 5173

# macOS / Linux
python3 -m http.server 5173
```

浏览器打开：http://127.0.0.1:5173

### 方法二：直接打开

用浏览器打开 `index.html` 也可以；若字体或模块加载异常，优先用方法一。

### 方法三：Vite（可选）

若已安装 Node.js：

```bash
npm install
npm run dev
```

## 结构

```
CHARON STUDIO/
  index.html
  package.json
  vite.config.js
  README.md
  src/
    main.js
    styles.css
    field.js
    palette.js
    data/
      year-2026.js   # 2026 Jan–Sep monthly report + stars
```

## 路由

- `#/` 首页
- `#/monthly-report` 2026 月报总览
- `#/monthly-report/2026/01` … `#/monthly-report/2026/09` 单月 FAV.01–04
- `#/monthly-report/star` Monthly Star（FAV ART + ART 时长）
