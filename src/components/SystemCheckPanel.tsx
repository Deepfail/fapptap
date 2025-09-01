import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { IS_DESKTOP, isTauriAvailable } from "@/lib/platform";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface SystemCheck {
  name: string;
  status: "ok" | "warning" | "error" | "checking";
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const SystemCheckPanel = () => {
  const [checks, setChecks] = useState<SystemCheck[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const runSystemChecks = async () => {
    setIsChecking(true);
    const newChecks: SystemCheck[] = [];

    // Check Tauri availability
    const desktopNow = isTauriAvailable();
    newChecks.push({
      name: "Tauri Runtime",
      status: desktopNow ? "ok" : "warning",
      message: desktopNow ? "Desktop runtime available" : "Browser mode - limited features",
    });

    // Check local storage
    try {
      localStorage.setItem("test", "test");
      localStorage.removeItem("test");
      newChecks.push({
        name: "Local Storage",
        status: "ok",
        message: "Available for settings and cache",
      });
    } catch {
      newChecks.push({
        name: "Local Storage",
        status: "error",
        message: "Unavailable - settings won't persist",
      });
    }

    // Check clipboard API
    if (navigator.clipboard) {
      newChecks.push({
        name: "Clipboard API",
        status: "ok",
        message: "Available for copy/paste operations",
      });
    } else {
      newChecks.push({
        name: "Clipboard API",
        status: "warning",
        message: "Limited clipboard functionality",
      });
    }

    // Check WebGL for timeline rendering
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      newChecks.push({
        name: "WebGL",
        status: gl ? "ok" : "warning",
        message: gl
          ? "Available for GPU acceleration"
          : "Fallback to CPU rendering",
      });
    } catch {
      newChecks.push({
        name: "WebGL",
        status: "warning",
        message: "Not available - using CPU fallback",
      });
    }

    // Check if we're in a secure context (needed for some APIs)
    newChecks.push({
      name: "Secure Context",
      status: window.isSecureContext ? "ok" : "warning",
      message: window.isSecureContext
        ? "HTTPS/localhost - all APIs available"
        : "HTTP - some APIs may be limited",
    });

  if (desktopNow) {
      // Desktop-specific checks
      try {
        // Check file system access using a guaranteed allowed path (HOME directory scope)
        const { exists } = await import("@tauri-apps/plugin-fs");
        // Use a common system path variable via JS path API (fallback: try relative)
        let target = "";
        try {
          const pathMod = await import("@tauri-apps/api/path");
          target = await (pathMod as any).homeDir();
        } catch {
          target = ".";
        }
        const ok = await exists(target);
        newChecks.push({
          name: "File System",
          status: ok ? "ok" : "warning",
          message: ok
            ? `Exists check ok at ${target}`
            : `Exists failed at ${target}`,
        });
      } catch (err) {
        newChecks.push({
          name: "File System",
          status: "error",
          message: `Access error: ${err}`,
        });
      }

      // Check Python worker availability (invoke a lightweight stage)
      try {
        const { runWorker } = await import("@/lib/exec");
        const result = await runWorker("beats");
        newChecks.push({
          name: "Python Worker",
          status: result.code === 0 ? "ok" : "warning",
          message:
            result.code === 0
              ? "Worker responsive"
              : `Exit ${result.code}: ${(result.stderr || result.stdout).split(/\r?\n/)[0]}`,
          action: {
            label: "Test",
            onClick: async () => {
              try {
                const testResult = await runWorker("beats");
                alert(
                  `Worker test:\nCode: ${testResult.code}\nStdout:\n${testResult.stdout}\nStderr:\n${testResult.stderr}`
                );
              } catch (err) {
                alert(`Worker test failed: ${err}`);
              }
            },
          },
        });
      } catch (err) {
        newChecks.push({
          name: "Python Worker",
          status: "error",
          message: `Worker not available: ${err}`,
        });
      }

      // Check FFmpeg availability
      try {
        const { ffmpegVersion } = await import("@/lib/exec");
        const result = await ffmpegVersion();
        const verLine = result.stdout.split(/\r?\n/)[0] || result.stdout.trim();
        newChecks.push({
          name: "FFmpeg",
          status: result.code === 0 ? "ok" : "warning",
          message: result.code === 0 ? verLine : `Exit ${result.code}: ${result.stderr.split(/\r?\n/)[0]}`,
          action: {
            label: "Test",
            onClick: async () => {
              try {
                const testResult = await ffmpegVersion();
                alert(testResult.stdout || testResult.stderr);
              } catch (err) {
                alert(`FFmpeg test failed: ${err}`);
              }
            },
          },
        });
      } catch (err) {
        newChecks.push({
          name: "FFmpeg",
          status: "error",
          message: `FFmpeg not available: ${err}`,
        });
      }

      // Check FFprobe availability
      try {
        const { ffprobeVersion } = await import("@/lib/exec");
        const result = await ffprobeVersion();
        const verLine = result.stdout.split(/\r?\n/)[0] || result.stdout.trim();
        newChecks.push({
          name: "FFprobe",
          status: result.code === 0 ? "ok" : "warning",
          message: result.code === 0 ? verLine : `Exit ${result.code}: ${result.stderr.split(/\r?\n/)[0]}`,
          action: {
            label: "Test",
            onClick: async () => {
              try {
                const testResult = await ffprobeVersion();
                alert(testResult.stdout || testResult.stderr);
              } catch (err) {
                alert(`FFprobe test failed: ${err}`);
              }
            },
          },
        });
      } catch (err) {
        newChecks.push({
          name: "FFprobe",
          status: "error",
          message: `FFprobe not available: ${err}`,
        });
      }
    } else {
      // Browser-specific checks
      newChecks.push({
        name: "File System Access API",
        status: "showDirectoryPicker" in window ? "ok" : "warning",
        message:
          "showDirectoryPicker" in window
            ? "Modern file access available"
            : "Limited to file upload/download",
      });

      // Check if we can play video
      const video = document.createElement("video");
      newChecks.push({
        name: "Video Support",
        status: video.canPlayType("video/mp4") ? "ok" : "error",
        message: video.canPlayType("video/mp4")
          ? "MP4 playback supported"
          : "Limited video format support",
      });
    }

    // Simulate delay for demo
    await new Promise((resolve) => setTimeout(resolve, 500));

    setChecks(newChecks);
    setIsChecking(false);
  };

  const openFolder = (path: string) => {
    if (isTauriAvailable()) {
      // TODO: implement actual folder open via shell open
      alert(`Would open folder: ${path}`);
    } else {
      alert("Folder opening only available in desktop mode");
    }
  };

  useEffect(() => {
    runSystemChecks();
  }, []);

  const getStatusIcon = (status: SystemCheck["status"]) => {
    switch (status) {
      case "ok":
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-400" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "checking":
        return <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />;
    }
  };

  const getStatusBadge = (status: SystemCheck["status"]) => {
    switch (status) {
      case "ok":
        return <Badge className="bg-green-600">OK</Badge>;
      case "warning":
        return <Badge variant="secondary">Warning</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "checking":
        return <Badge variant="outline">Checking...</Badge>;
    }
  };

  const overallStatus =
    checks.length === 0
      ? "checking"
      : checks.some((c) => c.status === "error")
      ? "error"
      : checks.some((c) => c.status === "warning")
      ? "warning"
      : "ok";

  return (
    <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">System Check</CardTitle>
          <div className="flex items-center gap-2">
            {getStatusBadge(overallStatus)}
            <Button
              size="sm"
              variant="outline"
              onClick={runSystemChecks}
              disabled={isChecking}
            >
              <RefreshCw
                className={`h-3 w-3 mr-1 ${isChecking ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {checks.map((check, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-2 bg-slate-700/30 rounded"
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(check.status)}
              <div>
                <div className="text-sm font-medium">{check.name}</div>
                <div className="text-xs text-muted-foreground">
                  {check.message}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {check.action && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={check.action.onClick}
                  className="h-6 text-xs"
                >
                  {check.action.label}
                </Button>
              )}
            </div>
          </div>
        ))}

        {/* Quick Actions */}
        <div className="pt-4 border-t border-slate-600">
          <h3 className="text-sm font-semibold mb-2">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openFolder("cache")}
              className="justify-start"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Cache
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openFolder("render")}
              className="justify-start"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Render
            </Button>
          </div>
        </div>

        {/* Environment Info */}
        <div className="pt-2 text-xs text-muted-foreground space-y-1">
          <div>
            <strong>Mode:</strong> {IS_DESKTOP ? "Desktop" : "Browser"}
          </div>
          <div>
            <strong>User Agent:</strong> {navigator.userAgent.slice(0, 50)}...
          </div>
          <div>
            <strong>Screen:</strong> {screen.width}×{screen.height}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
