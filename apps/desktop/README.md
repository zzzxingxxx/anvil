# apps/desktop

Electron 薄壳：加载 `http://127.0.0.1:5173`，用系统对话框选文件夹。关窗口进托盘，托盘选「退出」才结束进程。

特权仍在 Host。渲染进程没有 Node、不能读盘。

```bash
pnpm start
pnpm desktop
```

Electron 用 `npx electron@37.2.3` 拉，不进工作区 lockfile，避免 pnpm 忽略 postinstall 导致根目录 `pnpm install` 失败。

开发版仍需本机 Node。Windows 未签名，SmartScreen 可能提示。没有 Docker 时设置页只显示说明，不阻断启动。
