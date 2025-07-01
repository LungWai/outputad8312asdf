/**
 * Enhanced Cursor Data Provider with NO mock data generation
 * Reads real chat data from Cursor's SQLite databases only
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseService } from './databaseService';
import { isChatData } from '../types/cursor';

// Debug gate
export const DEBUG = process.env.CURSOR_DEBUG === '1';
const dbg = (...a: any[]) => DEBUG && console.log('[CDP]', ...a);

export class CursorDataProvider {
  private static instance: CursorDataProvider;
  private databaseService: DatabaseService;
  private storagePath: string = '';
  private workspaceStoragePaths: string[] = [];

  private constructor() {
    this.databaseService = new DatabaseService();
    this.initializeStoragePath();
    
    // Log startup info - NO MOCK DATA
    console.log('CursorDataProvider: Initialized - Mock data generation DISABLED');
  }

  public static getInstance(): CursorDataProvider {
    if (!CursorDataProvider.instance) {
      CursorDataProvider.instance = new CursorDataProvider();
    }
    return CursorDataProvider.instance;
  }



  private initializeStoragePath(): void {
    // Always find Cursor-specific paths, never VS Code
    const possiblePaths = [
      // Windows
      path.join(process.env.APPDATA || '', 'Cursor', 'User', 'workspaceStorage'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'workspaceStorage'),
      
      // macOS
      path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'workspaceStorage'),
      
      // Linux
      path.join(os.homedir(), '.config', 'Cursor', 'User', 'workspaceStorage')
    ];

    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        this.storagePath = possiblePath;
        break;
      }
    }


    
    if (!this.storagePath) {
      console.warn('CursorDataProvider: No Cursor workspace storage found');
    }
  }

  private async findWorkspaceStorageFolders(): Promise<string[]> {
    if (!this.storagePath || !fs.existsSync(this.storagePath)) {
      console.log('CursorDataProvider: No valid storage path found');
      return [];
    }

    try {
      const items = fs.readdirSync(this.storagePath);
      const folders: string[] = [];

      for (const item of items) {
        const fullPath = path.join(this.storagePath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          const dbPath = path.join(fullPath, 'state.vscdb');
          if (fs.existsSync(dbPath)) {
            const dbStat = fs.statSync(dbPath);
            if (dbStat.size > 10000) { // At least 10KB
              folders.push(fullPath);
            }
          }
        }
      }

      return folders;
    } catch (error) {
      console.error(`Error reading storage directory: ${error}`);
      return [];
    }
  }

  /**
   * Get all chat data from Cursor databases - NO MOCK DATA EVER
   */
  public async getChatData(): Promise<Record<string, any>[]> {
    console.log('CursorDataProvider: Starting REAL chat data retrieval - NO MOCK DATA');
    
    try {
      const workspaceFolders = await this.findWorkspaceStorageFolders();
      const allChatData: Record<string, any>[] = [];
      let totalDatabasesProcessed = 0;

      dbg(`Found ${workspaceFolders.length} workspace folders to process`);
      
      if (workspaceFolders.length === 0) {
        console.warn('CursorDataProvider: No workspace folders found - returning empty array (NO MOCK DATA)');
        return [];
      }

      for (const folderPath of workspaceFolders) {
        // Use the shared DatabaseService instance
        
        try {
          const dbPath = path.join(folderPath, 'state.vscdb');
          const folderName = path.basename(folderPath);



          // Connect to the database with shared service
          await this.databaseService.openConnection(dbPath);
          totalDatabasesProcessed++;

          // Get the real workspace name from the database
          const workspaceRealName = await this.extractWorkspaceRealName(this.databaseService);

          // Use the new optimized findChatData method
          const chatResults = await this.databaseService.findChatData();

          // Process the results with prioritization for rich chat data
          const processedKeys = new Set<string>();

          for (const result of chatResults) {
            try {
              const parsedValue = JSON.parse(result.value);
              if (parsedValue && this.isValidChatData(parsedValue)) {
                const workspaceName = this.extractWorkspaceName(folderPath, parsedValue);

                // Step B: Prioritize rich chat objects over prompts-only data
                const isRichChatData = result.key.startsWith('workbench.panel.aichat') && isChatData(parsedValue);

                if (isRichChatData) {
                  // This is rich chat data with actual assistant responses
                  allChatData.push({
                    source: result.key,
                    data: parsedValue,
                    workspace: workspaceName,
                    workspaceRealName: workspaceRealName,
                    databasePath: dbPath,
                    folderName: folderName,
                    rowSize: result.value.length,
                    isRichChatData: true
                  });

                  // Mark related prompts-only keys as processed to avoid duplicates
                  const baseKey = result.key.replace(/\.chat[Dd]ata$/, '');
                  processedKeys.add(`${baseKey}.prompts`);
                  processedKeys.add(`aiService.prompts`);

                  console.log(`CursorDataProvider: Found rich chat data at ${result.key}, skipping related prompts-only data`);
                } else if (!processedKeys.has(result.key)) {
                  // This is prompts-only data, include it only if no rich version exists
                  allChatData.push({
                    source: result.key,
                    data: parsedValue,
                    workspace: workspaceName,
                    workspaceRealName: workspaceRealName,
                    databasePath: dbPath,
                    folderName: folderName,
                    rowSize: result.value.length,
                    isRichChatData: false
                  });
                }

              }
            } catch (parseError) {
              console.log(`JSON parse error for key "${result.key}": ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }
          }

          // Always close the connection
          await this.databaseService.closeConnection();
          
        } catch (error) {
          console.error(`Error processing workspace folder ${folderPath}: ${error instanceof Error ? error.message : String(error)}`);
          
          // Ensure connection is closed even if there's an error
          try {
            await this.databaseService.closeConnection();
          } catch (closeError) {
            console.warn(`Warning: Could not close database connection: ${closeError}`);
          }
        }
      }

      dbg(`Processed ${totalDatabasesProcessed} databases`);
      dbg(`Found ${allChatData.length} real chat data items - NO MOCK DATA`);
      
      return allChatData;
      
    } catch (error) {
      console.error('CursorDataProvider: Error retrieving chat data:', error);
      return []; // Return empty array, NO MOCK DATA
    }
  }

  /**
   * Extract real workspace name from database by querying workspace.rootUri
   */
  private async extractWorkspaceRealName(dbService: DatabaseService): Promise<string | null> {
    try {
      // Try multiple keys that might contain workspace information
      const workspaceKeys = [
        'workspace.rootUri',
        'workbench.workspace.folder',
        'workspace.name',
        'workspace.displayName'
      ];

      for (const key of workspaceKeys) {
        const results = await dbService.executeQuery(
          'SELECT value FROM ItemTable WHERE key = ?',
          [key]
        );

        if (results.length > 0 && results[0].value) {
          const value = results[0].value;
          
          // Handle file:// URIs
          if (typeof value === 'string' && value.startsWith('file://')) {
            const decodedPath = decodeURIComponent(value.replace('file://', ''));
            // Handle Windows paths that might start with /C:/ or /c:/
            const normalizedPath = decodedPath.replace(/^\/([a-zA-Z]):/, '$1:');
            const pathParts = normalizedPath.split(/[/\\]/);
            const projectName = pathParts[pathParts.length - 1];
            if (projectName && projectName.length > 0 && !projectName.match(/^[a-f0-9]{32}$/)) {
              return projectName;
            }
          }
          // Handle direct string values (workspace.name or workspace.displayName)
          else if (typeof value === 'string' && value.length > 0 && !value.match(/^[a-f0-9]{32}$/)) {
            return value;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to extract workspace real name:', error);
    }
    return null;
  }

  private extractWorkspaceName(folderPath: string, parsedValue: any): string {
    // Extract meaningful workspace name
    const folderName = path.basename(folderPath);

    if (parsedValue && typeof parsedValue === 'object') {
      const workspaceFields = ['workspaceName', 'projectName', 'folderName', 'name'];
      for (const field of workspaceFields) {
        if (parsedValue[field] && typeof parsedValue[field] === 'string' && parsedValue[field].length > 1) {
          return parsedValue[field];
        }
      }
    }

    // Fallback to folder name or generated name
    if (!folderName.match(/^[a-f0-9]{8,}$/)) {
      return folderName;
    }

    return `Project ${folderName.substring(0, 8)}`;
  }

  /**
   * Accept Cursor's real shapes:
   *  • array of prompt objects  – OR –
   *  • object whose keys are numeric strings ("0","1",..)
   *  • object with messages / prompts / history fields
   *  • length check only if parsed JSON is a primitive
   */
  private isValidChatData(data: any): boolean {
    if (data == null) return false;

    // plain array – treat as chat message list
    if (Array.isArray(data)) return data.length >= 0;

    if (typeof data === 'object') {
      const k = Object.keys(data);
      if (k.length === 0) return true;              // empty but valid
      const structuralHit = k.some(x =>
        ['messages','history','conversations','prompts'].includes(x.toLowerCase()) ||
        /^\d+$/.test(x)                             // numeric keys -> cursor arrays
      );
      return structuralHit;
    }

    // primitive JSON strings / numbers – ignore unless very long
    if (typeof data === 'string') return data.length > 150;
    return false;
  }

  /**
   * Get projects - based on real workspace databases only
   */
  async getProjects(): Promise<any[]> {
    console.log('CursorDataProvider: Getting projects from real workspace data...');
    
    const projects: any[] = [];
    
    try {
      const workspaceFolders = await this.findWorkspaceStorageFolders();
      
      for (const folderPath of workspaceFolders) {
        const workspaceId = path.basename(folderPath);
        const chatData = await this.extractChatDataFromDatabase(folderPath);
        
        if (chatData.length > 0) {
          const project = {
            id: workspaceId,
            name: `Workspace ${workspaceId.substring(0, 8)}`,
            path: folderPath,
            chatCount: chatData.length,
            lastModified: fs.statSync(path.join(folderPath, 'state.vscdb')).mtime,
            isReal: true
          };
          
          projects.push(project);
        }
      }
      
      console.log(`CursorDataProvider: Found ${projects.length} real projects with chat data`);
      return projects;
      
    } catch (error) {
      console.error('CursorDataProvider: Error getting projects:', error);
      return [];
    }
  }

  private async extractChatDataFromDatabase(folderPath: string): Promise<any[]> {
    const chatData: any[] = [];

    try {
      const dbPath = path.join(folderPath, 'state.vscdb');
      await this.databaseService.openConnection(dbPath);

      // Use the new optimized findChatData method
      const chatResults = await this.databaseService.findChatData();

      for (const result of chatResults) {
        try {
          const rawData = JSON.parse(result.value);
          chatData.push({
            sourceKey: result.key,
            sourceDatabase: path.basename(folderPath),
            data: rawData,
            extractedAt: new Date().toISOString()
          });
        } catch (error) {
          // Invalid JSON - continue
        }
      }

      await this.databaseService.closeConnection();

    } catch (error) {
      console.error(`CursorDataProvider: Error extracting from database ${folderPath}:`, error);

      // Ensure connection is closed even if there's an error
      try {
        await this.databaseService.closeConnection();
      } catch (closeError) {
        console.warn(`Warning: Could not close database connection: ${closeError}`);
      }
    }

    return chatData;
  }

  /**
   * Clear any cached data and force refresh
   */
  public clearCache(): void {
    console.log('CursorDataProvider: Clearing cache...');
    this.workspaceStoragePaths = [];
  }

  /**
   * Get statistics about available data
   */
  async getDataStatistics(): Promise<any> {
    console.log('CursorDataProvider: Gathering real data statistics...');
    
    try {
      const projects = await this.getProjects();
      const chatData = await this.getChatData();
      
      return {
        totalProjects: projects.length,
        totalChats: chatData.length,
        workspaceStorageLocations: this.workspaceStoragePaths.length,
        isRealData: true,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('CursorDataProvider: Error getting statistics:', error);
      return {
        totalProjects: 0,
        totalChats: 0,
        workspaceStorageLocations: 0,
        isRealData: true,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}