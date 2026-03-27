#!/usr/bin/env node
// Reminder Cron Script
// Runs every minute to check for due reminders
// Can be called directly or via system cron

import ReminderService from '../server/services/reminder.js';

async function main() {
  console.log(`[${new Date().toISOString()}] Checking for due reminders...`);
  
  const reminderService = new ReminderService();
  
  try {
    const results = await reminderService.checkDueReminders();
    
    if (results.length > 0) {
      console.log(`[${new Date().toISOString()}] Sent ${results.length} reminders:`);
      results.forEach(r => {
        console.log(`  - ${r.todo.title} (${r.sent ? 'sent' : 'failed'})`);
      });
    } else {
      console.log(`[${new Date().toISOString()}] No reminders due`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error checking reminders:`, error);
    process.exit(1);
  }
}

main();
