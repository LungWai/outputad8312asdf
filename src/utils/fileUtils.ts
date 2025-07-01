import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as path from 'path';

export class FileUtils {
  /**
   * Check if file exists
   */
  public static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read file as string
   */
  public static async readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    return await fs.readFile(filePath, encoding);
  }

  /**
   * Write file
   */
  public static async writeFile(filePath: string, content: string, encoding: BufferEncoding = 'utf8'): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await this.ensureDirectory(dir);
    
    await fs.writeFile(filePath, content, encoding);
  }

  /**
   * Ensure directory exists
   */
  public static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Ignore error if directory already exists
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Delete file
   */
  public static async deleteFile(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  /**
   * Copy file
   */
  public static async copyFile(source: string, destination: string): Promise<void> {
    // Ensure destination directory exists
    const dir = path.dirname(destination);
    await this.ensureDirectory(dir);
    
    await fs.copyFile(source, destination);
  }

  /**
   * Get file stats
   */
  public static async getStats(filePath: string): Promise<Stats> {
    return await fs.stat(filePath);
  }

  /**
   * List directory contents
   */
  public static async listDirectory(dirPath: string): Promise<string[]> {
    return await fs.readdir(dirPath);
  }

  /**
   * Get file size in bytes
   */
  public static async getFileSize(filePath: string): Promise<number> {
    const stats = await this.getStats(filePath);
    return stats.size;
  }

  /**
   * Check if path is a directory
   */
  public static async isDirectory(dirPath: string): Promise<boolean> {
    try {
      const stats = await this.getStats(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if path is a file
   */
  public static async isFile(filePath: string): Promise<boolean> {
    try {
      const stats = await this.getStats(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }
} 