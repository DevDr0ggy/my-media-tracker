// --- โค้ดส่วน Custom Dropdown ---
document.addEventListener("DOMContentLoaded", () => {
    const selects = document.querySelectorAll("select");
    
    selects.forEach(select => {
        select.style.display = 'none';

        const wrapper = document.createElement("div");
        wrapper.className = "relative w-full flex-1 min-w-0";
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);

        const display = document.createElement("div");
        display.className = select.className.replace('appearance-none', '') + " cursor-pointer flex justify-between items-center select-none";
        display.tabIndex = 0; 
        
        const spanText = document.createElement("span");
        spanText.className = "truncate pr-2 flex-1 min-w-0";
        spanText.textContent = select.options[select.selectedIndex]?.text || '';
        select.customDisplaySpan = spanText; 
        
        const icon = document.createElement("div");
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-70 flex-shrink-0"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

        display.appendChild(spanText);
        display.appendChild(icon);
        wrapper.appendChild(display);

        const list = document.createElement("div");
        list.className = "absolute z-[2000] w-full mt-1 bg-containerLight dark:bg-containerDark border border-gray-200 dark:border-zinc-700 rounded-xl shadow-[0_8px_25px_rgba(0,0,0,0.15)] hidden overflow-hidden transition-all duration-200 max-h-[250px] overflow-y-auto custom-scrollbar";
        
        Array.from(select.options).forEach((option, index) => {
            const item = document.createElement("div");
            item.className = "p-3 cursor-pointer hover:bg-accent hover:text-white dark:hover:bg-accentDark dark:hover:text-gray-900 transition-colors text-[0.95em] select-none";
            item.textContent = option.text;
            
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                select.selectedIndex = index;
                spanText.textContent = option.text;
                list.classList.add("hidden");
                select.dispatchEvent(new Event("change"));
            });
            list.appendChild(item);
        });

        wrapper.appendChild(list);

        display.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll(".custom-select-list").forEach(l => {
                if (l !== list) l.classList.add("hidden");
            });
            list.classList.toggle("hidden");
        });

        list.classList.add("custom-select-list");
    });

    document.addEventListener("click", () => {
        document.querySelectorAll(".custom-select-list").forEach(l => l.classList.add("hidden"));
    });
});

window.addEventListener("load", () => {
    const updateUI = () => {
        document.querySelectorAll("select").forEach(select => {
            if (select.customDisplaySpan) {
                select.customDisplaySpan.textContent = select.options[select.selectedIndex]?.text || '';
            }
        });
    };

    if (typeof startEditItem === "function") {
        const originalStart = startEditItem;
        window.startEditItem = function(id) {
            originalStart(id);
            updateUI();
        };
    }
    if (typeof cancelEdit === "function") {
        const originalCancel = cancelEdit;
        window.cancelEdit = function() {
            originalCancel();
            updateUI();
        };
    }
});