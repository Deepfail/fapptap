#!/usr/bin/env python3
import json

# Check existing cutlist for effects
with open('cache/cutlist.json') as f:
    data = json.load(f)

print(f"Total events: {len(data['events'])}")
print("\nFirst 5 events effects:")
for i, event in enumerate(data['events'][:5]):
    effects = event.get('effects', [])
    print(f"Event {i}: {effects}")

# Check if any event has effects
events_with_effects = [i for i, ev in enumerate(data['events']) if ev.get('effects')]
print(f"\nEvents with effects: {len(events_with_effects)} out of {len(data['events'])}")
if events_with_effects:
    print(f"Indices: {events_with_effects[:10]}...")  # First 10