"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Formatters = void 0;
class Formatters {
    /**
     * Format date to readable string
     */
    static formatDate(date) {
        return date.toLocaleString();
    }
    /**
     * Format date to ISO string
     */
    static formatDateISO(date) {
        return date.toISOString();
    }
    /**
     * Format file size to human readable
     */
    static formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0)
            return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
    /**
     * Sanitize string for filename
     */
    static sanitizeFilename(filename) {
        return filename
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 255);
    }
    /**
     * Escape HTML special characters
     */
    static escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    /**
     * Unescape HTML special characters
     */
    static unescapeHtml(text) {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");
    }
    /**
     * Convert text to kebab-case
     */
    static toKebabCase(text) {
        return text
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }
    /**
     * Convert text to camelCase
     */
    static toCamelCase(text) {
        return text
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toLowerCase() : word.toUpperCase();
        })
            .replace(/\s+/g, '');
    }
    /**
     * Truncate text to specified length
     */
    static truncate(text, maxLength, suffix = '...') {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - suffix.length) + suffix;
    }
    /**
     * Format duration in milliseconds to human readable
     */
    static formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        }
        else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    /**
     * Format number with thousands separator
     */
    static formatNumber(num) {
        return num.toLocaleString();
    }
    /**
     * Convert markdown to plain text
     */
    static markdownToText(markdown) {
        return markdown
            .replace(/#{1,6}\s+/g, '') // Remove headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1') // Remove italic
            .replace(/`(.*?)`/g, '$1') // Remove inline code
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
            .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
            .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
            .trim();
    }
}
exports.Formatters = Formatters;
//# sourceMappingURL=formatters.js.map