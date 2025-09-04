import json

with open('cache/beats.json', 'r') as f:
    data = json.load(f)

beats_count = len(data.get("beats", []))
downbeats_count = len(data.get("downbeats", []))
downbeats = data.get("downbeats", [])

print(f"Total beats: {beats_count}")
print(f"Total downbeats: {downbeats_count}")
print(f"First 10 downbeats: {downbeats[:10]}")
if downbeats_count > 0:
    print(f"Downbeat ratio: 1 downbeat per {beats_count / downbeats_count:.1f} beats")
    print(f"Expected for 4/4 time: 1 downbeat per 4 beats")