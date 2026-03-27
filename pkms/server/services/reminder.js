// Reminder Service
// Handles sending reminders via Slack or other channels

import { todoOps, reminderOps } from '../database.js';
import { v4 as uuidv4 } from 'uuid';

class ReminderService {
  constructor() {
    this.slackWebhook = process.env.SLACK_WEBHOOK_URL || null;
  }

  // Send a notification (Slack or console)
  async sendNotification(title, message, priority = 'medium') {
    const notification = {
      title,
      message,
      priority,
      timestamp: new Date().toISOString()
    };

    if (this.slackWebhook) {
      await this.sendSlack(notification);
    } else {
      // Console output for development
      console.log(`[REMINDER] ${title}: ${message}`);
    }

    return notification;
  }

  // Send Slack notification
  async sendSlack(notification) {
    try {
      const priorityEmoji = {
        low: '📋',
        medium: '📌',
        high: '🔥',
        urgent: '🚨'
      };

      const emoji = priorityEmoji[notification.priority] || '📌';

      const payload = {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${emoji} 提醒: ${notification.title}`,
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: notification.message
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `⏰ ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
              }
            ]
          }
        ]
      };

      const response = await fetch(this.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
      return false;
    }
  }

  // Check and send due reminders
  async checkDueReminders() {
    // Get todos due in the next 5 minutes
    const dueTodos = todoOps.getDueReminders(5);
    const results = [];

    for (const todo of dueTodos) {
      // Check if we already sent a reminder recently
      if (reminderOps.wasSentRecently(todo.id)) {
        continue;
      }

      // Send reminder
      const deadline = todo.deadline ? new Date(todo.deadline).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未设置';
      
      const message = `
*任务*: ${todo.title}
*描述*: ${todo.description || '无'}
*截止时间*: ${deadline}
*优先级*: ${this.getPriorityText(todo.priority)}
${todo.tags.length > 0 ? `*标签*: ${todo.tags.join(', ')}` : ''}
      `.trim();

      const sent = await this.sendNotification(
        todo.title,
        message,
        todo.priority
      );

      if (sent) {
        // Log the reminder
        reminderOps.log(todo.id, todo.reminder_time);
        results.push({ todo, sent: true });
      } else {
        results.push({ todo, sent: false });
      }
    }

    return results;
  }

  // Get Chinese priority text
  getPriorityText(priority) {
    const map = {
      low: '🟢 低',
      medium: '🟡 中',
      high: '🟠 高',
      urgent: '🔴 紧急'
    };
    return map[priority] || '🟡 中';
  }

  // Set a reminder for a specific time
  async setReminder(todoId, reminderTime) {
    const todo = todoOps.getById(todoId);
    if (!todo) {
      throw new Error('Todo not found');
    }

    // Update the todo's reminder_time
    todoOps.update(todoId, { reminder_time: reminderTime });

    // Calculate time until reminder
    const now = new Date();
    const reminder = new Date(reminderTime);
    const msUntil = reminder.getTime() - now.getTime();

    if (msUntil > 0 && msUntil < 24 * 60 * 60 * 1000) {
      // Only notify if reminder is within 24 hours
      await this.sendNotification(
        '⏰ 提醒已设置',
        `任务 "${todo.title}" 的提醒已设置为 ${reminder.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
        'low'
      );
    }

    return { success: true, reminder_time: reminderTime };
  }
}

export default ReminderService;
export { ReminderService };
