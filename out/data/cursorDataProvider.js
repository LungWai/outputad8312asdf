"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorDataProvider = exports.DEBUG = void 0;
/**
 * Enhanced Cursor Data Provider with NO mock data generation
 * Reads real chat data from Cursor's SQLite databases only
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const databaseService_1 = require("./databaseService");
const cursor_1 = require("../types/cursor");
const logger_1 = require("../utils/logger");
const constants_1 = require("../config/constants");
// Debug gate
exports.DEBUG = process.env.CURSOR_DEBUG === '1';
const dbg = (...a) => exports.DEBUG && logger_1.logger.debug(constants_1.LOG_COMPONENTS.DATA_PROVIDER, a.join(' '));
class CursorDataProvider {
    constructor() {
        this.storagePath = '';
        this.workspaceStoragePaths = [];
        this.databaseService = new databaseService_1.DatabaseService();
        this.initializeStoragePath();
        // Log startup info - NO MOCK DATA
        logger_1.logger.info(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'Initialized - Mock data generation DISABLED');
    }
    static getInstance() {
        if (!CursorDataProvider.instance) {
            CursorDataProvider.instance = new CursorDataProvider();
        }
        return CursorDataProvider.instance;
    }
    initializeStoragePath() {
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
            logger_1.logger.warn(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'No Cursor workspace storage found');
        }
    }
    async findWorkspaceStorageFolders() {
        if (!this.storagePath || !fs.existsSync(this.storagePath)) {
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'No valid storage path found');
            return [];
        }
        try {
            const items = fs.readdirSync(this.storagePath);
            const folders = [];
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
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'Error reading storage directory', error);
            return [];
        }
    }
    /**
     * Get all chat data from Cursor databases - NO MOCK DATA EVER
     */
    async getChatData() {
        logger_1.logger.info(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'Starting REAL chat data retrieval - NO MOCK DATA');
        try {
            const workspaceFolders = await this.findWorkspaceStorageFolders();
            const allChatData = [];
            let totalDatabasesProcessed = 0;
            dbg(`Found ${workspaceFolders.length} workspace folders to process`);
            if (workspaceFolders.length === 0) {
                logger_1.logger.warn(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'No workspace folders found - returning empty array (NO MOCK DATA)');
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
                    const processedKeys = new Set();
                    for (const result of chatResults) {
                        try {
                            const parsedValue = JSON.parse(result.value);
                            if (parsedValue && this.isValidChatData(parsedValue)) {
                                const workspaceName = this.extractWorkspaceName(folderPath, parsedValue);
                                // Step B: Prioritize rich chat objects over prompts-only data
                                const isRichChatData = result.key.startsWith('workbench.panel.aichat') && (0, cursor_1.isChatData)(parsedValue);
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
                                    logger_1.logger.debug(constants_1.LOG_COMPONENTS.DATA_PROVIDER, `Found rich chat data at ${result.key}, skipping related prompts-only data`);
                                }
                                else if (!processedKeys.has(result.key)) {
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
                        }
                        catch (parseError) {
                            logger_1.logger.debug(constants_1.LOG_COMPONENTS.DATA_PROVIDER, `JSON parse error for key "${result.key}"`, parseError);
                        }
                    }
                    // Always close the connection
                    await this.databaseService.closeConnection();
                }
                catch (error) {
                    logger_1.logger.error(constants_1.LOG_COMPONENTS.DATA_PROVIDER, `Error processing workspace folder ${folderPath}`, error);
                    // Ensure connection is closed even if there's an error
                    try {
                        await this.databaseService.closeConnection();
                    }
                    catch (closeError) {
                        logger_1.logger.warn(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'Could not close database connection', closeError);
                    }
                }
            }
            dbg(`Processed ${totalDatabasesProcessed} databases`);
            dbg(`Found ${allChatData.length} real chat data items - NO MOCK DATA`);
            return allChatData;
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'Error retrieving chat data', error);
            return []; // Return empty array, NO MOCK DATA
        }
    }
    /**
     * Extract real workspace name from database by querying workspace.rootUri
     */
    async extractWorkspaceRealName(dbService) {
        try {
            // Try multiple keys that might contain workspace information
            const workspaceKeys = [
                'workspace.rootUri',
                'workbench.workspace.folder',
                'workspace.name',
                'workspace.displayName'
            ];
            for (const key of workspaceKeys) {
                const results = await dbService.executeQuery('SELECT value FROM ItemTable WHERE key = ?', [key]);
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
        }
        catch (error) {
            logger_1.logger.warn(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'Failed to extract workspace real name', error);
        }
        return null;
    }
    extractWorkspaceName(folderPath, parsedValue) {
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
     * Get projects - based on real workspace databases only
     */
    async getProjects() {
        logger_1.logger.info(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'Getting projects from real workspace data...');
        const projects = [];
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
            logger_1.logger.info(constants_1.LOG_COMPONENTS.DATA_PROVIDER, `Found ${projects.length} real projects with chat data`);
            return projects;
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'Error getting projects', error);
            return [];
        }
    }
    async extractChatDataFromDatabase(folderPath) {
        const chatData = [];
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
                }
                catch (error) {
                    // Invalid JSON - continue
                }
            }
            await this.databaseService.closeConnection();
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.DATA_PROVIDER, `Error extracting from database ${folderPath}`, error);
            // Ensure connection is closed even if there's an error
            try {
                await this.databaseService.closeConnection();
            }
            catch (closeError) {
                logger_1.logger.warn(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'Could not close database connection', closeError);
            }
        }
        return chatData;
    }
    /**
     * Clear any cached data and force refresh
     */
    clearCache() {
        logger_1.logger.debug(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'Clearing cache...');
        this.workspaceStoragePaths = [];
    }
    /**
     * Get statistics about available data
     */
    async getDataStatistics() {
        logger_1.logger.debug(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'Gathering real data statistics...');
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
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.DATA_PROVIDER, 'Error getting statistics', error);
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
exports.CursorDataProvider = CursorDataProvider;
//# sourceMappingURL=cursorDataProvider.js.map