// Duplicate file stub removed — keep an empty module to avoid duplicate symbols.
export {};
        currentVideoIndex: 0,
        generationStage: "Preview ready!",
        // Beat data is now replaced by cut data in timeline
        hasBeatData: false, // Hide beat visualization, show cuts instead
      }));

      toast.success(
        "Preview generated and loaded! Review and make edits, then Export for final render."
      );
    } catch (error) {
      setState((prev) => ({ ...prev, isGenerating: false }));
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast.error(`Preview generation failed: ${errorMessage}`);
    }
  }, [
    state.selectedAudio,
    state.selectedVideos,
    state.cuttingMode,
    state.videoFormat,
    loadCutlistIntoEditor,
  ]);

  // Preview
  const handlePreview = useCallback(async () => {
    if (!state.hasTimeline) {
      toast.error("Generate timeline first");
      return;
    }

    try {
      setState((prev) => ({ ...prev, isPreviewPlaying: true }));

      const { Command } = await import("@tauri-apps/plugin-shell");
      const command = Command.sidecar("binaries/ffplaybin", [
        "render/fapptap_proxy.mp4",
        "-autoexit",
        "-x",
        "640",
        "-y",
        "360",
      ]);

      await command.spawn();
      toast.success("Preview started!");
    } catch (error) {
      setState((prev) => ({ ...prev, isPreviewPlaying: false }));
      toast.error("Preview failed");
    }
  }, [state.hasTimeline]);

  // Export final high-quality render
  const handleExport = useCallback(async () => {
    if (!state.hasTimeline) {
      toast.error("Generate preview first");
      return;
    }

    try {
      setState((prev) => ({ ...prev, isExporting: true, exportProgress: 0 }));

      const { save } = await import("@tauri-apps/plugin-dialog");

      const savePath = await save({
        filters: [{ name: "Video Files", extensions: ["mp4"] }],
        defaultPath: "fapptap_export.mp4",
      });

      if (savePath) {
        // 1) Serialize the *edited* editor timeline into render/cutlist.json
        setState((prev) => ({ ...prev, exportProgress: 20 }));
        const appDir = (await appDataDir()).replace(/\\+/g, "/");
        const existing =
          (await readJsonFromCandidates([
            "cache/cutlist.json",
            `${appDir}/cache/cutlist.json`,
            "render/cutlist.json",
            `${appDir}/render/cutlist.json`,
          ])) || {};

        // derive dimensions from selected format if missing
        const dims =
          state.videoFormat === "portrait"
            ? { width: 1080, height: 1920 }
            : state.videoFormat === "square"
            ? { width: 1080, height: 1080 }
            : { width: 1920, height: 1080 };

        const timelineEvents = editor.timeline.map((t) => ({
          src: t.clipId,
          in: Number(t.in ?? 0),
          out: Number(t.out ?? 0),
          effects: (t.effects || [])
            .filter((e) => e.enabled !== false)
            .map((e) => (typeof e.id === "string" ? e.id : "effect")),
        }));

        const finalCutlist = {
          version: existing.version ?? 1,
          fps: existing.fps ?? 60,
          width: existing.width ?? dims.width,
          height: existing.height ?? dims.height,
          audio:
            existing.audio ??
            state.selectedAudio?.path ??
            (state.selectedVideos[0]?.path ?? ""),
          total_duration:
            Math.max(
              0,
              timelineEvents.reduce((s: number, ev: any) => s + (ev.out - ev.in), 0)
            ) || existing.total_duration || 0,
          events: timelineEvents,
        };

        await mkdir("render", { recursive: true }).catch(() => {});
        await writeTextFile("render/cutlist.json", JSON.stringify(finalCutlist, null, 2));

        // 2) Final render with high quality (no re-running cutlist that would overwrite edits)
        setState((prev) => ({ ...prev, exportProgress: 70 }));
        const worker = new PythonWorker();
        await worker.runStage("render", { proxy: false });

        // Copy to user's chosen location
        setState((prev) => ({ ...prev, exportProgress: 90 }));
        await fsCopyFile("render/fapptap_final.mp4", savePath);

        setState((prev) => ({
          ...prev,
          isExporting: false,
          exportProgress: 100,
        }));
        toast.success(`High-quality video exported to: ${savePath}`);
      } else {
        setState((prev) => ({ ...prev, isExporting: false }));
      }
    } catch (error) {
      setState((prev) => ({ ...prev, isExporting: false }));
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast.error(`Export failed: ${errorMessage}`);
    }
  }, [
    state.hasTimeline,
    state.selectedAudio,
    state.cuttingMode,
    state.tempo,
    state.videoFormat,
    editor.timeline,
  ]);

  // Note: Old toggleEffect removed - now using toggleTimelineItemEffect with editor store

  // NEW: Toggle effect on selected timeline item (EditorStore integration test)
  const toggleTimelineItemEffect = useCallback((effectId: string) => {
    if (!editor.selectedTimelineItemId) {
      toast.error("Please select a timeline item first");
      return;
    }

    const currentEffects = editor.getTimelineItemEffects(editor.selectedTimelineItemId);
    const hasEffect = currentEffects.some(effect => effect.type === "filter" && effect.id.includes(effectId));

    if (hasEffect) {
      // Remove the effect
      const updatedEffects = currentEffects.filter(effect => 
        !(effect.type === "filter" && effect.id.includes(effectId))
      );
      editor.updateTimelineItemEffects(editor.selectedTimelineItemId, updatedEffects);
      toast.success(`Removed ${effectId} effect from timeline item`);
    } else {
      // Add the effect
      const newEffect = {
        id: `effect-${effectId}-${Date.now()}`,
        type: "filter" as const,
        enabled: true,
      };
      const updatedEffects = [...currentEffects, newEffect];
      editor.updateTimelineItemEffects(editor.selectedTimelineItemId, updatedEffects);
      toast.success(`Added ${effectId} effect to timeline item`);
    }
  }, [editor]);

  // Load beat data from cache/beats.json
  const loadBeatData = useCallback(async () => {
    if (!isTauriAvailable()) {
      // Browser fallback - simulate beat data
      const mockBeats = Array.from({ length: 50 }, (_, i) => ({
        time: i * 0.5, // Beat every 0.5 seconds
        confidence: 0.8 + Math.random() * 0.2, // Random confidence 0.8-1.0
      }));
      setState((prev) => ({
        ...prev,
        beatData: mockBeats,
        hasBeatData: true,
      }));
      return;
    }

    try {
      let beatJson: any;
      
      if (isTauriAvailable()) {
        const appDir = (await appDataDir()).replace(/\\+/g, "/");
        beatJson = await readJsonFromCandidates([
          "cache/beats.json",
          `${appDir}/cache/beats.json`,
          "render/beats.json",
          `${appDir}/render/beats.json`,
        ]) || {};
      } else {
        // Browser fallback: read from cache/beats.json
        const response = await fetch('/cache/beats.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch beats: ${response.statusText}`);
        }
        const beatContent = await response.text();
        beatJson = JSON.parse(beatContent);
      }
      
      // Extract beat times and confidences
      const beats = beatJson.beats?.map((beat: any) => ({
        time: beat.time || beat.onset || 0,
        confidence: beat.confidence || beat.strength || 1.0,
      })) || [];
      
      setState((prev) => ({
        ...prev,
        beatData: beats,
        hasBeatData: beats.length > 0,
      }));
      
      if (beats.length > 0) {
        toast.success(`Loaded ${beats.length} beats from audio analysis`);
      }
    } catch (error) {
      console.error("Failed to load beat data:", error);
      setState((prev) => ({
        ...prev,
        beatData: [],
        hasBeatData: false,
      }));
    }
  }, []);

  // Effect: Load beat data when audio is selected
  useEffect(() => {
    if (state.selectedAudio && !state.hasBeatData) {
      loadBeatData();
    }
  }, [state.selectedAudio, state.hasBeatData, loadBeatData]);

  return (
    <div className="h-screen bg-slate-900 text-white flex overflow-hidden">
      {/* Left Column - File Browser (FIXED 25% WIDTH, THUMBNAILS ONLY) */}
      <div className="w-1/4 border-r border-slate-700 bg-slate-800 flex flex-col">
        {/* Browser Header - Select All & Randomize */}
        <div className="p-2 border-b border-slate-700">
          <div className="flex gap-1 justify-center mb-2">
            <Button variant="outline" size="sm" onClick={browseFolder}>
              <Folder className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={selectAudioFile}>
              <Music className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                // Select all videos in current folder
                const videos = state.files.filter((f) => f.type === "video");
                setState((prev) => ({
                  ...prev,
                  selectedVideos: [
                    ...prev.selectedVideos,
                    ...videos.filter(
                      (v) =>
                        !prev.selectedVideos.some((sv) => sv.path === v.path)
                    ),
                  ],
                  currentVideo: prev.currentVideo || videos[0],
                  currentVideoIndex: prev.currentVideo
                    ? prev.currentVideoIndex
                    : 0,
                }));
                if (videos.length > 0)
                  toast.success(`Added ${videos.length} videos`);
              }}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`flex-1 text-xs ${
                state.isRandomized ? "bg-purple-600 text-white" : ""
              }`}
              disabled={!state.hasTimeline || editor.timeline.length === 0}
              onClick={() => {
                // Toggle randomize timeline cuts order
                if (editor.timeline.length > 1) {
                  setState((prev) => {
                    if (prev.isRandomized) {
                      // Un-randomize: sort by original index (using timeline item id)
                      const sorted = [...editor.timeline].sort((a, b) => {
                        const aIndex = parseInt(a.id.replace("timeline-item-", ""));
                        const bIndex = parseInt(b.id.replace("timeline-item-", ""));
                        return aIndex - bIndex;
                      });
                      
                      // Update timeline items with sequential start times
                      const reorderedItems = sorted.map((item, index) => {
                        const duration = item.out - item.in;
                        return {
                          ...item,
                          start: index * duration
                        };
                      });
                      
                      editor.updateTimelineItems(reorderedItems);
                      return {
                        ...prev,
                        isRandomized: false,
                      };
                    } else {
                      // Randomize
                      const shuffled = [...editor.timeline].sort(
                        () => Math.random() - 0.5
                      );
                      
                      // Update timeline items with sequential start times
                      const reorderedItems = shuffled.map((item, index) => {
                        const duration = item.out - item.in;
                        return {
                          ...item,
                          start: index * duration
                        };
                      });
                      
                      editor.updateTimelineItems(reorderedItems);
                      return {
                        ...prev,
                        isRandomized: true,
                      };
                    }
                  });
                  toast.success(
                    state.isRandomized
                      ? "Timeline restored to original order!"
                      : "Timeline randomized!"
                  );
                }
              }}
            >
              {state.isRandomized ? "Original" : "Randomize"}
            </Button>
          </div>
        </div>

        {/* Thumbnails Grid - NO NAMES */}
        <div className="flex-1 overflow-y-auto p-1">
          {state.files.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <Folder className="w-12 h-12 mx-auto mb-2 text-slate-500" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={browseFolder}
                  className="text-xs"
                >
                  Browse
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {getCurrentPageFiles().map((file, index) => {
                // Check if this video is selected
                const isSelected =
                  file.type === "video" &&
                  state.selectedVideos.some((v) => v.path === file.path);

                return (
                  <div
                    key={index}
                    className={`relative group cursor-pointer rounded overflow-hidden border transition-all ${
                      file.type === "video"
                        ? isSelected
                          ? "border-green-400 bg-green-900/50 shadow-lg shadow-green-400/25" // Selected state
                          : "border-slate-600 bg-slate-800 hover:border-green-400"
                        : "border-slate-600 bg-slate-700 hover:border-purple-400"
                    }`}
                    onClick={() => {
                      if (file.type === "video") {
                        selectVideo(file);
                      } else if (file.type === "audio") {
                        selectAudio(file);
                      }
                    }}
                  >
                    {/* Show actual video thumbnails */}
                    <div className="aspect-square bg-slate-900 flex items-center justify-center relative overflow-hidden">
                      {file.type === "video" ? (
                        <div className="relative w-full h-full">
                          <VideoThumbnail filePath={file.path} />
                          {/* Fallback gradient background */}
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center -z-10">
                            <Video className="w-8 h-8 text-white/90" />
                          </div>
                          {/* Play overlay */}
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <Play className="w-6 h-6 text-white/90 drop-shadow-lg" />
                          </div>
                          <div className="absolute bottom-1 left-1 text-xs text-white/90 bg-black/50 px-1 rounded">
                            VIDEO
                          </div>
                          {/* Selection indicator */}
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                              <svg
                                className="w-3 h-3 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                      ) : file.type === "audio" ? (
                        <>
                          <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center">
                            <Music className="w-8 h-8 text-white/90" />
                          </div>
                          <div className="absolute bottom-1 left-1 text-xs text-white/90 bg-black/50 px-1 rounded">
                            AUDIO
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                            <Folder className="w-8 h-8 text-white/90" />
                          </div>
                          <div className="absolute bottom-1 left-1 text-xs text-white/90 bg-black/50 px-1 rounded">
                            FOLDER
                          </div>
                        </>
                      )}

                      {/* Selection indicator */}
                      {((file.type === "video" &&
                        state.selectedVideos.some(
                          (v) => v.path === file.path
                        )) ||
                        (file.type === "audio" &&
                          state.selectedAudio?.path === file.path)) && (
                        <div className="absolute inset-0 border-3 border-blue-400 bg-blue-400/20 rounded"></div>
                      )}

                      {/* Tiny type indicator with probe status */}
                      <div className="absolute top-1 right-1 flex flex-col gap-1">
                        {file.type === "video" && (
                          <>
                            <div className="bg-green-500 w-3 h-3 rounded-full border border-white/50"></div>
                            {(() => {
                              const probeStatus = getFileProbeStatus(file.path);
                              const probeColor =
                                probeStatus?.status === "cached-fast" ||
                                probeStatus?.status === "cached-deep"
                                  ? "bg-green-400"
                                  : probeStatus?.status === "probing"
                                  ? "bg-yellow-400"
                                  : probeStatus?.status === "error"
                                  ? "bg-red-400"
                                  : "bg-gray-400";
                              return (
                                <div
                                  className={`w-2 h-2 rounded-full ${probeColor}`}
                                  title={`Probe: ${
                                    probeStatus?.status || "pending"
                                  }`}
                                />
                              );
                            })()}
                          </>
                        )}
                        {file.type === "audio" && (
                          <div className="bg-purple-500 w-3 h-3 rounded-full border border-white/50"></div>
                        )}
                      </div>

                      {/* Duration overlay from probe data */}
                      {file.type === "video" &&
                        (() => {
                          const probeData = getFileProbeData(file.path);
                          return probeData?.duration_sec ? (
                            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
                              {Math.round(probeData.duration_sec)}s
                            </div>
                          ) : null;
                        })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-2 flex items-center justify-between px-2 py-1 bg-slate-800/50 rounded">
              <Button
                variant="outline"
                size="sm"
                onClick={prevPage}
                disabled={!canPrevPage}
                className="w-8 h-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="text-xs text-slate-400">
                {state.currentPage + 1} / {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={nextPage}
                disabled={!canNextPage}
                className="w-8 h-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Bottom - Just Counter */}
        <div className="p-2 border-t border-slate-700 bg-slate-900">
          <div className="text-xs text-slate-400 text-center">
            Videos: {state.selectedVideos.length} | Audio:{" "}
            {state.selectedAudio ? "1" : "0"}
          </div>
        </div>
      </div>

      {/* Center - Video Player (ALWAYS PRESENT) */}
      <div className="flex-1 flex flex-col relative min-h-0">
        {/* Top Right Overlay - Format, Generate Preview & Export Final */}
        <div className="absolute top-4 right-4 z-10 flex gap-2 items-center">
          {/* Video Format Dropdown */}
          <div className="bg-slate-800 border border-slate-600 rounded-md">
            <Select
              value={state.videoFormat}
              onValueChange={(value: "landscape" | "portrait" | "square") =>
                setState((prev) => ({ ...prev, videoFormat: value }))
              }
            >
              <SelectTrigger className="w-32 h-10 bg-slate-800 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {VIDEO_FORMATS.map((format) => (
                  <SelectItem
                    key={format.value}
                    value={format.value}
                    className="text-white hover:bg-slate-700 focus:bg-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <span>{format.icon}</span>
                      <span>{format.label}</span>
                      <span className="text-slate-400 text-xs">
                        ({format.aspect})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={
              !state.selectedAudio ||
              state.selectedVideos.length === 0 ||
              state.isGenerating
            }
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {state.isGenerating ? "Generating..." : "Generate Preview"}
          </Button>

          <Button
            onClick={handleExport}
            disabled={!state.hasTimeline || state.isExporting}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            {state.isExporting ? "Exporting..." : "Export Final"}
          </Button>
        </div>

        {/* Generation Progress Overlay */}
        {state.isGenerating && (
          <div className="absolute top-16 right-4 z-10 bg-slate-800 border border-slate-600 rounded p-3 min-w-48">
            <div className="text-sm text-white mb-2">
              {state.generationStage}
            </div>
            <Progress value={state.generationProgress} className="h-2" />
          </div>
        )}

        {/* Export Progress Overlay */}
        {state.isExporting && (
          <div className="absolute top-16 right-4 z-10 bg-slate-800 border border-slate-600 rounded p-3 min-w-48">
            <div className="text-sm text-white mb-2">Exporting...</div>
            <Progress value={state.exportProgress} className="h-2" />
          </div>
        )}
        {/* Video Player */}
        <div className="flex-1 bg-black relative flex items-center justify-center p-4 min-h-0">
          {/* Video Container with Dynamic Aspect Ratio */}
          <div
            className={`relative bg-black/20 border border-white/10 rounded-lg overflow-hidden ${
              state.videoFormat === "landscape"
                ? "aspect-video w-full max-h-full"
                : state.videoFormat === "portrait"
                ? "aspect-[9/16] max-h-full max-w-full"
                : "aspect-square w-full max-h-full"
            }`}
            style={{
              maxWidth: state.videoFormat === "portrait" ? "min(60vh, 80vw)" : "100%",
              maxHeight: "calc(100vh - 120px)", // Reserve space for bottom controls
            }}
          >
            {state.currentVideo && state.currentVideoUrl ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                src={state.currentVideoUrl}
                onTimeUpdate={(e) => {
                  const video = e.target as HTMLVideoElement;
                  setState((prev) => ({
                    ...prev,
                    currentTime: video.currentTime,
                    duration: video.duration || 0,
                  }));
                }}
                onPlay={() =>
                  setState((prev) => ({ ...prev, isPlaying: true }))
                }
                onPause={() =>
                  setState((prev) => ({ ...prev, isPlaying: false }))
                }
              />
            ) : (
              // Static placeholder when no video selected
              <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
                <div className="text-center">
                  <Video className="w-24 h-24 mx-auto mb-4 text-slate-500" />
                  <p className="text-slate-400 text-lg">
                    Select videos from file browser
                  </p>
                  <p className="text-slate-500 text-sm">
                    Videos will play here in order
                  </p>
                </div>
              </div>
            )}

            {/* Video Controls Overlay - Centered */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/60 rounded-lg p-4 flex items-center gap-6">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={prevVideo}
                  disabled={state.currentVideoIndex <= 0}
                  className="bg-black/40 border-white/20 hover:bg-black/60"
                >
                  <SkipBack className="w-8 h-8 text-white" />
                </Button>

                {/* Play button doubles as Preview when timeline exists */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={
                    state.hasTimeline
                      ? handlePreview
                      : state.isPlaying
                      ? pauseVideo
                      : playVideo
                  }
                  disabled={!state.currentVideo && !state.hasTimeline}
                  className={`bg-black/40 border-white/20 hover:bg-black/60 w-16 h-16 ${
                    state.hasTimeline ? "border-purple-400" : ""
                  }`}
                >
                  {state.isPreviewPlaying ? (
                    <Square className="w-10 h-10 text-white" />
                  ) : (
                    <Play className="w-10 h-10 text-white" />
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={nextVideo}
                  disabled={
                    state.currentVideoIndex >= state.selectedVideos.length - 1
                  }
                  className="bg-black/40 border-white/20 hover:bg-black/60"
                >
                  <SkipForward className="w-8 h-8 text-white" />
                </Button>
              </div>
            </div>

            {/* Progress Bar - Bottom Overlay */}
            {state.currentVideo && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="mb-2">
                  <Progress
                    value={(state.currentTime / state.duration) * 100}
                    className="h-3 bg-slate-600"
                  />
                  <div className="flex justify-between text-sm text-slate-300 mt-2">
                    <span>{Math.floor(state.currentTime)}s</span>
                    <span>{Math.floor(state.duration)}s</span>
                  </div>
                </div>

                {/* Current video info */}
                <div className="text-center">
                  <div className="text-sm font-medium text-white">
                    {state.currentVideo.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {state.currentVideoIndex + 1} of{" "}
                    {state.selectedVideos.length}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline - Always Visible */}
        <div className="bg-slate-800 border-t border-slate-700 p-3">
          {/* Timeline Header */}
          <div className="text-xs text-slate-400 mb-2 text-center">
            {state.hasTimeline && editor.timeline.length > 0 ? (
              <>
                Timeline ({editor.timeline.length} cuts)
                {state.isRandomized && (
                  <span className="ml-2 text-purple-400">• Randomized</span>
                )}
              </>
            ) : state.hasBeatData && state.beatData.length > 0 ? (
              <>
                Timeline ({state.beatData.length} beats detected)
                <span className="ml-2 text-green-400">• Ready for preview generation</span>
              </>
            ) : state.selectedAudio ? (
              "Timeline (analyzing audio beats...)"
            ) : (
              "Timeline (select audio to load beats)"
            )}
          </div>

          {/* Timeline Content */}
          <div className="flex gap-1 overflow-x-auto pb-2 min-h-[60px]">
            {state.hasTimeline && editor.timeline.length > 0 ? (
              // Show cuts after preview generation
              editor.timeline.map((item, index) => {
                const duration = item.out - item.in;
                const fileName = item.clipId.split("/").pop() || item.clipId.split("\\").pop() || `Item ${index + 1}`;
                
                return (
                  <div
                    key={item.id}
                    className={`flex-shrink-0 bg-slate-700 rounded p-2 min-w-[120px] border ${
                      editor.selectedTimelineItemId === item.id ? 'border-blue-500' : 'border-slate-600'
                    }`}
                    title={`${fileName}\nDuration: ${duration.toFixed(
                      2
                    )}s\nStart: ${item.start.toFixed(2)}s\nEffects: ${
                      item.effects && item.effects.length > 0 ? item.effects.length : "None"
                    }`}
                    onClick={() => editor.selectTimelineItem(item.id)}
                  >
                    <div className="text-xs font-medium text-white truncate">
                      {fileName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {duration.toFixed(2)}s
                    </div>
                    {item.effects && item.effects.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {item.effects.slice(0, 3).map((effect, i) => (
                          <div
                            key={i}
                            className="text-xs bg-purple-600 text-white px-1 rounded"
                          >
                            {effect.type}
                          </div>
                        ))}
                        {item.effects && item.effects.length > 3 && (
                          <div className="text-xs text-slate-400">
                            +{item.effects.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 mt-1">
                      #{index + 1}
                    </div>
                  </div>
                );
              })
            ) : state.hasBeatData && state.beatData.length > 0 ? (
              // Show beat visualization
              <div className="flex gap-1">
                {state.beatData.slice(0, 50).map((beat, index) => (
                  <div
                    key={index}
                    className={`flex-shrink-0 rounded p-1 min-w-[8px] h-12 ${
                      beat.confidence > 0.9 
                        ? "bg-green-600" 
                        : beat.confidence > 0.7 
                        ? "bg-yellow-500" 
                        : "bg-slate-600"
                    }`}
                    title={`Beat ${index + 1}\nTime: ${beat.time.toFixed(2)}s\nConfidence: ${beat.confidence.toFixed(2)}`}
                    style={{
                      height: `${20 + beat.confidence * 28}px`, // Height based on confidence
                    }}
                  />
                ))}
                {state.beatData.length > 50 && (
                  <div className="text-xs text-slate-400 flex items-center ml-2">
                    +{state.beatData.length - 50} more beats
                  </div>
                )}
              </div>
            ) : state.selectedAudio ? (
              // Show loading state for beats
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <div className="text-sm">🎵 Loading beat analysis...</div>
                  <div className="text-xs mt-1">Audio selected: {state.selectedAudio.name}</div>
                </div>
              </div>
            ) : (
              // Show empty state
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <div className="text-sm">📱 Select audio file</div>
                  <div className="text-xs mt-1">Audio beats will appear here</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Effects Bar */}
        <div className="bg-slate-800 border-t border-slate-700 p-3">
          <div className="flex items-center justify-center gap-4">
            {/* Cutting Mode */}
            <div className="flex gap-1">
              <span className="text-xs text-slate-400 mr-2">Mode:</span>
              {CUTTING_MODES.map((mode) => (
                <Button
                  key={mode.value}
                  variant={
                    state.cuttingMode === mode.value ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    setState((prev) => ({ ...prev, cuttingMode: mode.value }))
                  }
                  className="text-xs px-2"
                >
                  {mode.label}
                </Button>
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-slate-600"></div>

            {/* Effects (enabled when an item is selected) */}
            <div className="flex gap-1">
              <span className="text-xs text-slate-400 mr-2">Effects:</span>
              {AVAILABLE_EFFECTS.map((effect) => {
                const Icon = effect.icon;
                const isActive = isEffectActive(effect.id);
                return (
                  <Button
                    key={effect.id}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleEffect(effect.id)}
                    className={`text-xs px-2 ${isActive ? effect.color : ""}`}
                    title={
                      selectedItemId
                        ? effect.label
                        : "Select a clip on the timeline to enable"
                    }
                    disabled={!selectedItemId}
                  >
                    <Icon className="w-4 h-4" />
                  </Button>
                );
              })}
            </div>

            {/* Timeline Item Effects (EditorStore Test) */}
            {editor.selectedTimelineItemId && (
              <>
                <div className="w-px h-6 bg-slate-600"></div>
                <div className="flex gap-1">
                  <span className="text-xs text-yellow-400 mr-2">Item Effects:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTimelineItemEffect("speed_up")}
                    className="text-xs px-2"
                    title="Toggle Speed Up effect on selected timeline item"
                  >
                    ⚡
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTimelineItemEffect("blur")}
                    className="text-xs px-2"
                    title="Toggle Blur effect on selected timeline item"
                  >
                    🌫️
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTimelineItemEffect("grayscale")}
                    className="text-xs px-2"
                    title="Toggle Grayscale effect on selected timeline item"
                  >
                    ⚫
                  </Button>
                </div>
              </>
            )}

            {/* Divider */}
            <div className="w-px h-6 bg-slate-600"></div>

            {/* Tempo */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Tempo:</span>
              <span className="text-xs text-white w-12">{state.tempo}%</span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      tempo: Math.max(50, prev.tempo - 10),
                    }))
                  }
                  className="text-xs px-1"
                >
                  -
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      tempo: Math.min(200, prev.tempo + 10),
                    }))
                  }
                  className="text-xs px-1"
                >
                  +
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  );
}

export default StaticUnifiedApp;
