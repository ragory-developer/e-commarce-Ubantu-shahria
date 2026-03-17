const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.join(__dirname, '../prisma/modules');
const OUTPUT_FILE = path.join(__dirname, '../prisma/schema.prisma');

// IMPORTANT: Added url = env("DATABASE_URL") - this was missing!
const header = `
// ========================================
// AUTO-GENERATED FILE — DO NOT EDIT
// Run: npm run prisma:build
// ========================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`.trim();

if (! fs.existsSync(MODULES_DIR)) {
  fs.mkdirSync(MODULES_DIR, { recursive: true });
  console.log('Created prisma/modules directory');
}

const files = fs
  .readdirSync(MODULES_DIR)
  .filter(f => f.endsWith('.prisma'))
  .sort();

let output = header + '\n';

for (const file of files) {
  const content = fs.readFileSync(
    path.join(MODULES_DIR, file),
    'utf8'
  ).trim();

  output += `

// ========================================
// MODULE:  ${file.toUpperCase()}
// ========================================

${content}
`;
}

fs.writeFileSync(OUTPUT_FILE, output.trim() + '\n');
console.log('✅ prisma/schema.prisma generated');
