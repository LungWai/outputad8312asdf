"use strict";
/**
 * Development configuration for the Cursor Chat Manager extension
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevelopmentConfigManager = void 0;
class DevelopmentConfigManager {
    constructor() {
        this.config = this.loadConfig();
    }
    static getInstance() {
        if (!DevelopmentConfigManager.instance) {
            DevelopmentConfigManager.instance = new DevelopmentConfigManager();
        }
        return DevelopmentConfigManager.instance;
    }
    loadConfig() {
        // Always use real data - no mock data
        const isDevelopment = process.env.NODE_ENV === 'development' ||
            process.env.VSCODE_DEBUG_MODE === 'true' ||
            process.execPath.toLowerCase().includes('cursor');
        return {
            useMockData: false, // NEVER use mock data
            enableVerboseLogging: isDevelopment,
            skipDatabaseLockCheck: false,
            mockDataCount: 0 // No mock data
        };
    }
    getConfig() {
        return { ...this.config };
    }
    isRunningInCursor() {
        const processName = process.execPath.toLowerCase();
        return processName.includes('cursor') ||
            process.env.TERM_PROGRAM === 'cursor' ||
            process.env.VSCODE_PID !== undefined;
    }
    shouldUseMockData() {
        // Always use real data for proper testing and development
        return false;
    }
    shouldEnableVerboseLogging() {
        return this.config.enableVerboseLogging;
    }
}
exports.DevelopmentConfigManager = DevelopmentConfigManager;
//# sourceMappingURL=developmentConfig.js.map