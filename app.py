from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import sqlite3
import threading
import time
import os
import webbrowser
import certifi

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

# Setup Flask
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# --- Heartbeat System ---
last_heartbeat = time.time() + 10 

def auto_shutdown_monitor():
    global last_heartbeat
    while True:
        time.sleep(1)
        if time.time() - last_heartbeat > 3:
            print("No heartbeat detected. Shutting down server...")
            os._exit(0)

monitor_thread = threading.Thread(target=auto_shutdown_monitor, daemon=True)
monitor_thread.start()

@app.route('/heartbeat', methods=['POST'])
def heartbeat():
    global last_heartbeat
    last_heartbeat = time.time()
    return jsonify({"status": "alive"})

@app.route('/')
def root():
    return app.send_static_file('index.html')

# --- Database Logic ---
def get_db_connection():
    conn = sqlite3.connect('media_tracker.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    # Create main table if it does not exist
    conn.execute('''
        CREATE TABLE IF NOT EXISTS media_list (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT NOT NULL,
            rating INTEGER DEFAULT 0,
            link TEXT,
            review TEXT,
            current_progress INTEGER DEFAULT 0,
            total_count INTEGER DEFAULT 0,
            cover_image TEXT DEFAULT '',
            tags TEXT DEFAULT '',
            created_at TEXT,
            updated_at TEXT
        )
    ''')
    
    # Auto-upgrade database: Add new columns if they are missing
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(media_list)")
    columns = [info[1] for info in cursor.fetchall()]
    
    if 'cover_image' not in columns:
        conn.execute("ALTER TABLE media_list ADD COLUMN cover_image TEXT DEFAULT ''")
    if 'tags' not in columns:
        conn.execute("ALTER TABLE media_list ADD COLUMN tags TEXT DEFAULT ''")
    if 'updated_at' not in columns:
        conn.execute("ALTER TABLE media_list ADD COLUMN updated_at TEXT")
        
    conn.commit()
    conn.close()

init_db()

@app.route('/items', methods=['GET'])
def get_items():
    conn = get_db_connection()
    items = conn.execute('SELECT * FROM media_list ORDER BY id DESC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in items])

@app.route('/items', methods=['POST'])
def add_item():
    data = request.get_json()
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db_connection()
    
    # ถ้าระบบส่ง id กลับมาด้วย (เช่นตอน Undo ลบ) ให้ใช้ id เดิมเพื่อข้อมูลจะได้เป๊ะเหมือนเดิม
    if 'id' in data and data['id']:
        cursor = conn.execute(
            '''INSERT INTO media_list 
               (id, title, category, status, rating, link, review, current_progress, total_count, created_at, updated_at, cover_image, tags) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (data['id'], data['title'], data['category'], data['status'], data.get('rating', 0), 
             data.get('link', ''), data.get('review', ''), 
             data.get('current_progress', 0), data.get('total_count', 0), 
             data.get('created_at', current_time), data.get('updated_at', current_time), data.get('cover_image', ''), data.get('tags', ''))
        )
        new_id = data['id']
    else:
        cursor = conn.execute(
            '''INSERT INTO media_list 
               (title, category, status, rating, link, review, current_progress, total_count, created_at, updated_at, cover_image, tags) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (data['title'], data['category'], data['status'], data.get('rating', 0), 
             data.get('link', ''), data.get('review', ''), 
             data.get('current_progress', 0), data.get('total_count', 0), 
             current_time, current_time, data.get('cover_image', ''), data.get('tags', ''))
        )
        new_id = cursor.lastrowid
        
    conn.commit()
    conn.close()
    return jsonify({"id": new_id, "message": "Item added!"}), 201

@app.route('/items/<int:id>', methods=['PUT'])
def update_item(id):
    data = request.get_json()
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db_connection()
    
    query = '''
        UPDATE media_list 
        SET title = COALESCE(?, title),
            category = COALESCE(?, category),
            status = COALESCE(?, status),
            rating = COALESCE(?, rating),
            link = COALESCE(?, link),
            review = COALESCE(?, review),
            current_progress = COALESCE(?, current_progress),
            total_count = COALESCE(?, total_count),
            cover_image = COALESCE(?, cover_image),
            tags = COALESCE(?, tags),
            updated_at = ?
        WHERE id = ?
    '''
    conn.execute(query, (
        data.get('title'), data.get('category'), data.get('status'),
        data.get('rating'), data.get('link'), data.get('review'),
        data.get('current_progress'), data.get('total_count'),
        data.get('cover_image'), data.get('tags'), current_time, id
    ))
    conn.commit()
    conn.close()
    return jsonify({"message": "Updated!"})

@app.route('/items/<int:id>', methods=['DELETE'])
def delete_item(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM media_list WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Deleted!"})

# 🔥 New Route for Multi-Delete
@app.route('/items/batch-delete', methods=['POST'])
def batch_delete_items():
    data = request.get_json()
    ids_to_delete = data.get('ids', [])
    if not ids_to_delete:
        return jsonify({"message": "No IDs provided"}), 400
        
    conn = get_db_connection()
    # Prepare the SQL query with IN clause
    placeholders = ','.join(['?' for _ in ids_to_delete])
    query = f"DELETE FROM media_list WHERE id IN ({placeholders})"
    
    cursor = conn.execute(query, ids_to_delete)
    deleted_count = cursor.rowcount
    conn.commit()
    conn.close()
    
    return jsonify({"message": f"Deleted {deleted_count} items", "deleted_ids": ids_to_delete}), 200

# 🔥 Route for Restore from MongoDB Atlas
@app.route('/restore/mongodb', methods=['POST'])
def restore_from_mongodb():
    try:
        # 1. Connect to MongoDB Atlas
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client['MediaTracker']
        collection = db['backups']
        
        # 2. Fetch all backed up items (exclude the MongoDB '_id' field)
        backup_items = list(collection.find({}, {'_id': 0}))
        
        if not backup_items:
            return jsonify({"message": "No backup data found on Atlas"}), 404
            
        # 3. Connect to local SQLite
        conn = get_db_connection()
        
        # 4. Wipe current local data to prevent duplicates
        conn.execute('DELETE FROM media_list')
        
        # 5. Insert backup data into local SQLite
        for item in backup_items:
            conn.execute(
                '''INSERT INTO media_list 
                   (id, title, category, status, rating, link, review, current_progress, total_count, cover_image, tags, created_at, updated_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (item.get('id'), item.get('title'), item.get('category'), item.get('status'), 
                 item.get('rating'), item.get('link'), item.get('review'), 
                 item.get('current_progress'), item.get('total_count'), 
                 item.get('cover_image'), item.get('tags'), 
                 item.get('created_at'), item.get('updated_at'))
            )
        
        conn.commit()
        conn.close()
        
        return jsonify({"message": "Restore successful!", "count": len(backup_items)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    webbrowser.open("http://127.0.0.1:5000")
    app.run(debug=False, port=5000)