// Todo Routes
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { todoOps } from '../database.js';
import ContentAnalyzer from '../services/analyzer.js';
import ReminderService from '../services/reminder.js';

const router = Router();
const reminderService = new ReminderService();

// Get all todos
router.get('/', (req, res) => {
  try {
    const { status, priority, tag } = req.query;
    let todos = todoOps.getAll();
    
    if (status) {
      todos = todos.filter(t => t.status === status);
    }
    if (priority) {
      todos = todos.filter(t => t.priority === priority);
    }
    if (tag) {
      todos = todos.filter(t => t.tags.includes(tag));
    }
    
    res.json({ success: true, data: todos });
  } catch (error) {
    console.error('Error getting todos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pending todos
router.get('/pending', (req, res) => {
  try {
    const todos = todoOps.getPending();
    res.json({ success: true, data: todos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get due reminders
router.get('/reminders/due', (req, res) => {
  try {
    const { minutes } = req.query;
    const todos = todoOps.getDueReminders(parseInt(minutes) || 5);
    res.json({ success: true, data: todos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single todo
router.get('/:id', (req, res) => {
  try {
    const todo = todoOps.getById(req.params.id);
    if (!todo) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }
    res.json({ success: true, data: todo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create todo
router.post('/', async (req, res) => {
  try {
    const { title, description, deadline, reminder_time, priority, tags } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    
    const todo = {
      id: uuidv4(),
      title: title.trim(),
      description: description || '',
      deadline: deadline || null,
      reminder_time: reminder_time || null,
      status: 'pending',
      priority: priority || 'medium',
      tags: tags || []
    };
    
    // Auto-analyze content for tags and deadline
    const analysis = ContentAnalyzer.analyzeTodo(todo.description);
    if (!todo.priority && analysis.priority !== 'medium') {
      todo.priority = analysis.priority;
    }
    if (!todo.deadline && analysis.deadline) {
      todo.deadline = analysis.deadline;
    }
    
    const created = todoOps.create(todo);
    
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update todo
router.put('/:id', (req, res) => {
  try {
    const todo = todoOps.getById(req.params.id);
    if (!todo) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }
    
    const { title, description, deadline, reminder_time, status, priority, tags } = req.body;
    
    todoOps.update(req.params.id, {
      title,
      description,
      deadline,
      reminder_time,
      status,
      priority,
      tags
    });
    
    const updated = todoOps.getById(req.params.id);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Complete todo
router.post('/:id/complete', (req, res) => {
  try {
    const todo = todoOps.getById(req.params.id);
    if (!todo) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }
    
    todoOps.complete(req.params.id);
    const updated = todoOps.getById(req.params.id);
    
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete todo
router.delete('/:id', (req, res) => {
  try {
    const todo = todoOps.getById(req.params.id);
    if (!todo) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }
    
    todoOps.delete(req.params.id);
    res.json({ success: true, message: 'Todo deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set reminder for todo
router.post('/:id/reminder', async (req, res) => {
  try {
    const { reminder_time } = req.body;
    
    if (!reminder_time) {
      return res.status(400).json({ success: false, error: 'reminder_time is required' });
    }
    
    const result = await reminderService.setReminder(req.params.id, reminder_time);
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
