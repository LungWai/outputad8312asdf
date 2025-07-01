import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { LOG_COMPONENTS } from '../config/constants';

export interface StorageData {
  version: string;
  data: any;
  timestamp: string;
}

export class StorageManager {
  private static instance: StorageManager;
  private static readonly CURRENT_VERSION = '1.0.0';
  private context: vscode.ExtensionContext | null = null;

  private constructor() {}

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  public initialize(context: vscode.ExtensionContext): void {
    this.context = context;
  }

  public async saveData(key: string, data: any): Promise<boolean> {
    if (!this.context) {
      throw new Error('Storage manager not initialized');
    }

    try {
      const storageData: StorageData = {
        version: StorageManager.CURRENT_VERSION,
        data,
        timestamp: new Date().toISOString()
      };

      await this.context.globalState.update(key, storageData);
      return true;
    } catch (error) {
      logger.error(LOG_COMPONENTS.STORAGE_MANAGER, 'Error saving data', error);
      return false;
    }
  }

  public async getData<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    if (!this.context) {
      throw new Error('Storage manager not initialized');
    }

    try {
      const storageData = this.context.globalState.get<StorageData>(key);
      
      if (!storageData) {
        return defaultValue;
      }

      // Handle data migration if needed
      const migratedData = this.migrateDataIfNeeded(storageData);
      return migratedData.data as T;
    } catch (error) {
      logger.error(LOG_COMPONENTS.STORAGE_MANAGER, 'Error retrieving data', error);
      return defaultValue;
    }
  }

  public async removeData(key: string): Promise<boolean> {
    if (!this.context) {
      throw new Error('Storage manager not initialized');
    }

    try {
      await this.context.globalState.update(key, undefined);
      return true;
    } catch (error) {
      logger.error(LOG_COMPONENTS.STORAGE_MANAGER, 'Error removing data', error);
      return false;
    }
  }

  public async getAllKeys(): Promise<string[]> {
    if (!this.context) {
      throw new Error('Storage manager not initialized');
    }

    try {
      // Get all keys from globalState that have our format
      const keys: string[] = [];
      this.context.globalState.keys().forEach(key => {
        const data = this.context?.globalState.get(key);
        if (data && typeof data === 'object' && 'version' in data) {
          keys.push(key);
        }
      });
      
      return keys;
    } catch (error) {
      logger.error(LOG_COMPONENTS.STORAGE_MANAGER, 'Error getting keys', error);
      return [];
    }
  }

  private migrateDataIfNeeded(storageData: StorageData): StorageData {
    // If the version matches current, no migration needed
    if (storageData.version === StorageManager.CURRENT_VERSION) {
      return storageData;
    }

    // Handle migrations between different versions
    // For future use as new versions are introduced
    logger.info(LOG_COMPONENTS.STORAGE_MANAGER, `Migrating data from version ${storageData.version} to ${StorageManager.CURRENT_VERSION}`);
    
    // For now, just update the version
    return {
      ...storageData,
      version: StorageManager.CURRENT_VERSION
    };
  }
} 