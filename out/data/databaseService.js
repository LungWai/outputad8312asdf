"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
/**
 * Optimized SQLite database service for Cursor chat data access
 * Uses sql.js for JavaScript-based SQLite access without native dependencies
 */
const compression_1 = require("../utils/compression");
const logger_1 = require("../utils/logger");
const constants_1 = require("../config/constants");
// Try to load sql.js for JavaScript-based SQLite access
let initSqlJs = null;
try {
    initSqlJs = require('sql.js');
    logger_1.logger.info(constants_1.LOG_COMPONENTS.DATABASE, 'sql.js loaded successfully - real database access enabled');
}
catch (error) {
    logger_1.logger.error(constants_1.LOG_COMPONENTS.DATABASE, 'sql.js not available. Install with: npm install sql.js', error);
    throw new Error('sql.js is required for database access. Run: npm install sql.js');
}
class DatabaseService {
    constructor() {
        this.db = null;
        this.dbPath = '';
        this.connectionPool = new Map();
        this.queryCache = new Map();
        this.sqlJs = null;
        // Target keys for Cursor chat data as specified in documentation
        this.CURSOR_CHAT_KEYS = [
            'workbench.panel.aichat.view.aichat.chatdata',
            'workbench.panel.aichat.view.aichat.chatData',
            'aiService.prompts',
            'cursorChat.conversations',
            'cursor.chatHistory',
            'composer.sessions',
            'aichat.messages'
        ];
        logger_1.logger.info(constants_1.LOG_COMPONENTS.DATABASE, 'Initialized with sql.js for real database access');
    }
    /**
     * Initialize sql.js if not already done
     */
    async initializeSqlJs() {
        if (this.sqlJs) {
            return; // Already initialized
        }
        try {
            this.sqlJs = await initSqlJs();
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.DATABASE, 'sql.js initialized successfully');
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.DATABASE, 'Failed to initialize sql.js', error);
            throw new Error('Failed to initialize sql.js SQLite engine');
        }
    }
    /**
     * Opens a read-only connection to the SQLite database
     * @param dbPath Path to the database file
     */
    async openConnection(dbPath) {
        try {
            this.dbPath = dbPath;
            // Check if we already have a connection for this database
            if (this.connectionPool.has(dbPath)) {
                this.db = this.connectionPool.get(dbPath);
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.DATABASE, `Reusing existing connection to: ${dbPath}`);
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
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.DATABASE, `Read SQLite file: ${dbPath} (${fileBuffer.length} bytes)`);
            // Create database from file buffer
            this.db = new this.sqlJs.Database(fileBuffer);
            // Store in connection pool
            this.connectionPool.set(dbPath, this.db);
            // Clear old cache entries for this database
            this.clearCacheForDatabase(dbPath);
            logger_1.logger.info(constants_1.LOG_COMPONENTS.DATABASE, `Opened real database connection to: ${dbPath}`);
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.DATABASE, 'Failed to open connection', error);
            throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Execute a query to find chat-related data
     *  – Uses wildcard LIKE so per-workspace keys are included
     */
    async findChatData(searchPattern) {
        if (!this.db)
            throw new Error('Database not connected');
        // ––––– cache check –––––
        const cacheKey = `findChatData:${searchPattern || 'all'}:${this.dbPath}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached)
            return cached;
        // -----------------------
        // Build wildcard WHERE list
        // -----------------------
        const likePieces = this.CURSOR_CHAT_KEYS
            .map(k => `${k}%`) // allow suffixes
            .concat(searchPattern ? [`%${searchPattern}%`] : [])
            .map(() => `key LIKE ?`) // produces "key LIKE ?" * N
            .join(' OR ');
        const query = `SELECT key, value FROM ItemTable WHERE ${likePieces}`;
        const params = this.CURSOR_CHAT_KEYS.map(k => `${k}%`);
        if (searchPattern)
            params.push(`%${searchPattern}%`);
        const stmt = this.db.prepare(query);
        const rows = [];
        stmt.bind(params);
        while (stmt.step())
            rows.push(stmt.getAsObject());
        stmt.free();
        // -----------------------
        // Decode / validate rows
        // -----------------------
        const results = [];
        for (const row of rows) {
            let val = row.value;
            try {
                val = (0, compression_1.maybeDecode)(row.value); // attempt universal decode
                if (this.isValidChatData(val)) {
                    results.push({ key: row.key, value: val });
                }
            }
            catch (e) {
                logger_1.logger.warn(constants_1.LOG_COMPONENTS.DATABASE, `Failed to process row ${row.key}`, e);
            }
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
    async executeQuery(query, params) {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        try {
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.DATABASE, `Executing custom query on real database: ${query.substring(0, 100)}...`);
            const stmt = this.db.prepare(query);
            const rows = [];
            if (params && params.length > 0) {
                stmt.bind(params);
            }
            while (stmt.step()) {
                const row = stmt.getAsObject();
                rows.push(row);
            }
            stmt.free();
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.DATABASE, `Custom query returned ${rows.length} rows from real database`);
            return rows;
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.DATABASE, 'Custom query failed', error);
            throw error;
        }
    }
    /**
     * Get all available keys from ItemTable for debugging
     */
    async getAllKeys() {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        try {
            const stmt = this.db.prepare('SELECT DISTINCT key FROM ItemTable ORDER BY key');
            const keys = [];
            while (stmt.step()) {
                const row = stmt.getAsObject();
                keys.push(row.key);
            }
            stmt.free();
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.DATABASE, `Found ${keys.length} total keys in real database`);
            return keys;
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.DATABASE, 'Failed to get keys', error);
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
    isValidChatData(data) {
        if (data == null)
            return false;
        // plain array – treat as chat message list
        if (Array.isArray(data))
            return data.length >= 0;
        if (typeof data === 'object') {
            const k = Object.keys(data);
            if (k.length === 0)
                return true; // empty but valid
            const structuralHit = k.some(x => ['messages', 'history', 'conversations', 'prompts'].includes(x.toLowerCase()) ||
                /^\d+$/.test(x) // numeric keys -> cursor arrays
            );
            return structuralHit;
        }
        // primitive JSON strings / numbers – ignore unless very long
        if (typeof data === 'string')
            return data.length > 150;
        return false;
    }
    /**
     * Cache management
     */
    getCachedResult(key) {
        const cached = this.queryCache.get(key);
        if (cached) {
            return cached;
        }
        return null;
    }
    setCachedResult(key, results) {
        this.queryCache.set(key, results);
        // Simple cache size management
        if (this.queryCache.size > 100) {
            const firstKey = this.queryCache.keys().next().value;
            if (firstKey) {
                this.queryCache.delete(firstKey);
            }
        }
    }
    clearCacheForDatabase(dbPath) {
        for (const [key] of this.queryCache) {
            if (key && key.includes(dbPath)) {
                this.queryCache.delete(key);
            }
        }
    }
    /**
     * Close the current database connection
     */
    async closeConnection() {
        // Check if there's actually a connection to close
        if (!this.db || !this.dbPath) {
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.DATABASE, 'No active connection to close');
            return;
        }
        try {
            this.db.close();
            this.connectionPool.delete(this.dbPath);
            logger_1.logger.info(constants_1.LOG_COMPONENTS.DATABASE, `Closed real database connection to ${this.dbPath}`);
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.DATABASE, 'Error closing connection', error);
        }
        finally {
            // Always reset connection state
            this.db = null;
            this.dbPath = '';
        }
    }
    /**
     * Close all connections and clear cache
     */
    closeAllConnections() {
        try {
            logger_1.logger.info(constants_1.LOG_COMPONENTS.DATABASE, `Closing ${this.connectionPool.size} real database connections`);
            for (const [path, db] of this.connectionPool) {
                try {
                    db.close();
                }
                catch (error) {
                    logger_1.logger.error(constants_1.LOG_COMPONENTS.DATABASE, `Error closing connection to ${path}`, error);
                }
            }
            this.connectionPool.clear();
            this.queryCache.clear();
            this.db = null;
            this.dbPath = '';
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.DATABASE, 'Error closing all connections', error);
        }
    }
    /**
     * Get information about the current database connection
     */
    getDatabaseInfo() {
        return {
            path: this.dbPath || 'Not connected',
            isConnected: !!this.db,
            poolSize: this.connectionPool.size,
            cacheSize: this.queryCache.size,
            mode: 'real-database'
        };
    }
}
exports.DatabaseService = DatabaseService;
//# sourceMappingURL=databaseService.js.map