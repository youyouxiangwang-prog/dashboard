// PKMS Main Application
// Personal Knowledge Management System for Youxiang Wang

const API_BASE = '/pkms-api';

// State
let currentTab = 'todos';
let currentFilter = 'all';
let currentNoteTypeFilter = 'all';
let currentTodo = null;
let currentNote = null;
let currentDailyDate = new Date();
let todos = [];
let notes = [];
let searchTimeout = null;

// DOM Elements
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const filterBtns = document.querySelectorAll('.filter-btn');
const noteTypeBtns = document.querySelectorAll('.note-type-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initTodoForm();
  initFilters();
  initNoteTypeFilters();
  initSearch();
  initDailyNotes();
  initNotes();
  loadStats();
  
  // Auto-refresh stats every minute
  setInterval(loadStats, 60000);
});

// Tab Management
function initTabs() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  currentTab = tabName;
  
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  tabContents.forEach(content => {
    content.classList.add('hidden');
    content.classList.remove('animate-fade-in');
  });
  
  const targetTab = document.getElementById(`tab-${tabName}`);
  targetTab.classList.remove('hidden');
  setTimeout(() => targetTab.classList.add('animate-fade-in'), 10);
  
  // Load data for tab
  if (tabName === 'todos') loadTodos();
  if (tabName === 'notes') loadNotes();
  if (tabName === 'daily') loadDailyNote();
  if (tabName === 'search') {
    const searchInput = document.getElementById('search-input');
    searchInput.focus();
  }
}

// Todo Functions
function initTodoForm() {
  const form = document.getElementById('todo-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('todo-title').value.trim();
    const description = document.getElementById('todo-description').value.trim();
    const deadline = document.getElementById('todo-deadline').value || null;
    const reminder = document.getElementById('todo-reminder').value || null;
    const priority = document.getElementById('todo-priority').value;
    const tagsInput = document.getElementById('todo-tags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
    
    if (!title) {
      showToast('请输入任务标题', 'error');
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, deadline, reminder_time: reminder, priority, tags })
      });
      
      const data = await res.json();
      if (data.success) {
        showToast('任务创建成功', 'success');
        form.reset();
        loadTodos();
        loadStats();
      } else {
        showToast(data.error || '创建失败', 'error');
      }
    } catch (error) {
      showToast('网络错误', 'error');
      console.error(error);
    }
  });
}

async function loadTodos() {
  try {
    const res = await fetch(`${API_BASE}/todos`);
    const data = await res.json();
    todos = data.data || [];
    renderTodos();
  } catch (error) {
    console.error('Failed to load todos:', error);
    document.getElementById('todos-container').innerHTML = `
      <div class="text-center text-slate-400 py-12">
        <i class="fas fa-exclamation-triangle text-4xl mb-4 opacity-50"></i>
        <p>加载失败，请刷新页面</p>
      </div>
    `;
  }
}

function renderTodos() {
  const container = document.getElementById('todos-container');
  
  let filteredTodos = [...todos];
  
  // Apply filter
  if (currentFilter === 'pending') {
    filteredTodos = filteredTodos.filter(t => t.status === 'pending');
  } else if (currentFilter === 'in_progress') {
    filteredTodos = filteredTodos.filter(t => t.status === 'in_progress');
  } else if (currentFilter === 'completed') {
    filteredTodos = filteredTodos.filter(t => t.status === 'completed');
  } else if (currentFilter === 'overdue') {
    filteredTodos = filteredTodos.filter(t => {
      if (!t.deadline || t.status === 'completed') return false;
      return new Date(t.deadline) < new Date();
    });
  }
  
  if (filteredTodos.length === 0) {
    container.innerHTML = `
      <div class="empty-state rounded-xl p-12 text-center">
        <i class="fas fa-clipboard-list text-6xl mb-4 text-slate-500"></i>
        <h3 class="text-xl font-medium text-slate-300 mb-2">暂无任务</h3>
        <p class="text-slate-400">创建一个新任务开始吧</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filteredTodos.map(todo => {
    const isOverdue = todo.deadline && new Date(todo.deadline) < new Date() && todo.status !== 'completed';
    const priorityClass = `priority-${todo.priority}`;
    const statusClass = isOverdue ? 'status-overdue' : `status-${todo.status}`;
    const completedClass = todo.status === 'completed' ? 'opacity-60' : '';
    
    const deadlineText = todo.deadline ? formatDateTime(todo.deadline) : null;
    const deadlineDisplay = isOverdue 
      ? `<span class="text-red-400">${deadlineText} (已过期)</span>`
      : deadlineText;
    
    return `
      <div class="todo-item bg-slate-800 rounded-xl p-4 ${priorityClass} ${completedClass} cursor-pointer"
           onclick="openTodoModal('${todo.id}')">
        <div class="flex items-start gap-4">
          <button class="mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                         ${todo.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-slate-500 hover:border-blue-500'}"
                  onclick="event.stopPropagation(); toggleTodoComplete('${todo.id}')">
            ${todo.status === 'completed' ? '<i class="fas fa-check text-xs text-white"></i>' : ''}
          </button>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-medium text-slate-100 truncate ${todo.status === 'completed' ? 'line-through' : ''}">${escapeHtml(todo.title)}</h3>
              <span class="px-2 py-0.5 rounded text-xs ${statusClass} text-white shrink-0">${getStatusText(todo.status)}</span>
            </div>
            ${todo.description ? `<p class="text-sm text-slate-400 line-clamp-2 mb-2">${escapeHtml(todo.description)}</p>` : ''}
            <div class="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              ${deadlineDisplay ? `<span><i class="far fa-calendar mr-1"></i>${deadlineDisplay}</span>` : ''}
              ${todo.tags.map(tag => `<span class="bg-slate-700 px-2 py-0.5 rounded">#${escapeHtml(tag)}</span>`).join('')}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="event.stopPropagation();" 
                    class="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center transition-colors"
                    title="编辑">
              <i class="fas fa-ellipsis-h text-slate-400"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function toggleTodoComplete(todoId) {
  try {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;
    
    if (todo.status === 'completed') {
      // Uncomplete
      await fetch(`${API_BASE}/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' })
      });
    } else {
      // Complete
      await fetch(`${API_BASE}/todos/${todoId}/complete`, { method: 'POST' });
    }
    
    loadTodos();
    loadStats();
  } catch (error) {
    showToast('操作失败', 'error');
    console.error(error);
  }
}

function openTodoModal(todoId) {
  const todo = todos.find(t => t.id === todoId);
  if (!todo) return;
  
  currentTodo = todo;
  
  document.getElementById('modal-todo-title').textContent = todo.title;
  document.getElementById('modal-todo-description').innerHTML = todo.description ? marked.parse(todo.description) : '<p class="text-slate-500 italic">无描述</p>';
  document.getElementById('modal-todo-deadline').textContent = todo.deadline ? formatDateTime(todo.deadline) : '未设置';
  document.getElementById('modal-todo-reminder').textContent = todo.reminder_time ? formatDateTime(todo.reminder_time) : '未设置';
  document.getElementById('modal-todo-status').textContent = getStatusText(todo.status);
  
  const priorityEl = document.getElementById('modal-todo-priority');
  priorityEl.textContent = getPriorityText(todo.priority);
  priorityEl.className = `inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${
    todo.priority === 'urgent' ? 'bg-red-500 text-white' :
    todo.priority === 'high' ? 'bg-orange-500 text-white' :
    todo.priority === 'medium' ? 'bg-yellow-500 text-black' :
    'bg-green-500 text-white'
  }`;
  
  document.getElementById('modal-todo-tags').innerHTML = todo.tags.length > 0 
    ? todo.tags.map(tag => `<span class="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-sm">#${escapeHtml(tag)}</span>`).join('')
    : '<span class="text-slate-500 text-sm">无标签</span>';
  
  document.getElementById('modal-complete-btn').style.display = todo.status === 'completed' ? 'none' : 'block';
  
  document.getElementById('todo-modal').classList.remove('hidden');
}

function closeTodoModal() {
  document.getElementById('todo-modal').classList.add('hidden');
  currentTodo = null;
}

async function deleteTodo() {
  if (!currentTodo) return;
  if (!confirm('确定要删除这个任务吗？')) return;
  
  try {
    await fetch(`${API_BASE}/todos/${currentTodo.id}`, { method: 'DELETE' });
    closeTodoModal();
    loadTodos();
    loadStats();
    showToast('任务已删除', 'success');
  } catch (error) {
    showToast('删除失败', 'error');
  }
}

async function completeTodo() {
  if (!currentTodo) return;
  
  try {
    await fetch(`${API_BASE}/todos/${currentTodo.id}/complete`, { method: 'POST' });
    closeTodoModal();
    loadTodos();
    loadStats();
    showToast('任务已完成 🎉', 'success');
  } catch (error) {
    showToast('操作失败', 'error');
  }
}

// Setup modal buttons
document.getElementById('modal-complete-btn').addEventListener('click', completeTodo);
document.getElementById('modal-delete-btn').addEventListener('click', deleteTodo);

// Filter Functions
function initFilters() {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      filterBtns.forEach(b => {
        b.classList.remove('bg-blue-500', 'text-white');
        b.classList.add('bg-slate-700', 'text-slate-300');
      });
      btn.classList.remove('bg-slate-700', 'text-slate-300');
      btn.classList.add('bg-blue-500', 'text-white');
      renderTodos();
    });
  });
}

// Note Functions
function initNotes() {
  document.getElementById('new-note-btn').addEventListener('click', createNewNote);
  document.getElementById('save-note-btn').addEventListener('click', saveCurrentNote);
  
  // Auto-save on content change (debounced)
  const noteContent = document.getElementById('note-content');
  noteContent.addEventListener('input', debounce(saveCurrentNote, 2000));
  
  // Tag input handling
  document.getElementById('note-tags-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Could implement tag autocomplete here
    }
  });
}

function initNoteTypeFilters() {
  noteTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentNoteTypeFilter = btn.dataset.type;
      noteTypeBtns.forEach(b => {
        b.classList.remove('bg-blue-500');
        b.classList.add('bg-slate-700');
      });
      btn.classList.remove('bg-slate-700');
      btn.classList.add('bg-blue-500');
      loadNotes();
    });
  });
}

function createNewNote() {
  currentNote = null;
  document.getElementById('note-title').value = '';
  document.getElementById('note-content').value = '';
  document.getElementById('note-type').value = 'general';
  document.getElementById('note-tags-display').innerHTML = '';
  document.getElementById('linked-notes-section').classList.add('hidden');
}

async function loadNotes() {
  try {
    const url = currentNoteTypeFilter !== 'all' 
      ? `${API_BASE}/notes?type=${currentNoteTypeFilter}`
      : `${API_BASE}/notes`;
    const res = await fetch(url);
    const data = await res.json();
    notes = data.data || [];
    renderNotesSidebar();
  } catch (error) {
    console.error('Failed to load notes:', error);
  }
}

function renderNotesSidebar() {
  const sidebar = document.getElementById('notes-sidebar');
  
  if (notes.length === 0) {
    sidebar.innerHTML = `
      <div class="text-center text-slate-400 py-8">
        <i class="fas fa-file-alt text-4xl mb-4 opacity-50"></i>
        <p class="text-sm">暂无笔记</p>
        <button onclick="createNewNote()" class="mt-2 text-blue-400 text-sm hover:underline">创建第一篇</button>
      </div>
    `;
    return;
  }
  
  sidebar.innerHTML = notes.map(note => `
    <div class="note-sidebar-item p-3 rounded-lg cursor-pointer transition-colors ${currentNote && currentNote.id === note.id ? 'bg-slate-600' : 'hover:bg-slate-700'}"
         onclick="loadNote('${note.id}')">
      <h4 class="font-medium text-sm truncate text-slate-200">${escapeHtml(note.title)}</h4>
      <div class="flex items-center gap-2 mt-1">
        <span class="text-xs px-1.5 py-0.5 rounded ${getNoteTypeStyle(note.note_type)}">${getNoteTypeText(note.note_type)}</span>
        <span class="text-xs text-slate-500">${formatDateRelative(note.updated_at)}</span>
      </div>
      ${note.tags.length > 0 ? `
        <div class="flex flex-wrap gap-1 mt-2">
          ${note.tags.slice(0, 3).map(tag => `<span class="text-xs text-slate-500">#${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

async function loadNote(noteId) {
  try {
    const res = await fetch(`${API_BASE}/notes/${noteId}`);
    const data = await res.json();
    if (data.success) {
      currentNote = data.data;
      document.getElementById('note-title').value = currentNote.title;
      document.getElementById('note-content').value = currentNote.raw_content || currentNote.content;
      document.getElementById('note-type').value = currentNote.note_type;
      
      // Render tags
      const tagsDisplay = document.getElementById('note-tags-display');
      tagsDisplay.innerHTML = currentNote.tags.map(tag => 
        `<span class="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-sm">#${escapeHtml(tag)}</span>`
      ).join('');
      
      // Linked notes
      const linkedSection = document.getElementById('linked-notes-section');
      if (currentNote.linked_notes && currentNote.linked_notes.length > 0) {
        linkedSection.classList.remove('hidden');
        const linkedList = document.getElementById('linked-notes-list');
        linkedList.innerHTML = currentNote.linked_notes_info.map(link => 
          `<span class="note-link bg-slate-700 px-2 py-1 rounded text-sm" onclick="loadNote('${link.id || link.title}')">${escapeHtml(link.title)}</span>`
        ).join('');
      } else {
        linkedSection.classList.add('hidden');
      }
      
      renderNotesSidebar();
    }
  } catch (error) {
    showToast('加载笔记失败', 'error');
    console.error(error);
  }
}

async function saveCurrentNote() {
  const title = document.getElementById('note-title').value.trim();
  const content = document.getElementById('note-content').value;
  const note_type = document.getElementById('note-type').value;
  
  if (!title) {
    showToast('请输入笔记标题', 'error');
    return;
  }
  
  try {
    if (currentNote) {
      // Update existing
      await fetch(`${API_BASE}/notes/${currentNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, raw_content: content, note_type })
      });
      showToast('笔记已保存', 'success');
    } else {
      // Create new
      const res = await fetch(`${API_BASE}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, note_type })
      });
      const data = await res.json();
      if (data.success) {
        currentNote = data.data;
        showToast('笔记已创建', 'success');
        loadNotes();
      }
    }
  } catch (error) {
    showToast('保存失败', 'error');
    console.error(error);
  }
}

// Daily Notes
function initDailyNotes() {
  document.getElementById('prev-day').addEventListener('click', () => {
    currentDailyDate.setDate(currentDailyDate.getDate() - 1);
    loadDailyNote();
  });
  
  document.getElementById('next-day').addEventListener('click', () => {
    currentDailyDate.setDate(currentDailyDate.getDate() + 1);
    loadDailyNote();
  });
  
  document.getElementById('today-btn').addEventListener('click', () => {
    currentDailyDate = new Date();
    loadDailyNote();
  });
  
  // Auto-save daily note
  const dailyContent = document.getElementById('daily-content');
  dailyContent.addEventListener('input', debounce(saveDailyNote, 2000));
  
  // Render mini calendar
  renderMiniCalendar();
}

function renderMiniCalendar() {
  const calendar = document.getElementById('mini-calendar');
  const year = currentDailyDate.getFullYear();
  const month = currentDailyDate.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let html = '';
  
  // Empty cells for days before first of month
  for (let i = 0; i < startDay; i++) {
    html += '<div class="aspect-square"></div>';
  }
  
  // Days of month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const isToday = date.getTime() === today.getTime();
    const isSelected = date.toDateString() === currentDailyDate.toDateString();
    
    html += `
      <button class="aspect-square rounded-lg flex items-center justify-center text-sm transition-colors
                     ${isSelected ? 'bg-blue-500 text-white' : isToday ? 'bg-slate-600 text-white' : 'hover:bg-slate-700'}"
              onclick="selectCalendarDay(${year}, ${month}, ${day})">
        ${day}
      </button>
    `;
  }
  
  calendar.innerHTML = html;
}

function selectCalendarDay(year, month, day) {
  currentDailyDate = new Date(year, month, day);
  renderMiniCalendar();
  loadDailyNote();
}

async function loadDailyNote() {
  const dateStr = currentDailyDate.toISOString().split('T')[0];
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dayName = dayNames[currentDailyDate.getDay()];
  
  document.getElementById('daily-date').textContent = `${dateStr} ${dayName}`;
  
  try {
    const res = await fetch(`${API_BASE}/daily`);
    const data = await res.json();
    if (data.success) {
      const note = data.data;
      // Extract content after the title line
      const content = note.raw_content || note.content || '';
      const lines = content.split('\n');
      const contentStart = lines.slice(1).join('\n').trim();
      document.getElementById('daily-content').value = contentStart;
    }
  } catch (error) {
    console.error('Failed to load daily note:', error);
  }
}

async function saveDailyNote() {
  const content = document.getElementById('daily-content').value;
  const dateStr = currentDailyDate.toISOString().split('T')[0];
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dayName = dayNames[currentDailyDate.getDay()];
  
  const fullContent = `# ${dateStr} ${dayName}\n\n${content}`;
  
  try {
    // Get or create daily note first
    const res = await fetch(`${API_BASE}/daily`);
    const data = await res.json();
    if (data.success && data.data) {
      await fetch(`${API_BASE}/notes/${data.data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_content: fullContent, content: marked.parse(fullContent) })
      });
    }
  } catch (error) {
    console.error('Failed to save daily note:', error);
  }
}

// Search
function initSearch() {
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(searchInput.value), 300);
  });
}

async function performSearch(query) {
  const resultsContainer = document.getElementById('search-results');
  
  if (!query.trim()) {
    resultsContainer.innerHTML = `
      <div class="text-center text-slate-400 py-8">
        <i class="fas fa-search text-4xl mb-4 opacity-50"></i>
        <p>输入关键词搜索笔记和任务</p>
      </div>
    `;
    return;
  }
  
  try {
    const [todosRes, notesRes] = await Promise.all([
      fetch(`${API_BASE}/todos?status=all`),
      fetch(`${API_BASE}/notes/search?q=${encodeURIComponent(query)}`)
    ]);
    
    const todosData = await todosRes.json();
    const notesData = await notesRes.json();
    
    const matchedTodos = (todosData.data || []).filter(t => 
      t.title.includes(query) || (t.description && t.description.includes(query))
    );
    
    const matchedNotes = notesData.data || [];
    
    if (matchedTodos.length === 0 && matchedNotes.length === 0) {
      resultsContainer.innerHTML = `
        <div class="text-center text-slate-400 py-8">
          <i class="fas fa-folder-open text-4xl mb-4 opacity-50"></i>
          <p>没有找到匹配的结果</p>
        </div>
      `;
      return;
    }
    
    let html = '';
    
    if (matchedTodos.length > 0) {
      html += `
        <h3 class="font-medium text-slate-300 mb-3">
          <i class="fas fa-check-circle mr-2 text-blue-400"></i>任务 (${matchedTodos.length})
        </h3>
        <div class="space-y-2 mb-6">
          ${matchedTodos.map(todo => `
            <div class="bg-slate-700/50 rounded-lg p-4 cursor-pointer hover:bg-slate-700 transition-colors"
                 onclick="switchTab('todos'); openTodoModal('${todo.id}')">
              <div class="flex items-center gap-2">
                <span class="font-medium">${escapeHtml(todo.title)}</span>
                <span class="text-xs px-2 py-0.5 rounded ${getStatusStyle(todo.status)}">${getStatusText(todo.status)}</span>
              </div>
              ${todo.description ? `<p class="text-sm text-slate-400 mt-1 line-clamp-2">${escapeHtml(todo.description)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }
    
    if (matchedNotes.length > 0) {
      html += `
        <h3 class="font-medium text-slate-300 mb-3">
          <i class="fas fa-book mr-2 text-yellow-400"></i>笔记 (${matchedNotes.length})
        </h3>
        <div class="space-y-2">
          ${matchedNotes.map(note => `
            <div class="bg-slate-700/50 rounded-lg p-4 cursor-pointer hover:bg-slate-700 transition-colors"
                 onclick="switchTab('notes'); loadNote('${note.id}')">
              <div class="flex items-center gap-2">
                <span class="font-medium">${escapeHtml(note.title)}</span>
                <span class="text-xs px-1.5 py-0.5 rounded ${getNoteTypeStyle(note.note_type)}">${getNoteTypeText(note.note_type)}</span>
              </div>
              ${note.summary ? `<p class="text-sm text-slate-400 mt-1 line-clamp-2">${escapeHtml(note.summary)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }
    
    resultsContainer.innerHTML = html;
  } catch (error) {
    console.error('Search failed:', error);
    resultsContainer.innerHTML = `
      <div class="text-center text-red-400 py-8">
        <i class="fas fa-exclamation-circle text-4xl mb-4"></i>
        <p>搜索失败</p>
      </div>
    `;
  }
}

// Stats
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const data = await res.json();
    if (data.success) {
      document.getElementById('stat-pending').textContent = `${data.data.todos.pending} 待办`;
      document.getElementById('stat-notes').textContent = `${data.data.notes.total} 笔记`;
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// Global Search (header)
document.getElementById('global-search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const query = e.target.value.trim();
    if (query) {
      switchTab('search');
      document.getElementById('search-input').value = query;
      performSearch(query);
    }
  }
});

// Utility Functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateRelative(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function getStatusText(status) {
  const map = {
    pending: '待处理',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消'
  };
  return map[status] || status;
}

function getStatusStyle(status) {
  const map = {
    pending: 'bg-blue-500 text-white',
    in_progress: 'bg-purple-500 text-white',
    completed: 'bg-green-500 text-white',
    cancelled: 'bg-slate-500 text-white'
  };
  return map[status] || 'bg-slate-500 text-white';
}

function getPriorityText(priority) {
  const map = {
    low: '🟢 低',
    medium: '🟡 中',
    high: '🟠 高',
    urgent: '🔴 紧急'
  };
  return map[priority] || '🟡 中';
}

function getNoteTypeText(type) {
  const map = {
    general: '通用',
    daily: '每日',
    project: '项目',
    reference: '参考'
  };
  return map[type] || '通用';
}

function getNoteTypeStyle(type) {
  const map = {
    general: 'bg-slate-600 text-slate-300',
    daily: 'bg-blue-500/20 text-blue-400',
    project: 'bg-purple-500/20 text-purple-400',
    reference: 'bg-yellow-500/20 text-yellow-400'
  };
  return map[type] || 'bg-slate-600 text-slate-300';
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const msg = document.getElementById('toast-message');
  
  msg.textContent = message;
  
  if (type === 'success') {
    icon.className = 'fas fa-check-circle text-green-400';
  } else if (type === 'error') {
    icon.className = 'fas fa-exclamation-circle text-red-400';
  } else {
    icon.className = 'fas fa-info-circle text-blue-400';
  }
  
  toast.classList.remove('translate-y-20', 'opacity-0');
  
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}

// Close modal on escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeTodoModal();
  }
});

// Make functions globally available
window.toggleTodoComplete = toggleTodoComplete;
window.openTodoModal = openTodoModal;
window.closeTodoModal = closeTodoModal;
window.loadNote = loadNote;
window.selectCalendarDay = selectCalendarDay;
