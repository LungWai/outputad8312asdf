/**
 * Development configuration for the Cursor Chat Manager extension
 */

export interface DevelopmentConfig {
  useMockData: boolean;
  enableVerboseLogging: boolean;
  skipDatabaseLockCheck: boolean;
  mockDataCount: number;
}

export class DevelopmentConfigManager {
  private static instance: DevelopmentConfigManager;
  private config: DevelopmentConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): DevelopmentConfigManager {
    if (!DevelopmentConfigManager.instance) {
      DevelopmentConfigManager.instance = new DevelopmentConfigManager();
    }
    return DevelopmentConfigManager.instance;
  }

  private loadConfig(): DevelopmentConfig {
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

  public getConfig(): DevelopmentConfig {
    return { ...this.config };
  }

  public isRunningInCursor(): boolean {
    const processName = process.execPath.toLowerCase();
    return processName.includes('cursor') || 
           process.env.TERM_PROGRAM === 'cursor' ||
           process.env.VSCODE_PID !== undefined;
  }

  public shouldUseMockData(): boolean {
    // Always use real data for proper testing and development
    return false;
  }

  public shouldEnableVerboseLogging(): boolean {
    return this.config.enableVerboseLogging;
  }
}
