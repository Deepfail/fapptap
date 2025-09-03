import sqlite3
import json

# Connect to database
conn = sqlite3.connect('cache/analysis.db')
cursor = conn.cursor()

# Check total clips and their total duration
cursor.execute('SELECT COUNT(*), SUM(duration) FROM clips')
count, total_duration = cursor.fetchone()

print(f"Database status:")
print(f"  Total clips: {count}")
print(f"  Total duration: {total_duration:.2f} seconds ({total_duration/60:.1f} minutes)")

# Show some sample clips
cursor.execute('SELECT path, duration FROM clips LIMIT 10')
print(f"\nSample clips:")
for path, duration in cursor.fetchall():
    print(f"  {path}: {duration:.3f}s")

conn.close()
