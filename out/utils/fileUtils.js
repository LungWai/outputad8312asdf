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
exports.FileUtils = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class FileUtils {
    /**
     * Check if file exists
     */
    static async exists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Read file as string
     */
    static async readFile(filePath, encoding = 'utf8') {
        return await fs.readFile(filePath, encoding);
    }
    /**
     * Write file
     */
    static async writeFile(filePath, content, encoding = 'utf8') {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        await this.ensureDirectory(dir);
        await fs.writeFile(filePath, content, encoding);
    }
    /**
     * Ensure directory exists
     */
    static async ensureDirectory(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        }
        catch (error) {
            // Ignore error if directory already exists
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
    /**
     * Delete file
     */
    static async deleteFile(filePath) {
        await fs.unlink(filePath);
    }
    /**
     * Copy file
     */
    static async copyFile(source, destination) {
        // Ensure destination directory exists
        const dir = path.dirname(destination);
        await this.ensureDirectory(dir);
        await fs.copyFile(source, destination);
    }
    /**
     * Get file stats
     */
    static async getStats(filePath) {
        return await fs.stat(filePath);
    }
    /**
     * List directory contents
     */
    static async listDirectory(dirPath) {
        return await fs.readdir(dirPath);
    }
    /**
     * Get file size in bytes
     */
    static async getFileSize(filePath) {
        const stats = await this.getStats(filePath);
        return stats.size;
    }
    /**
     * Check if path is a directory
     */
    static async isDirectory(dirPath) {
        try {
            const stats = await this.getStats(dirPath);
            return stats.isDirectory();
        }
        catch {
            return false;
        }
    }
    /**
     * Check if path is a file
     */
    static async isFile(filePath) {
        try {
            const stats = await this.getStats(filePath);
            return stats.isFile();
        }
        catch {
            return false;
        }
    }
}
exports.FileUtils = FileUtils;
//# sourceMappingURL=fileUtils.js.map