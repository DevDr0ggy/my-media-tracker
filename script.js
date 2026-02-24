/* script.js - LocalStorage Version (GitHub Ready) */

let allItems = [];
let currentFilter = 'All';
let isEditing = false;

// --- 🔥 ระบบจัดการข้อมูล (LocalStorage) ---
function loadData() {
    const saved = localStorage.getItem('mediaItems');
    if (saved) {
        allItems = JSON.parse(saved);
    } else {
        allItems = [];
    }
    renderItems(allItems);
    updateDashboard(allItems);
}

function saveData() {
    localStorage.setItem('mediaItems', JSON.stringify(allItems));
    renderItems(allItems);
    updateDashboard(allItems);
}

// --- ฟังก์ชันช่วยเหลือ ---
function getAcronym(title) {
    if (!title) return "";
    const matches = title.match(/\b(\w)/g);
    return matches ? matches.join('').toLowerCase() : "";
}

function generateId() {
    return Date.now(); // ใช้เวลาปัจจุบันเป็น ID (ไม่ซ้ำ)
}

// --- Logic หลัก ---
function quickProgress(id, current, total) {
    // แก้บั๊ก: ต้องแปลงเป็นตัวเลขก่อนคำนวณ
    current = parseInt(current) || 0;
    total = parseInt(total) || 0;

    if (total > 0 && current >= total) return;
    
    // หาไอเท็มและอัปเดต
    const index = allItems.findIndex(i => i.id === id);
    if (index !== -1) {
        allItems[index].current_progress = current + 1;
        saveData(); // บันทึกทันที
    }
}

function updateDashboard(items) {
    const total = items.length;
    const finished = items.filter(i => i.status === 'Completed').length;
    const todo = items.filter(i => i.status === 'Planned').length;
    
    animateValue("totalCount", total);
    animateValue("finishedCount", finished);
    animateValue("todoCount", todo);
}

function animateValue(id, end) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let start = parseInt(obj.textContent.replace(/,/g, '')) || 0;
    if (start === end) return;
    let range = Math.abs(end - start);
    let stepTime = Math.max(Math.floor(1000 / (range || 1)), 20);
    
    // เคลียร์ timer เก่าถ้ามี (ป้องกันตัวเลขรวน)
    if (obj.timer) clearInterval(obj.timer);

    obj.timer = setInterval(() => {
        if (start < end) start++; else start--;
        obj.textContent = start;
        if (start === end) clearInterval(obj.timer);
    }, stepTime);
}

function renderItems(items) {
    const listContainer = document.getElementById('mediaListContainer');
    listContainer.innerHTML = ''; 

    let filtered = items.filter(i => {
        let matchesStatus;
        if (currentFilter === 'All') matchesStatus = true;
        else if (currentFilter === 'Progress') matchesStatus = (parseInt(i.total_count) > 0);
        else matchesStatus = (i.status === currentFilter);
        
        const term = document.getElementById('searchInput').value.toLowerCase().trim();
        const itemAcronym = getAcronym(i.title);
        const matchesSearch = i.title.toLowerCase().includes(term) || itemAcronym.includes(term);
        
        return matchesStatus && matchesSearch;
    });

    const sortType = document.getElementById('sortInput').value;
    filtered.sort((a,b) => {
        if (sortType === 'best') return (parseInt(b.rating) || 0) - (parseInt(a.rating) || 0);
        if (sortType === 'az') return a.title.localeCompare(b.title);
        if (sortType === 'oldest') return a.id - b.id;
        return b.id - a.id;
    });

    const groups = {};
    filtered.forEach(i => { if(!groups[i.category]) groups[i.category]=[]; groups[i.category].push(i); });

    ['Game', 'Anime', 'Manga', 'Movie'].forEach(cat => {
        if (groups[cat]) {
            const sec = document.createElement('div');
            sec.innerHTML = `<h3 class="category-header">${cat}</h3>`;
            const ul = document.createElement('ul');
            ul.className = 'category-list';
            groups[cat].forEach(item => {
                const li = document.createElement('li');
                const current = parseInt(item.current_progress) || 0;
                const total = parseInt(item.total_count) || 0;
                const percent = total > 0 ? (current / total) * 100 : 0;
                let linkHtml = item.link ? `<a href="${item.link}" target="_blank" class="item-link" title="Open Link">🔗</a>` : '';

                li.innerHTML = `
                    <div class="item-info">
                        <span class="item-title">${item.title} <span class="item-rating">${'⭐'.repeat(item.rating)}</span> ${linkHtml}</span>
                        <div class="progress-text">
                            Progress: ${current} / ${total}
                            ${item.status !== 'Completed' ? `<button class="btn-plus" onclick="quickProgress(${item.id}, ${current}, ${total})">+</button>` : ''}
                        </div>
                        ${total > 0 ? `<div class="progress-container"><div class="progress-bar" style="width: ${percent}%"></div></div>` : ''}
                        ${item.review ? `<span class="item-review">"${item.review}"</span>` : ''}
                    </div>
                    <div class="actions">
                        <button class="btn-icon btn-edit" onclick="startEditItem(${item.id})">✏️</button>
                        <button class="btn-icon btn-delete" onclick="deleteItem(${item.id})">🗑️</button>
                    </div>
                `;
                ul.appendChild(li);
            });
            sec.appendChild(ul);
            listContainer.appendChild(sec);
        }
    });
}

function handleFormSubmit() {
    const title = document.getElementById('titleInput').value.trim();
    if(!title) return;

    const data = {
        title,
        category: document.getElementById('categoryInput').value,
        status: document.getElementById('statusInput').value,
        rating: parseInt(document.getElementById('ratingInput').value),
        link: document.getElementById('linkInput').value.trim(),
        review: document.getElementById('reviewInput').value.trim(),
        current_progress: parseInt(document.getElementById('currentProgressInput').value) || 0,
        total_count: parseInt(document.getElementById('totalCountInput').value) || 0
    };

    if (isEditing) {
        const id = parseInt(document.getElementById('editId').value);
        const index = allItems.findIndex(i => i.id === id);
        if (index !== -1) {
            // อัปเดตข้อมูลโดยคง ID เดิมไว้
            allItems[index] = { ...data, id: id, created_at: allItems[index].created_at };
        }
        cancelEdit();
    } else {
        data.id = generateId(); // สร้าง ID ใหม่
        data.created_at = new Date().toLocaleString();
        allItems.push(data);
        resetForm();
    }
    saveData();
}

function startEditItem(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('titleInput').value = item.title;
    document.getElementById('linkInput').value = item.link || ''; 
    document.getElementById('currentProgressInput').value = item.current_progress;
    document.getElementById('totalCountInput').value = item.total_count;
    document.getElementById('categoryInput').value = item.category;
    document.getElementById('statusInput').value = item.status;
    document.getElementById('ratingInput').value = item.rating;
    document.getElementById('reviewInput').value = item.review || '';
    document.getElementById('editId').value = item.id;
    
    isEditing = true;
    document.getElementById('submitBtn').textContent = "Update";
    document.getElementById('cancelBtn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    isEditing = false;
    resetForm();
    document.getElementById('submitBtn').textContent = "Add to List";
    document.getElementById('cancelBtn').classList.add('hidden');
}

function resetForm() {
    document.getElementById('editId').value = '';
    document.querySelectorAll('input, textarea').forEach(x => x.value = '');
    document.getElementById('ratingInput').value = 0;
}

function deleteItem(id) {
    if(confirm("ลบรายการนี้ใช่ไหม?")) {
        allItems = allItems.filter(i => i.id !== id);
        saveData();
    }
}

// 🔥 ระบบ Backup & Restore
function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allItems));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "media_tracker_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm("ข้อมูลปัจจุบันจะถูกแทนที่ด้วยไฟล์ Backup นี้ ยืนยันไหม?")) {
                allItems = data;
                saveData();
                alert("กู้คืนข้อมูลสำเร็จ!");
            }
        } catch (err) { alert("ไฟล์ไม่ถูกต้อง"); }
    };
    reader.readAsText(file);
}

// Event Handlers
function handleSearch() { renderItems(allItems); }
function handleSort() { renderItems(allItems); }
function setFilter(event, f) { 
    if (event) event.preventDefault(); 
    currentFilter = f; 
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderItems(allItems); 
}

function toggleTheme() {
    const htmlElement = document.documentElement;
    const isDark = htmlElement.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    const icon = document.getElementById('themeIcon');
    icon.textContent = isDark ? '🌙' : '☀️';

    const btn = document.querySelector('.theme-toggle');
    btn.classList.add('rotate-anim');
    setTimeout(() => btn.classList.remove('rotate-anim'), 500);
}

// Start
(function init() {
    const savedTheme = localStorage.getItem('theme');
    const icon = document.getElementById('themeIcon');
    if (savedTheme === 'dark') icon.textContent = '🌙';
    else icon.textContent = '☀️';
    
    loadData();
})();
