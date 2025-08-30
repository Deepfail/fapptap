import { useState, useEffect } from "react";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Progress } from "./components/ui/progress";
// Removed unused UI primitives until needed
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { Badge } from "./components/ui/badge";
import { PythonWorker, WorkerMessage, isTauriAvailable } from "./lib/worker";
import {
  Activity,
  Film,
  Scissors,
  Play,
  LucideIcon,
  Sparkles,
} from "lucide-react";
import { Waveform } from "./components/Waveform";
import { ClipList } from "./components/ClipList";
import { PreviewPlayer } from "./components/PreviewPlayer";
import { Timeline } from "./components/Timeline";
import { ZoomControls } from "./components/ZoomControls";
import { EditorProvider } from "./state/editorStore";
import { LogPanel, LogEntry } from "./components/LogPanel";
import "./App.css";
import { DragGhost } from "./components/DragGhost";
import { EffectsInspector } from "./components/EffectsInspector";
import { CutlistExporter } from "./components/CutlistExporter";
import { SystemCheckPanel } from "./components/SystemCheckPanel";
import { ProjectManager } from "./components/ProjectManager";

interface StageConfig {
  icon: LucideIcon;
  description: string;
  color: string;
}

interface BeatsData {
  version: number;
  engine: string;
  tempo_global: number;
  beats: number[];
  strength: number[];
  tempo_curve: {
    t: number[];
    bpm: number[];
  };
  debug: {
    sr: number;
    duration: number;
    onset_env_peak: number;
    onset_env_mean: number;
    preprocessing: {
      hpss_percussive_peak: number;
      hpss_percussive_rms: number;
      transient_peak: number;
      transient_rms: number;
    };
  };
}

function App() {
  const [worker] = useState(() => new PythonWorker());
  const [tauriAvailable] = useState(() => isTauriAvailable());
  const [songPath, setSongPath] = useState<string>("");
  const [clipsPath, setClipsPath] = useState<string>("");
  const [beatEngine] = useState<string>("advanced");
  const [currentStage, setCurrentStage] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [beatsData, setBeatsData] = useState<BeatsData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<
    Record<string, { status: string; progress: number }>
  >({
    beats: { status: "idle", progress: 0 },
    shots: { status: "idle", progress: 0 },
    cutlist: { status: "idle", progress: 0 },
    render: { status: "idle", progress: 0 },
  });

  const addLog = (log: LogEntry) => {
    setLogs((prev) => [log, ...prev.slice(0, 199)]); // Keep last 200 logs
  };

  const clearLogs = () => {
    setLogs([]);
  };

  useEffect(() => {
    const unsubscribe = worker.onMessage((msg: WorkerMessage) => {
      if (msg.stage) {
        setCurrentStage(msg.stage);

        // Add log entry
        const generateId = () => {
          try {
            return (crypto as any).randomUUID();
          } catch (e) {
            return (
              Date.now().toString() + Math.random().toString(36).substr(2, 9)
            );
          }
        };

        const logEntry: LogEntry = {
          id: generateId(),
          timestamp: new Date(),
          message:
            msg.message ||
            msg.error ||
            `${msg.stage} progress: ${(msg.progress || 0) * 100}%`,
          type: msg.error ? "error" : msg.progress === 1 ? "success" : "info",
          stage: msg.stage,
        };
        addLog(logEntry);

        if (msg.progress !== undefined) {
          setProgress(msg.progress);
          setStatus((prev) => ({
            ...prev,
            [msg.stage!]: {
              status: msg.progress === 1 ? "completed" : "running",
              progress: msg.progress || 0,
            },
          }));
        }

        if (msg.message) {
          toast.message(msg.message);
        }

        if (msg.error) {
          toast.error(msg.error);
          setStatus((prev) => ({
            ...prev,
            [msg.stage!]: { status: "error", progress: 0 },
          }));
        }

        // Load beats data when beats stage completes
        if (msg.stage === "beats" && msg.progress === 1) {
          loadBeatsData();
        }
      }
    });

    return unsubscribe;
  }, [worker]);

  useEffect(() => {
    // Load beats data when song path changes
    if (songPath) {
      loadBeatsData();
    }
  }, [songPath]);

  const loadBeatsData = async () => {
    try {
      const data = await worker.readFile("cache/beats.json");
      const beatsData = JSON.parse(data) as BeatsData;
      setBeatsData(beatsData);
      addLog({
        id:
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : Date.now().toString(),
        timestamp: new Date(),
        message: "Loaded beats data successfully",
        type: "success",
        stage: "beats",
      });
    } catch (error) {
      // File might not exist yet, which is fine
      setBeatsData(null);
      addLog({
        id:
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : Date.now().toString(),
        timestamp: new Date(),
        message: "No beats data found or error loading beats",
        type: "warning",
        stage: "beats",
      });
    }
  };

  const handleSelectSong = async () => {
    const path = await worker.selectSong();
    if (path) {
      setSongPath(path);
      addLog({
        id:
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : Date.now().toString(),
        timestamp: new Date(),
        message: `Selected song: ${path}`,
        type: "info",
        stage: "setup",
      });
    }
  };

  const handleSelectClips = async () => {
    const path = await worker.selectClipsDirectory();
    if (path) {
      setClipsPath(path);
      addLog({
        id:
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : Date.now().toString(),
        timestamp: new Date(),
        message: `Selected clips directory: ${path}`,
        type: "info",
        stage: "setup",
      });
    }
  };

  const runStage = async (stage: string) => {
    try {
      setCurrentStage(stage);
      setProgress(0);
      setStatus((prev) => ({
        ...prev,
        [stage]: { status: "running", progress: 0 },
      }));

      addLog({
        id:
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : Date.now().toString(),
        timestamp: new Date(),
        message: `Starting ${stage} stage...`,
        type: "info",
        stage: stage,
      });

      await worker.runStage(stage, {
        song: songPath,
        clips: clipsPath,
        proxy: stage === "render",
        engine: beatEngine,
      });

      toast.success(`${stage} completed successfully`);
      addLog({
        id:
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : Date.now().toString(),
        timestamp: new Date(),
        message: `${stage} completed successfully`,
        type: "success",
        stage: stage,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast.error(`Failed to run ${stage}: ${errorMessage}`);
      setStatus((prev) => ({
        ...prev,
        [stage]: { status: "error", progress: 0 },
      }));
      addLog({
        id:
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : Date.now().toString(),
        timestamp: new Date(),
        message: `Failed to run ${stage}: ${errorMessage}`,
        type: "error",
        stage: stage,
      });
    }
  };

  const runAllStages = async () => {
    try {
      addLog({
        id:
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : Date.now().toString(),
        timestamp: new Date(),
        message: "Starting full pipeline execution...",
        type: "info",
        stage: "pipeline",
      });
      await runStage("beats");
      await runStage("shots");
      await runStage("cutlist");
      await runStage("render");
      addLog({
        id:
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : Date.now().toString(),
        timestamp: new Date(),
        message: "Pipeline completed successfully",
        type: "success",
        stage: "pipeline",
      });
    } catch (error) {
      toast.error("Pipeline failed");
      addLog({
        id:
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : Date.now().toString(),
        timestamp: new Date(),
        message: "Pipeline failed",
        type: "error",
        stage: "pipeline",
      });
    }
  };

  const getStatusColor = (stageStatus: string) => {
    switch (stageStatus) {
      case "completed":
        return "default";
      case "running":
        return "secondary";
      case "error":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusBadge = () => {
    const runningStage = Object.entries(status).find(
      ([, { status }]) => status === "running"
    );
    return runningStage ? "Running" : "Idle";
  };

  const stageConfig: Record<string, StageConfig> = {
    beats: {
      icon: Activity,
      description: "Detect beats and tempo from audio",
      color: "from-blue-500 to-blue-600",
    },
    shots: {
      icon: Film,
      description: "Analyze video clips for shot detection",
      color: "from-purple-500 to-purple-600",
    },
    cutlist: {
      icon: Scissors,
      description: "Build edit timeline matching beats to shots",
      color: "from-green-500 to-green-600",
    },
    render: {
      icon: Play,
      description: "Render final video with audio sync",
      color: "from-orange-500 to-orange-600",
    },
  };

  return (
    <EditorProvider>
      <div className="min-h-screen bg-slate-900 text-slate-100">
        {/* Top Bar */}
        <header className="sticky top-0 z-50 w-full border-b bg-slate-800/80 backdrop-blur-md shadow-sm">
          <div className="container flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                <Sparkles className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold">AutoEdit</h1>
              </div>
              <span className="text-sm text-muted-foreground">
                Automated Video Editing
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="px-3 py-1 font-medium">
                {getStatusBadge()}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {tauriAvailable ? "Desktop" : "Browser"}
              </span>
              <ZoomControls />
              <Button
                size="sm"
                onClick={() => runAllStages()}
                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800"
              >
                Run All
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="container grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 mt-4">
          {/* Left Column: Project Sources */}
          <div className="space-y-6">
            <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">
                  Project Sources
                </CardTitle>
                <CardDescription>
                  Select your music and video clips
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-2">
                  <Button size="sm" onClick={handleSelectSong}>
                    Select Song
                  </Button>
                  <Button size="sm" onClick={handleSelectClips}>
                    Select Clips
                  </Button>
                </div>
                <div className="h-96 overflow-auto">
                  <ClipList />
                </div>
              </CardContent>
            </Card>

            {/* Waveform Display */}
            {songPath && beatsData && (
              <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold">
                    Audio Waveform
                  </CardTitle>
                  <CardDescription>
                    Visual representation with beat markers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Waveform
                    audioPath={songPath}
                    beats={beatsData.beats}
                    downbeats={[]} // You can add downbeat detection logic later
                    tempoCurve={beatsData.tempo_curve.bpm}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Middle Column: Preview + Timeline */}
          <div className="space-y-6">
            <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Preview</CardTitle>
                <CardDescription>
                  Playback and scrub the composition
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PreviewPlayer src={songPath || undefined} />
                <div className="mt-4">
                  <Timeline />
                </div>
              </CardContent>
            </Card>

            {/* Pipeline Stages (kept below preview) */}
            <div className="space-y-6">
              {Object.entries(status).map(
                ([stage, { status: stageStatus, progress: stageProgress }]) => {
                  const IconComponent = stageConfig[stage].icon;
                  const gradient = stageConfig[stage].color;
                  return (
                    <Card
                      key={stage}
                      className={`border-0 shadow-lg transition-all duration-300 hover:shadow-xl ${
                        currentStage === stage
                          ? "ring-2 ring-blue-400 scale-[1.02]"
                          : ""
                      }`}
                    >
                      <CardContent className="pt-6">
                        {/* Top row with icon, title, and button */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`p-2 rounded-lg bg-gradient-to-r ${gradient}`}
                            >
                              <IconComponent className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold capitalize">
                                  {stage}
                                </h3>
                                <Badge variant={getStatusColor(stageStatus)}>
                                  {stageStatus}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {stageConfig[stage].description}
                                {stage === "render" && " (Proxy mode)"}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => runStage(stage)}
                            disabled={
                              !songPath ||
                              !clipsPath ||
                              stageStatus === "running"
                            }
                            className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800"
                          >
                            Run
                          </Button>
                        </div>

                        {stageStatus === "running" && (
                          <Progress
                            value={stageProgress * 100}
                            className="w-full"
                          />
                        )}

                        {currentStage === stage &&
                          stageStatus === "running" && (
                            <div className="text-xs text-muted-foreground mt-2">
                              Progress: {(progress * 100).toFixed(1)}%
                            </div>
                          )}
                      </CardContent>
                    </Card>
                  );
                }
              )}
            </div>
          </div>

          {/* Right Column: Inspector + Tools */}
          <div className="space-y-6">
            <ProjectManager />
            <EffectsInspector />
            <CutlistExporter />
            <SystemCheckPanel />
            <LogPanel logs={logs} onClear={clearLogs} />
          </div>
        </div>

        <Toaster position="top-right" theme="light" />
        <DragGhost />
      </div>
    </EditorProvider>
  );
}

export default App;
