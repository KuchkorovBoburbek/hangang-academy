import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'hangang-http-'));
export default defineConfig({
  testDir: './tests/http',
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    baseURL: 'http://localhost:3100',
    extraHTTPHeaders: { Origin: 'http://localhost:3100' },
  },
  webServer: {
    command:
      'node --import tsx scripts/import-topik.ts && node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100',
    url: 'http://localhost:3100/api/health',
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      NODE_ENV: 'production',
      DATA_DIR: data,
      APP_URL: 'http://localhost:3100',
      DEMO_MODE: 'false',
      ADMIN_EMAIL: 'qa-teacher@hangang.local',
      ADMIN_PASSWORD: 'Local-QA-Teacher-Only-2026!',
      OPENAI_API_KEY: '',
      AI_PROVIDER: 'openrouter',
      OPENROUTER_API_KEY: '',
      TELEGRAM_BOT_TOKEN: '',
    },
  },
});
