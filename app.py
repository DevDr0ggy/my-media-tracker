from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import time
import certifi

# โหลดรหัสผ่านจากไฟล์ .env
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

# Setup Flask
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# เชื่อมต่อ MongoDB Atlas เป็นฐานข้อมูลหลัก
client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client['MediaTracker']
collection = db['media_list']

# 🌟 ระบบโอนย้ายข้อมูลอัตโนมัติ: ถ้าฐานข้อมูลหลักว่างเปล่า ให้ไปดึงจากตัวที่เคย Backup ไว้มาใส่
if collection.count_documents({}) == 0:
    backup_coll = db['backups']
    if backup_coll.count_documents({}) > 0:
        collection.insert_many(list(backup_coll.find({}, {'_id': 0})))
        print("Migrated data from backup successfully!")

@app.route('/')
def root():
    return app.send_static_file('index.html')

@app.route('/items', methods=['GET'])
def get_items():
    # ดึงข้อมูลทั้งหมดเรียงจาก ID ล่าสุด (ซ่อนฟิลด์ _id ของ MongoDB เพื่อไม่ให้ Frontend สับสน)
    items = list(collection.find({}, {'_id': 0}).sort('id', -1))
    return jsonify(items)

@app.route('/items', methods=['POST'])
def add_item():
    data = request.get_json()
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # สร้าง ID ใหม่เป็นตัวเลข (ดึงจากเวลา Unix) หรือใช้ ID เดิมถ้าเป็นการ Undo
    new_id = data.get('id')
    if not new_id:
        new_id = int(time.time() * 1000) 
        
    new_item = {
        "id": new_id,
        "title": data['title'],
        "category": data['category'],
        "status": data['status'],
        "rating": data.get('rating', 0),
        "link": data.get('link', ''),
        "review": data.get('review', ''),
        "current_progress": data.get('current_progress', 0),
        "total_count": data.get('total_count', 0),
        "cover_image": data.get('cover_image', ''),
        "tags": data.get('tags', ''),
        "created_at": data.get('created_at', current_time),
        "updated_at": data.get('updated_at', current_time)
    }
    
    collection.insert_one(new_item)
    return jsonify({"id": new_id, "message": "Item added!"}), 201

@app.route('/items/<int:item_id>', methods=['PUT'])
def update_item(item_id):
    data = request.get_json()
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    update_fields = {}
    for key in ['title', 'category', 'status', 'rating', 'link', 'review', 'current_progress', 'total_count', 'cover_image', 'tags']:
        if key in data:
            update_fields[key] = data[key]
            
    update_fields['updated_at'] = current_time
    
    collection.update_one({'id': item_id}, {'$set': update_fields})
    return jsonify({"message": "Updated!"})

@app.route('/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    collection.delete_one({'id': item_id})
    return jsonify({"message": "Deleted!"})

@app.route('/items/batch-delete', methods=['POST'])
def batch_delete_items():
    data = request.get_json()
    ids_to_delete = data.get('ids', [])
    if not ids_to_delete:
        return jsonify({"message": "No IDs provided"}), 400
        
    result = collection.delete_many({'id': {'$in': ids_to_delete}})
    return jsonify({"message": f"Deleted {result.deleted_count} items", "deleted_ids": ids_to_delete}), 200

if __name__ == '__main__':
    # Discloud จะส่ง Port มาให้ทาง Environment Variable ถ้าไม่มีจะใช้ 8080
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)