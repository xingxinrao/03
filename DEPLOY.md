# 部署成可分享链接的移动端 Demo

## 推荐方案：Vercel

这是最适合你当前项目的部署方式，免费、简单，并且支持把页面变成一个可分享链接。

### 1. 准备文件

确保当前目录包含：

- `server.js`
- `AI简历优化助手_网页原型.html`
- `manifest.json`
- `service-worker.js`
- `vercel.json`

### 2. 推送到 GitHub

先把整个文件夹上传到一个 GitHub 仓库。

### 3. 在 Vercel 创建项目

进入 Vercel 后：

- 选择 Import Git Repository
- 选择你的仓库
- Framework 选择 Other
- 保持默认设置
- 点击 Deploy

### 4. 可访问链接

部署完成后，Vercel 会给你一个公开 URL，例如：

`https://your-project.vercel.app`

这个链接就是你的可分享移动端 Demo。

## 本地预览方式

如果你想先在本地测试：

```bash
npm install
npm start
```

然后访问：

`http://localhost:3000/AI简历优化助手_网页原型.html`

## 手机使用方式

在手机浏览器里打开这个链接后，可以：

- 直接查看 Demo
- 复制分享链接给别人
- 通过浏览器菜单添加到主屏幕

## 注意

如果你希望页面支持真实 AI 分析，需要额外配置 `OPENAI_API_KEY` 环境变量。若不配置，也会自动回退到本地 mock 模式，仍可演示完整产品流程。
