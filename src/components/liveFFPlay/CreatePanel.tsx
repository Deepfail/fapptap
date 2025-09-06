/**
 * Create Panel for Live FFPlay Mode
 * Handles user input for audio duration, file selection, and video length
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Music, Video, Play } from 'lucide-react';
import { CreateRequest } from '@/preview/types';
import { isTauriAvailable } from '@/lib/platform';

interface CreatePanelProps {
  onCreateRequest: (request: CreateRequest) => void;
  isCreating?: boolean;
  selectedClipPaths?: string[];
}

const DURATION_OPTIONS = [
  { value: '30s', label: '30 seconds' },
  { value: '1m', label: '1 minute' },
  { value: '2m', label: '2 minutes' },
  { value: '3m', label: '3 minutes' },
  { value: 'full', label: 'Full track' },
] as const;

const ORDER_OPTIONS = [
  { value: 'random', label: 'Random' },
  { value: 'byTitle', label: 'By title' },
] as const;

export function CreatePanel({ onCreateRequest, isCreating = false, selectedClipPaths = [] }: CreatePanelProps) {
  const [audioPath, setAudioPath] = useState<string>('');
  const [audioPreset, setAudioPreset] = useState<CreateRequest['audioPreset']>('1m');
  const [videoLength, setVideoLength] = useState<CreateRequest['videoLength']>('1m');
  const [clipOrder, setClipOrder] = useState<CreateRequest['clipOrder']>('random');

  const handleSelectAudio = async () => {
    if (!isTauriAvailable()) {
      // Browser fallback - show file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          setAudioPath(URL.createObjectURL(file));
        }
      };
      input.click();
      return;
    }

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        title: 'Select Audio File',
        filters: [
          {
            name: 'Audio Files',
            extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg']
          }
        ]
      });

      if (result && typeof result === 'string') {
        setAudioPath(result);
      }
    } catch (error) {
      console.error('Failed to select audio file:', error);
    }
  };

  const handleCreate = () => {
    if (!audioPath) {
      alert('Please select an audio file first');
      return;
    }

    if (selectedClipPaths.length === 0) {
      alert('Please select some video clips first');
      return;
    }

    const request: CreateRequest = {
      audioPath,
      audioPreset,
      videoLength,
      clipOrder,
    };

    onCreateRequest(request);
  };

  const canCreate = audioPath && selectedClipPaths.length > 0 && !isCreating;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Live FFPlay Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Audio Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Audio File</Label>
          <div className="flex gap-2">
            <Input
              value={audioPath ? audioPath.split('/').pop()?.split('\\').pop() || audioPath : ''}
              placeholder="Select audio file..."
              readOnly
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAudio}
              className="shrink-0"
            >
              <Music className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Audio Duration Preset */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Audio Duration</Label>
          <Select value={audioPreset} onValueChange={(value: string) => setAudioPreset(value as CreateRequest['audioPreset'])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Video Length */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Video Length</Label>
          <Select value={videoLength} onValueChange={(value: string) => setVideoLength(value as CreateRequest['videoLength'])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clip Ordering */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Clip Order</Label>
          <Select value={clipOrder} onValueChange={(value: string) => setClipOrder(value as CreateRequest['clipOrder'])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Clips Info */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Selected Clips</Label>
          <div className="text-sm text-muted-foreground">
            {selectedClipPaths.length} clip{selectedClipPaths.length !== 1 ? 's' : ''} selected
          </div>
        </div>

        {/* Create Button */}
        <Button
          onClick={handleCreate}
          disabled={!canCreate}
          className="w-full"
          size="lg"
        >
          {isCreating ? (
            'Creating...'
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Create & Preview
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}