#!/usr/bin/env node
/**
 * Fix duplicate .mutation/.query patterns in routers.ts
 * 
 * The migration script created patterns like:
 *   .mutation(async ({ input }) => {
 *   
 *   .mutation(async ({ input, ctx }) => {
 * 
 * This needs to be collapsed to just:
 *   .mutation(async ({ input, ctx }) => {
 */

import fs from 'fs';

const filePath = '/home/ubuntu/whatsapp-automation-app/server/routers.ts';
let content = fs.readFileSync(filePath, 'utf-8');
let changes = 0;

// Pattern 1: .mutation(async ({ input }) => {\n\n      .mutation(async ({ input, ctx }) => {
content = content.replace(
  /\.mutation\(async \(\{ input \}\) => \{\s*\n\s*\.mutation\(async \(\{ input, ctx \}\) => \{/g,
  (match) => { changes++; return '.mutation(async ({ input, ctx }) => {'; }
);

// Pattern 2: .query(async ({ input }) => {\n\n      .query(async ({ input, ctx }) => {
content = content.replace(
  /\.query\(async \(\{ input \}\) => \{\s*\n\s*\.query\(async \(\{ input, ctx \}\) => \{/g,
  (match) => { changes++; return '.query(async ({ input, ctx }) => {'; }
);

// Pattern 3: .mutation(async ({ input }) => {\n\n\n\n\n      .mutation(async ({ input, ctx }) => {
content = content.replace(
  /\.mutation\(async \(\{ input \}\) => \{\s*\n+\s*\.mutation\(async \(\{ input, ctx \}\) => \{/g,
  (match) => { changes++; return '.mutation(async ({ input, ctx }) => {'; }
);

// Pattern 4: .query(async ({ input }) => {\n\n\n\n\n      .query(async ({ input, ctx }) => {
content = content.replace(
  /\.query\(async \(\{ input \}\) => \{\s*\n+\s*\.query\(async \(\{ input, ctx \}\) => \{/g,
  (match) => { changes++; return '.query(async ({ input, ctx }) => {'; }
);

// Also fix: .mutation(async () => {\n\n      .mutation(async ({ ctx }) => {
content = content.replace(
  /\.mutation\(async \(\) => \{\s*\n+\s*\.mutation\(async \(\{ ctx \}\) => \{/g,
  (match) => { changes++; return '.mutation(async ({ ctx }) => {'; }
);

// Also fix: .query(async () => {\n\n      .query(async ({ ctx }) => {
content = content.replace(
  /\.query\(async \(\) => \{\s*\n+\s*\.query\(async \(\{ ctx \}\) => \{/g,
  (match) => { changes++; return '.query(async ({ ctx }) => {'; }
);

// Also fix empty .input(z.object({ })) — remove them
content = content.replace(
  /\s*\.input\(z\.object\(\{\s*\}\)\)/g,
  (match) => { changes++; return ''; }
);

fs.writeFileSync(filePath, content);
console.log(`Fixed ${changes} duplicate patterns`);
