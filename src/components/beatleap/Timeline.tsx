/**
 * Timeline - Cards showing clips with transition badges
 */
import { useEditor } from "@/state/editorStore";
import { getTransitionLabel } from "@/types/transitions";
import { Video, Scissors } from "lucide-react";

export function Timeline() {
  const { timeline, selectTimelineItem, selectedTimelineItemId } = useEditor();

  if (timeline.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Scissors className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div>Timeline is empty</div>
          <div className="text-sm">Generate or drag clips here</div>
        </div>
      </div>
    );
  }

  const getClipFileName = (clipId: string) => {
    return clipId.split(/[\\/]/).pop() || clipId;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full p-4">
      <div className="flex space-x-2 overflow-x-auto h-full">
        {timeline.map((item) => {
          const duration = item.out - item.in;
          const isSelected = item.id === selectedTimelineItemId;
          const transitionLabel = getTransitionLabel(item.transitionOut);
          
          return (
            <div
              key={item.id}
              className={`
                relative flex-shrink-0 w-32 h-20 rounded border-2 cursor-pointer transition-colors
                ${isSelected 
                  ? "border-blue-500 bg-blue-900/50" 
                  : "border-gray-600 bg-gray-700 hover:bg-gray-650"
                }
              `}
              onClick={() => selectTimelineItem(item.id)}
            >
              {/* Clip Content */}
              <div className="p-2 h-full flex flex-col">
                <div className="flex items-center mb-1">
                  <Video className="w-3 h-3 mr-1" />
                  <span className="text-xs truncate flex-1">
                    {getClipFileName(item.clipId)}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {formatDuration(duration)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatDuration(item.in)} - {formatDuration(item.out)}
                </div>
              </div>

              {/* Transition Badge */}
              {item.transitionOut && (
                <div className="absolute -right-1 top-1 bg-purple-600 text-white text-xs px-1 py-0.5 rounded text-center min-w-[3rem]">
                  {transitionLabel}
                </div>
              )}

              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute inset-0 border-2 border-blue-400 rounded pointer-events-none animate-pulse" />
              )}
            </div>
          );
        })}
      </div>

      {/* Timeline Info */}
      <div className="mt-2 text-xs text-gray-400 text-center">
        {timeline.length} clips • Total: {formatDuration(timeline.reduce((sum, item) => sum + (item.out - item.in), 0))}
      </div>
    </div>
  );
}