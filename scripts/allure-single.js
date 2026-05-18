/**
 * Allure Single Report Generator
 *
 * Generates an Allure report from allure-results but EXCLUDES trace files,
 * videos, and large binary attachments from the HTML report.
 *
 * The allure-results directory still retains all trace files for debugging.
 * Only the generated HTML report is "clean" (no trace downloads).
 *
 * Usage: node scripts/allure-single.js
 * Or:    npm run report:allure:generate:single
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ALLURE_RESULTS = path.resolve('allure-results');
const ALLURE_REPORT = path.resolve('reports', 'allure-single');
const TEMP_RESULTS = path.resolve('allure-results-single');

// File extensions to exclude from the single report (trace, video)
const EXCLUDED_EXTENSIONS = ['.zip', '.webm', '.mp4', '.avi', '.mov'];

// Attachment content types to strip from result JSON files
const EXCLUDED_CONTENT_TYPES = [
  'application/zip',           // trace files
  'video/webm',               // video recordings
  'video/mp4',
  'application/x-tar',
];

function main() {
  console.log('[allure-single] Generating clean Allure report (no trace/video attachments)...');

  if (!fs.existsSync(ALLURE_RESULTS)) {
    console.error('[allure-single] No allure-results directory found. Run tests first.');
    process.exit(1);
  }

  // Step 1: Copy allure-results to a temp directory (preserving originals)
  if (fs.existsSync(TEMP_RESULTS)) {
    fs.rmSync(TEMP_RESULTS, { recursive: true });
  }
  copyDir(ALLURE_RESULTS, TEMP_RESULTS);

  // Step 2: Remove trace/video binary files from the temp copy
  const removedFiles = [];
  const files = fs.readdirSync(TEMP_RESULTS);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (EXCLUDED_EXTENSIONS.includes(ext)) {
      fs.unlinkSync(path.join(TEMP_RESULTS, file));
      removedFiles.push(file);
    }
  }

  // Step 3: Strip trace/video attachment references from result JSON files
  const jsonFiles = fs.readdirSync(TEMP_RESULTS).filter(f => f.endsWith('-result.json'));
  for (const jsonFile of jsonFiles) {
    const filePath = path.join(TEMP_RESULTS, jsonFile);
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (content.attachments) {
        content.attachments = content.attachments.filter(att => {
          return !EXCLUDED_CONTENT_TYPES.includes(att.type) &&
                 !EXCLUDED_EXTENSIONS.includes(path.extname(att.source || '').toLowerCase());
        });
      }
      // Also strip from steps
      if (content.steps) {
        stripAttachmentsFromSteps(content.steps);
      }
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    } catch {
      // Skip malformed JSON
    }
  }

  console.log(`[allure-single] Removed ${removedFiles.length} trace/video file(s) from temp results`);

  // Step 4: Generate Allure report as a SINGLE HTML file from the cleaned temp directory
  try {
    execSync(`npx allure generate "${TEMP_RESULTS}" --single-file --clean -o "${ALLURE_REPORT}"`, {
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('[allure-single] Allure generation failed:', err.message);
    process.exit(1);
  }

  // Step 5: Clean up temp directory
  fs.rmSync(TEMP_RESULTS, { recursive: true });

  console.log(`[allure-single] ✅ Single-file report generated at: ${path.join(ALLURE_REPORT, 'index.html')}`);
  console.log('[allure-single] Original allure-results (with traces) preserved.');
  console.log('[allure-single] Share the single index.html file — no server needed to view it.');
}

function stripAttachmentsFromSteps(steps) {
  for (const step of steps) {
    if (step.attachments) {
      step.attachments = step.attachments.filter(att => {
        return !EXCLUDED_CONTENT_TYPES.includes(att.type) &&
               !EXCLUDED_EXTENSIONS.includes(path.extname(att.source || '').toLowerCase());
      });
    }
    if (step.steps) {
      stripAttachmentsFromSteps(step.steps);
    }
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

main();
