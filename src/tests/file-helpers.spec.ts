import { test, expect } from '@playwright/test';
import {
  readTextFile,
  readTextFileAsync,
  readJsonFile,
  readJsonFileAsync,
  writeTextFile,
  writeTextFileAsync,
  writeJsonFile,
  writeJsonFileAsync,
  fileExists,
  directoryExists,
  resolveFromRoot,
  resolvePath,
  getDirectory,
  getFileName,
  getFileExtension,
  joinPaths,
  normalizePath,
  getRelativePath,
  createDirectory,
  createDirectoryAsync,
  deleteFile,
  deleteFileAsync,
  listFiles,
  copyFile,
  copyFileAsync,
} from '../main/utils';
import * as path from 'path';
import * as fs from 'fs';

test.describe('File Helpers', () => {
  const testDir = resolveFromRoot('test-output', 'file-helpers-test');

  test.beforeEach(() => {
    // Ensure test directory exists
    if (!fs.existsSync(testDir)) {
      createDirectory(testDir);
    }
  });

  test('should write and read text files synchronously', () => {
    const filePath = path.join(testDir, 'test.txt');
    const content = 'Hello, World!';

    writeTextFile(filePath, content);
    expect(fileExists(filePath)).toBe(true);

    const readContent = readTextFile(filePath);
    expect(readContent).toBe(content);
  });

  test('should write and read text files asynchronously', async () => {
    const filePath = path.join(testDir, 'test-async.txt');
    const content = 'Hello, Async World!';

    await writeTextFileAsync(filePath, content);
    expect(fileExists(filePath)).toBe(true);

    const readContent = await readTextFileAsync(filePath);
    expect(readContent).toBe(content);
  });

  test('should write and read JSON files synchronously', () => {
    const filePath = path.join(testDir, 'test.json');
    const data = { name: 'Alice', age: 30, active: true };

    writeJsonFile(filePath, data);
    expect(fileExists(filePath)).toBe(true);

    const readData = readJsonFile<typeof data>(filePath);
    expect(readData).toEqual(data);
  });

  test('should write and read JSON files asynchronously', async () => {
    const filePath = path.join(testDir, 'test-async.json');
    const data = { name: 'Bob', age: 25, active: false };

    await writeJsonFileAsync(filePath, data);
    expect(fileExists(filePath)).toBe(true);

    const readData = await readJsonFileAsync<typeof data>(filePath);
    expect(readData).toEqual(data);
  });

  test('should write JSON with pretty formatting', () => {
    const filePath = path.join(testDir, 'pretty.json');
    const data = { name: 'Charlie', items: [1, 2, 3] };

    writeJsonFile(filePath, data, true);
    const content = readTextFile(filePath);
    expect(content).toContain('\n');
    expect(content).toContain('  ');
  });

  test('should write JSON without formatting', () => {
    const filePath = path.join(testDir, 'compact.json');
    const data = { name: 'David', items: [1, 2, 3] };

    writeJsonFile(filePath, data, false);
    const content = readTextFile(filePath);
    expect(content).not.toContain('\n  ');
  });

  test('should check file existence', () => {
    const existingFile = path.join(testDir, 'existing.txt');
    const nonExistingFile = path.join(testDir, 'non-existing.txt');

    writeTextFile(existingFile, 'exists');
    expect(fileExists(existingFile)).toBe(true);
    expect(fileExists(nonExistingFile)).toBe(false);
  });

  test('should check directory existence', () => {
    const existingDir = path.join(testDir, 'existing-dir');
    const nonExistingDir = path.join(testDir, 'non-existing-dir');

    createDirectory(existingDir);
    expect(directoryExists(existingDir)).toBe(true);
    expect(directoryExists(nonExistingDir)).toBe(false);
  });

  test('should create nested directories', () => {
    const nestedDir = path.join(testDir, 'level1', 'level2', 'level3');
    createDirectory(nestedDir);
    expect(directoryExists(nestedDir)).toBe(true);
  });

  test('should create nested directories asynchronously', async () => {
    const nestedDir = path.join(testDir, 'async-level1', 'async-level2');
    await createDirectoryAsync(nestedDir);
    expect(directoryExists(nestedDir)).toBe(true);
  });

  test('should delete files', () => {
    const filePath = path.join(testDir, 'to-delete.txt');
    writeTextFile(filePath, 'delete me');
    expect(fileExists(filePath)).toBe(true);

    deleteFile(filePath);
    expect(fileExists(filePath)).toBe(false);
  });

  test('should delete files asynchronously', async () => {
    const filePath = path.join(testDir, 'to-delete-async.txt');
    writeTextFile(filePath, 'delete me async');
    expect(fileExists(filePath)).toBe(true);

    await deleteFileAsync(filePath);
    expect(fileExists(filePath)).toBe(false);
  });

  test('should copy files', () => {
    const sourcePath = path.join(testDir, 'source.txt');
    const destPath = path.join(testDir, 'destination.txt');

    writeTextFile(sourcePath, 'copy me');
    copyFile(sourcePath, destPath);

    expect(fileExists(destPath)).toBe(true);
    expect(readTextFile(destPath)).toBe('copy me');
  });

  test('should copy files asynchronously', async () => {
    const sourcePath = path.join(testDir, 'source-async.txt');
    const destPath = path.join(testDir, 'destination-async.txt');

    writeTextFile(sourcePath, 'copy me async');
    await copyFileAsync(sourcePath, destPath);

    expect(fileExists(destPath)).toBe(true);
    expect(readTextFile(destPath)).toBe('copy me async');
  });

  test('should list files in directory', () => {
    const listDir = path.join(testDir, 'list-test');
    createDirectory(listDir);

    writeTextFile(path.join(listDir, 'file1.txt'), 'content1');
    writeTextFile(path.join(listDir, 'file2.txt'), 'content2');
    writeTextFile(path.join(listDir, 'file3.json'), '{}');

    const files = listFiles(listDir);
    expect(files.length).toBe(3);
    expect(files.some((f) => f.endsWith('file1.txt'))).toBe(true);
    expect(files.some((f) => f.endsWith('file2.txt'))).toBe(true);
    expect(files.some((f) => f.endsWith('file3.json'))).toBe(true);
  });

  test('should list files recursively', () => {
    const listDir = path.join(testDir, 'recursive-test');
    const subDir = path.join(listDir, 'subdir');
    createDirectory(subDir);

    writeTextFile(path.join(listDir, 'root.txt'), 'root');
    writeTextFile(path.join(subDir, 'nested.txt'), 'nested');

    const files = listFiles(listDir, true);
    expect(files.length).toBe(2);
    expect(files.some((f) => f.endsWith('root.txt'))).toBe(true);
    expect(files.some((f) => f.endsWith('nested.txt'))).toBe(true);
  });

  test('should resolve paths from root', () => {
    const resolved = resolveFromRoot('test-data', 'users.json');
    expect(resolved).toContain('test-data');
    expect(resolved).toContain('users.json');
    expect(path.isAbsolute(resolved)).toBe(true);
  });

  test('should resolve paths from base', () => {
    const basePath = '/project/src';
    const resolved = resolvePath(basePath, 'tests', 'login.spec.ts');
    expect(resolved).toContain('tests');
    expect(resolved).toContain('login.spec.ts');
    expect(path.isAbsolute(resolved)).toBe(true);
  });

  test('should get directory from path', () => {
    const filePath = '/project/src/tests/login.spec.ts';
    const dir = getDirectory(filePath);
    expect(dir).toContain('tests');
    expect(dir).not.toContain('login.spec.ts');
  });

  test('should get file name with extension', () => {
    const filePath = '/project/src/tests/login.spec.ts';
    const fileName = getFileName(filePath);
    expect(fileName).toBe('login.spec.ts');
  });

  test('should get file name without extension', () => {
    const filePath = '/project/src/tests/login.spec.ts';
    const fileName = getFileName(filePath, false);
    expect(fileName).toBe('login.spec');
  });

  test('should get file extension', () => {
    expect(getFileExtension('/path/file.txt')).toBe('.txt');
    expect(getFileExtension('/path/file.json')).toBe('.json');
    expect(getFileExtension('/path/file.spec.ts')).toBe('.ts');
  });

  test('should join paths', () => {
    const joined = joinPaths('src', 'tests', 'login.spec.ts');
    expect(joined).toContain('src');
    expect(joined).toContain('tests');
    expect(joined).toContain('login.spec.ts');
  });

  test('should normalize paths', () => {
    const normalized = normalizePath('./src/../tests/./login.spec.ts');
    expect(normalized).not.toContain('..');
    expect(normalized).not.toContain('./');
  });

  test('should get relative path', () => {
    const from = '/project/src';
    const to = '/project/tests/login.spec.ts';
    const relative = getRelativePath(from, to);
    expect(relative).toContain('..');
    expect(relative).toContain('tests');
  });

  test('should handle errors gracefully', () => {
    expect(() => readTextFile('/non/existing/file.txt')).toThrow();
    expect(() => readJsonFile('/non/existing/file.json')).toThrow();
  });

  test('should create parent directories when writing', () => {
    const deepPath = path.join(testDir, 'deep', 'nested', 'path', 'file.txt');
    writeTextFile(deepPath, 'content');
    expect(fileExists(deepPath)).toBe(true);
  });
});
