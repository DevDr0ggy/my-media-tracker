/* script.js - Updated with Multi-Select Delete functionality */

const apiUrl = 'http://127.0.0.1:5000/items';
let allItems = [];
let currentFilter = 'All';
let isEditing = false;
let selectedItems = new Set(); // 🔥 ตัวแปรเก็บ ID ที่กำลังเลือก (ใช้ Set เพื่อความสะดวกในการเพิ่ม/ลบ)

// Heartbeat
setInterval(() => {
    fetch('http://127.0.0.1:5000/heartbeat', { method: 'POST' })
        .catch(err => console.log('Server waiting...'));
}, 1000);

// Get acronym for Smart Search
function getAcronym(title) {
    if (!title) return "";
    const matches = title.match(/\b(\w)/g); 
    return matches ? matches.join('').toLowerCase() : "";
}

// Quick Add Progress
async function quickProgress(id, current, total) {
    if (total > 0 && current >= total) return;
    await fetch(`${apiUrl}/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ current_progress: current + 1 })
    });
    loadItems();
}

// Load data from backend
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

// 🔥 ระบบควบคุม multi-select (Select All และ Delete Selected)
function updateMultiSelectUI() {
    const controls = document.getElementById('multiSelectControls');
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const selectCountText = document.getElementById('selectCountText');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    if (selectedItems.size > 0) {
        controls.classList.remove('hidden');
        selectCountText.textContent = `เลือกแล้ว ${selectedItems.size} รายการ`;
        deleteBtn.removeAttribute('disabled');
        // ตรวจสอบว่าเลือกครบทุกรายการที่กำลังแสดงหรือไม่ (เพื่อทำเครื่องหมาย Select All)
        const visibleItems = document.querySelectorAll('.item-checkbox');
        let allChecked = visibleItems.length > 0;
        visibleItems.forEach(cb => { if(!cb.checked) allChecked = false; });
        selectAllCheckbox.checked = allChecked;

    } else {
        controls.classList.add('hidden');
        selectAllCheckbox.checked = false;
        deleteBtn.setAttribute('disabled', 'disabled');
    }
}

function handleCheckboxChange(checkbox, id) {
    if (checkbox.checked) {
        selectedItems.add(id);
    } else {
        selectedItems.delete(id);
    }
    updateMultiSelectUI();
}

function toggleSelectAll(checkbox) {
    const visibleCheckboxes = document.querySelectorAll('.item-checkbox');
    if (checkbox.checked) {
        visibleCheckboxes.forEach(cb => {
            cb.checked = true;
            const id = parseInt(cb.dataset.id);
            selectedItems.add(id);
        });
    } else {
        visibleCheckboxes.forEach(cb => {
            cb.checked = false;
            const id = parseInt(cb.dataset.id);
            selectedItems.delete(id);
        });
    }
    updateMultiSelectUI();
}

async function deleteSelectedItems() {
    if (selectedItems.size === 0) return;
    if (confirm(`ลบ ${selectedItems.size} รายการที่เลือกใช่ไหม? ข้อมูลจะไม่สามารถกู้คืนได้`)) {
        try {
            await fetch('http://127.0.0.1:5000/items/batch-delete', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ ids: Array.from(selectedItems) })
            });
            selectedItems.clear(); // ล้างรายการที่เลือกหลังจากลบสำเร็จ
            loadItems(); // โหลดรายการใหม่
        } catch (error) { console.error("Batch Delete Error:", error); }
    }
}
// 🔥 -------------------------------------------------------------

// Render the items to HTML
function renderItems(items) {
    const listContainer = document.getElementById('mediaListContainer');
    listContainer.innerHTML = ''; 
    // 🔥 ล้างค่า multi-select เก่าทุกครั้งที่เรนเดอร์ใหม่ (เช่น ตอนกรองข้อมูล)
    selectedItems.clear(); 
    updateMultiSelectUI();

    let filtered = items.filter(i => {
        let matchesStatus;
        if (currentFilter === 'All') {
            matchesStatus = true;
        } else if (currentFilter === 'Progress') {
            matchesStatus = (i.total_count > 0);
        } else {
            matchesStatus = (i.status === currentFilter);
        }
        
        const term = document.getElementById('searchInput').value.toLowerCase().trim();
        const itemAcronym = getAcronym(i.title);
        const itemTags = i.tags ? i.tags.toLowerCase() : "";
        const matchesSearch = i.title.toLowerCase().includes(term) || itemAcronym.includes(term) || itemTags.includes(term);
        
        return matchesStatus && matchesSearch;
    });

    const sortType = document.getElementById('sortInput').value;
    filtered.sort((a,b) => {
        if (sortType === 'best') return (b.rating || 0) - (a.rating || 0);
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
                // 🔥 แก้โครงสร้าง flex เพื่อให้ Checkbox, Cover, และ Info เรียงกันสวยงาม
                li.className = "bg-itemLight dark:bg-itemDark mb-3 p-[15px] rounded-xl flex items-center gap-4 transition-all duration-200 shadow-sm border border-transparent hover:border-accent hover:dark:border-accentDark";
                
                const percent = item.total_count > 0 ? (item.current_progress / item.total_count) * 100 : 0;
                let linkHtml = item.link ? `<a href="${item.link}" target="_blank" class="item-link" title="Open Link">🔗</a>` : '';
                
                // แปลง Tags ให้กลายเป็นปุ่ม Badge
                let tagsHtml = '';
                if (item.tags) {
                    const tagArray = item.tags.split(',').map(t => t.trim()).filter(t => t);
                    tagsHtml = `<div class="flex flex-wrap gap-1 mt-1.5 mb-2">
                        ${tagArray.map(tag => `<span class="bg-accent/10 dark:bg-accentDark/10 text-accent dark:text-accentDark text-[0.75em] px-2 py-0.5 rounded-md font-semibold border border-accent/20 dark:border-accentDark/20">${tag}</span>`).join('')}
                    </div>`;
                }

                // รูปหน้าปก
                let coverHtml = item.cover_image 
                    ? `<img src="${item.cover_image}" class="w-[85px] h-[120px] object-cover rounded-lg shadow-md shrink-0 border border-gray-200 dark:border-zinc-700" alt="Cover">` 
                    : `<div class="w-[85px] h-[120px] bg-black/5 dark:bg-white/5 rounded-lg flex items-center justify-center shrink-0 text-3xl border border-dashed border-gray-300 dark:border-zinc-700">📸</div>`;

                li.innerHTML = `
                    <input type="checkbox" data-id="${item.id}" onchange="handleCheckboxChange(this, ${item.id})" class="item-checkbox w-6 h-6 shrink-0 cursor-pointer accent-accent dark:accent-accentDark rounded-md">
                    
                    ${coverHtml}
                    
                    <div class="item-info flex-1 min-w-0">
                        <div class="flex justify-between items-start">
                            <div>
                                <span class="item-title text-[1.2em]">
                                    ${item.title} 
                                    <span class="item-rating text-sm">${'⭐'.repeat(item.rating)}</span>
                                    ${linkHtml}
                                </span>
                                ${tagsHtml}
                            </div>
                            <div class="actions ml-2 flex gap-1.5">
                                <button class="btn-icon btn-edit text-sm p-[6px_10px]" onclick="startEditItem(${item.id})">✏️</button>
                                <button class="btn-icon btn-delete text-sm p-[6px_10px]" onclick="deleteItem(${item.id})">🗑️</button>
                            </div>
                        </div>
                        
                        <div class="progress-text mt-2 text-[0.95em]">
                            Progress: ${item.current_progress} / ${item.total_count}
                            ${item.status !== 'Completed' ? `<button class="btn-plus shadow-sm hover:scale-110" onclick="quickProgress(${item.id}, ${item.current_progress}, ${item.total_count})">+</button>` : ''}
                        </div>
                        ${item.total_count > 0 ? `<div class="progress-container"><div class="progress-bar" style="width: ${percent}%"></div></div>` : ''}
                        ${item.review ? `<span class="item-review">"${item.review}"</span>` : ''}
                        
                        <div class="text-[0.7em] opacity-50 mt-2 flex items-center gap-1">
                            🕒 Last updated: ${item.updated_at || item.created_at || 'Unknown'}
                        </div>
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

// Handle Form Submission
async function handleFormSubmit() {
    const title = document.getElementById('titleInput').value.trim();
    if(!title) return;
    
    const data = {
        title,
        category: document.getElementById('categoryInput').value,
        status: document.getElementById('statusInput').value,
        rating: parseInt(document.getElementById('ratingInput').value),
        link: document.getElementById('linkInput').value.trim(),
        cover_image: document.getElementById('coverInput').value.trim(),
        tags: document.getElementById('tagsInput').value.trim(),
        review: document.getElementById('reviewInput').value.trim(),
        current_progress: parseInt(document.getElementById('currentProgressInput').value) || 0,
        total_count: parseInt(document.getElementById('totalCountInput').value) || 0
    };
    
    const id = document.getElementById('editId').value;
    const url = isEditing ? `${apiUrl}/${id}` : apiUrl;
    const method = isEditing ? 'PUT' : 'POST';
    
    await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    cancelEdit(); 
    loadItems();
}

// Edit Item functionality
function startEditItem(id) {
    const i = allItems.find(x => x.id === id);
    document.getElementById('titleInput').value = i.title;
    document.getElementById('linkInput').value = i.link || ''; 
    document.getElementById('coverInput').value = i.cover_image || ''; 
    document.getElementById('tagsInput').value = i.tags || ''; 
    document.getElementById('currentProgressInput').value = i.current_progress;
    document.getElementById('totalCountInput').value = i.total_count;
    document.getElementById('categoryInput').value = i.category;
    document.getElementById('statusInput').value = i.status;
    document.getElementById('ratingInput').value = i.rating;
    document.getElementById('reviewInput').value = i.review || '';
    document.getElementById('editId').value = i.id;
    
    isEditing = true;
    document.getElementById('submitBtn').textContent = "Update (อัปเดตข้อมูล)";
    document.getElementById('cancelBtn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Cancel Editing
function cancelEdit() {
    isEditing = false;
    document.getElementById('editId').value = '';
    document.querySelectorAll('input, textarea').forEach(x => x.value = '');
    document.getElementById('submitBtn').textContent = "Add to List (เพิ่มรายการ)";
    document.getElementById('cancelBtn').classList.add('hidden');
}

// Delete Item
async function deleteItem(id) {
    if(confirm("ลบรายการนี้ใช่ไหม? ข้อมูลจะไม่สามารถกู้คืนได้")) { 
        await fetch(`${apiUrl}/${id}`, { method: 'DELETE' }); 
        loadItems(); 
    }
}

function handleSearch() { renderItems(allItems); }
function handleSort() { renderItems(allItems); }

// Theme Toggle System
function toggleTheme() {
    const htmlElement = document.documentElement;
    const isDark = htmlElement.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.getElementById('themeIcon');
    icon.textContent = isDark ? '🌙' : '☀️';

    const btn = document.querySelector('.theme-toggle');
    btn.classList.add('rotate-anim');
    setTimeout(() => { btn.classList.remove('rotate-anim'); }, 500);
}

(function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const icon = document.getElementById('themeIcon');
    if (savedTheme === 'dark') { icon.textContent = '🌙'; } 
    else { icon.textContent = '☀️'; }
})();

async function triggerUndo() { loadItems(); }
async function triggerRedo() { loadItems(); }

// Initialize app
loadItems();

// Backup to MongoDB Atlas function
async function backupToMongo() {
    const btn = document.getElementById('backupBtn');
    const originalText = btn.innerHTML;
    
    // เปลี่ยนข้อความบนปุ่มตอนกำลังโหลด
    btn.innerHTML = '⏳ Backing up...';
    btn.disabled = true;
    btn.classList.add('opacity-70', 'cursor-not-allowed');

    try {
        const response = await fetch('http://127.0.0.1:5000/backup/mongodb', {
            method: 'POST'
        });
        const data = await response.json();
        
        if (response.ok) {
            alert(`✅ สำรองข้อมูลขึ้น MongoDB Atlas สำเร็จ!\nข้อมูลทั้งหมด ${data.count} รายการ ถูกเก็บไว้ใน Cluster ของ MyScheduleBot แล้วครับ`);
        } else {
            alert(`❌ เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: ${data.error}`);
        }
    } catch (error) {
        alert(`❌ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ โปรดตรวจสอบอินเทอร์เน็ต`);
        console.error("Backup Error:", error);
    } finally {
        // เปลี่ยนปุ่มกลับสู่สภาพเดิม
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
}// Backup to MongoDB Atlas function
async function backupToMongo() {
    const btn = document.getElementById('backupBtn');
    const originalText = btn.innerHTML;
    
    // เปลี่ยนข้อความบนปุ่มตอนกำลังโหลด
    btn.innerHTML = '⏳ Backing up...';
    btn.disabled = true;
    btn.classList.add('opacity-70', 'cursor-not-allowed');

    try {
        const response = await fetch('http://127.0.0.1:5000/backup/mongodb', {
            method: 'POST'
        });
        const data = await response.json();
        
        if (response.ok) {
            alert(`✅ สำรองข้อมูลขึ้น MongoDB Atlas สำเร็จ!\nข้อมูลทั้งหมด ${data.count} รายการ ถูกเก็บไว้ใน Cluster ของ MyScheduleBot แล้วครับ`);
        } else {
            alert(`❌ เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: ${data.error}`);
        }
    } catch (error) {
        alert(`❌ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ โปรดตรวจสอบอินเทอร์เน็ต`);
        console.error("Backup Error:", error);
    } finally {
        // เปลี่ยนปุ่มกลับสู่สภาพเดิม
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
}