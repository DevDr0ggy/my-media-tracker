from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from datetime import datetime
import threading
import time
import os
import webbrowser  # 🔥 เพิ่มตัวช่วยเปิด Browser

# ตั้งค่าให้ Flask มองเห็นไฟล์ html, css, js ในโฟลเดอร์ปัจจุบัน
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# --- 🔥 ระบบ Heartbeat (ปิดโปรแกรมอัตโนมัติ) ---
last_heartbeat = time.time() + 10  # ให้เวลาเริ่มต้น 10 วินาที

def auto_shutdown_monitor():
    """คอยเช็คว่าหน้าเว็บยังเปิดอยู่ไหม ถ้าหายไปเกิน 3 วินาที ให้ปิดโปรแกรม"""
    global last_heartbeat
    while True:
        time.sleep(1)
        if time.time() - last_heartbeat > 3:
            print("No heartbeat detected. Shutting down server...")
            os._exit(0)

# เริ่มทำงานตัวจับเวลาใน Background
monitor_thread = threading.Thread(target=auto_shutdown_monitor, daemon=True)
monitor_thread.start()

@app.route('/heartbeat', methods=['POST'])
def heartbeat():
    global last_heartbeat
    last_heartbeat = time.time()
    return jsonify({"status": "alive"})

# --- 🔥 Route สำหรับเปิดหน้าเว็บ ---
@app.route('/')
def root():
    # ส่งไฟล์ index.html ไปแสดงผล
    return app.send_static_file('index.html')

# --- Database Logic (เหมือนเดิม) ---
def get_db_connection():
    conn = sqlite3.connect('media_tracker.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
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
            created_at TEXT
        )
    ''')
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
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db_connection()
    cursor = conn.execute(
        '''INSERT INTO media_list 
           (title, category, status, rating, link, review, current_progress, total_count, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (data['title'], data['category'], data['status'], data.get('rating', 0), 
         data.get('link', ''), data.get('review', ''), 
         data.get('current_progress', 0), data.get('total_count', 0), created_at)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return jsonify({"id": new_id, "message": "Item added!"}), 201

@app.route('/items/<int:id>', methods=['PUT'])
def update_item(id):
    data = request.get_json()
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
            total_count = COALESCE(?, total_count)
        WHERE id = ?
    '''
    conn.execute(query, (
        data.get('title'), data.get('category'), data.get('status'),
        data.get('rating'), data.get('link'), data.get('review'),
        data.get('current_progress'), data.get('total_count'), id
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

if __name__ == '__main__':
    # 🔥 สั่งให้เปิด Browser อัตโนมัติ ไปที่ localhost
    webbrowser.open("http://127.0.0.1:5000")
    
    # รัน Server (ปิด debug เพื่อป้องกันการเปิดหน้าต่างเบิ้ล)
    app.run(debug=False, port=5000)