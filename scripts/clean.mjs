// Cross-platform clean (works in PowerShell, cmd and bash): removes build artifacts.
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const targets = [
  'shared/dist',
  'server/dist',
  'client/dist',
  'shared/tsconfig.tsbuildinfo',
  'server/tsconfig.tsbuildinfo',
  'client/node_modules/.tmp',
  'coverage',
];

for (const target of targets) {
  rmSync(resolve(target), { recursive: true, force: true });
  console.log(`removed ${target}`);
}
