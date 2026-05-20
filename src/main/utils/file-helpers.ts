import * as fs from 'fs';
import * as path from 'path';

/**
 * File Helpers - Utilities for reading, parsing, and resolving file paths
 */

/**
 * Read a text file synchronously
 * @param filePath - Path to the text file
 * @param encoding - File encoding (default: 'utf-8')
 * @returns File content as string
 * @throws Error if file cannot be read
 */
export function readTextFile(filePath: string, encoding: BufferEncoding = 'utf-8'): string {
  try {
    const resolvedPath = path.resolve(filePath);
    return fs.readFileSync(resolvedPath, encoding);
  } catch (error) {
    throw new Error(`Failed to read text file at ${filePath}: ${error}`);
  }
}

/**
 * Read a text file asynchronously
 * @param filePath - Path to the text file
 * @param encoding - File encoding (default: 'utf-8')
 * @returns Promise resolving to file content as string
 * @throws Error if file cannot be read
 */
export async function readTextFileAsync(
  filePath: string,
  encoding: BufferEncoding = 'utf-8'
): Promise<string> {
  try {
    const resolvedPath = path.resolve(filePath);
    return await fs.promises.readFile(resolvedPath, encoding);
  } catch (error) {
    throw new Error(`Failed to read text file at ${filePath}: ${error}`);
  }
}

/**
 * Read and parse a JSON file synchronously
 * @param filePath - Path to the JSON file
 * @param encoding - File encoding (default: 'utf-8')
 * @returns Parsed JSON object
 * @throws Error if file cannot be read or parsed
 */
export function readJsonFile<T = any>(filePath: string, encoding: BufferEncoding = 'utf-8'): T {
  try {
    const content = readTextFile(filePath, encoding);
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(`Failed to read or parse JSON file at ${filePath}: ${error}`);
  }
}

/**
 * Read and parse a JSON file asynchronously
 * @param filePath - Path to the JSON file
 * @param encoding - File encoding (default: 'utf-8')
 * @returns Promise resolving to parsed JSON object
 * @throws Error if file cannot be read or parsed
 */
export async function readJsonFileAsync<T = any>(
  filePath: string,
  encoding: BufferEncoding = 'utf-8'
): Promise<T> {
  try {
    const content = await readTextFileAsync(filePath, encoding);
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(`Failed to read or parse JSON file at ${filePath}: ${error}`);
  }
}

/**
 * Write text content to a file synchronously
 * @param filePath - Path to the file
 * @param content - Content to write
 * @param encoding - File encoding (default: 'utf-8')
 * @throws Error if file cannot be written
 */
export function writeTextFile(
  filePath: string,
  content: string,
  encoding: BufferEncoding = 'utf-8'
): void {
  try {
    const resolvedPath = path.resolve(filePath);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolvedPath, content, encoding);
  } catch (error) {
    throw new Error(`Failed to write text file at ${filePath}: ${error}`);
  }
}

/**
 * Write text content to a file asynchronously
 * @param filePath - Path to the file
 * @param content - Content to write
 * @param encoding - File encoding (default: 'utf-8')
 * @returns Promise that resolves when write is complete
 * @throws Error if file cannot be written
 */
export async function writeTextFileAsync(
  filePath: string,
  content: string,
  encoding: BufferEncoding = 'utf-8'
): Promise<void> {
  try {
    const resolvedPath = path.resolve(filePath);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    await fs.promises.writeFile(resolvedPath, content, encoding);
  } catch (error) {
    throw new Error(`Failed to write text file at ${filePath}: ${error}`);
  }
}

/**
 * Write JSON object to a file synchronously
 * @param filePath - Path to the file
 * @param data - Data to write as JSON
 * @param pretty - Whether to format JSON with indentation (default: true)
 * @param encoding - File encoding (default: 'utf-8')
 * @throws Error if file cannot be written
 */
export function writeJsonFile(
  filePath: string,
  data: any,
  pretty: boolean = true,
  encoding: BufferEncoding = 'utf-8'
): void {
  try {
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    writeTextFile(filePath, content, encoding);
  } catch (error) {
    throw new Error(`Failed to write JSON file at ${filePath}: ${error}`);
  }
}

/**
 * Write JSON object to a file asynchronously
 * @param filePath - Path to the file
 * @param data - Data to write as JSON
 * @param pretty - Whether to format JSON with indentation (default: true)
 * @param encoding - File encoding (default: 'utf-8')
 * @returns Promise that resolves when write is complete
 * @throws Error if file cannot be written
 */
export async function writeJsonFileAsync(
  filePath: string,
  data: any,
  pretty: boolean = true,
  encoding: BufferEncoding = 'utf-8'
): Promise<void> {
  try {
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await writeTextFileAsync(filePath, content, encoding);
  } catch (error) {
    throw new Error(`Failed to write JSON file at ${filePath}: ${error}`);
  }
}

/**
 * Check if a file exists
 * @param filePath - Path to check
 * @returns True if file exists, false otherwise
 */
export function fileExists(filePath: string): boolean {
  try {
    const resolvedPath = path.resolve(filePath);
    return fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile();
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 * @param dirPath - Path to check
 * @returns True if directory exists, false otherwise
 */
export function directoryExists(dirPath: string): boolean {
  try {
    const resolvedPath = path.resolve(dirPath);
    return fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolve a path relative to the project root
 * @param relativePath - Relative path from project root
 * @returns Absolute path
 */
export function resolveFromRoot(...relativePath: string[]): string {
  return path.resolve(process.cwd(), ...relativePath);
}

/**
 * Resolve a path relative to a base directory
 * @param basePath - Base directory path
 * @param relativePath - Relative path segments
 * @returns Absolute path
 */
export function resolvePath(basePath: string, ...relativePath: string[]): string {
  return path.resolve(basePath, ...relativePath);
}

/**
 * Get the directory name from a file path
 * @param filePath - File path
 * @returns Directory path
 */
export function getDirectory(filePath: string): string {
  return path.dirname(filePath);
}

/**
 * Get the file name from a path (with or without extension)
 * @param filePath - File path
 * @param includeExtension - Whether to include the extension (default: true)
 * @returns File name
 */
export function getFileName(filePath: string, includeExtension: boolean = true): string {
  const base = path.basename(filePath);
  return includeExtension ? base : path.parse(base).name;
}

/**
 * Get the file extension from a path
 * @param filePath - File path
 * @returns File extension (including the dot, e.g., '.json')
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath);
}

/**
 * Join path segments into a normalized path
 * @param segments - Path segments to join
 * @returns Joined path
 */
export function joinPaths(...segments: string[]): string {
  return path.join(...segments);
}

/**
 * Normalize a path (resolve '..' and '.' segments)
 * @param filePath - Path to normalize
 * @returns Normalized path
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath);
}

/**
 * Get relative path from one location to another
 * @param from - Starting path
 * @param to - Target path
 * @returns Relative path
 */
export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

/**
 * Create a directory (and parent directories if needed)
 * @param dirPath - Directory path to create
 * @throws Error if directory cannot be created
 */
export function createDirectory(dirPath: string): void {
  try {
    const resolvedPath = path.resolve(dirPath);
    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }
  } catch (error) {
    throw new Error(`Failed to create directory at ${dirPath}: ${error}`);
  }
}

/**
 * Create a directory asynchronously (and parent directories if needed)
 * @param dirPath - Directory path to create
 * @returns Promise that resolves when directory is created
 * @throws Error if directory cannot be created
 */
export async function createDirectoryAsync(dirPath: string): Promise<void> {
  try {
    const resolvedPath = path.resolve(dirPath);
    if (!fs.existsSync(resolvedPath)) {
      await fs.promises.mkdir(resolvedPath, { recursive: true });
    }
  } catch (error) {
    throw new Error(`Failed to create directory at ${dirPath}: ${error}`);
  }
}

/**
 * Delete a file
 * @param filePath - Path to the file to delete
 * @throws Error if file cannot be deleted
 */
export function deleteFile(filePath: string): void {
  try {
    const resolvedPath = path.resolve(filePath);
    if (fs.existsSync(resolvedPath)) {
      fs.unlinkSync(resolvedPath);
    }
  } catch (error) {
    throw new Error(`Failed to delete file at ${filePath}: ${error}`);
  }
}

/**
 * Delete a file asynchronously
 * @param filePath - Path to the file to delete
 * @returns Promise that resolves when file is deleted
 * @throws Error if file cannot be deleted
 */
export async function deleteFileAsync(filePath: string): Promise<void> {
  try {
    const resolvedPath = path.resolve(filePath);
    if (fs.existsSync(resolvedPath)) {
      await fs.promises.unlink(resolvedPath);
    }
  } catch (error) {
    throw new Error(`Failed to delete file at ${filePath}: ${error}`);
  }
}

/**
 * List files in a directory
 * @param dirPath - Directory path
 * @param recursive - Whether to list files recursively (default: false)
 * @returns Array of file paths
 */
export function listFiles(dirPath: string, recursive: boolean = false): string[] {
  try {
    const resolvedPath = path.resolve(dirPath);
    if (!fs.existsSync(resolvedPath)) {
      return [];
    }

    const files: string[] = [];
    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(resolvedPath, entry.name);
      if (entry.isFile()) {
        files.push(fullPath);
      } else if (entry.isDirectory() && recursive) {
        files.push(...listFiles(fullPath, true));
      }
    }

    return files;
  } catch (error) {
    throw new Error(`Failed to list files in ${dirPath}: ${error}`);
  }
}

/**
 * Copy a file
 * @param sourcePath - Source file path
 * @param destPath - Destination file path
 * @throws Error if file cannot be copied
 */
export function copyFile(sourcePath: string, destPath: string): void {
  try {
    const resolvedSource = path.resolve(sourcePath);
    const resolvedDest = path.resolve(destPath);
    const destDir = path.dirname(resolvedDest);
    
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    fs.copyFileSync(resolvedSource, resolvedDest);
  } catch (error) {
    throw new Error(`Failed to copy file from ${sourcePath} to ${destPath}: ${error}`);
  }
}

/**
 * Copy a file asynchronously
 * @param sourcePath - Source file path
 * @param destPath - Destination file path
 * @returns Promise that resolves when file is copied
 * @throws Error if file cannot be copied
 */
export async function copyFileAsync(sourcePath: string, destPath: string): Promise<void> {
  try {
    const resolvedSource = path.resolve(sourcePath);
    const resolvedDest = path.resolve(destPath);
    const destDir = path.dirname(resolvedDest);
    
    if (!fs.existsSync(destDir)) {
      await fs.promises.mkdir(destDir, { recursive: true });
    }
    
    await fs.promises.copyFile(resolvedSource, resolvedDest);
  } catch (error) {
    throw new Error(`Failed to copy file from ${sourcePath} to ${destPath}: ${error}`);
  }
}
