/**
 * Enhanced Library Pane with selection tracking for Unified App
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LibraryPane from '@/components/library/LibraryPane';
import { FolderOpen, Check } from 'lucide-react';

interface SelectableLibraryPaneProps {
  selectedClips: string[];
  onSelectClip: (clipPath: string) => void;
  initialDir?: string;
  onDirChange?: (dir: string) => void;
}

export function SelectableLibraryPane({ 
  selectedClips, 
  onSelectClip, 
  initialDir, 
  onDirChange 
}: SelectableLibraryPaneProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <Card className="m-3 bg-slate-800 border-slate-600">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Video Library
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-slate-400">
            Click videos to select for timeline generation
          </div>
          {selectedClips.length > 0 && (
            <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
              <Check className="h-3 w-3" />
              {selectedClips.length} selected
            </div>
          )}
        </CardContent>
      </Card>

      {/* Library with custom selection handling */}
      <div className="flex-1 overflow-hidden">
        <LibraryPane
          onSelectClip={onSelectClip}
          initialDir={initialDir}
          onDirChange={onDirChange}
        />
      </div>
      
      {/* Selected clips overlay */}
      {selectedClips.length > 0 && (
        <div className="p-3 border-t border-slate-700 bg-slate-900/50 max-h-32 overflow-y-auto">
          <div className="text-xs text-slate-400 mb-2">Selected clips:</div>
          <div className="space-y-1">
            {selectedClips.slice(0, 5).map((clipPath, index) => (
              <div 
                key={index} 
                className="text-xs text-green-400 truncate bg-slate-800/50 px-2 py-1 rounded"
              >
                {clipPath.split('/').pop()?.split('\\').pop() || clipPath}
              </div>
            ))}
            {selectedClips.length > 5 && (
              <div className="text-xs text-slate-500">
                ... and {selectedClips.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}