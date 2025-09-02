import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Activity,
  Film,
  Scissors,
  Play,
  X,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  Monitor,
  Zap,
  Edit3,
} from "lucide-react";
import { useMediaStore } from "../state/mediaStore";
import { PythonWorker, WorkerMessage } from "../lib/worker";
import { SystemCheckPanel } from "./SystemCheckPanel";
import { toast } from "sonner";

const stageConfigs = {
  beats: {
    icon: Activity,
    title: "Beat Analysis",
    description: "Detect beats and tempo from audio track",
    color: "from-blue-500 to-blue-600",
  },
  shots: {
    icon: Film,
    title: "Shot Detection",
    description: "Analyze video clips for scene changes",
    color: "from-purple-500 to-purple-600",
  },
  cutlist: {
    icon: Scissors,
    title: "Generate Cutlist",
    description: "Create edit timeline matching beats to shots",
    color: "from-green-500 to-green-600",
  },
  render: {
    icon: Play,
    title: "Render Proxy",
    description: "Generate preview video with audio sync",
    color: "from-orange-500 to-orange-600",
  },
};

export function ActionsPane() {
  const {
    songPath,
    clipsDir,
    selectedClipIds,
    prefs,
    updatePrefs,
    jobs,
    addJob,
    updateJob,
    removeJob,
  } = useMediaStore();

  const [worker] = useState(() => new PythonWorker());
  const [showSystemCheck, setShowSystemCheck] = useState(false);
  const [isRunningFullWorkflow, setIsRunningFullWorkflow] = useState(false);

  const hasRequiredInputs = songPath && clipsDir && selectedClipIds.size > 0;

  const getJobStatus = (type: string) => {
    const job = jobs.find((j) => j.type === type && j.status !== "completed");
    return job || { status: "idle", progress: 0 };
  };

  const runStage = async (stage: string) => {
    if (!hasRequiredInputs) {
      toast.error(
        "Please select a song, clips directory, and at least one clip"
      );
      return;
    }

    const jobId = addJob({
      type: stage as any,
      status: "pending",
      progress: 0,
      message: `Starting ${stage}...`,
    });

    try {
      updateJob(jobId, { status: "running", progress: 0 });

      // Set up event handler for progress updates
      worker.on("progress", (message: WorkerMessage) => {
        updateJob(jobId, {
          progress: message.progress ?? 0,
          message: message.message || `${stage} in progress...`,
        });
      });

      await worker.runStage(stage, {
        song: songPath,
        clips: clipsDir,
        proxy: stage === "render",
        engine: prefs.engine,
      });

      updateJob(jobId, {
        status: "completed",
        progress: 1,
        message: `${stage} completed successfully`,
        endTime: Date.now(),
      });

      toast.success(`${stage} completed successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      updateJob(jobId, {
        status: "error",
        progress: 0,
        error: errorMessage,
        endTime: Date.now(),
      });
      toast.error(`${stage} failed: ${errorMessage}`);
    }
  };

  const runFullWorkflow = async () => {
    if (!hasRequiredInputs) {
      toast.error(
        "Please select a song, clips directory, and at least one clip"
      );
      return;
    }

    setIsRunningFullWorkflow(true);
    const stages = ["beats", "shots", "cutlist", "render"];
    
    try {
      for (const stage of stages) {
        // Check if stage already completed
        const existingJob = jobs.find(
          (j) => j.type === stage && j.status === "completed"
        );
        
        if (!existingJob) {
          await runStage(stage);
          
          // Wait for completion before moving to next stage
          await new Promise<void>((resolve, reject) => {
            const checkInterval = setInterval(() => {
              const currentJob = jobs.find(
                (j) => j.type === stage && j.status !== "pending" && j.status !== "running"
              );
              
              if (currentJob?.status === "completed") {
                clearInterval(checkInterval);
                resolve();
              } else if (currentJob?.status === "error") {
                clearInterval(checkInterval);
                reject(new Error(currentJob.error || `${stage} failed`));
              }
            }, 500);
          });
        }
      }
      
      toast.success("Video creation completed! 🎉");
    } catch (error: any) {
      toast.error(`Workflow failed: ${error.message}`);
    } finally {
      setIsRunningFullWorkflow(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      await worker.cancel();
      updateJob(jobId, {
        status: "error",
        error: "Cancelled by user",
        endTime: Date.now(),
      });
      toast.info("Job cancelled");
    } catch (error) {
      console.warn("Failed to cancel job:", error);
      updateJob(jobId, {
        status: "error",
        error: "Cancelled by user",
        endTime: Date.now(),
      });
      toast.info("Job cancelled");
    }
  };

  const clearCompletedJobs = () => {
    const completedJobIds = jobs
      .filter((j) => j.status === "completed")
      .map((j) => j.id);
    completedJobIds.forEach((id) => removeJob(id));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Actions</h2>
            <p className="text-sm text-slate-400 mt-1">
              {prefs.engine === "basic" 
                ? "One-click video creation"
                : "Manual control over each step"
              }
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSystemCheck(!showSystemCheck)}
          >
            <Monitor className="h-4 w-4 mr-1" />
            System
          </Button>
        </div>
      </div>

      {/* System Check Panel */}
      {showSystemCheck && (
        <div className="border-b border-slate-700 p-4">
          <SystemCheckPanel />
        </div>
      )}

      {/* Status Summary */}
      <div className="p-4 border-b border-slate-700">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Song:</span>
            <span className={songPath ? "text-green-400" : "text-red-400"}>
              {songPath ? "✓" : "Missing"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Clips:</span>
            <span className={clipsDir ? "text-green-400" : "text-red-400"}>
              {clipsDir ? "✓" : "Missing"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Selected:</span>
            <span
              className={
                selectedClipIds.size > 0 ? "text-green-400" : "text-red-400"
              }
            >
              {selectedClipIds.size} clips
            </span>
          </div>
        </div>
      </div>

      {/* Basic vs Advanced Mode Content */}
      {prefs.engine === "basic" ? (
        // BASIC MODE: Single "Create Video" Button
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-6 max-w-md">
            <div className="space-y-3">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Create Video</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Automatically analyze beats, detect shots, generate cuts, and render your video. 
                Everything happens in one click!
              </p>
            </div>

            <Button
              size="lg"
              className="w-full h-12 text-base bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              onClick={runFullWorkflow}
              disabled={!hasRequiredInputs || isRunningFullWorkflow}
            >
              {isRunningFullWorkflow ? (
                <>
                  <div className="h-4 w-4 border border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating Video...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Create Video
                </>
              )}
            </Button>

            {!hasRequiredInputs && (
              <p className="text-xs text-red-400">
                Please select audio, clips folder, and at least one video clip to continue
              </p>
            )}

            {/* Progress indicator for basic mode */}
            {isRunningFullWorkflow && (
              <div className="space-y-2">
                <div className="text-xs text-slate-400 text-left">
                  Progress: {Object.keys(stageConfigs).map(stage => {
                    const job = jobs.find(j => j.type === stage);
                    return (
                      <div key={stage} className="flex justify-between">
                        <span>{stageConfigs[stage as keyof typeof stageConfigs].title}</span>
                        <span className={
                          job?.status === "completed" ? "text-green-400" :
                          job?.status === "running" ? "text-blue-400" :
                          job?.status === "error" ? "text-red-400" :
                          "text-slate-500"
                        }>
                          {job?.status === "completed" ? "✓" :
                           job?.status === "running" ? "..." :
                           job?.status === "error" ? "✗" :
                           "⋯"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // ADVANCED MODE: Individual Stage Controls
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Edit3 className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-400">
              Run individual analysis steps and edit results
            </span>
          </div>

          {Object.entries(stageConfigs).map(([stage, config]) => {
            const job = getJobStatus(stage);
            const Icon = config.icon;

            return (
              <Card key={stage} className="border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg bg-gradient-to-r ${config.color}`}
                      >
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{config.title}</h3>
                          <Badge
                            variant={
                              job.status === "completed"
                                ? "default"
                                : job.status === "running"
                                ? "secondary"
                                : job.status === "error"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {job.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {config.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {job.status === "running" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelJob(job.id!)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => runStage(stage)}
                        disabled={!hasRequiredInputs || job.status === "running"}
                      >
                        {job.status === "completed" ? "Re-run" : "Run"}
                      </Button>
                      {job.status === "completed" && (
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>

                  {job.status === "running" && (
                    <div className="space-y-2">
                      <Progress value={job.progress * 100} className="h-2" />
                      <p className="text-xs text-slate-400">
                        {job.message ||
                          `Progress: ${(job.progress * 100).toFixed(1)}%`}
                      </p>
                    </div>
                  )}

                  {job.status === "error" && job.error && (
                    <div className="mt-2 p-2 bg-red-900/20 border border-red-900/30 rounded text-xs text-red-400">
                      {job.error}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Settings */}
      <div className="border-t border-slate-700 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </h3>
          {jobs.filter((j) => j.status === "completed").length > 0 && (
            <Button size="sm" variant="ghost" onClick={clearCompletedJobs}>
              Clear
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="engine" className="text-sm">
              Mode
            </Label>
            <Select
              value={prefs.engine}
              onValueChange={(value: "basic" | "advanced") =>
                updatePrefs({ engine: value })
              }
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3 w-3" />
                    Basic
                  </div>
                </SelectItem>
                <SelectItem value="advanced">
                  <div className="flex items-center gap-2">
                    <Edit3 className="h-3 w-3" />
                    Advanced
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="snap" className="text-sm">
              Snap to beat
            </Label>
            <Switch
              id="snap"
              checked={prefs.snapToBeat}
              onCheckedChange={(checked) =>
                updatePrefs({ snapToBeat: checked })
              }
            />
          </div>
        </div>
      </div>

      {/* Job Queue */}
      {jobs.length > 0 && (
        <div className="border-t border-slate-700 p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Queue ({jobs.length})
          </h3>
          <div className="space-y-2 max-h-32 overflow-auto">
            {jobs.slice(-5).map((job) => (
              <div key={job.id} className="flex items-center gap-2 text-xs">
                {job.status === "completed" ? (
                  <CheckCircle className="h-3 w-3 text-green-400" />
                ) : job.status === "error" ? (
                  <XCircle className="h-3 w-3 text-red-400" />
                ) : job.status === "running" ? (
                  <div className="h-3 w-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Clock className="h-3 w-3 text-slate-400" />
                )}
                <span className="flex-1 truncate">{job.type}</span>
                <span className="text-slate-400">
                  {job.status === "running"
                    ? `${(job.progress * 100).toFixed(0)}%`
                    : job.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
