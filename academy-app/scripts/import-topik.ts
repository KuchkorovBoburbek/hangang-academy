import '../lib/env';
import { importTopikSolutions } from '../lib/topik-solutions';
import { importTopikFiles } from '../lib/topik';

try {
  const result = { ...importTopikFiles(process.argv[2]), solutions: importTopikSolutions() };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
