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
import { Label } from "./components/ui/label";
import { Separator } from "./components/ui/separator";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { PythonWorker, WorkerMessage } from "./lib/worker";
import "./App.css";

function App() {
  const [worker] = useState(() => new PythonWorker());
  const [songPath, setSongPath] = useState<string>("");
  const [clipsPath, setClipsPath] = useState<string>("");
  const [currentStage, setCurrentStage] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<
    Record<string, { status: string; progress: number }>
  >({
    beats: { status: "idle", progress: 0 },
    shots: { status: "idle", progress: 0 },
    cutlist: { status: "idle", progress: 0 },
    render: { status: "idle", progress: 0 },
  });

  useEffect(() => {
    const unsubscribe = worker.onMessage((msg: WorkerMessage) => {
      if (msg.stage) {
        setCurrentStage(msg.stage);
        if (msg.progress !== undefined) {
          setProgress(msg.progress);
          setStatus((prev) => ({
            ...prev,
            [msg.stage]: {
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
            [msg.stage]: { status: "error", progress: 0 },
          }));
        }
      }
    });

    return unsubscribe;
  }, [worker]);

  const handleSelectSong = async () => {
    const path = await worker.selectSong();
    if (path) setSongPath(path);
  };

  const handleSelectClips = async () => {
    const path = await worker.selectClipsDirectory();
    if (path) setClipsPath(path);
  };

  const runStage = async (stage: string) => {
    try {
      setCurrentStage(stage);
      setProgress(0);
      setStatus((prev) => ({
        ...prev,
        [stage]: { status: "running", progress: 0 },
      }));

      await worker.runStage(stage, {
        song: songPath,
        clips: clipsPath,
        proxy: stage === "render",
      });

      toast.success(`${stage} completed successfully`);
    } catch (error) {
      toast.error(
        `Failed to run ${stage}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setStatus((prev) => ({
        ...prev,
        [stage]: { status: "error", progress: 0 },
      }));
    }
  };

  const getStatusColor = (stageStatus: string) => {
    switch (stageStatus) {
      case "completed":
        return "text-green-600";
      case "running":
        return "text-blue-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <Toaster />
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              AutoEdit Pipeline
            </CardTitle>
            <CardDescription>
              Automated video editing pipeline with beat detection and shot
              matching
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Music Track</Label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSelectSong}>
                    Select Song
                  </Button>
                  <span className="text-sm text-muted-foreground truncate">
                    {songPath || "No song selected"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Video Clips Directory</Label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSelectClips}>
                    Select Clips
                  </Button>
                  <span className="text-sm text-muted-foreground truncate">
                    {clipsPath || "No directory selected"}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Pipeline Stages */}
            <div className="space-y-4">
              {Object.entries(status).map(
                ([stage, { status: stageStatus, progress: stageProgress }]) => (
                  <Card
                    key={stage}
                    className={currentStage === stage ? "border-blue-300" : ""}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold capitalize">{stage}</h3>
                          <span
                            className={`text-sm ${getStatusColor(stageStatus)}`}
                          >
                            {stageStatus}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => runStage(stage)}
                          disabled={
                            !songPath || !clipsPath || stageStatus === "running"
                          }
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

                      {currentStage === stage && stageStatus === "running" && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Progress: {(progress * 100).toFixed(1)}%
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default App;
