import { Timeline } from './types';

export function normalize(p: string): string {
  return p.replace(/\\/g, '/');
}

export function buildInputList(_tl: Timeline): string {
  return '';
}

export function buildFilterComplex(_tl: Timeline): { complex: string; vOut: string; aOut: string } {
  return { complex: '', vOut: 'vout', aOut: 'aout' };
}

export async function writeCache(relPath: string, _content: string): Promise<string> {
  return Promise.resolve(relPath);
}
