"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageManager = void 0;
const logger_1 = require("../utils/logger");
const constants_1 = require("../config/constants");
class StorageManager {
    constructor() {
        this.context = null;
    }
    static getInstance() {
        if (!StorageManager.instance) {
            StorageManager.instance = new StorageManager();
        }
        return StorageManager.instance;
    }
    initialize(context) {
        this.context = context;
    }
    async saveData(key, data) {
        if (!this.context) {
            throw new Error('Storage manager not initialized');
        }
        try {
            const storageData = {
                version: StorageManager.CURRENT_VERSION,
                data,
                timestamp: new Date().toISOString()
            };
            await this.context.globalState.update(key, storageData);
            return true;
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.STORAGE_MANAGER, 'Error saving data', error);
            return false;
        }
    }
    async getData(key, defaultValue) {
        if (!this.context) {
            throw new Error('Storage manager not initialized');
        }
        try {
            const storageData = this.context.globalState.get(key);
            if (!storageData) {
                return defaultValue;
            }
            // Handle data migration if needed
            const migratedData = this.migrateDataIfNeeded(storageData);
            return migratedData.data;
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.STORAGE_MANAGER, 'Error retrieving data', error);
            return defaultValue;
        }
    }
    async removeData(key) {
        if (!this.context) {
            throw new Error('Storage manager not initialized');
        }
        try {
            await this.context.globalState.update(key, undefined);
            return true;
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.STORAGE_MANAGER, 'Error removing data', error);
            return false;
        }
    }
    async getAllKeys() {
        if (!this.context) {
            throw new Error('Storage manager not initialized');
        }
        try {
            // Get all keys from globalState that have our format
            const keys = [];
            this.context.globalState.keys().forEach(key => {
                const data = this.context?.globalState.get(key);
                if (data && typeof data === 'object' && 'version' in data) {
                    keys.push(key);
                }
            });
            return keys;
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.STORAGE_MANAGER, 'Error getting keys', error);
            return [];
        }
    }
    migrateDataIfNeeded(storageData) {
        // If the version matches current, no migration needed
        if (storageData.version === StorageManager.CURRENT_VERSION) {
            return storageData;
        }
        // Handle migrations between different versions
        // For future use as new versions are introduced
        logger_1.logger.info(constants_1.LOG_COMPONENTS.STORAGE_MANAGER, `Migrating data from version ${storageData.version} to ${StorageManager.CURRENT_VERSION}`);
        // For now, just update the version
        return {
            ...storageData,
            version: StorageManager.CURRENT_VERSION
        };
    }
}
exports.StorageManager = StorageManager;
StorageManager.CURRENT_VERSION = '1.0.0';
//# sourceMappingURL=storageManager.js.map