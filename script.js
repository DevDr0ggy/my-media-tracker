/* script.js - Full Fixed Version + Heartbeat */

const apiUrl = 'http://127.0.0.1:5000/items';
let allItems = [];
let currentFilter = 'All';
let isEditing = false;

// 🔥 ส่งสัญญาณชีพ (Heartbeat) ไปหา Python ทุก 1 วินาที
setInterval(() => {
    fetch('http://127.0.0.1:5000/heartbeat', { method: 'POST' })
        .catch(err => console.log('Server waiting...'));
}, 1000);

// ฟังก์ชันดึงตัวย่อ (Smart Search)
function getAcronym(title) {
    if (!title) return "";
    const matches = title.match(/\b(\w)/g); 
    return matches ? matches.join('').toLowerCase() : "";
}

// เพิ่มตอนด่วน (+)
async function quickProgress(id, current, total) {
    if (total > 0 && current >= total) return;
    await fetch(`${apiUrl}/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ current_progress: current + 1 })
    });
    loadItems();
}

async function loadItems() {
    try {
        const response = await fetch(apiUrl);
        allItems = await response.json();
        renderItems(allItems);
        updateDashboard(allItems);
    } catch (error) { console.error("Load Error:", error); }
}

function updateDashboard(items) {
    animateValue("totalCount", items.length);
    animateValue("finishedCount", items.filter(i => i.status === 'Completed').length);
    animateValue("todoCount", items.filter(i => i.status === 'Planned').length);
}

function animateValue(id, end) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let start = parseInt(obj.textContent.replace(/,/g, '')) || 0;
    if (start === end) return;
    if (obj.timer) clearInterval(obj.timer);
    let range = Math.abs(end - start);
    let stepTime = Math.max(Math.floor(1000 / range), 20);
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
        // 1. กรองตามสถานะหรือความคืบหน้า
        let matchesStatus;
        if (currentFilter === 'All') {
            matchesStatus = true;
        } else if (currentFilter === 'Progress') {
            matchesStatus = (i.total_count > 0);
        } else {
            matchesStatus = (i.status === currentFilter);
        }
        
        // 2. ค้นหา
        const term = document.getElementById('searchInput').value.toLowerCase().trim();
        const itemAcronym = getAcronym(i.title);
        const matchesSearch = i.title.toLowerCase().includes(term) || itemAcronym.includes(term);
        
        return matchesStatus && matchesSearch;
    });

    // Sorting
    const sortType = document.getElementById('sortInput').value;
    filtered.sort((a,b) => {
        if (sortType === 'best') return (b.rating || 0) - (a.rating || 0);
        if (sortType === 'az') return a.title.localeCompare(b.title);
        if (sortType === 'oldest') return a.id - b.id;
        return b.id - a.id;
    });

    // Grouping
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
                const percent = item.total_count > 0 ? (item.current_progress / item.total_count) * 100 : 0;
                
                // 🔥 สร้างลิงก์ HTML ถ้ามี URL
                let linkHtml = item.link ? `<a href="${item.link}" target="_blank" class="item-link" title="Open Link">🔗</a>` : '';

                li.innerHTML = `
                    <div class="item-info">
                        <span class="item-title">
                            ${item.title} 
                            <span class="item-rating">${'⭐'.repeat(item.rating)}</span>
                            ${linkHtml}
                        </span>
                        <div class="progress-text">
                            Progress: ${item.current_progress} / ${item.total_count}
                            ${item.status !== 'Completed' ? `<button class="btn-plus" onclick="quickProgress(${item.id}, ${item.current_progress}, ${item.total_count})">+</button>` : ''}
                        </div>
                        ${item.total_count > 0 ? `<div class="progress-container"><div class="progress-bar" style="width: ${percent}%"></div></div>` : ''}
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

function setFilter(event, f) { 
    if (event) event.preventDefault(); 
    currentFilter = f; 
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderItems(allItems); 
}

async function handleFormSubmit() {
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
    const id = document.getElementById('editId').value;
    const url = isEditing ? `${apiUrl}/${id}` : apiUrl;
    const method = isEditing ? 'PUT' : 'POST';
    await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    cancelEdit(); loadItems();
}

function startEditItem(id) {
    const i = allItems.find(x => x.id === id);
    document.getElementById('titleInput').value = i.title;
    document.getElementById('linkInput').value = i.link || ''; 
    document.getElementById('currentProgressInput').value = i.current_progress;
    document.getElementById('totalCountInput').value = i.total_count;
    document.getElementById('categoryInput').value = i.category;
    document.getElementById('statusInput').value = i.status;
    document.getElementById('ratingInput').value = i.rating;
    document.getElementById('reviewInput').value = i.review || '';
    document.getElementById('editId').value = i.id;
    isEditing = true;
    document.getElementById('submitBtn').textContent = "Update";
    document.getElementById('cancelBtn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    isEditing = false;
    document.getElementById('editId').value = '';
    document.querySelectorAll('input, textarea').forEach(x => x.value = '');
    document.getElementById('submitBtn').textContent = "Add to List";
    document.getElementById('cancelBtn').classList.add('hidden');
}

async function deleteItem(id) {
    if(confirm("ลบรายการนี้ใช่ไหม?")) { await fetch(`${apiUrl}/${id}`, { method: 'DELETE' }); loadItems(); }
}

function handleSearch() { renderItems(allItems); }
function handleSort() { renderItems(allItems); }

// ฟังก์ชันธีม พร้อม Animation
function toggleTheme() {
    const htmlElement = document.documentElement;
    const isDark = htmlElement.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.getElementById('themeIcon');
    icon.textContent = isDark ? '🌙' : '☀️';

    const btn = document.querySelector('.theme-toggle');
    btn.classList.add('rotate-anim');
    setTimeout(() => {
        btn.classList.remove('rotate-anim');
    }, 500);
}

(function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const icon = document.getElementById('themeIcon');
    if (savedTheme === 'dark') {
        icon.textContent = '🌙';
    } else {
        icon.textContent = '☀️';
    }
})();

async function triggerUndo() { loadItems(); }
async function triggerRedo() { loadItems(); }

loadItems();