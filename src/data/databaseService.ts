/**
 * Optimized SQLite database service for Cursor chat data access
 * Uses sql.js for JavaScript-based SQLite access without native dependencies
 */
import { maybeDecode } from '../utils/compression';
import { logger } from '../utils/logger';
import { LOG_COMPONENTS } from '../config/constants';

// Try to load sql.js for JavaScript-based SQLite access
let initSqlJs: any = null;

try {
  initSqlJs = require('sql.js');
  logger.info(LOG_COMPONENTS.DATABASE, 'sql.js loaded successfully - real database access enabled');
} catch (error) {
  logger.error(LOG_COMPONENTS.DATABASE, 'sql.js not available. Install with: npm install sql.js', error);
  throw new Error('sql.js is required for database access. Run: npm install sql.js');
}

export interface DatabaseQueryResult {
  key: string;
  value: string;
}

export interface DatabaseRow {
  key: string;
  value: any;
}

export class DatabaseService {
  private db: any = null;
  private dbPath: string = '';
  private connectionPool: Map<string, any> = new Map();
  private queryCache: Map<string, DatabaseQueryResult[]> = new Map();
  private sqlJs: any = null;

  // Target keys for Cursor chat data as specified in documentation
  private readonly CURSOR_CHAT_KEYS = [
    'workbench.panel.aichat.view.aichat.chatdata',
    'workbench.panel.aichat.view.aichat.chatData',
    'aiService.prompts',
    'cursorChat.conversations',
    'cursor.chatHistory',
    'composer.sessions',
    'aichat.messages'
  ];

  constructor() {
    logger.info(LOG_COMPONENTS.DATABASE, 'Initialized with sql.js for real database access');
  }

  /**
   * Initialize sql.js if not already done
   */
  private async initializeSqlJs(): Promise<void> {
    if (this.sqlJs) {
      return; // Already initialized
    }

    try {
      this.sqlJs = await initSqlJs();
      logger.debug(LOG_COMPONENTS.DATABASE, 'sql.js initialized successfully');
    } catch (error) {
      logger.error(LOG_COMPONENTS.DATABASE, 'Failed to initialize sql.js', error);
      throw new Error('Failed to initialize sql.js SQLite engine');
    }
  }

  /**
   * Opens a read-only connection to the SQLite database
   * @param dbPath Path to the database file
   */
  public async openConnection(dbPath: string): Promise<void> {
    try {
      this.dbPath = dbPath;

      // Check if we already have a connection for this database
      if (this.connectionPool.has(dbPath)) {
        this.db = this.connectionPool.get(dbPath)!;
        logger.debug(LOG_COMPONENTS.DATABASE, `Reusing existing connection to: ${dbPath}`);
        return;
      }

      // Verify file exists
      const fs = require('fs');
      if (!fs.existsSync(dbPath)) {
        throw new Error(`Database file does not exist: ${dbPath}`);
      }

      // Initialize sql.js if needed
      await this.initializeSqlJs();

      // Read the SQLite file
      const fileBuffer = fs.readFileSync(dbPath);
      logger.debug(LOG_COMPONENTS.DATABASE, `Read SQLite file: ${dbPath} (${fileBuffer.length} bytes)`);

      // Create database from file buffer
      this.db = new this.sqlJs.Database(fileBuffer);
      
      // Store in connection pool
      this.connectionPool.set(dbPath, this.db);
      
      // Clear old cache entries for this database
      this.clearCacheForDatabase(dbPath);

      logger.info(LOG_COMPONENTS.DATABASE, `Opened real database connection to: ${dbPath}`);

    } catch (error) {
      logger.error(LOG_COMPONENTS.DATABASE, 'Failed to open connection', error);
      throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a query to find chat-related data
   *  – Uses wildcard LIKE so per-workspace keys are included
   */
  public async findChatData(searchPattern?: string): Promise<DatabaseQueryResult[]> {
    if (!this.db) throw new Error('Database not connected');

    // ––––– cache check –––––
    const cacheKey = `findChatData:${searchPattern || 'all'}:${this.dbPath}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    // -----------------------
    // Build wildcard WHERE list
    // -----------------------
    const likePieces = this.CURSOR_CHAT_KEYS
      .map(k => `${k}%`)                      // allow suffixes
      .concat(searchPattern ? [`%${searchPattern}%`] : [])
      .map(() => `key LIKE ?`)               // produces "key LIKE ?" * N
      .join(' OR ');

    const query = `SELECT key, value FROM ItemTable WHERE ${likePieces}`;
    const params = this.CURSOR_CHAT_KEYS.map(k => `${k}%`);
    if (searchPattern) params.push(`%${searchPattern}%`);



    const stmt = this.db.prepare(query);
    const rows:any[] = [];
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();



    // -----------------------
    // Decode / validate rows
    // -----------------------
    const results: DatabaseQueryResult[] = [];
    for (const row of rows) {
      let val: any = row.value;
      try {
        val = maybeDecode(row.value);               // attempt universal decode
        if (this.isValidChatData(val)) {
          results.push({ key: row.key, value: val });
        }
      } catch(e) { logger.warn(LOG_COMPONENTS.DATABASE, `Failed to process row ${row.key}`, e); }
    }

    this.setCachedResult(cacheKey, results);
    return results;
  }

  /**
   * Execute a custom query on the database
   * @param query SQL query to execute
   * @param params Query parameters
   * @returns Query results
   */
  public async executeQuery(query: string, params?: any[]): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      logger.debug(LOG_COMPONENTS.DATABASE, `Executing custom query on real database: ${query.substring(0, 100)}...`);
      
      const stmt = this.db.prepare(query);
      const rows: any[] = [];
      
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      
      while (stmt.step()) {
        const row = stmt.getAsObject();
        rows.push(row);
      }
      stmt.free();
      
      logger.debug(LOG_COMPONENTS.DATABASE, `Custom query returned ${rows.length} rows from real database`);
      return rows;

    } catch (error) {
      logger.error(LOG_COMPONENTS.DATABASE, 'Custom query failed', error);
      throw error;
    }
  }

  /**
   * Get all available keys from ItemTable for debugging
   */
  public async getAllKeys(): Promise<string[]> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      const stmt = this.db.prepare('SELECT DISTINCT key FROM ItemTable ORDER BY key');
      const keys: string[] = [];
      
      while (stmt.step()) {
        const row = stmt.getAsObject();
        keys.push(row.key);
      }
      stmt.free();
      
      logger.debug(LOG_COMPONENTS.DATABASE, `Found ${keys.length} total keys in real database`);
      
      return keys;

    } catch (error) {
      logger.error(LOG_COMPONENTS.DATABASE, 'Failed to get keys', error);
      return [];
    }
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
   * Cache management
   */
  private getCachedResult(key: string): DatabaseQueryResult[] | null {
    const cached = this.queryCache.get(key);
    if (cached) {
      return cached;
    }
    return null;
  }

  private setCachedResult(key: string, results: DatabaseQueryResult[]): void {
    this.queryCache.set(key, results);
    
    // Simple cache size management
    if (this.queryCache.size > 100) {
      const firstKey = this.queryCache.keys().next().value;
      if (firstKey) {
        this.queryCache.delete(firstKey);
      }
    }
  }

  private clearCacheForDatabase(dbPath: string): void {
    for (const [key] of this.queryCache) {
      if (key && key.includes(dbPath)) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Close the current database connection
   */
  public async closeConnection(): Promise<void> {
    // Check if there's actually a connection to close
    if (!this.db || !this.dbPath) {
      logger.debug(LOG_COMPONENTS.DATABASE, 'No active connection to close');
      return;
    }

    try {
      this.db.close();
      this.connectionPool.delete(this.dbPath);
      logger.info(LOG_COMPONENTS.DATABASE, `Closed real database connection to ${this.dbPath}`);
    } catch (error) {
      logger.error(LOG_COMPONENTS.DATABASE, 'Error closing connection', error);
    } finally {
      // Always reset connection state
      this.db = null;
      this.dbPath = '';
    }
  }

  /**
   * Close all connections and clear cache
   */
  public closeAllConnections(): void {
    try {
      logger.info(LOG_COMPONENTS.DATABASE, `Closing ${this.connectionPool.size} real database connections`);
      
      for (const [path, db] of this.connectionPool) {
        try {
          db.close();
        } catch (error) {
          logger.error(LOG_COMPONENTS.DATABASE, `Error closing connection to ${path}`, error);
        }
      }
      
      this.connectionPool.clear();
      this.queryCache.clear();
      this.db = null;
      this.dbPath = '';
      
    } catch (error) {
      logger.error(LOG_COMPONENTS.DATABASE, 'Error closing all connections', error);
    }
  }

  /**
   * Get information about the current database connection
   */
  public getDatabaseInfo(): { path: string; isConnected: boolean; poolSize: number; cacheSize: number; mode: string } {
    return {
      path: this.dbPath || 'Not connected',
      isConnected: !!this.db,
      poolSize: this.connectionPool.size,
      cacheSize: this.queryCache.size,
      mode: 'real-database'
    };
  }
} 