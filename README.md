# 知网 PDF 入 ima

这是一个独立的 Microsoft Edge 扩展：在有权下载 PDF 的知网单篇文章详情页，选择腾讯 ima 知识库及文件夹，将 PDF 上传到该位置。扩展不会上传文章链接来冒充 PDF，也不会调用 Edge 的文件下载功能。

本项目由社区独立开发，**不是**中国知网、腾讯 ima 或 Zotero 的官方产品。

## 安装

### 从 GitHub Release 下载（推荐）

1. 在本仓库的 **Releases** 页面下载 `cnki-ima-extension-v0.3.0-edge.zip`，解压到一个以后不会随意移动的文件夹。
2. 在 Edge 地址栏输入 `edge://extensions/`，打开“开发人员模式”。
3. 点击“加载解压缩的扩展”，选择解压后**直接包含 `manifest.json`** 的文件夹。
4. 打开扩展的“设置”，从 [腾讯 ima 官方接口页面](https://ima.qq.com/agent-interface)获取你自己的 Client ID 和 API Key，填入并点击“保存并测试连接”。不要把这些凭证发给别人或提交到 GitHub。

GitHub 的“Code → Download ZIP”也可以安装：解压后选择其中包含 `manifest.json` 的项目文件夹。GitHub 下载链接本身不能让 Edge 一键安装；商店式安装需要另行上架 Microsoft Edge 扩展商店。

## 使用

1. 在 Edge 登录知网，打开一篇你有权限下载完整 PDF 的**单篇文章详情页**。
2. 点击扩展图标，选择目标 ima 知识库和文件夹。
3. 点击“下载 PDF 并上传”，等待“已添加到……”提示，再到 ima 查看文件。ima 可能还需要一些时间解析全文。

已有同名 PDF 时扩展会停止，避免重复上传。若知网返回登录页、验证码页、试读内容或其他非 PDF 响应，扩展会报错，不会上传该响应。

## 支持范围与限制

- 目前只支持知网详情页上能识别到直接指向 `*.cnki.net` HTTPS 地址的 PDF 下载链接；需要 JavaScript 特殊跳转、额外购买或验证码的文章可能失败。
- PDF 必须不超过 ima 接口的 200 MB 上限。扩展会检查 PDF 文件头和结束标记；这不能证明所有未标记的试读文件都是完整论文，重要文章请在 ima 中核对页数。
- 需要用户自己的知网下载权限和 ima API 凭证。本仓库不提供文章、下载权限或 API Key。
- 扩展在浏览器内存中获取 PDF 后上传到 ima 分配的腾讯 COS 目标，不在系统“下载”目录另存副本。

## 隐私与权限

扩展所请求的主机范围是知网、`ima.qq.com` 和腾讯 COS。`cookies` 与 `declarativeNetRequest` 权限用于在 PDF 请求中携带知网页面来源以及必要的分区 Cookie；相应请求头规则在请求结束后移除。ima Client ID 与 API Key 保存在本机 Edge 扩展存储中，不包含在仓库或下载包里。请勿分享扩展设置页截图或带一次性令牌的知网链接。

## 开发

本项目不需要安装第三方 npm 依赖。使用 Node.js 运行：

```text
npm test
npm run check
```

自动化测试覆盖链接识别、PDF 校验、请求头规则、ima API 编排及上传处理。知网网站和登录状态会变化，自动化测试不能代替实际文章的端到端验收。

## 许可证

[MIT License](LICENSE)。
