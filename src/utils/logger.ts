/**
 * Centralized logging utility with level control
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private isDevelopment: boolean;

  private constructor() {
    // Set log level based on environment
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
    
    // Allow override via environment variable
    const envLogLevel = process.env.CURSOR_LOG_LEVEL;
    if (envLogLevel) {
      this.logLevel = LogLevel[envLogLevel as keyof typeof LogLevel] ?? this.logLevel;
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: string, component: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${component}] ${message}`;
  }

  public debug(component: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('DEBUG', component, message), ...args);
    }
  }

  public info(component: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', component, message), ...args);
    }
  }

  public warn(component: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', component, message), ...args);
    }
  }

  public error(component: string, message: string, error?: Error | any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(this.formatMessage('ERROR', component, message), errorMessage);
      if (error instanceof Error && error.stack && this.isDevelopment) {
        console.error(error.stack);
      }
    }
  }

  public group(component: string, title: string, fn: () => void): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.group(this.formatMessage('GROUP', component, title));
      fn();
      console.groupEnd();
    } else {
      fn();
    }
  }

  public time(component: string, label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.time(`[${component}] ${label}`);
    }
  }

  public timeEnd(component: string, label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.timeEnd(`[${component}] ${label}`);
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();