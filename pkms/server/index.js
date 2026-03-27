// PKMS Server - Main Entry Point
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

import todosRouter from './routes/todos.js';
import notesRouter from './routes/notes.js';
import slackRouter from './routes/slack.js';
import ReminderService from './services/reminder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/todos', todosRouter);
app.use('/api/notes', notesRouter);
app.use('/api/slack', slackRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Daily note shortcut
app.get('/api/daily', async (req, res) => {
  try {
    const { noteOps } = await import('./database.js');
    const note = noteOps.createOrGetDaily();
    note.rendered_content = note.content;
    res.json({ success: true, data: note });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// All notes summary
app.get('/api/stats', async (req, res) => {
  try {
    const { todoOps, noteOps } = await import('./database.js');
    
    const todos = todoOps.getAll();
    const notes = noteOps.getAll();
    
    const stats = {
      todos: {
        total: todos.length,
        pending: todos.filter(t => t.status === 'pending').length,
        in_progress: todos.filter(t => t.status === 'in_progress').length,
        completed: todos.filter(t => t.status === 'completed').length,
        overdue: todos.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'completed').length
      },
      notes: {
        total: notes.length,
        daily: notes.filter(n => n.note_type === 'daily').length,
        project: notes.filter(n => n.note_type === 'project').length,
        general: notes.filter(n => n.note_type === 'general').length
      }
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start reminder cron job
const reminderService = new ReminderService();

// Run every minute to check for due reminders
cron.schedule('* * * * *', async () => {
  try {
    const results = await reminderService.checkDueReminders();
    if (results.length > 0) {
      console.log(`[CRON] Sent ${results.length} reminders`);
    }
  } catch (error) {
    console.error('[CRON] Error checking reminders:', error);
  }
});

console.log('[CRON] Reminder checker scheduled (every minute)');

// Serve SPA for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🧠 PKMS - 个人知识管理系统                                  ║
║                                                              ║
║   Server running at: http://localhost:${PORT}                   ║
║   Local:         http://0.0.0.0:${PORT}                         ║
║                                                              ║
║   API Endpoints:                                             ║
║   • GET  /api/health    - Health check                       ║
║   • GET  /api/todos     - List all todos                     ║
║   • POST /api/todos     - Create todo                        ║
║   • GET  /api/notes     - List all notes                     ║
║   • POST /api/notes     - Create note                        ║
║   • GET  /api/daily     - Get/create daily note              ║
║   • GET  /api/stats     - Dashboard statistics               ║
║                                                              ║
║   Cron reminders: Running every minute                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
