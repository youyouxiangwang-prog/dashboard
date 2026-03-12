const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

const PORT = 3000;
const TASKS_FILE = path.join(__dirname, 'tasks.json');
const EVENTS_FILE = path.join(__dirname, 'events.json');
const NOTES_FILE = path.join(__dirname, 'notes.json');
const ACTIVITY_FILE = path.join(__dirname, 'activity.json');

// Knowledge base folders - READ ONLY FROM THESE as specified
const KNOWLEDGE_BASE_PATH = '/home/ubuntu/.openclaw/workspace-knowledge-base/kb';

const KNOWLEDGE_FOLDERS = [
  { path: path.join(KNOWLEDGE_BASE_PATH, 'tech'), name: 'Tech', icon: '💻', category: 'tech' },
  { path: path.join(KNOWLEDGE_BASE_PATH, 'personal'), name: 'Personal', icon: '👤', category: 'personal' },
  { path: path.join(KNOWLEDGE_BASE_PATH, 'projects'), name: 'Projects', icon: '📁', category: 'projects' },
  { path: path.join(KNOWLEDGE_BASE_PATH, 'finance'), name: 'Finance', icon: '💰', category: 'finance' },
  { path: path.join(KNOWLEDGE_BASE_PATH, 'health'), name: 'Health', icon: '❤️', category: 'health' },
  { path: path.join(KNOWLEDGE_BASE_PATH, 'misc'), name: 'Misc', icon: '📝', category: 'misc' }
];

// Extract key takeaways from text content
function extractSummary(content, maxLength = 150) {
  if (!content) return 'No content';
  
  // Try to find a summary section or extract first meaningful paragraphs
  const lines = content.split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('```'))
    .slice(0, 3);
  
  const summary = lines.join(' ').replace(/[#*`]/g, '').trim();
  
  if (summary.length > maxLength) {
    return summary.substring(0, maxLength) + '...';
  }
  return summary || 'No summary available';
}

// Parse markdown files
function parseMarkdown(content) {
  const lines = content.split('\n');
  const result = {
    title: '',
    sections: [],
    tags: []
  };
  
  // Find title (first H1)
  for (const line of lines) {
    if (line.startsWith('# ')) {
      result.title = line.replace('# ', '').trim();
      break;
    }
  }
  
  // Extract tags from content
  const tagMatch = content.match(/tags?:\s*\[([^\]]+)\]/i);
  if (tagMatch) {
    result.tags = tagMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
  }
  
  return result;
}

// Scan folder and get files with summaries
function scanFolder(folderPath, name, icon, category) {
  const items = [];
  
  if (!fs.existsSync(folderPath)) {
    return { name, icon, category, items: [], empty: true };
  }
  
  try {
    const files = fs.readdirSync(folderPath);
    
    files.forEach(file => {
      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        const isText = ['.md', '.txt', '.json', '.js', '.yaml', '.yml', '.log'].includes(ext);
        
        let summary = '';
        let metadata = {};
        
        if (isText) {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            summary = extractSummary(content);
            
            if (ext === '.md') {
              metadata = parseMarkdown(content);
            }
          } catch (e) {
            summary = 'Unable to read file';
          }
        } else {
          summary = `File (${(stat.size / 1024).toFixed(1)} KB)`;
        }
        
        items.push({
          name: file,
          path: filePath,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          summary: summary,
          type: ext.replace('.', '') || 'file',
          metadata: metadata
        });
      }
    });
  } catch (e) {
    console.error(`Error scanning ${folderPath}:`, e.message);
  }
  
  return { name, icon, category, items, empty: items.length === 0 };
}

// Initialize tasks file if it doesn't exist
if (!fs.existsSync(TASKS_FILE)) {
  const initialData = { 
    version: "1.0", 
    categories: ["Work", "Personal", "Projects", "Finance", "Health", "Misc"], 
    tasks: [], 
    metadata: { 
      lastUpdated: new Date().toISOString(), 
      totalTasks: 0, 
      completedTasks: 0 
    } 
  };
  fs.writeFileSync(TASKS_FILE, JSON.stringify(initialData, null, 2));
}

// Initialize events file if it doesn't exist
if (!fs.existsSync(EVENTS_FILE)) {
  const today = new Date();
  const sampleEvents = [
    { id: '1', title: 'Weekly Planning', date: today.toISOString().split('T')[0], time: '09:00', category: 'Work', description: '' },
    { id: '2', title: 'Team Standup', date: new Date(today.getTime() + 86400000).toISOString().split('T')[0], time: '10:00', category: 'Work', description: '' },
    { id: '3', title: 'Review PRs', date: new Date(today.getTime() + 2*86400000).toISOString().split('T')[0], time: '14:00', category: 'Projects', description: '' }
  ];
  fs.writeFileSync(EVENTS_FILE, JSON.stringify({ version: "1.0", events: sampleEvents }, null, 2));
}

// Initialize notes file
if (!fs.existsSync(NOTES_FILE)) {
  fs.writeFileSync(NOTES_FILE, JSON.stringify({ version: "1.0", notes: [], lastUpdated: new Date().toISOString() }, null, 2));
}

// Initialize activity file
if (!fs.existsSync(ACTIVITY_FILE)) {
  fs.writeFileSync(ACTIVITY_FILE, JSON.stringify({ version: "1.0", activities: [], lastUpdated: new Date().toISOString() }, null, 2));
}

// Log activity
function logActivity(action, item, details = {}) {
  try {
    const data = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8'));
    const activity = {
      id: 'act_' + Date.now(),
      action,
      item,
      details,
      timestamp: new Date().toISOString()
    };
    data.activities.unshift(activity);
    data.activities = data.activities.slice(0, 50);
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error logging activity:', e.message);
  }
}

// MIME types for static files
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // API Routes
  if (pathname.startsWith('/api/')) {
    try {
      // GET /api/events
      if (pathname === '/api/events' && req.method === 'GET') {
        const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data.events));
        return;
      }

      // POST /api/events
      if (pathname === '/api/events' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          const newEvent = JSON.parse(body);
          const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
          newEvent.id = 'evt_' + Date.now();
          data.events.push(newEvent);
          data.lastUpdated = new Date().toISOString();
          fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2));
          logActivity('created', 'event', { title: newEvent.title, date: newEvent.date });
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(newEvent));
        });
        return;
      }

      // DELETE /api/events/:id
      if (pathname.match(/^\/api\/events\/(.+)$/) && req.method === 'DELETE') {
        const eventId = pathname.match(/^\/api\/events\/(.+)$/)[1];
        const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
        const event = data.events.find(e => e.id === eventId);
        data.events = data.events.filter(e => e.id !== eventId);
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2));
        logActivity('deleted', 'event', { title: event?.title });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // GET /api/tasks
      if (pathname === '/api/tasks' && req.method === 'GET') {
        const data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
      }

      // POST /api/tasks
      if (pathname === '/api/tasks' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          const newTask = JSON.parse(body);
          const data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
          
          const task = {
            id: 'task_' + Date.now(),
            title: newTask.title,
            category: newTask.category || 'Work',
            completed: false,
            dueDate: newTask.dueDate || null,
            priority: newTask.priority || 'medium',
            createdAt: new Date().toISOString(),
            notes: newTask.notes || ''
          };
          
          data.tasks.push(task);
          data.metadata.lastUpdated = new Date().toISOString();
          data.metadata.totalTasks = data.tasks.length;
          
          fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
          logActivity('created', 'task', { title: task.title, priority: task.priority });
          
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(task));
        });
        return;
      }

      // PUT /api/tasks/:id
      if (pathname.match(/^\/api\/tasks\/(.+)$/) && req.method === 'PUT') {
        const taskId = pathname.match(/^\/api\/tasks\/(.+)$/)[1];
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          const updates = JSON.parse(body);
          const data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
          
          const index = data.tasks.findIndex(t => t.id === taskId);
          if (index !== -1) {
            const wasCompleted = data.tasks[index].completed;
            data.tasks[index] = { ...data.tasks[index], ...updates, updatedAt: new Date().toISOString() };
            data.metadata.lastUpdated = new Date().toISOString();
            data.metadata.completedTasks = data.tasks.filter(t => t.completed).length;
            
            fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
            
            if (updates.completed && !wasCompleted) {
              logActivity('completed', 'task', { title: data.tasks[index].title });
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data.tasks[index]));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Task not found' }));
          }
        });
        return;
      }

      // DELETE /api/tasks/:id
      if (pathname.match(/^\/api\/tasks\/(.+)$/) && req.method === 'DELETE') {
        const taskId = pathname.match(/^\/api\/tasks\/(.+)$/)[1];
        const data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
        
        const index = data.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
          const task = data.tasks[index];
          data.tasks.splice(index, 1);
          data.metadata.lastUpdated = new Date().toISOString();
          data.metadata.totalTasks = data.tasks.length;
          
          fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
          logActivity('deleted', 'task', { title: task.title });
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Task not found' }));
        }
        return;
      }

      // GET /api/knowledge - Get all KB data
      if (pathname === '/api/knowledge' && req.method === 'GET') {
        const knowledgeBase = KNOWLEDGE_FOLDERS.map(folder => 
          scanFolder(folder.path, folder.name, folder.icon, folder.category)
        );
        
        const allItems = knowledgeBase.flatMap(kb => kb.items);
        
        // Count by category
        const categoryCount = {};
        const categoryData = {};
        knowledgeBase.forEach(kb => {
          categoryCount[kb.category] = kb.items.length;
          categoryData[kb.category] = {
            name: kb.name,
            icon: kb.icon,
            count: kb.items.length,
            empty: kb.empty,
            items: kb.items.slice(0, 5) // Limit items per category
          };
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          folders: knowledgeBase, 
          totalItems: allItems.length,
          byCategory: categoryCount,
          categoryData: categoryData,
          lastUpdated: new Date().toISOString()
        }));
        return;
      }

      // GET /api/knowledge/:category - Get specific category
      if (pathname.match(/^\/api\/knowledge\/([a-z]+)$/) && req.method === 'GET') {
        const category = pathname.match(/^\/api\/knowledge\/([a-z]+)$/)[1];
        const folder = KNOWLEDGE_FOLDERS.find(f => f.category === category);
        
        if (folder) {
          const data = scanFolder(folder.path, folder.name, folder.icon, folder.category);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Category not found' }));
        }
        return;
      }

      // GET /api/notes
      if (pathname === '/api/notes' && req.method === 'GET') {
        const data = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
      }

      // POST /api/notes
      if (pathname === '/api/notes' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          const newNote = JSON.parse(body);
          const data = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
          
          const note = {
            id: 'note_' + Date.now(),
            title: newNote.title || 'Untitled Note',
            content: newNote.content || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          data.notes.push(note);
          data.lastUpdated = new Date().toISOString();
          fs.writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2));
          logActivity('created', 'note', { title: note.title });
          
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(note));
        });
        return;
      }

      // PUT /api/notes/:id
      if (pathname.match(/^\/api\/notes\/(.+)$/) && req.method === 'PUT') {
        const noteId = pathname.match(/^\/api\/notes\/(.+)$/)[1];
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          const updates = JSON.parse(body);
          const data = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
          
          const index = data.notes.findIndex(n => n.id === noteId);
          if (index !== -1) {
            data.notes[index] = { ...data.notes[index], ...updates, updatedAt: new Date().toISOString() };
            data.lastUpdated = new Date().toISOString();
            fs.writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data.notes[index]));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Note not found' }));
          }
        });
        return;
      }

      // DELETE /api/notes/:id
      if (pathname.match(/^\/api\/notes\/(.+)$/) && req.method === 'DELETE') {
        const noteId = pathname.match(/^\/api\/notes\/(.+)$/)[1];
        const data = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
        
        const index = data.notes.findIndex(n => n.id === noteId);
        if (index !== -1) {
          const note = data.notes[index];
          data.notes.splice(index, 1);
          data.lastUpdated = new Date().toISOString();
          fs.writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2));
          logActivity('deleted', 'note', { title: note.title });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Note not found' }));
        }
        return;
      }

      // GET /api/activity
      if (pathname === '/api/activity' && req.method === 'GET') {
        const data = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data.activities.slice(0, 10)));
        return;
      }

      // GET /api/stats - Get stats for KB metrics
      if (pathname === '/api/stats' && req.method === 'GET') {
        const knowledgeBase = KNOWLEDGE_FOLDERS.map(folder => 
          scanFolder(folder.path, folder.name, folder.icon, folder.category)
        );
        
        const allItems = knowledgeBase.flatMap(kb => kb.items);
        
        // File type breakdown
        const fileTypes = {};
        let totalSize = 0;
        
        allItems.forEach(item => {
          const type = item.type || 'other';
          fileTypes[type] = (fileTypes[type] || 0) + 1;
          totalSize += item.size;
        });
        
        // Get task stats
        const tasksData = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
        const eventsData = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
        const notesData = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
        
        // Calculate KB category counts
        const kbStats = {};
        KNOWLEDGE_FOLDERS.forEach(folder => {
          const folderData = scanFolder(folder.path, folder.name, folder.icon, folder.category);
          kbStats[folder.category] = {
            name: folder.name,
            icon: folder.icon,
            count: folderData.items.length,
            empty: folderData.empty
          };
        });
        
        // Storage in human readable format
        const storageUsed = totalSize > 1024 * 1024 
          ? (totalSize / (1024 * 1024)).toFixed(2) + ' MB'
          : (totalSize / 1024).toFixed(2) + ' KB';
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          knowledgeBase: {
            totalItems: allItems.length,
            byCategory: kbStats,
            fileTypes: fileTypes,
            storageUsed: storageUsed,
            storageBytes: totalSize
          },
          tasks: {
            total: tasksData.tasks.length,
            completed: tasksData.tasks.filter(t => t.completed).length,
            pending: tasksData.tasks.filter(t => !t.completed).length,
            categories: tasksData.categories
          },
          events: {
            total: eventsData.events.length,
            upcoming: eventsData.events.filter(e => new Date(e.date) >= new Date(new Date().setHours(0,0,0,0))).length
          },
          notes: {
            total: notesData.notes.length
          },
          lastUpdated: new Date().toISOString()
        }));
        return;
      }

      // 404 for API
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    } catch (err) {
      console.error('Server error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
      return;
    }
  }

  // Static file serving
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(__dirname, 'index.html'), (err2, content2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content2);
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Dashboard server running at http://localhost:${PORT}/`);
});