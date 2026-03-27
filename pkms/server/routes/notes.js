// Notes Routes
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { noteOps } from '../database.js';
import ContentAnalyzer from '../services/analyzer.js';
import { marked } from 'marked';

const router = Router();

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true
});

// Get all notes
router.get('/', (req, res) => {
  try {
    const { type, tag } = req.query;
    let notes = noteOps.getAll();
    
    if (type) {
      notes = notes.filter(n => n.note_type === type);
    }
    if (tag) {
      notes = notes.filter(n => n.tags.includes(tag));
    }
    
    // Don't return full content in list view
    const lightNotes = notes.map(n => ({
      id: n.id,
      title: n.title,
      note_type: n.note_type,
      tags: n.tags,
      summary: n.summary || ContentAnalyzer.generateSummary(n.raw_content || n.content),
      created_at: n.created_at,
      updated_at: n.updated_at
    }));
    
    res.json({ success: true, data: lightNotes });
  } catch (error) {
    console.error('Error getting notes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get daily note (creates if not exists)
router.get('/daily', (req, res) => {
  try {
    const note = noteOps.createOrGetDaily();
    res.json({ success: true, data: note });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search notes
router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      return res.json({ success: true, data: [] });
    }
    
    const notes = noteOps.search(q.trim());
    res.json({ success: true, data: notes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single note
router.get('/:id', (req, res) => {
  try {
    const note = noteOps.getById(req.params.id);
    
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }
    
    // Render markdown content
    note.rendered_content = marked.parse(note.raw_content || note.content);
    
    // Get linked notes info
    if (note.linked_notes && note.linked_notes.length > 0) {
      note.linked_notes_info = note.linked_notes.map(title => {
        const allNotes = noteOps.getAll();
        const linked = allNotes.find(n => n.title === title);
        return linked ? { id: linked.id, title: linked.title } : { title };
      });
    }
    
    res.json({ success: true, data: note });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create note
router.post('/', (req, res) => {
  try {
    const { title, content, raw_content, tags, note_type, linked_notes } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    
    const noteContent = raw_content || content || '';
    
    // Analyze content
    const analysis = ContentAnalyzer.analyze(noteContent, tags || []);
    
    const note = {
      id: uuidv4(),
      title: title.trim(),
      content: marked.parse(noteContent),
      raw_content: noteContent,
      tags: tags || analysis.tags,
      note_type: note_type || 'general',
      linked_notes: linked_notes || analysis.linkedNotes
    };
    
    const created = noteOps.create(note);
    created.rendered_content = created.content;
    
    res.status(201).json({ success: true, data: created, analysis });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update note
router.put('/:id', (req, res) => {
  try {
    const note = noteOps.getById(req.params.id);
    
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }
    
    const { title, content, raw_content, tags, note_type, linked_notes } = req.body;
    
    const noteContent = raw_content !== undefined ? raw_content : (content || note.raw_content);
    
    // Re-analyze content if changed
    let analysis = null;
    if (noteContent !== note.raw_content) {
      analysis = ContentAnalyzer.analyze(noteContent, tags || note.tags);
    }
    
    noteOps.update(req.params.id, {
      title,
      content: marked.parse(noteContent),
      raw_content: noteContent,
      tags: tags || (analysis ? analysis.tags : note.tags),
      note_type,
      linked_notes: linked_notes !== undefined ? linked_notes : (analysis ? analysis.linkedNotes : note.linked_notes)
    });
    
    const updated = noteOps.getById(req.params.id);
    updated.rendered_content = updated.content;
    
    res.json({ success: true, data: updated, analysis });
  } catch (error) {
    console.status(500).json({ success: false, error: error.message });
  }
});

// Delete note
router.delete('/:id', (req, res) => {
  try {
    const note = noteOps.getById(req.params.id);
    
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }
    
    noteOps.delete(req.params.id);
    res.json({ success: true, message: 'Note deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get notes by type
router.get('/type/:type', (req, res) => {
  try {
    const notes = noteOps.getByType(req.params.type);
    res.json({ success: true, data: notes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
