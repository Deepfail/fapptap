import { TimelineItem } from '../state/editorStore';

export interface BeatInfo {
  time: number; // timestamp in seconds
  strength: number; // 0-1, how strong this beat is
  type: 'downbeat' | 'beat' | 'subdivision';
}

export interface BeatSyncOptions {
  tolerance: number; // seconds around beat to snap to
  quantizeLevel: '1/1' | '1/2' | '1/4' | '1/8' | '1/16';
  swing: number; // 0-100, amount of swing to apply
}

export class BeatSyncTools {
  private beats: BeatInfo[];
  
  constructor(beats: BeatInfo[] = []) {
    this.beats = beats;
  }
  
  updateBeats(beats: BeatInfo[]) {
    this.beats = beats;
  }
  
  /**
   * Find the nearest beat to a given time
   */
  findNearestBeat(time: number, tolerance: number = 0.1): BeatInfo | null {
    if (this.beats.length === 0) return null;
    
    let nearest = this.beats[0];
    let minDistance = Math.abs(this.beats[0].time - time);
    
    for (const beat of this.beats) {
      const distance = Math.abs(beat.time - time);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = beat;
      }
    }
    
    return minDistance <= tolerance ? nearest : null;
  }
  
  /**
   * Quantize a time to the nearest beat subdivision
   */
  quantizeTime(time: number, options: BeatSyncOptions): number {
    const nearestBeat = this.findNearestBeat(time, options.tolerance);
    if (!nearestBeat) return time;
    
    // Calculate subdivision interval
    const bpm = this.estimateBPM();
    const beatInterval = 60 / bpm;
    
    let subdivisionInterval: number;
    switch (options.quantizeLevel) {
      case '1/1': subdivisionInterval = beatInterval * 4; break; // whole note
      case '1/2': subdivisionInterval = beatInterval * 2; break; // half note
      case '1/4': subdivisionInterval = beatInterval; break;     // quarter note
      case '1/8': subdivisionInterval = beatInterval / 2; break; // eighth note
      case '1/16': subdivisionInterval = beatInterval / 4; break; // sixteenth note
      default: subdivisionInterval = beatInterval;
    }
    
    // Find nearest subdivision
    const subdivisions = Math.round((time - nearestBeat.time) / subdivisionInterval);
    let quantizedTime = nearestBeat.time + (subdivisions * subdivisionInterval);
    
    // Apply swing
    if (options.swing > 0 && subdivisions % 2 === 1) {
      const swingOffset = (subdivisionInterval * options.swing / 100) * 0.1;
      quantizedTime += swingOffset;
    }
    
    return quantizedTime;
  }
  
  /**
   * Quantize all timeline items to beats
   */
  quantizeTimelineItems(items: TimelineItem[], options: BeatSyncOptions): TimelineItem[] {
    return items.map(item => ({
      ...item,
      start: this.quantizeTime(item.start, options),
      in: this.quantizeTime(item.in, options),
      out: this.quantizeTime(item.out, options)
    }));
  }
  
  /**
   * Nudge a time forward or backward by beat subdivisions
   */
  nudgeTime(time: number, direction: 'forward' | 'backward', subdivisions: number = 1, quantizeLevel: BeatSyncOptions['quantizeLevel'] = '1/4'): number {
    const bpm = this.estimateBPM();
    const beatInterval = 60 / bpm;
    
    let subdivisionInterval: number;
    switch (quantizeLevel) {
      case '1/1': subdivisionInterval = beatInterval * 4; break;
      case '1/2': subdivisionInterval = beatInterval * 2; break;
      case '1/4': subdivisionInterval = beatInterval; break;
      case '1/8': subdivisionInterval = beatInterval / 2; break;
      case '1/16': subdivisionInterval = beatInterval / 4; break;
      default: subdivisionInterval = beatInterval;
    }
    
    const offset = subdivisionInterval * subdivisions;
    return direction === 'forward' ? time + offset : time - offset;
  }
  
  /**
   * Get beat markers within a time range
   */
  getBeatsInRange(startTime: number, endTime: number): BeatInfo[] {
    return this.beats.filter(beat => beat.time >= startTime && beat.time <= endTime);
  }
  
  /**
   * Estimate BPM from beat data
   */
  private estimateBPM(): number {
    if (this.beats.length < 2) return 120; // default BPM
    
    const intervals: number[] = [];
    for (let i = 1; i < Math.min(this.beats.length, 10); i++) {
      intervals.push(this.beats[i].time - this.beats[i-1].time);
    }
    
    if (intervals.length === 0) return 120;
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    return 60 / avgInterval;
  }
  
  /**
   * Auto-detect cut points based on beats and energy changes
   */
  detectAutoCutPoints(startTime: number, endTime: number, options: {
    minCutLength: number; // minimum seconds between cuts
    energyThreshold: number; // 0-1, how much energy change needed for cut
    onlyOnBeats: boolean; // only cut on beat markers
  }): number[] {
    const cutPoints: number[] = [];
    const beatsInRange = this.getBeatsInRange(startTime, endTime);
    
    for (const beat of beatsInRange) {
      // Skip if too close to last cut point
      if (cutPoints.length > 0 && 
          beat.time - cutPoints[cutPoints.length - 1] < options.minCutLength) {
        continue;
      }
      
      // For downbeats or strong beats, add as cut point
      if (beat.type === 'downbeat' || beat.strength >= options.energyThreshold) {
        cutPoints.push(beat.time);
      }
    }
    
    return cutPoints;
  }
  
  /**
   * Create a beat grid for timeline visualization
   */
  createBeatGrid(startTime: number, endTime: number, pixelsPerSecond: number): {
    time: number;
    x: number;
    type: BeatInfo['type'];
    strength: number;
  }[] {
    const beatsInRange = this.getBeatsInRange(startTime, endTime);
    
    return beatsInRange.map(beat => ({
      time: beat.time,
      x: (beat.time - startTime) * pixelsPerSecond,
      type: beat.type,
      strength: beat.strength
    }));
  }
}

// Create a singleton instance
export const beatSyncTools = new BeatSyncTools();

// Mock beat data for development
export const generateMockBeats = (duration: number, bpm: number = 120): BeatInfo[] => {
  const beatInterval = 60 / bpm;
  const beats: BeatInfo[] = [];
  
  for (let time = 0; time < duration; time += beatInterval) {
    const beatNumber = Math.floor(time / beatInterval);
    
    beats.push({
      time,
      strength: beatNumber % 4 === 0 ? 1.0 : 0.7, // downbeats are stronger
      type: beatNumber % 4 === 0 ? 'downbeat' : 'beat'
    });
  }
  
  return beats;
};