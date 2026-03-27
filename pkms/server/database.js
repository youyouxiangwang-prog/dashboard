// JSON File-based Database
// Simple, portable storage for todos and notes
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const TODOS_FILE = path.join(dataDir, 'todos.json');
const NOTES_FILE = path.join(dataDir, 'notes.json');

// Helper functions
function readJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return [];
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
}

// Todo operations
export const todoOps = {
  getAll: () => {
    const todos = readJSON(TODOS_FILE);
    return todos.sort((a, b) => {
      // Sort by status, then priority, then deadline
      const statusOrder = { pending: 1, in_progress: 2, completed: 3 };
      const priorityOrder = { urgent: 1, high: 2, medium: 3, low: 4 };
      
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (a.deadline && b.deadline) {
        return new Date(a.deadline) - new Date(b.deadline);
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
  },

  getById: (id) => {
    const todos = readJSON(TODOS_FILE);
    return todos.find(t => t.id === id) || null;
  },

  getPending: () => {
    const todos = readJSON(TODOS_FILE);
    return todos
      .filter(t => ['pending', 'in_progress'].includes(t.status) && t.deadline)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  },

  getDueReminders: (minutesFromNow = 5) => {
    const todos = readJSON(TODOS_FILE);
    const now = new Date();
    const future = new Date(now.getTime() + minutesFromNow * 60000);
    
    return todos.filter(t => {
      if (!['pending', 'in_progress'].includes(t.status)) return false;
      if (!t.reminder_time) return false;
      const reminderDate = new Date(t.reminder_time);
      return reminderDate > now && reminderDate <= future;
    });
  },

  create: (todo) => {
    const todos = readJSON(TODOS_FILE);
    const newTodo = {
      ...todo,
      id: todo.id || uuidv4(),
      status: todo.status || 'pending',
      priority: todo.priority || 'medium',
      tags: todo.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null
    };
    todos.push(newTodo);
    writeJSON(TODOS_FILE, todos);
    return newTodo;
  },

  update: (id, updates) => {
    const todos = readJSON(TODOS_FILE);
    const index = todos.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    todos[index] = {
      ...todos[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    if (updates.status === 'completed') {
      todos[index].completed_at = new Date().toISOString();
    }
    
    writeJSON(TODOS_FILE, todos);
    return todos[index];
  },

  complete: (id) => {
    return todoOps.update(id, { 
      status: 'completed',
      completed_at: new Date().toISOString()
    });
  },

  delete: (id) => {
    const todos = readJSON(TODOS_FILE);
    const filtered = todos.filter(t => t.id !== id);
    writeJSON(TODOS_FILE, filtered);
    return { changes: todos.length - filtered.length };
  }
};

// Note operations
export const noteOps = {
  getAll: () => {
    const notes = readJSON(NOTES_FILE);
    return notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  },

  getById: (id) => {
    const notes = readJSON(NOTES_FILE);
    return notes.find(n => n.id === id) || null;
  },

  getDaily: () => {
    const today = new Date().toISOString().split('T')[0];
    const notes = readJSON(NOTES_FILE);
    return notes.find(n => n.note_type === 'daily' && n.title === today) || null;
  },

  getByType: (type) => {
    const notes = readJSON(NOTES_FILE);
    return notes
      .filter(n => n.note_type === type)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  },

  search: (query) => {
    const notes = readJSON(NOTES_FILE);
    const lowerQuery = query.toLowerCase();
    return notes.filter(n => 
      n.title.toLowerCase().includes(lowerQuery) ||
      (n.content && n.content.toLowerCase().includes(lowerQuery)) ||
      (n.raw_content && n.raw_content.toLowerCase().includes(lowerQuery)) ||
      n.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  },

  create: (note) => {
    const notes = readJSON(NOTES_FILE);
    const newNote = {
      ...note,
      id: note.id || uuidv4(),
      tags: note.tags || [],
      note_type: note.note_type || 'general',
      linked_notes: note.linked_notes || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    notes.push(newNote);
    writeJSON(NOTES_FILE, notes);
    return newNote;
  },

  update: (id, updates) => {
    const notes = readJSON(NOTES_FILE);
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) return null;
    
    notes[index] = {
      ...notes[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    writeJSON(NOTES_FILE, notes);
    return notes[index];
  },

  delete: (id) => {
    const notes = readJSON(NOTES_FILE);
    const filtered = notes.filter(n => n.id !== id);
    writeJSON(NOTES_FILE, filtered);
    return { changes: notes.length - filtered.length };
  },

  createOrGetDaily: () => {
    const today = new Date().toISOString().split('T')[0];
    let note = noteOps.getDaily();
    
    if (!note) {
      const now = new Date();
      const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const dayName = dayNames[now.getDay()];
      
      note = noteOps.create({
        id: `daily-${today}`,
        title: today,
        content: `# ${today} ${dayName}\n\n`,
        raw_content: `# ${today} ${dayName}\n\n`,
        note_type: 'daily',
        tags: ['daily']
      });
    }
    
    return note;
  }
};

// Reminder log operations
export const reminderOps = {
  getLog: () => {
    const logFile = path.join(dataDir, 'reminders_log.json');
    return readJSON(logFile);
  },

  log: (todoId, reminderTime) => {
    const logFile = path.join(dataDir, 'reminders_log.json');
    const logs = readJSON(logFile);
    const newLog = {
      id: uuidv4(),
      todo_id: todoId,
      reminder_time: reminderTime,
      sent_at: new Date().toISOString(),
      status: 'sent'
    };
    logs.push(newLog);
    writeJSON(logFile, logs);
    return newLog;
  },

  wasSentRecently: (todoId) => {
    const logs = reminderOps.getLog();
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60000);
    return logs.some(l => 
      l.todo_id === todoId && 
      new Date(l.sent_at) > thirtyMinutesAgo
    );
  }
};

export default { todoOps, noteOps, reminderOps };
