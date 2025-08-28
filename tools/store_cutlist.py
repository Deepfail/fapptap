import sqlite3
import json
from pathlib import Path

def main():
    # Connect to database
    conn = sqlite3.connect('cache/analysis.db')
    c = conn.cursor()
    
    # Create table if it doesn't exist
    c.execute('''
        CREATE TABLE IF NOT EXISTS cutlists(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            json TEXT
        )
    ''')
    
    # Read cutlist.json
    cutlist_path = Path('render/cutlist.json')
    if not cutlist_path.exists():
        print("❌ cutlist.json not found")
        return 1
    
    with open(cutlist_path, 'r', encoding='utf-8') as f:
        cutlist_data = f.read()
    
    # Insert into database
    c.execute('INSERT INTO cutlists(json) VALUES (?)', (cutlist_data,))
    conn.commit()
    
    print("✅ Cutlist stored in database successfully")
    return 0

if __name__ == "__main__":
    main()
