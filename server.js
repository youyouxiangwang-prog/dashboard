const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

const PORT = 3000;
const TASKS_FILE = path.join(__dirname, 'tasks.json');
const EVENTS_FILE = path.join(__dirname, 'events.json');
const UPLOADS_DIR = '/home/ubuntu/clawd/uploads';
const BUSINESS_DIR = '/home/ubuntu/clawd/business';
const AUTOMATIONS_DIR = '/home/ubuntu/clawd/automations';

// Knowledge base folders to scan
const KNOWLEDGE_FOLDERS = [
  { path: UPLOADS_DIR, name: 'Uploads', icon: '💾' },
  { path: BUSINESS_DIR, name: 'Business', icon: '🤝' },
  { path: AUTOMATIONS_DIR, name: 'Automations', icon: '⚙️' }
];

// Extract key takeaways from text content
function extractSummary(content, maxLength = 200) {
  if (!content) return 'No content';
  
  // Get first few lines as summary
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'));
  const summary = lines.slice(0, 3).join(' ').replace(/[#*`]/g, '').trim();
  
  if (summary.length > maxLength) {
    return summary.substring(0, maxLength) + '...';
  }
  return summary || 'No summary available';
}

// Scan folder and get files with summaries
function scanFolder(folderPath, name, icon) {
  const items = [];
  
  if (!fs.existsSync(folderPath)) {
    return { name, icon, items: [] };
  }
  
  const files = fs.readdirSync(folderPath);
  
  files.forEach(file => {
    const filePath = path.join(folderPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      const isText = ['.md', '.txt', '.json', '.js', '.yaml', '.yml'].includes(ext);
      
      let summary = '';
      if (isText) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          summary = extractSummary(content);
        } catch (e) {
          summary = 'Unable to read file';
        }
      } else {
        summary = `File (${(stat.size / 1024).toFixed(1)} KB)`;
      }
      
      items.push({
        name: file,
        size: stat.size,
        modified: stat.mtime.toISOString().split('T')[0],
        summary: summary
      });
    }
  });
  
  return { name, icon, items };
}

// Initialize tasks file if it doesn't exist
if (!fs.existsSync(TASKS_FILE)) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify([], null, 2));
}

// Initialize events file with sample events if it doesn't exist
if (!fs.existsSync(EVENTS_FILE)) {
  const sampleEvents = [
    { id: '1', title: 'Welcome to Dashboard!', date: new Date().toISOString().split('T')[0], time: '09:00', category: 'General' },
    { id: '2', title: 'Add your events here', date: new Date(Date.now() + 86400000).toISOString().split('T')[0], time: '10:00', category: 'General' }
  ];
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(sampleEvents, null, 2));
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
  // Enable CORS
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
      // GET /api/events - Fetch events from local storage
      if (pathname === '/api/events' && req.method === 'GET') {
        const events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(events));
        return;
      }

      // POST /api/events - Add new event
      if (pathname === '/api/events' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          const newEvent = JSON.parse(body);
          const events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
          newEvent.id = Date.now().toString();
          events.push(newEvent);
          fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(newEvent));
        });
        return;
      }

      // DELETE /api/events/:id - Delete event
      if (pathname.match(/^\/api\/events\/.+$/) && req.method === 'DELETE') {
        const eventId = pathname.split('/').pop();
        let events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
        events = events.filter(e => e.id !== eventId);
        fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // GET /api/tasks - Read all tasks (returns tasks array only)
      if (pathname === '/api/tasks' && req.method === 'GET') {
        const data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
        const tasks = data.tasks || [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(tasks));
        return;
      }

      // POST /api/tasks - Add new task
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
          
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(task));
        });
        return;
      }

      // PUT /api/tasks/:id - Update task
      if (pathname.match(/^\/api\/tasks\/(.+)$/) && req.method === 'PUT') {
        const taskId = pathname.match(/^\/api\/tasks\/(.+)$/)[1];
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          const updates = JSON.parse(body);
          const data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
          
          const index = data.tasks.findIndex(t => t.id === taskId);
          if (index !== -1) {
            data.tasks[index] = { ...data.tasks[index], ...updates, updatedAt: new Date().toISOString() };
            data.metadata.lastUpdated = new Date().toISOString();
            data.metadata.completedTasks = data.tasks.filter(t => t.completed).length;
            
            fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data.tasks[index]));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Task not found' }));
          }
        });
        return;
      }

      // DELETE /api/tasks/:id - Delete task
      if (pathname.match(/^\/api\/tasks\/(.+)$/) && req.method === 'DELETE') {
        const taskId = pathname.match(/^\/api\/tasks\/(.+)$/)[1];
        let data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
        
        const index = data.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
          data.tasks.splice(index, 1);
          data.metadata.lastUpdated = new Date().toISOString();
          data.metadata.totalTasks = data.tasks.length;
          
          fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Task not found' }));
        }
        return;
      }

      // GET /api/knowledge - Knowledge base with summaries
      if (pathname === '/api/knowledge' && req.method === 'GET') {
        const knowledgeBase = KNOWLEDGE_FOLDERS.map(folder => 
          scanFolder(folder.path, folder.name, folder.icon)
        );
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(knowledgeBase));
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

  // Security: prevent directory traversal
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
        // Serve index.html for SPA routing
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