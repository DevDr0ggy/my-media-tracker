/* script.js - Updated with FULL Undo/Redo Memory Stack */

// const apiUrl = 'http://127.0.0.1:5000/items';
const apiUrl = '/items';
let allItems = [];
let currentFilter = 'All';
let isEditing = false;
let selectedItems = new Set(); 

// 🔥 ระบบความจำสำหรับ Undo/Redo
let undoStack = [];
let redoStack = [];

function saveAction(action) {
    undoStack.push(action);
    if (undoStack.length > 30) undoStack.shift(); // จำย้อนหลังได้สูงสุด 30 รายการล่าสุด
    redoStack = []; // ล้าง Redo ทิ้งเมื่อมีการกระทำใหม่
    updateUndoRedoUI();
}

function updateUndoRedoUI() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    // จัดการหน้าตาปุ่ม Undo
    if(undoStack.length > 0) {
        undoBtn.disabled = false;
        undoBtn.classList.remove('opacity-30', 'cursor-not-allowed');
    } else {
        undoBtn.disabled = true;
        undoBtn.classList.add('opacity-30', 'cursor-not-allowed');
    }

    // จัดการหน้าตาปุ่ม Redo
    if(redoStack.length > 0) {
        redoBtn.disabled = false;
        redoBtn.classList.remove('opacity-30', 'cursor-not-allowed');
    } else {
        redoBtn.disabled = true;
        redoBtn.classList.add('opacity-30', 'cursor-not-allowed');
    }
}

async function triggerUndo() {
    if (undoStack.length === 0) return;
    const action = undoStack.pop();
    redoStack.push(action); // ย้ายไปให้ Redo เตรียมจำ
    updateUndoRedoUI();
    await revertAction(action, true);
    loadItems();
}

async function triggerRedo() {
    if (redoStack.length === 0) return;
    const action = redoStack.pop();
    undoStack.push(action); // ย้ายกลับมาให้ Undo
    updateUndoRedoUI();
    await revertAction(action, false);
    loadItems();
}

async function revertAction(action, isUndo) {
    if (action.type === 'add') {
        // ถ้า Undo การ Add = ลบทิ้ง / ถ้า Redo = สร้างใหม่
        if (isUndo) await fetch(`${apiUrl}/${action.item.id}`, { method: 'DELETE' });
        else await fetch(apiUrl, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(action.item) });
    } 
    else if (action.type === 'edit') {
        // ดึงข้อมูลเก่าหรือใหม่ไปทับ
        const payload = isUndo ? action.oldItem : action.newItem;
        await fetch(`${apiUrl}/${payload.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    }
    else if (action.type === 'delete') {
        // ถ้า Undo การลบ = สร้างกลับมา / ถ้า Redo = ลบทิ้งอีกรอบ
        if (isUndo) await fetch(apiUrl, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(action.item) });
        else await fetch(`${apiUrl}/${action.item.id}`, { method: 'DELETE' });
    }
    else if (action.type === 'batch_delete') {
        // การจัดการลบแบบกลุ่ม
        if (isUndo) {
            for (let item of action.items) {
                await fetch(apiUrl, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(item) });
            }
        } else {
            const ids = action.items.map(i => i.id);
            await fetch(`${apiUrl}/batch-delete`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ids }) });
        }
    }
}
// -------------------------------------------------------------

// Heartbeat
// setInterval(() => { fetch('http://127.0.0.1:5000/heartbeat', { method: 'POST' }).catch(err => {}); }, 1000);

// Get acronym for Smart Search
function getAcronym(title) {
    if (!title) return "";
    const matches = title.match(/\b(\w)/g); 
    return matches ? matches.join('').toLowerCase() : "";
}

// Quick Add Progress
async function quickProgress(id, current, total) {
    if (total > 0 && current >= total) return;
    
    const oldItem = allItems.find(x => x.id === id);
    const newItem = { ...oldItem, current_progress: current + 1 };
    
    await fetch(`${apiUrl}/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ current_progress: current + 1 })
    });
    
    saveAction({ type: 'edit', oldItem: oldItem, newItem: newItem }); // บันทึกความจำ
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

// ระบบจัดการ UI แบบเลือกหลายรายการ
function updateMultiSelectUI() {
    const controls = document.getElementById('multiSelectControls');
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const selectCountText = document.getElementById('selectCountText');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    if (selectedItems.size > 0) {
        controls.classList.remove('hidden');
        selectCountText.textContent = `เลือกแล้ว ${selectedItems.size} รายการ`;
        deleteBtn.removeAttribute('disabled');
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
    if (checkbox.checked) selectedItems.add(id);
    else selectedItems.delete(id);
    updateMultiSelectUI();
}

function toggleSelectAll(checkbox) {
    const visibleCheckboxes = document.querySelectorAll('.item-checkbox');
    if (checkbox.checked) {
        visibleCheckboxes.forEach(cb => {
            cb.checked = true;
            selectedItems.add(parseInt(cb.dataset.id));
        });
    } else {
        visibleCheckboxes.forEach(cb => {
            cb.checked = false;
            selectedItems.delete(parseInt(cb.dataset.id));
        });
    }
    updateMultiSelectUI();
}

async function deleteSelectedItems() {
    if (selectedItems.size === 0) return;
    if (confirm(`คุณต้องการลบ ${selectedItems.size} รายการที่เลือกใช่หรือไม่?\n(ลบแล้วกู้คืนไม่ได้นะ)`)) {
        const deletedItems = allItems.filter(x => selectedItems.has(x.id)); // จำของที่จะลบก่อน
        
        await fetch('http://127.0.0.1:5000/items/batch-delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ids: Array.from(selectedItems) })
        });
        
        saveAction({ type: 'batch_delete', items: deletedItems }); // บันทึกความจำ
        selectedItems.clear();
        updateMultiSelectUI();
        loadItems();
    }
}

// Render the items to HTML
function renderItems(items) {
    const listContainer = document.getElementById('mediaListContainer');
    listContainer.innerHTML = ''; 
    selectedItems.clear(); 
    updateMultiSelectUI();

    let filtered = items.filter(i => {
        let matchesStatus;
        if (currentFilter === 'All') matchesStatus = true;
        else if (currentFilter === 'Progress') matchesStatus = (i.total_count > 0);
        else matchesStatus = (i.status === currentFilter);
        
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
                li.className = "bg-itemLight dark:bg-itemDark mb-3 p-[15px] rounded-xl flex items-center gap-4 transition-all duration-200 shadow-sm border border-transparent hover:border-accent hover:dark:border-accentDark";
                
                const percent = item.total_count > 0 ? (item.current_progress / item.total_count) * 100 : 0;
                let linkHtml = item.link ? `<a href="${item.link}" target="_blank" class="item-link" title="Open Link">🔗</a>` : '';
                
                let tagsHtml = '';
                if (item.tags) {
                    const tagArray = item.tags.split(',').map(t => t.trim()).filter(t => t);
                    tagsHtml = `<div class="flex flex-wrap gap-1 mt-1.5 mb-2">
                        ${tagArray.map(tag => `<span class="bg-accent/10 dark:bg-accentDark/10 text-accent dark:text-accentDark text-[0.75em] px-2 py-0.5 rounded-md font-semibold border border-accent/20 dark:border-accentDark/20">${tag}</span>`).join('')}
                    </div>`;
                }

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
    
    if (isEditing) {
        const oldItem = allItems.find(x => x.id == id);
        data.id = parseInt(id); // แปะ ID เข้าไปด้วยเพื่อความสมบูรณ์
        await fetch(`${apiUrl}/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        saveAction({ type: 'edit', oldItem: oldItem, newItem: data }); // บันทึกความจำ
    } else {
        const response = await fetch(apiUrl, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        const resData = await response.json();
        data.id = resData.id;
        saveAction({ type: 'add', item: data }); // บันทึกความจำ
    }
    
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
        const deletedItem = allItems.find(x => x.id === id);
        await fetch(`${apiUrl}/${id}`, { method: 'DELETE' }); 
        saveAction({ type: 'delete', item: deletedItem }); // บันทึกความจำ
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

// Initialize app
loadItems();
updateUndoRedoUI(); // ล็อกปุ่มไว้ตั้งแต่เริ่ม

// ----------------- Backup / Restore Systems -----------------
// async function backupToMongo() {
//     const btn = document.getElementById('backupBtn');
//     const originalText = btn.innerHTML;
//     btn.innerHTML = '⏳ Backing up...';
//     btn.disabled = true;
//     btn.classList.add('opacity-70', 'cursor-not-allowed');

//     try {
//         const response = await fetch('http://127.0.0.1:5000/backup/mongodb', { method: 'POST' });
//         const data = await response.json();
//         if (response.ok) alert(`✅ สำรองข้อมูลขึ้น MongoDB Atlas สำเร็จ!\nข้อมูลทั้งหมด ${data.count} รายการ ถูกเก็บไว้ใน Cluster ของ MyScheduleBot แล้วครับ`);
//         else alert(`❌ เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: ${data.error}`);
//     } catch (error) {
//         alert(`❌ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ โปรดตรวจสอบอินเทอร์เน็ต`);
//         console.error("Backup Error:", error);
//     } finally {
//         btn.innerHTML = originalText;
//         btn.disabled = false;
//         btn.classList.remove('opacity-70', 'cursor-not-allowed');
//     }
// }

// async function restoreFromMongo() {
//     if (!confirm("⚠️ คำเตือน: การ Restore จะลบข้อมูลปัจจุบันในเครื่อง แล้วแทนที่ด้วยข้อมูลจาก Cloud ทั้งหมด\nคุณแน่ใจหรือไม่ที่จะดำเนินการต่อ?")) return;

//     const btn = document.getElementById('restoreBtn');
//     const originalText = btn.innerHTML;
//     btn.innerHTML = '⏳ Restoring...';
//     btn.disabled = true;
//     btn.classList.add('opacity-70', 'cursor-not-allowed');

//     try {
//         const response = await fetch('http://127.0.0.1:5000/restore/mongodb', { method: 'POST' });
//         const data = await response.json();
//         if (response.ok) {
//             alert(`✅ กู้คืนข้อมูลสำเร็จ!\nดึงข้อมูลลงมาทั้งหมด ${data.count} รายการ เรียบร้อยแล้ว`);
//             loadItems(); 
//         } else {
//             alert(`❌ ไม่สามารถกู้คืนได้: ${data.error || data.message}`);
//         }
//     } catch (error) {
//         alert(`❌ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ โปรดตรวจสอบอินเทอร์เน็ต`);
//         console.error("Restore Error:", error);
//     } finally {
//         btn.innerHTML = originalText;
//         btn.disabled = false;
//         btn.classList.remove('opacity-70', 'cursor-not-allowed');
//     }
// }