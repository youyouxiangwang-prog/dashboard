// Dashboard App - Reads from KB index.json

// Fetch from GitHub raw content (workspace KB data)
const KB_INDEX_PATH = 'https://raw.githubusercontent.com/youyouxiangwang-prog/dashboard/master/kb/index.json';

async function loadDashboard() {
    try {
        const response = await fetch(KB_INDEX_PATH);
        const data = await response.json();
        
        updateKBOverview(data);
        updateTasks(data.tasks || []);
        updateTimestamp(data.lastUpdated);
        renderCalendar(data.tasks || []);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        document.getElementById('tasksList').innerHTML = 
            '<p class="no-tasks">Error loading data. Please check the server.</p>';
    }
}

function updateKBOverview(data) {
    // Total items
    document.getElementById('totalItems').textContent = data.totalItems || 0;
    
    // Categories count
    const categories = data.categories || {};
    const categoryCount = Object.keys(categories).length;
    document.getElementById('totalCategories').textContent = categoryCount;
    
    // Categories grid
    const categoriesGrid = document.getElementById('categoriesGrid');
    categoriesGrid.innerHTML = '';
    
    const categoryIcons = {
        tech: '💻',
        personal: '👤',
        projects: '📁',
        finance: '💰',
        health: '🏥',
        misc: '📦'
    };
    
    for (const [key, value] of Object.entries(categories)) {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <div class="category-name">${categoryIcons[key] || '📁'} ${key}</div>
            <div class="category-count">${value.count || 0} items</div>
        `;
        categoriesGrid.appendChild(card);
    }
}

function updateTasks(tasks) {
    const tasksList = document.getElementById('tasksList');
    
    if (!tasks || tasks.length === 0) {
        tasksList.innerHTML = '<p class="no-tasks">No tasks yet. Add some to get started!</p>';
        return;
    }
    
    // Sort by due date
    const sortedTasks = [...tasks].sort((a, b) => {
        return new Date(a.dueDate) - new Date(b.dueDate);
    });
    
    tasksList.innerHTML = '';
    
    sortedTasks.forEach(task => {
        const dueDate = new Date(task.dueDate);
        const now = new Date();
        const isPending = task.status !== 'completed';
        
        const item = document.createElement('div');
        item.className = `task-item ${isPending ? 'pending' : 'completed'}`;
        item.innerHTML = `
            <div class="task-content">
                <div class="task-title">${task.title}</div>
                <div class="task-time">📅 ${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
            <span class="task-status ${task.status || 'pending'}">${task.status || 'pending'}</span>
        `;
        tasksList.appendChild(item);
    });
}

function updateTimestamp(lastUpdate) {
    if (lastUpdate) {
        const date = new Date(lastUpdate);
        document.getElementById('lastUpdate').textContent = `Last Updated: ${date.toLocaleString()}`;
        document.getElementById('syncTime').textContent = date.toLocaleString();
    }
}

// Calendar functionality
function renderCalendar(tasks = []) {
    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) return;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get first day of month and total days
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Build task dates map
    const taskDates = {};
    tasks.forEach(task => {
        if (task.dueDate) {
            const dateKey = task.dueDate.split('T')[0];
            if (!taskDates[dateKey]) taskDates[dateKey] = [];
            taskDates[dateKey].push(task);
        }
    });
    
    let html = '';
    const today = now.toISOString().split('T')[0];
    
    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });
    
    // Empty cells for days before first of month
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="calendar-day empty"></div>`;
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasTasks = taskDates[dateKey] || (taskDates[dateStr] && taskDates[dateStr].length > 0);
        const isToday = dateStr === today;
        const taskCount = taskDates[dateStr] ? taskDates[dateStr].length : 0;
        
        html += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${hasTasks ? 'has-tasks' : ''}" 
                 data-date="${dateStr}" onclick="showDayDetails('${dateStr}')">
                <span class="day-number">${day}</span>
                ${taskCount > 0 ? `<span class="task-badge">${taskCount}</span>` : ''}
            </div>
        `;
    }
    
    calendarGrid.innerHTML = html;
    window.allTasks = tasks; // Store for day detail view
}

function showDayDetails(dateStr) {
    const dayDetail = document.getElementById('dayDetail');
    const dayDetailTitle = document.getElementById('dayDetailTitle');
    const dayItems = document.getElementById('dayItems');
    
    if (!dayDetail || !window.allTasks) return;
    
    // Filter tasks for this date
    const dateKey = dateStr;
    const dayTasks = window.allTasks.filter(task => {
        if (!task.dueDate) return false;
        return task.dueDate.split('T')[0] === dateKey;
    });
    
    // Format display date
    const displayDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    dayDetailTitle.textContent = `Tasks for ${displayDate}`;
    
    if (dayTasks.length === 0) {
        dayItems.innerHTML = '<p class="no-tasks">No tasks for this day.</p>';
    } else {
        dayItems.innerHTML = dayTasks.map(task => `
            <div class="task-item ${task.status === 'completed' ? 'completed' : 'pending'}">
                <div class="task-content">
                    <div class="task-title">${task.title}</div>
                    <div class="task-desc">${task.description || ''}</div>
                </div>
                <span class="task-status ${task.status || 'pending'}">${task.status || 'pending'}</span>
            </div>
        `).join('');
    }
    
    dayDetail.style.display = 'block';
    dayDetail.scrollIntoView({ behavior: 'smooth' });
}

// Auto-refresh every 30 seconds
loadDashboard();
setInterval(loadDashboard, 30000);