import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const child = spawn('node_modules\\.bin\\tsx', ['server/src/index.ts'], {
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ZEPHYR_MIGRATION_PROMPT: 'never' }
});

let out = '';
let err = '';
child.stdout.on('data', d => { out += d.toString(); });
child.stderr.on('data', d => { err += d.toString(); });

setTimeout(() => child.kill(), 8000);

child.on('close', (code) => {
  const combined = `=== STDOUT ===\n${out}\n=== STDERR ===\n${err}\n=== EXIT: ${code} ===`;
  writeFileSync('error-capture.txt', combined, 'utf8');
  console.log(combined.slice(0, 3000));
});
