import fs from 'node:fs';
for (const file of ['.env.local', '.env']) if (fs.existsSync(file)) process.loadEnvFile(file);
