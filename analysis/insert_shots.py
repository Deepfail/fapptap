import sqlite3
import json
import sys

# Usage: python insert_shots.py <shots_json_file>
shots_json_file = sys.argv[1]

# Read the shots JSON file
with open(shots_json_file, 'r', encoding='utf-8') as f:
    shots_data = json.load(f)

# Connect to SQLite database
conn = sqlite3.connect('cache/analysis.db')
cursor = conn.cursor()

# Insert or replace shots data
for video_path, shots in shots_data.items():
    shots_json = json.dumps(shots)
    cursor.execute(
        "INSERT OR REPLACE INTO shots (video_path, shots_json) VALUES (?, ?)",
        (video_path, shots_json)
    )

# Commit changes and close connection
conn.commit()
conn.close()

print(f"Inserted {len(shots_data)} shot records into database")
