// Slack incoming message handler - creates todo or note from Slack messages
import { Router } from 'express';
import { todoOps, noteOps } from '../database.js';

const router = Router();

// Parse Slack message: "TODO: xxx by YYYY-MM-DD" or "NOTE: xxx" or plain text
function parseMessage(text) {
  const trimmed = text.trim();
  
  // TODO pattern: "TODO: task content by YYYY-MM-DD" or "TODO: task content"
  const todoMatch = trimmed.match(/^TODO[:：]\s*(.+)/i);
  if (todoMatch) {
    const content = todoMatch[1];
    const deadlineMatch = content.match(/(?:by|截止|deadline)[:：]?\s*(\d{4}[-\/]\d{2}[-\/]\d{2})/i);
    const deadline = deadlineMatch ? deadlineMatch[1].replace(/\//g, '-') : null;
    const title = deadline ? content.replace(/(?:by|截止|deadline)[:：]?\s*\d{4}[-\/]\d{2}[-\/]\d{2}/i, '').trim() : content;
    
    return {
      type: 'todo',
      title: title.trim(),
      deadline,
      tags: ['slack']
    };
  }
  
  // NOTE pattern
  const noteMatch = trimmed.match(/^NOTE[:：]\s*(.+)/i);
  if (noteMatch) {
    return {
      type: 'note',
      title: noteMatch[1].trim(),
      content: noteMatch[1].trim()
    };
  }
  
  // Plain text → create note with AI analysis
  return {
    type: 'note',
    title: trimmed.slice(0, 100),
    content: trimmed
  };
}

// POST /api/slack/incoming - receive Slack DM, create todo or note
router.post('/incoming', async (req, res) => {
  try {
    const { user_id, text, command } = req.body;
    
    // Handle Slack command (slash command)
    if (command) {
      const parsed = parseMessage(text || '');
      
      if (parsed.type === 'todo') {
        const todo = todoOps.create({
          title: parsed.title,
          deadline: parsed.deadline,
          tags: parsed.tags,
          priority: 'medium',
          status: 'pending'
        });
        
        return res.json({
          response_type: 'ephemeral',
          text: `✅ Todo 创建成功！\n📝 ${parsed.title}${parsed.deadline ? `\n⏰ 截止: ${parsed.deadline}` : ''}`
        });
      } else {
        const note = noteOps.create({
          title: parsed.title,
          content: parsed.content,
          tags: ['slack']
        });
        
        return res.json({
          response_type: 'ephemeral',
          text: `📝 笔记创建成功！\n📌 ${parsed.title}`
        });
      }
    }
    
    // Handle direct message webhook
    if (user_id && text) {
      const parsed = parseMessage(text);
      
      if (parsed.type === 'todo') {
        const todo = todoOps.create({
          title: parsed.title,
          deadline: parsed.deadline,
          tags: parsed.tags,
          priority: 'medium',
          status: 'pending'
        });
        
        return res.json({ success: true, type: 'todo', data: todo });
      } else {
        const note = noteOps.create({
          title: parsed.title,
          content: parsed.content,
          tags: ['slack', 'auto']
        });
        
        return res.json({ success: true, type: 'note', data: note });
      }
    }
    
    res.status(400).json({ error: 'Invalid request' });
  } catch (err) {
    console.error('[Slack] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/slack/test - health check
router.get('/test', (req, res) => {
  res.json({ ok: true, service: 'slack-incoming' });
});

export default router;
