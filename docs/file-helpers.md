# File Helpers

Utilities for reading, writing, parsing JSON and text files, and resolving file paths in your Playwright tests.

## Table of Contents

- [Installation](#installation)
- [Reading Files](#reading-files)
  - [Read Text Files](#read-text-files)
  - [Read JSON Files](#read-json-files)
- [Writing Files](#writing-files)
  - [Write Text Files](#write-text-files)
  - [Write JSON Files](#write-json-files)
- [File System Operations](#file-system-operations)
  - [Check File/Directory Existence](#check-filedirectory-existence)
  - [Create Directories](#create-directories)
  - [Delete Files](#delete-files)
  - [Copy Files](#copy-files)
  - [List Files](#list-files)
- [Path Resolution](#path-resolution)
  - [Resolve Paths](#resolve-paths)
  - [Path Manipulation](#path-manipulation)
- [Use Cases](#use-cases)
- [API Reference](#api-reference)

## Installation

The file helpers are included in the utilities package:

```typescript
import {
  readTextFile,
  readJsonFile,
  writeTextFile,
  writeJsonFile,
  fileExists,
  resolveFromRoot,
  // ... other helpers
} from './utils';
```

## Reading Files

### Read Text Files

Read text files synchronously or asynchronously:

```typescript
import { readTextFile, readTextFileAsync } from './utils';

// Synchronous read
const content = readTextFile('./data/sample.txt');
console.log(content);

// Asynchronous read
const contentAsync = await readTextFileAsync('./data/sample.txt');
console.log(contentAsync);

// Specify encoding
const utf16Content = readTextFile('./data/sample.txt', 'utf16le');
```

### Read JSON Files

Read and parse JSON files with type safety:

```typescript
import { readJsonFile, readJsonFileAsync } from './utils';

// Define your data type
interface UserData {
  name: string;
  email: string;
  age: number;
}

// Synchronous read with type
const userData = readJsonFile<UserData>('./data/user.json');
console.log(userData.name);

// Asynchronous read with type
const userDataAsync = await readJsonFileAsync<UserData>('./data/user.json');
console.log(userDataAsync.email);

// Read configuration
interface Config {
  apiUrl: string;
  timeout: number;
}

const config = readJsonFile<Config>('./config/test-config.json');
```

## Writing Files

### Write Text Files

Write text content to files:

```typescript
import { writeTextFile, writeTextFileAsync } from './utils';

// Synchronous write
writeTextFile('./output/report.txt', 'Test completed successfully');

// Asynchronous write
await writeTextFileAsync('./output/log.txt', 'Log entry: Test started');

// Write with specific encoding
writeTextFile('./output/data.txt', 'Content', 'utf16le');

// Automatically creates parent directories if they don't exist
writeTextFile('./output/nested/deep/file.txt', 'Content');
```

### Write JSON Files

Write objects as JSON files:

```typescript
import { writeJsonFile, writeJsonFileAsync } from './utils';

const testResults = {
  passed: 10,
  failed: 2,
  duration: 45000,
};

// Synchronous write (pretty formatted by default)
writeJsonFile('./output/results.json', testResults);

// Asynchronous write
await writeJsonFileAsync('./output/results.json', testResults);

// Write compact JSON (no formatting)
writeJsonFile('./output/results.json', testResults, false);

// Write with specific encoding
writeJsonFile('./output/results.json', testResults, true, 'utf8');
```

## File System Operations

### Check File/Directory Existence

Check if files or directories exist:

```typescript
import { fileExists, directoryExists } from './utils';

// Check if file exists
if (fileExists('./data/config.json')) {
  console.log('Config file found');
}

// Check if directory exists
if (directoryExists('./output')) {
  console.log('Output directory exists');
}

// Use in conditional logic
const configPath = './config/test.json';
const config = fileExists(configPath)
  ? readJsonFile(configPath)
  : getDefaultConfig();
```

### Create Directories

Create directories with automatic parent directory creation:

```typescript
import { createDirectory, createDirectoryAsync } from './utils';

// Synchronous directory creation
createDirectory('./output/screenshots');

// Asynchronous directory creation
await createDirectoryAsync('./output/reports/allure');

// Creates all parent directories automatically
createDirectory('./output/nested/deep/structure');
```

### Delete Files

Delete files safely:

```typescript
import { deleteFile, deleteFileAsync } from './utils';

// Synchronous delete
deleteFile('./temp/old-report.json');

// Asynchronous delete
await deleteFileAsync('./temp/cache.txt');

// Safe deletion (no error if file doesn't exist)
if (fileExists('./temp/file.txt')) {
  deleteFile('./temp/file.txt');
}
```

### Copy Files

Copy files with automatic directory creation:

```typescript
import { copyFile, copyFileAsync } from './utils';

// Synchronous copy
copyFile('./templates/report.html', './output/report.html');

// Asynchronous copy
await copyFileAsync('./data/backup.json', './archive/backup-2024.json');

// Automatically creates destination directories
copyFile('./source/file.txt', './dest/nested/deep/file.txt');
```

### List Files

List files in a directory:

```typescript
import { listFiles } from './utils';

// List files in directory (non-recursive)
const files = listFiles('./data');
console.log(files); // ['./data/file1.txt', './data/file2.json']

// List files recursively
const allFiles = listFiles('./src', true);
console.log(allFiles); // All files in src and subdirectories

// Filter by extension
const jsonFiles = listFiles('./data').filter(f => f.endsWith('.json'));
```

## Path Resolution

### Resolve Paths

Resolve paths relative to different locations:

```typescript
import { resolveFromRoot, resolvePath } from './utils';

// Resolve from project root
const configPath = resolveFromRoot('config', 'test.json');
// Returns: /absolute/path/to/project/config/test.json

// Resolve from specific base directory
const dataPath = resolvePath('./data', 'users', 'user1.json');
// Returns: /absolute/path/to/data/users/user1.json

// Use in file operations
const content = readJsonFile(resolveFromRoot('data', 'config.json'));
```

### Path Manipulation

Manipulate and analyze file paths:

```typescript
import {
  getDirectory,
  getFileName,
  getFileExtension,
  joinPaths,
  normalizePath,
  getRelativePath,
} from './utils';

const filePath = '/project/src/tests/login.spec.ts';

// Get directory
const dir = getDirectory(filePath);
// Returns: '/project/src/tests'

// Get file name
const fileName = getFileName(filePath);
// Returns: 'login.spec.ts'

const fileNameNoExt = getFileName(filePath, false);
// Returns: 'login.spec'

// Get extension
const ext = getFileExtension(filePath);
// Returns: '.ts'

// Join paths
const joined = joinPaths('src', 'tests', 'login.spec.ts');
// Returns: 'src/tests/login.spec.ts' (OS-specific separators)

// Normalize path
const normalized = normalizePath('./src/../tests/./login.spec.ts');
// Returns: 'tests/login.spec.ts'

// Get relative path
const relative = getRelativePath('/project/src', '/project/tests/login.spec.ts');
// Returns: '../tests/login.spec.ts'
```

## Use Cases

### Test Data Management

```typescript
import { readJsonFile, writeJsonFile, resolveFromRoot } from './utils';

test('Load test data from JSON', async ({ page }) => {
  // Load test data
  interface TestUser {
    username: string;
    password: string;
  }
  
  const testData = readJsonFile<TestUser>(
    resolveFromRoot('test-data', 'users.json')
  );
  
  // Use in test
  await page.fill('#username', testData.username);
  await page.fill('#password', testData.password);
});
```

### Configuration Management

```typescript
import { readJsonFile, fileExists, resolveFromRoot } from './utils';

interface TestConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

function loadConfig(env: string): TestConfig {
  const configPath = resolveFromRoot('config', `${env}.json`);
  
  if (!fileExists(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  
  return readJsonFile<TestConfig>(configPath);
}

const config = loadConfig('staging');
```

### Test Results Export

```typescript
import { writeJsonFile, createDirectory, resolveFromRoot } from './utils';

test.afterAll(async () => {
  const results = {
    totalTests: 50,
    passed: 45,
    failed: 5,
    timestamp: new Date().toISOString(),
  };
  
  // Ensure output directory exists
  const outputDir = resolveFromRoot('test-results');
  createDirectory(outputDir);
  
  // Write results
  writeJsonFile(
    resolveFromRoot('test-results', 'summary.json'),
    results
  );
});
```

### Dynamic Test Generation

```typescript
import { readJsonFile, listFiles, resolveFromRoot } from './utils';

// Read test scenarios from JSON files
const scenarioFiles = listFiles(resolveFromRoot('scenarios'), false)
  .filter(f => f.endsWith('.json'));

for (const scenarioFile of scenarioFiles) {
  const scenario = readJsonFile(scenarioFile);
  
  test(`Scenario: ${scenario.name}`, async ({ page }) => {
    // Execute test based on scenario data
    await page.goto(scenario.url);
    // ... rest of test
  });
}
```

### File Backup and Archiving

```typescript
import { copyFile, getFileName, resolveFromRoot } from './utils';

test('Backup test artifacts', async () => {
  const sourceFile = resolveFromRoot('output', 'report.html');
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const fileName = getFileName(sourceFile, false);
  const ext = getFileExtension(sourceFile);
  
  const backupFile = resolveFromRoot(
    'archive',
    `${fileName}-${timestamp}${ext}`
  );
  
  copyFile(sourceFile, backupFile);
});
```

### Environment-Specific Data

```typescript
import { readTextFile, resolveFromRoot } from './utils';

function getApiKey(environment: string): string {
  const envFile = resolveFromRoot('env', `.env.${environment}`);
  const content = readTextFile(envFile);
  
  // Parse .env file
  const match = content.match(/API_KEY=(.+)/);
  return match ? match[1].trim() : '';
}

const apiKey = getApiKey('production');
```

### Log File Management

```typescript
import { writeTextFile, readTextFile, fileExists, resolveFromRoot } from './utils';

class TestLogger {
  private logPath: string;
  
  constructor(testName: string) {
    this.logPath = resolveFromRoot('logs', `${testName}.log`);
  }
  
  log(message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}\n`;
    
    // Append to existing log or create new
    const existing = fileExists(this.logPath) 
      ? readTextFile(this.logPath) 
      : '';
    
    writeTextFile(this.logPath, existing + entry);
  }
}

const logger = new TestLogger('login-test');
logger.log('Test started');
```

## API Reference

### Reading Functions

#### `readTextFile(filePath: string, encoding?: BufferEncoding): string`
Read a text file synchronously.

#### `readTextFileAsync(filePath: string, encoding?: BufferEncoding): Promise<string>`
Read a text file asynchronously.

#### `readJsonFile<T>(filePath: string, encoding?: BufferEncoding): T`
Read and parse a JSON file synchronously with type safety.

#### `readJsonFileAsync<T>(filePath: string, encoding?: BufferEncoding): Promise<T>`
Read and parse a JSON file asynchronously with type safety.

### Writing Functions

#### `writeTextFile(filePath: string, content: string, encoding?: BufferEncoding): void`
Write text content to a file synchronously.

#### `writeTextFileAsync(filePath: string, content: string, encoding?: BufferEncoding): Promise<void>`
Write text content to a file asynchronously.

#### `writeJsonFile(filePath: string, data: any, pretty?: boolean, encoding?: BufferEncoding): void`
Write JSON object to a file synchronously.

#### `writeJsonFileAsync(filePath: string, data: any, pretty?: boolean, encoding?: BufferEncoding): Promise<void>`
Write JSON object to a file asynchronously.

### File System Functions

#### `fileExists(filePath: string): boolean`
Check if a file exists.

#### `directoryExists(dirPath: string): boolean`
Check if a directory exists.

#### `createDirectory(dirPath: string): void`
Create a directory synchronously (with parent directories).

#### `createDirectoryAsync(dirPath: string): Promise<void>`
Create a directory asynchronously (with parent directories).

#### `deleteFile(filePath: string): void`
Delete a file synchronously.

#### `deleteFileAsync(filePath: string): Promise<void>`
Delete a file asynchronously.

#### `copyFile(sourcePath: string, destPath: string): void`
Copy a file synchronously.

#### `copyFileAsync(sourcePath: string, destPath: string): Promise<void>`
Copy a file asynchronously.

#### `listFiles(dirPath: string, recursive?: boolean): string[]`
List files in a directory.

### Path Functions

#### `resolveFromRoot(...relativePath: string[]): string`
Resolve a path relative to the project root.

#### `resolvePath(basePath: string, ...relativePath: string[]): string`
Resolve a path relative to a base directory.

#### `getDirectory(filePath: string): string`
Get the directory name from a file path.

#### `getFileName(filePath: string, includeExtension?: boolean): string`
Get the file name from a path.

#### `getFileExtension(filePath: string): string`
Get the file extension from a path.

#### `joinPaths(...segments: string[]): string`
Join path segments into a normalized path.

#### `normalizePath(filePath: string): string`
Normalize a path (resolve '..' and '.' segments).

#### `getRelativePath(from: string, to: string): string`
Get relative path from one location to another.

## Best Practices

1. **Use Type Safety**: Always specify types when reading JSON files
2. **Handle Errors**: Wrap file operations in try-catch blocks for better error handling
3. **Use Async When Possible**: Prefer async functions in test contexts
4. **Resolve Paths**: Use `resolveFromRoot()` for consistent path resolution
5. **Check Existence**: Use `fileExists()` before reading to avoid errors
6. **Create Directories**: Use `createDirectory()` before writing to ensure paths exist
7. **Use Path Helpers**: Use path manipulation functions instead of string concatenation

## Error Handling

All file helper functions throw descriptive errors:

```typescript
import { readJsonFile } from './utils';

try {
  const data = readJsonFile('./missing-file.json');
} catch (error) {
  console.error('Failed to read file:', error.message);
  // Error message includes the file path and reason
}
```

## Platform Compatibility

All path operations use Node.js `path` module for cross-platform compatibility:
- Works on Windows, macOS, and Linux
- Handles platform-specific path separators automatically
- Normalizes paths for consistent behavior
