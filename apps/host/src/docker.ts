import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DockerStatus = {
  available: boolean;
  version?: string;
  reason?: string;
};

export async function probeDocker(): Promise<DockerStatus> {
  try {
    const { stdout } = await execFileAsync("docker", ["version", "--format", "{{.Server.Version}}"], {
      timeout: 4000,
      windowsHide: true,
    });
    const version = stdout.trim();
    if (!version) {
      return { available: false, reason: "Docker 客户端在，守护进程没有响应。入口已隐藏。" };
    }
    return { available: true, version };
  } catch {
    return { available: false, reason: "未检测到 Docker。Windows 上没有 Docker 时入口保持隐藏，不阻断启动。" };
  }
}
