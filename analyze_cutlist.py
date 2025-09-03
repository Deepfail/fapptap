import json

with open('cache/cutlist.json', 'r') as f:
    cutlist = json.load(f)

print("Cutlist analysis:")
print(f"  Events: {len(cutlist.get('events', []))}")
print(f"  Total duration: {cutlist.get('total_duration', 'missing')}")

events = cutlist.get('events', [])
if len(events) > 0:
    # Calculate duration from events
    total_event_duration = 0
    for event in events:
        duration = event['out'] - event['in']
        total_event_duration += duration
    
    print(f"  Calculated duration from events: {total_event_duration:.2f}s")
    print(f"  Average event duration: {total_event_duration/len(events):.3f}s")
    
    # Show first few events
    print(f"\nFirst 3 events:")
    for i, event in enumerate(events[:3]):
        duration = event['out'] - event['in']
        src_file = event['src'].split('/')[-1]
        print(f"  {i+1}: {src_file} ({event['in']:.3f}-{event['out']:.3f} = {duration:.3f}s)")
