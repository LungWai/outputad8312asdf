import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { logger } from './logger';
import { LOG_COMPONENTS } from '../config/constants';

/**
 * Database Inspector utility to examine SQLite database structure
 * This helps us understand the actual structure of Cursor's state.vscdb files
 */
export class DatabaseInspector {
  
  /**
   * Inspect a SQLite database file and return its structure
   */
  public static async inspectDatabase(dbPath: string): Promise<any> {
    try {
      logger.info(LOG_COMPONENTS.DATABASE, `Inspecting database at ${dbPath}`);
      
      // Check if file exists
      if (!fs.existsSync(dbPath)) {
        throw new Error(`Database file does not exist: ${dbPath}`);
      }
      
      // For now, let's try to read the file as text to see if we can find any patterns
      const fileBuffer = fs.readFileSync(dbPath);
      const fileSize = fileBuffer.length;
      
      logger.debug(LOG_COMPONENTS.DATABASE, `File size: ${fileSize} bytes`);
      
      // Try to find text patterns that might indicate table names or data
      const fileText = fileBuffer.toString('utf8', 0, Math.min(10000, fileSize));
      
      // Look for common SQLite patterns
      const sqliteHeader = fileBuffer.toString('ascii', 0, 16);
      logger.debug(LOG_COMPONENTS.DATABASE, `SQLite header: ${sqliteHeader}`);
      
      // Look for potential table names or chat-related keywords
      const chatKeywords = [
        'chat', 'message', 'conversation', 'ai', 'cursor', 'prompt',
        'workbench', 'panel', 'aichat', 'aiService', 'history'
      ];
      
      const foundKeywords: string[] = [];
      chatKeywords.forEach(keyword => {
        if (fileText.toLowerCase().includes(keyword.toLowerCase())) {
          foundKeywords.push(keyword);
        }
      });
      
      logger.debug(LOG_COMPONENTS.DATABASE, `Found keywords: ${foundKeywords.join(', ')}`);
      
      // Try to extract potential JSON data
      const jsonMatches = fileText.match(/\{[^{}]*"[^"]*"[^{}]*\}/g);
      if (jsonMatches) {
        logger.debug(LOG_COMPONENTS.DATABASE, `Found ${jsonMatches.length} potential JSON objects`);
        jsonMatches.slice(0, 3).forEach((match, index) => {
          logger.debug(LOG_COMPONENTS.DATABASE, `JSON sample ${index + 1}: ${match.substring(0, 200)}...`);
        });
      }
      
      return {
        path: dbPath,
        size: fileSize,
        sqliteHeader,
        foundKeywords,
        jsonSamples: jsonMatches?.slice(0, 3) || []
      };
      
    } catch (error) {
      logger.error(LOG_COMPONENTS.DATABASE, `Error inspecting database ${dbPath}`, error);
      throw error;
    }
  }
  
  /**
   * Find and inspect all workspace storage databases
   */
  public static async inspectAllWorkspaceStorages(): Promise<any[]> {
    const results: any[] = [];
    
    try {
      // Get Cursor storage path
      const os = require('os');
      const cursorStoragePath = path.join(
        os.homedir(),
        'AppData', 'Roaming', 'Cursor', 'User', 'workspaceStorage'
      );
      
      logger.info(LOG_COMPONENTS.DATABASE, `Scanning ${cursorStoragePath}`);
      
      if (!fs.existsSync(cursorStoragePath)) {
        throw new Error(`Cursor storage path does not exist: ${cursorStoragePath}`);
      }
      
      const workspaceFolders = fs.readdirSync(cursorStoragePath);
      logger.info(LOG_COMPONENTS.DATABASE, `Found ${workspaceFolders.length} workspace folders`);
      
      for (const folder of workspaceFolders.slice(0, 5)) { // Limit to first 5 for performance
        const dbPath = path.join(cursorStoragePath, folder, 'state.vscdb');
        
        if (fs.existsSync(dbPath)) {
          logger.debug(LOG_COMPONENTS.DATABASE, `Inspecting ${folder}`);
          try {
            const inspection = await this.inspectDatabase(dbPath);
            results.push({
              workspaceId: folder,
              ...inspection
            });
          } catch (error) {
            logger.error(LOG_COMPONENTS.DATABASE, `Failed to inspect ${folder}`, error);
          }
        }
      }
      
    } catch (error) {
      logger.error(LOG_COMPONENTS.DATABASE, 'Error scanning workspace storages', error);
    }
    
    return results;
  }
  
  /**
   * Create a detailed report of database inspection results
   */
  public static async createInspectionReport(): Promise<string> {
    const inspections = await this.inspectAllWorkspaceStorages();
    
    let report = '# Database Inspection Report\n\n';
    report += `Found ${inspections.length} databases to inspect.\n\n`;
    
    inspections.forEach((inspection, index) => {
      report += `## Database ${index + 1}: ${inspection.workspaceId}\n`;
      report += `- **Path**: ${inspection.path}\n`;
      report += `- **Size**: ${inspection.size} bytes\n`;
      report += `- **SQLite Header**: ${inspection.sqliteHeader}\n`;
      report += `- **Found Keywords**: ${inspection.foundKeywords.join(', ')}\n`;
      
      if (inspection.jsonSamples.length > 0) {
        report += `- **JSON Samples**:\n`;
        inspection.jsonSamples.forEach((sample: string, i: number) => {
          report += `  ${i + 1}. \`${sample.substring(0, 100)}...\`\n`;
        });
      }
      
      report += '\n';
    });
    
    return report;
  }
}
