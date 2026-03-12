// Dashboard Frontend Logic

// State
let tasks = [];
let currentFilter = 'all';
let isDarkMode = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initDate();
  loadEvents();
  loadTasks();
  initEventListeners();
});

// Initialize theme from localStorage
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDarkMode = true;
    document.documentElement.classList.add('dark');
    updateThemeButton();
  }
}

// Initialize current date display
function initDate() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
  
  const calendarTitle = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  document.getElementById('calendarTitle').textContent = calendarTitle;
}

// Theme toggle
function initEventListeners() {
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('taskForm').addEventListener('submit', handleAddTask);
  document.getElementById('editTaskForm').addEventListener('submit', handleEditTask);
  document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
  
  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => handleFilterClick(btn));
  });
  
  // File upload
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', handleFileDrop);
  fileInput.addEventListener('change', handleFileSelect);
}

function toggleTheme() {
  isDarkMode = !isDarkMode;
  document.documentElement.classList.toggle('dark', isDarkMode);
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  updateThemeButton();
}

function updateThemeButton() {
  const themeText = document.getElementById('themeText');
  themeText.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
}

// ==================== Events ====================

async function loadEvents() {
  const eventsList = document.getElementById('eventsList');
  
  try {
    const response = await fetch('/api/events');
    const events = await response.json();
    
    if (events.length === 0) {
      eventsList.innerHTML = `
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          <svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <p>No upcoming events</p>
        </div>
      `;
      return;
    }
    
    eventsList.innerHTML = events.slice(0, 10).map((event, index) => {
      const start = event.start?.dateTime || event.start?.date || 'TBD';
      const end = event.end?.dateTime || event.end?.date || '';
      const date = new Date(start);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      return `
        <div class="task-item event-card p-4 bg-gray-50 dark:bg-gray-700 rounded-lg" style="animation-delay: ${index * 50}ms">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h4 class="font-semibold text-gray-800 dark:text-gray-100">${escapeHtml(event.summary || 'Untitled Event')}</h4>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                <svg class="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                ${dateStr} at ${timeStr}
              </p>
              ${event.location ? `<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">📍 ${escapeHtml(event.location)}</p>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Failed to load events:', error);
    eventsList.innerHTML = `
      <div class="text-center py-8 text-red-500">
        <p>Failed to load events</p>
      </div>
    `;
  }
}

// ==================== Tasks ====================

async function loadTasks() {
  const taskList = document.getElementById('taskList');
  
  try {
    const response = await fetch('/api/tasks');
    tasks = await response.json();
    renderTasks();
  } catch (error) {
    console.error('Failed to load tasks:', error);
    taskList.innerHTML = `
      <div class="text-center py-8 text-red-500">
        <p>Failed to load tasks</p>
      </div>
    `;
  }
}

function renderTasks() {
  const taskList = document.getElementById('taskList');
  const filteredTasks = currentFilter === 'all' 
    ? tasks 
    : tasks.filter(t => t.category === currentFilter);
  
  if (filteredTasks.length === 0) {
    taskList.innerHTML = `
      <div class="text-center py-8 text-gray-500 dark:text-gray-400">
        <svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
        </svg>
        <p>No tasks yet. Add one above!</p>
      </div>
    `;
    return;
  }
  
  taskList.innerHTML = filteredTasks.map((task, index) => {
    const categoryClass = `category-${task.category.replace(' ', '-')}`;
    const isAI = task.category === 'AI Education';
    const badgeClass = isAI ? 'category-AI-Education' : categoryClass;
    
    return `
      <div class="task-item task-card flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg ${task.completed ? 'task-completed' : ''}" style="animation-delay: ${index * 50}ms" data-id="${task.id}">
        <div class="flex items-center gap-4 flex-1">
          <input type="checkbox" ${task.completed ? 'checked' : ''} 
            onchange="toggleTaskComplete('${task.id}')"
            class="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800">
          <div class="flex-1">
            <span class="task-title font-medium text-gray-800 dark:text-gray-100">${escapeHtml(task.title)}</span>
            <span class="ml-2 px-2 py-0.5 text-xs rounded-full ${badgeClass}">${task.category}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="openEditModal('${task.id}')" class="p-2 text-gray-500 hover:text-primary-500 transition-colors" title="Edit">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button onclick="deleteTask('${task.id}')" class="p-2 text-gray-500 hover:text-red-500 transition-colors" title="Delete">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleAddTask(e) {
  e.preventDefault();
  
  const title = document.getElementById('taskTitle').value.trim();
  const category = document.getElementById('taskCategory').value;
  
  if (!title) return;
  
  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, completed: false })
    });
    
    const newTask = await response.json();
    tasks.push(newTask);
    renderTasks();
    
    document.getElementById('taskTitle').value = '';
    showToast('Task added successfully!', 'success');
  } catch (error) {
    console.error('Failed to add task:', error);
    showToast('Failed to add task', 'error');
  }
}

async function toggleTaskComplete(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  task.completed = !task.completed;
  
  try {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: task.completed })
    });
    renderTasks();
  } catch (error) {
    console.error('Failed to update task:', error);
    task.completed = !task.completed;
    renderTasks();
  }
}

function openEditModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  document.getElementById('editTaskId').value = task.id;
  document.getElementById('editTaskTitle').value = task.title;
  document.getElementById('editTaskCategory').value = task.category;
  document.getElementById('editTaskCompleted').checked = task.completed;
  
  document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editModal').classList.add('hidden');
}

async function handleEditTask(e) {
  e.preventDefault();
  
  const taskId = document.getElementById('editTaskId').value;
  const title = document.getElementById('editTaskTitle').value.trim();
  const category = document.getElementById('editTaskCategory').value;
  const completed = document.getElementById('editTaskCompleted').checked;
  
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, completed })
    });
    
    const updatedTask = await response.json();
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      tasks[index] = updatedTask;
    }
    
    renderTasks();
    closeEditModal();
    showToast('Task updated successfully!', 'success');
  } catch (error) {
    console.error('Failed to update task:', error);
    showToast('Failed to update task', 'error');
  }
}

async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  
  try {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE'
    });
    
    tasks = tasks.filter(t => t.id !== taskId);
    renderTasks();
    showToast('Task deleted successfully!', 'success');
  } catch (error) {
    console.error('Failed to delete task:', error);
    showToast('Failed to delete task', 'error');
  }
}

function handleFilterClick(btn) {
  currentFilter = btn.dataset.filter;
  
  // Update active state
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.remove('active', 'bg-primary-500', 'text-white');
    b.classList.add('bg-gray-200', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-300');
  });
  btn.classList.add('active', 'bg-primary-500', 'text-white');
  btn.classList.remove('bg-gray-200', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-300');
  
  renderTasks();
}

// ==================== File Upload ====================

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('dragover');
  
  const files = e.dataTransfer.files;
  uploadFiles(files);
}

function handleFileSelect(e) {
  const files = e.target.files;
  uploadFiles(files);
}

async function uploadFiles(files) {
  const uploadStatus = document.getElementById('uploadStatus');
  
  if (files.length === 0) return;
  
  uploadStatus.innerHTML = '<p class="text-gray-500">Uploading files...</p>';
  
  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      // Since we don't have a real upload endpoint, we'll simulate success
      // In production, you'd POST to /api/upload
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Show success (simulated)
      uploadStatus.innerHTML = `
        <div class="flex items-center gap-2 text-green-600 dark:text-green-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <span>File "${file.name}" ready for upload to /home/ubuntu/clawd/uploads/</span>
        </div>
      `;
      
      showToast(`File "${file.name}" selected for upload`, 'success');
    } catch (error) {
      uploadStatus.innerHTML = `
        <div class="flex items-center gap-2 text-red-600 dark:text-red-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
          <span>Failed to upload "${file.name}"</span>
        </div>
      `;
    }
  }
}

// ==================== Utilities ====================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Make functions globally available
window.toggleTaskComplete = toggleTaskComplete;
window.openEditModal = openEditModal;
window.deleteTask = deleteTask;