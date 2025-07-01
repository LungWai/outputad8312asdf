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
exports.DatabaseInspector = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Database Inspector utility to examine SQLite database structure
 * This helps us understand the actual structure of Cursor's state.vscdb files
 */
class DatabaseInspector {
    /**
     * Inspect a SQLite database file and return its structure
     */
    static async inspectDatabase(dbPath) {
        try {
            console.log(`DatabaseInspector: Inspecting database at ${dbPath}`);
            // Check if file exists
            if (!fs.existsSync(dbPath)) {
                throw new Error(`Database file does not exist: ${dbPath}`);
            }
            // For now, let's try to read the file as text to see if we can find any patterns
            const fileBuffer = fs.readFileSync(dbPath);
            const fileSize = fileBuffer.length;
            console.log(`DatabaseInspector: File size: ${fileSize} bytes`);
            // Try to find text patterns that might indicate table names or data
            const fileText = fileBuffer.toString('utf8', 0, Math.min(10000, fileSize));
            // Look for common SQLite patterns
            const sqliteHeader = fileBuffer.toString('ascii', 0, 16);
            console.log(`DatabaseInspector: SQLite header: ${sqliteHeader}`);
            // Look for potential table names or chat-related keywords
            const chatKeywords = [
                'chat', 'message', 'conversation', 'ai', 'cursor', 'prompt',
                'workbench', 'panel', 'aichat', 'aiService', 'history'
            ];
            const foundKeywords = [];
            chatKeywords.forEach(keyword => {
                if (fileText.toLowerCase().includes(keyword.toLowerCase())) {
                    foundKeywords.push(keyword);
                }
            });
            console.log(`DatabaseInspector: Found keywords: ${foundKeywords.join(', ')}`);
            // Try to extract potential JSON data
            const jsonMatches = fileText.match(/\{[^{}]*"[^"]*"[^{}]*\}/g);
            if (jsonMatches) {
                console.log(`DatabaseInspector: Found ${jsonMatches.length} potential JSON objects`);
                jsonMatches.slice(0, 3).forEach((match, index) => {
                    console.log(`DatabaseInspector: JSON sample ${index + 1}: ${match.substring(0, 200)}...`);
                });
            }
            return {
                path: dbPath,
                size: fileSize,
                sqliteHeader,
                foundKeywords,
                jsonSamples: jsonMatches?.slice(0, 3) || []
            };
        }
        catch (error) {
            console.error(`DatabaseInspector: Error inspecting database ${dbPath}:`, error);
            throw error;
        }
    }
    /**
     * Find and inspect all workspace storage databases
     */
    static async inspectAllWorkspaceStorages() {
        const results = [];
        try {
            // Get Cursor storage path
            const os = require('os');
            const cursorStoragePath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'workspaceStorage');
            console.log(`DatabaseInspector: Scanning ${cursorStoragePath}`);
            if (!fs.existsSync(cursorStoragePath)) {
                throw new Error(`Cursor storage path does not exist: ${cursorStoragePath}`);
            }
            const workspaceFolders = fs.readdirSync(cursorStoragePath);
            console.log(`DatabaseInspector: Found ${workspaceFolders.length} workspace folders`);
            for (const folder of workspaceFolders.slice(0, 5)) { // Limit to first 5 for performance
                const dbPath = path.join(cursorStoragePath, folder, 'state.vscdb');
                if (fs.existsSync(dbPath)) {
                    console.log(`DatabaseInspector: Inspecting ${folder}`);
                    try {
                        const inspection = await this.inspectDatabase(dbPath);
                        results.push({
                            workspaceId: folder,
                            ...inspection
                        });
                    }
                    catch (error) {
                        console.error(`DatabaseInspector: Failed to inspect ${folder}:`, error);
                    }
                }
            }
        }
        catch (error) {
            console.error('DatabaseInspector: Error scanning workspace storages:', error);
        }
        return results;
    }
    /**
     * Create a detailed report of database inspection results
     */
    static async createInspectionReport() {
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
                inspection.jsonSamples.forEach((sample, i) => {
                    report += `  ${i + 1}. \`${sample.substring(0, 100)}...\`\n`;
                });
            }
            report += '\n';
        });
        return report;
    }
}
exports.DatabaseInspector = DatabaseInspector;
//# sourceMappingURL=databaseInspector.js.map