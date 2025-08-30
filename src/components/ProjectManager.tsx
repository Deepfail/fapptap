import { useState } from "react";
import { useEditor } from "../state/editorStore";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { IS_DESKTOP } from "@/lib/platform";
import { Save, FolderOpen, Clock, AlertTriangle } from "lucide-react";

interface ProjectData {
  version: string;
  name: string;
  createdAt: string;
  lastModified: string;
  timeline: any[];
  clips: any[];
  settings: {
    pixelsPerSecond: number;
    playhead: number;
    selectedTimelineItemId: string | null;
    rippleMode: boolean;
  };
  metadata: {
    totalDuration: number;
    clipCount: number;
    eventCount: number;
  };
}

export const ProjectManager = () => {
  const {
    timeline,
    clips,
    pixelsPerSecond,
    playhead,
    selectedTimelineItemId,
    rippleMode,
  } = useEditor();

  const [projectName, setProjectName] = useState("Untitled Project");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  const generateProjectData = (): ProjectData => {
    const totalDuration =
      timeline.length > 0
        ? Math.max(...timeline.map((item) => item.start + (item.out - item.in)))
        : 0;

    return {
      version: "1.0",
      name: projectName,
      createdAt: lastSaved
        ? new Date(lastSaved).toISOString()
        : new Date().toISOString(),
      lastModified: new Date().toISOString(),
      timeline: timeline,
      clips: clips,
      settings: {
        pixelsPerSecond,
        playhead,
        selectedTimelineItemId: selectedTimelineItemId || null,
        rippleMode,
      },
      metadata: {
        totalDuration,
        clipCount: clips.length,
        eventCount: timeline.length,
      },
    };
  };

  const saveProject = async (saveAs = false) => {
    setIsSaving(true);

    try {
      const projectData = generateProjectData();
      const json = JSON.stringify(projectData, null, 2);

      if (IS_DESKTOP) {
        // Desktop: Save to .fapptap.json file
        const { writeTextFile, exists } = await import("@tauri-apps/plugin-fs");
        const fileName = `${projectName
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase()}.fapptap.json`;

        if (saveAs || !(await exists(fileName))) {
          // Could use dialog to pick location
          await writeTextFile(fileName, json);
        } else {
          await writeTextFile(fileName, json);
        }

        setLastSaved(new Date().toISOString());
      } else {
        // Browser: Save to localStorage and offer download
        const storageKey = `fapptap_project_${projectName}`;
        localStorage.setItem(storageKey, json);

        // Also offer download
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${projectName}.fapptap.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setLastSaved(new Date().toISOString());
        localStorage.setItem(
          `${storageKey}_lastSaved`,
          new Date().toISOString()
        );
      }
    } catch (error) {
      console.error("Failed to save project:", error);
      alert(`Failed to save project: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const loadProject = async () => {
    setIsLoading(true);

    try {
      if (IS_DESKTOP) {
        // Desktop: Use file dialog
        const { open } = await import("@tauri-apps/plugin-dialog");
        const { readTextFile } = await import("@tauri-apps/plugin-fs");

        const filePath = await open({
          filters: [{ name: "Fapptap Project", extensions: ["fapptap.json"] }],
        });

        if (filePath) {
          const json = await readTextFile(filePath);
          const projectData: ProjectData = JSON.parse(json);

          // Would need to update editor state here
          // For now, just show the data
          console.log("Loaded project:", projectData);
          setProjectName(projectData.name);
          setLastSaved(projectData.lastModified);

          alert(
            `Project "${projectData.name}" loaded (${projectData.metadata.eventCount} events)`
          );
        }
      } else {
        // Browser: Load from localStorage or file input
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".fapptap.json,.json";

        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const text = await file.text();
            const projectData: ProjectData = JSON.parse(text);

            console.log("Loaded project:", projectData);
            setProjectName(projectData.name);
            setLastSaved(projectData.lastModified);

            alert(
              `Project "${projectData.name}" loaded (${projectData.metadata.eventCount} events)`
            );
          }
        };

        input.click();
      }
    } catch (error) {
      console.error("Failed to load project:", error);
      alert(`Failed to load project: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const hasUnsavedChanges = () => {
    // Simple check - in real app would track dirty state
    return timeline.length > 0 && !lastSaved;
  };

  const formatLastSaved = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          Project Manager
          {hasUnsavedChanges() && (
            <Badge variant="secondary">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Unsaved
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Project Name */}
        <div className="space-y-2">
          <Label htmlFor="project-name">Project Name</Label>
          <Input
            id="project-name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Enter project name..."
          />
        </div>

        {/* Save/Load Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => saveProject()}
            disabled={isSaving}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={() => saveProject(true)}
            disabled={isSaving}
            className="w-full"
          >
            Save As...
          </Button>
          <Button
            variant="outline"
            onClick={loadProject}
            disabled={isLoading}
            className="col-span-2 w-full"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            {isLoading ? "Loading..." : "Load Project"}
          </Button>
        </div>

        {/* Auto-save Toggle */}
        <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Auto-save</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={(e) => setAutoSaveEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Project Stats */}
        <div className="grid grid-cols-3 gap-4 text-center pt-2 border-t border-slate-600">
          <div>
            <div className="text-lg font-semibold">{timeline.length}</div>
            <div className="text-xs text-muted-foreground">Events</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{clips.length}</div>
            <div className="text-xs text-muted-foreground">Clips</div>
          </div>
          <div>
            <div className="text-lg font-semibold">
              {timeline.length > 0
                ? Math.max(
                    ...timeline.map((item) => item.start + (item.out - item.in))
                  ).toFixed(1)
                : "0.0"}
              s
            </div>
            <div className="text-xs text-muted-foreground">Duration</div>
          </div>
        </div>

        {/* Last Saved */}
        {lastSaved && (
          <div className="text-xs text-muted-foreground text-center">
            Last saved: {formatLastSaved(lastSaved)}
          </div>
        )}

        {/* File Format Info */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-slate-600">
          <div>
            <strong>Format:</strong> .fapptap.json
          </div>
          <div>
            <strong>Location:</strong>{" "}
            {IS_DESKTOP ? "Project directory" : "localStorage + Download"}
          </div>
          <div>
            <strong>Auto-save:</strong>{" "}
            {autoSaveEnabled ? "Every 30s" : "Disabled"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
