"use strict";
/**
 * Centralized logging utility with level control
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["NONE"] = 4] = "NONE";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor() {
        // Set log level based on environment
        this.isDevelopment = process.env.NODE_ENV !== 'production';
        this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
        // Allow override via environment variable
        const envLogLevel = process.env.CURSOR_LOG_LEVEL;
        if (envLogLevel) {
            this.logLevel = LogLevel[envLogLevel] ?? this.logLevel;
        }
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    setLogLevel(level) {
        this.logLevel = level;
    }
    shouldLog(level) {
        return level >= this.logLevel;
    }
    formatMessage(level, component, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] [${component}] ${message}`;
    }
    debug(component, message, ...args) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.log(this.formatMessage('DEBUG', component, message), ...args);
        }
    }
    info(component, message, ...args) {
        if (this.shouldLog(LogLevel.INFO)) {
            console.log(this.formatMessage('INFO', component, message), ...args);
        }
    }
    warn(component, message, ...args) {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage('WARN', component, message), ...args);
        }
    }
    error(component, message, error) {
        if (this.shouldLog(LogLevel.ERROR)) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(this.formatMessage('ERROR', component, message), errorMessage);
            if (error instanceof Error && error.stack && this.isDevelopment) {
                console.error(error.stack);
            }
        }
    }
    group(component, title, fn) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.group(this.formatMessage('GROUP', component, title));
            fn();
            console.groupEnd();
        }
        else {
            fn();
        }
    }
    time(component, label) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.time(`[${component}] ${label}`);
        }
    }
    timeEnd(component, label) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.timeEnd(`[${component}] ${label}`);
        }
    }
}
exports.Logger = Logger;
// Export singleton instance
exports.logger = Logger.getInstance();
//# sourceMappingURL=logger.js.map