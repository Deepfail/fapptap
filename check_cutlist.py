import json

with open('cache/cutlist.json', 'r') as f:
    cutlist = json.load(f)

events = cutlist.get('events', [])
total_duration = cutlist.get('total_duration', 'MISSING')
calculated_duration = sum(event['out'] - event['in'] for event in events)

print(f'Events: {len(events)}')
print(f'Total duration from cutlist: {total_duration} seconds')
print(f'Calculated from events: {calculated_duration:.3f} seconds')
print(f'Audio file: {cutlist.get("audio", "MISSING")}')