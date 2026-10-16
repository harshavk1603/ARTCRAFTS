import { spawn } from 'node:child_process';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const children = [
  spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit', env: process.env }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { stdio: 'inherit', env: process.env }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill();
  setTimeout(() => process.exit(code), 100).unref();
}
for (const child of children) {
  child.on('error', error => { console.error(error); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 0); });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0));
