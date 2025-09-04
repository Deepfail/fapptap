import { BeatPoint } from '../state/playerStore';

export function snapTime(
  t: number,
  beats: BeatPoint[],
  pxPerSec: number,
  snapRadiusPx: number = 10
): number {
  if (beats.length === 0) return t;

  const snapRadiusSec = snapRadiusPx / pxPerSec;
  
  // Binary search for nearest beat
  let left = 0;
  let right = beats.length - 1;
  let closestIndex = 0;
  let closestDistance = Math.abs(beats[0].time - t);

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const distance = Math.abs(beats[mid].time - t);
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = mid;
    }

    if (beats[mid].time < t) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // Check neighbors for potentially closer beats
  for (let i = Math.max(0, closestIndex - 1); i <= Math.min(beats.length - 1, closestIndex + 1); i++) {
    const distance = Math.abs(beats[i].time - t);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }

  // Snap if within radius
  if (closestDistance <= snapRadiusSec) {
    return beats[closestIndex].time;
  }

  return t;
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30); // Assuming 30fps
  return `${minutes}:${secs.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
}

export function constrainTime(time: number, duration: number): number {
  return Math.max(0, Math.min(duration, time));
}

export function preventZeroLengthCuts(start: number, end: number, minDuration: number = 0.05): { start: number; end: number } {
  if (end - start < minDuration) {
    end = start + minDuration;
  }
  return { start, end };
}