import { useState } from 'react';
import { PreviewPlayer } from '@/components/preview';
import { Timeline } from '@/components/Timeline';
import { EffectsInspector } from '@/components/EffectsInspector';
import { TransitionsInspector } from '@/components/TransitionsInspector';
import { CuttingTools } from '@/components/CuttingTools';
import { Button } from '@/components/ui/button';

interface EditorLayoutProps {
  currentClip?: string;
}

export const EditorLayout = ({ currentClip }: EditorLayoutProps) => {
  const [showTimeline, setShowTimeline] = useState(true);
  const [inspectorTab, setInspectorTab] = useState('effects');

  return (
    <div className="flex flex-col h-full">
      {/* Video Preview Area */}
      <div className="flex-1 min-h-0 bg-slate-900 p-3">
        <div className="h-full rounded-xl border border-slate-700 overflow-hidden">
          <PreviewPlayer
            srcPath={currentClip}
            muted
            autoHideMs={5000}
            showTimelineStrip={false}
            onTime={() => {}}
          />
        </div>
      </div>

      {/* Timeline Toggle */}
      <div className="px-3 py-1 border-t border-slate-700 bg-slate-800/50">
        <Button
          size="sm"
          variant={showTimeline ? "default" : "outline"}
          onClick={() => setShowTimeline(!showTimeline)}
          className="text-xs"
        >
          {showTimeline ? 'Hide Timeline' : 'Show Timeline'}
        </Button>
      </div>

      {/* Timeline Area */}
      {showTimeline && (
        <div className="h-48 border-t border-slate-700 bg-slate-800/30 p-3">
          <Timeline />
        </div>
      )}

      {/* Bottom Inspector Panel */}
      <div className="h-80 border-t border-slate-700 bg-slate-800/50 p-3">
        <div className="flex gap-3 h-full">
          {/* Left: Cutting Tools */}
          <div className="w-80 flex-shrink-0">
            <CuttingTools />
          </div>

          {/* Right: Effects & Transitions */}
          <div className="flex-1 min-w-0">
            <div className="h-full flex flex-col">
              <div className="flex gap-2 mb-3">
                <Button
                  size="sm"
                  variant={inspectorTab === 'effects' ? "default" : "outline"}
                  onClick={() => setInspectorTab('effects')}
                  className="text-xs"
                >
                  Effects
                </Button>
                <Button
                  size="sm"
                  variant={inspectorTab === 'transitions' ? "default" : "outline"}
                  onClick={() => setInspectorTab('transitions')}
                  className="text-xs"
                >
                  Transitions
                </Button>
              </div>
              
              <div className="flex-1 min-h-0">
                {inspectorTab === 'effects' && <EffectsInspector />}
                {inspectorTab === 'transitions' && <TransitionsInspector />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};