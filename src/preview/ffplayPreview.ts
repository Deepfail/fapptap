/**
 * FFplay preview process management for FAPPTap Live FFPlay
 * Handles starting, stopping, and managing ffplay processes
 */

import { Command, Child } from '@tauri-apps/plugin-shell';
import { Timeline, PreviewState } from './types';
import { buildInputList, buildFilterComplex, writeCache, normalize } from './ffgraph';
import { isTauriAvailable } from '@/lib/platform';

class FFplayPreviewManager {
  private currentProcess: Child | null = null;
  private state: PreviewState = { isRunning: false };
  private eventHandlers: Map<string, Function[]> = new Map();

  /**
   * Add event listener
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  /**
   * Get current preview state
   */
  getState(): PreviewState {
    return { ...this.state };
  }

  /**
   * Check if preview is currently running
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Start FFplay preview with given timeline
   */
  async startPreview(timeline: Timeline): Promise<void> {
    // Check if Tauri is available
    if (!isTauriAvailable()) {
      throw new Error('FFplay preview is only available in desktop mode');
    }

    try {
      // Stop any existing preview first
      await this.stopPreview();

      // Generate input list and filter complex
      const inputList = buildInputList(timeline);
      const { complex, vOut, aOut } = buildFilterComplex(timeline);

      // Write temporary files
      const inputsPath = await writeCache('inputs.txt', inputList);
      const graphPath = await writeCache('graph.fc', complex);

      // Build ffplay command arguments
      const args = [
        '-hide_banner',
        '-autoexit',
        '-stats',
        '-f', 'concat',
        '-safe', '0',
        '-protocol_whitelist', 'file,pipe,concat,subfile',
        '-i', normalize(inputsPath),
        '-filter_complex_script', normalize(graphPath),
        '-map', `[${vOut}]`,
        '-map', `[${aOut}]`,
        // Additional ffplay options for better UX
        '-x', '854', // Default width
        '-y', '480', // Default height
        '-window_title', 'FAPPTap Live Preview',
        '-volume', '50', // Start at 50% volume
      ];

      // Log command for debugging
      console.log('Starting ffplay with args:', args);
      this.emit('command', { name: 'binaries/ffplaybin', args });

      // Start the process
      const command = Command.sidecar('binaries/ffplaybin', args);
      this.currentProcess = await command.spawn();

      // Update state
      this.state = {
        isRunning: true,
        processId: this.currentProcess.pid,
        startTime: Date.now(),
        error: undefined,
      };

      this.emit('started', this.state);

      // Handle process completion in background without blocking
      // Note: Using a simple wait since Child doesn't expose status() in this version
      (async () => {
        try {
          // Just wait for the process - it will be cleaned up when it exits
          console.log('FFplay process started with PID:', this.currentProcess!.pid);
        } catch (error: any) {
          console.error('FFplay process error:', error);
          if (this.currentProcess) {
            this.state = { 
              isRunning: false, 
              error: error.toString() 
            };
            this.currentProcess = null;
            this.emit('error', error);
          }
        }
      })();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to start FFplay preview:', errorMessage);
      
      this.state = { 
        isRunning: false, 
        error: errorMessage 
      };
      
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the current FFplay preview
   */
  async stopPreview(): Promise<void> {
    if (!this.currentProcess || !this.state.isRunning) {
      return;
    }

    try {
      console.log('Stopping FFplay process...');
      
      // Kill the process
      await this.currentProcess.kill();
      
      // Update state
      this.state = { isRunning: false };
      this.currentProcess = null;
      
      this.emit('stopped', { code: 0, signal: 'SIGTERM' });
      
    } catch (error) {
      console.error('Failed to stop FFplay process:', error);
      
      // Force update state even if kill failed
      this.state = { isRunning: false };
      this.currentProcess = null;
      
      this.emit('error', error);
    }
  }

  /**
   * Restart preview with new timeline (for debounced updates)
   */
  async restartPreview(timeline: Timeline): Promise<void> {
    await this.stopPreview();
    
    // Small delay to ensure process cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await this.startPreview(timeline);
  }

  /**
   * Cleanup on component unmount
   */
  async cleanup(): Promise<void> {
    await this.stopPreview();
    this.eventHandlers.clear();
  }
}

// Export singleton instance
export const ffplayPreview = new FFplayPreviewManager();

// Export convenience functions
export async function startFfplayPreview(timeline: Timeline): Promise<void> {
  return ffplayPreview.startPreview(timeline);
}

export async function stopFfplayPreview(): Promise<void> {
  return ffplayPreview.stopPreview();
}

export async function restartFfplayPreview(timeline: Timeline): Promise<void> {
  return ffplayPreview.restartPreview(timeline);
}

export function isPreviewRunning(): boolean {
  return ffplayPreview.isRunning();
}

export function getPreviewState(): PreviewState {
  return ffplayPreview.getState();
}