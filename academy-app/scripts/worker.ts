import { processCourseWordJob } from '../lib/course-bot';
import { processVocabularyJob } from '../lib/vocabulary-ai';
import '../lib/env';
import { ensureSeed } from '../lib/seed';
import { cleanExpired, processAIJob, queueReminders, sendNotifications } from '../lib/worker';
import { setTimeout as delay } from 'node:timers/promises';
ensureSeed();
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
console.log('HangangAcademy worker ishga tushdi.');
async function runAI() {
  while (!stopping) {
    try {
      await processAIJob();
      if (!stopping) await processVocabularyJob();
      if (!stopping) await processCourseWordJob();
    } catch {
      console.error('AI navbatini tekshirishda xatolik.');
    }
    await delay(4000);
  }
}
async function runMessages() {
  while (!stopping) {
    try {
      cleanExpired();
      queueReminders();
      await sendNotifications();
    } catch {
      console.error('Eslatmalarni tekshirishda xatolik.');
    }
    for (let i = 0; i < 1 && !stopping; i++) await delay(5000);
  }
}
Promise.all([runAI(), runMessages()]).catch(() => {
  process.exitCode = 1;
});
