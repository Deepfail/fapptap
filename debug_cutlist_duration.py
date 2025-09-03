#!/usr/bin/env python3

import json

# Load cutlist
with open('cache/cutlist_debug.json', 'r') as f:
    cutlist = json.load(f)

# Calculate total duration
total_duration = 0
for event in cutlist['events']:
    segment_duration = event['out'] - event['in']
    total_duration += segment_duration

print(f'Cutlist total duration: {total_duration:.2f} seconds ({total_duration/60:.2f} minutes)')
print(f'Number of cutlist events: {len(cutlist["events"])}')
print(f'Average segment duration: {total_duration/len(cutlist["events"]):.3f} seconds')

# Show first and last few events
print("\nFirst 3 events:")
for i, event in enumerate(cutlist['events'][:3]):
    duration = event['out'] - event['in']
    print(f"  Event {i+1}: {duration:.3f}s from {event['src']}")

print("\nLast 3 events:")
for i, event in enumerate(cutlist['events'][-3:], len(cutlist['events'])-2):
    duration = event['out'] - event['in']
    print(f"  Event {i}: {duration:.3f}s from {event['src']}")