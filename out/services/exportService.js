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
exports.ExportService = exports.ExportFormat = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
const constants_1 = require("../config/constants");
var ExportFormat;
(function (ExportFormat) {
    ExportFormat["JSON"] = "json";
    ExportFormat["HTML"] = "html";
    ExportFormat["TEXT"] = "text";
})(ExportFormat || (exports.ExportFormat = ExportFormat = {}));
class ExportService {
    constructor() {
        // Initialize template path
        this.templatePath = path.join(__dirname, '..', '..', 'resources', 'templates');
    }
    static getInstance() {
        if (!ExportService.instance) {
            ExportService.instance = new ExportService();
        }
        return ExportService.instance;
    }
    /**
     * Export a single chat
     */
    async exportChat(chat, options) {
        try {
            const content = this.formatChat(chat, options);
            const filePath = this.generateFilePath(options.targetPath, chat.title, options.format);
            await this.writeToFile(filePath, content);
            return filePath;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to export chat: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Export multiple chats
     */
    async exportChats(chats, options) {
        const exportedFiles = [];
        try {
            for (const chat of chats) {
                const filePath = await this.exportChat(chat, options);
                exportedFiles.push(filePath);
            }
            return exportedFiles;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to export chats: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Export a project containing multiple chats
     */
    async exportProject(project, options) {
        try {
            // Create project directory
            const projectDirPath = path.join(options.targetPath, this.sanitizeFileName(project.name));
            await fs.promises.mkdir(projectDirPath, { recursive: true });
            // Export individual chats
            const chatOptions = { ...options, targetPath: projectDirPath };
            const chatPaths = [];
            for (const chat of project.chats) {
                const chatPath = await this.exportChat(chat, chatOptions);
                chatPaths.push(chatPath);
            }
            // Create project index if HTML format
            if (options.format === ExportFormat.HTML) {
                const indexPath = path.join(projectDirPath, 'index.html');
                const indexContent = await this.generateProjectIndex(project, chatPaths, options);
                await this.writeToFile(indexPath, indexContent);
            }
            return projectDirPath;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to export project: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Format chat content based on export format
     */
    formatChat(chat, options) {
        const format = typeof options === 'object' ? options.format : options;
        switch (format) {
            case ExportFormat.JSON:
                return this.formatChatAsJSON(chat, typeof options === 'object' ? options : undefined);
            case ExportFormat.HTML:
                return this.formatChatAsHTML(chat, typeof options === 'object' ? options : undefined);
            case ExportFormat.TEXT:
                return this.formatChatAsText(chat, typeof options === 'object' ? options : undefined);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    /**
     * Format chat as JSON
     */
    formatChatAsJSON(chat, options) {
        // If no specific options, export everything
        if (!options) {
            return JSON.stringify(chat, null, 2);
        }
        // Create a copy of the chat to avoid modifying the original
        const chatCopy = JSON.parse(JSON.stringify(chat));
        // Remove unwanted properties based on options
        if (!options.includeMetadata) {
            delete chatCopy.id;
            delete chatCopy.createdAt;
            delete chatCopy.updatedAt;
        }
        if (!options.includeTimestamps) {
            delete chatCopy.createdAt;
            delete chatCopy.updatedAt;
            chatCopy.dialogues.forEach((dialogue) => {
                delete dialogue.timestamp;
            });
        }
        if (!options.includeTags) {
            delete chatCopy.tags;
            chatCopy.dialogues.forEach((dialogue) => {
                delete dialogue.tags;
            });
        }
        return JSON.stringify(chatCopy, null, 2);
    }
    /**
     * Format chat as HTML
     */
    formatChatAsHTML(chat, options) {
        // Load HTML template
        let template = this.loadTemplate('chat.html');
        // Basic chat info
        template = template.replace('{{CHAT_TITLE}}', this.sanitizeHtml(chat.title));
        // Metadata section
        let metadataHtml = '';
        if (options?.includeMetadata) {
            metadataHtml = `
        <div class="metadata">
          <div class="metadata-item">ID: ${this.sanitizeHtml(chat.id)}</div>
          ${options?.includeTimestamps ? `
            <div class="metadata-item">Created: ${new Date(chat.timestamp).toLocaleString()}</div>
          ` : ''}
          ${options?.includeTags && chat.tags && chat.tags.length > 0 ? `
            <div class="metadata-item">Tags: ${chat.tags.map(tag => `<span class="tag">${this.sanitizeHtml(tag)}</span>`).join(' ')}</div>
          ` : ''}
        </div>
      `;
        }
        template = template.replace('{{METADATA}}', metadataHtml);
        // Format dialogues
        const dialoguesHtml = chat.dialogues.map(dialogue => {
            return `
        <div class="dialogue ${dialogue.isUser ? 'user' : 'assistant'}">
          <div class="dialogue-header">
            <span class="role">${this.sanitizeHtml(dialogue.isUser ? 'User' : 'Assistant')}</span>
            ${options?.includeTimestamps ? `<span class="timestamp">${new Date(dialogue.timestamp).toLocaleString()}</span>` : ''}
            ${options?.includeTags && dialogue.tags && dialogue.tags.length > 0 ?
                `<span class="tags">${dialogue.tags.map(tag => `<span class="tag">${this.sanitizeHtml(tag)}</span>`).join(' ')}</span>` : ''}
          </div>
          <div class="dialogue-content">${this.formatDialogueContent(dialogue)}</div>
        </div>
      `;
        }).join('\n');
        template = template.replace('{{DIALOGUES}}', dialoguesHtml);
        return template;
    }
    /**
     * Format dialogue content with proper handling of code blocks, etc.
     */
    formatDialogueContent(dialogue) {
        // Simple implementation - in a real project, use a proper markdown renderer
        const content = this.sanitizeHtml(dialogue.content);
        // Replace code blocks - this is simplistic and would be more robust in a real implementation
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        return content.replace(codeBlockRegex, (_, language, code) => {
            return `<pre class="code-block ${language}"><code>${this.sanitizeHtml(code)}</code></pre>`;
        });
    }
    /**
     * Format chat as plain text
     */
    formatChatAsText(chat, options) {
        let result = `# ${chat.title}\n\n`;
        // Add metadata if required
        if (options?.includeMetadata) {
            result += `ID: ${chat.id}\n`;
            if (options?.includeTimestamps) {
                result += `Created: ${new Date(chat.timestamp).toLocaleString()}\n`;
            }
            if (options?.includeTags && chat.tags && chat.tags.length > 0) {
                result += `Tags: ${chat.tags.join(', ')}\n`;
            }
            result += '\n';
        }
        // Add dialogues
        chat.dialogues.forEach(dialogue => {
            result += `## ${dialogue.isUser ? 'USER' : 'ASSISTANT'}\n`;
            if (options?.includeTimestamps) {
                result += `Time: ${new Date(dialogue.timestamp).toLocaleString()}\n`;
            }
            if (options?.includeTags && dialogue.tags && dialogue.tags.length > 0) {
                result += `Tags: ${dialogue.tags.join(', ')}\n`;
            }
            result += `\n${dialogue.content}\n\n`;
        });
        return result;
    }
    /**
     * Generate an index page for a project containing multiple chats
     */
    async generateProjectIndex(project, chatPaths, options) {
        // Load project index template
        let template = this.loadTemplate('project-index.html');
        // Set project name
        template = template.replace('{{PROJECT_NAME}}', this.sanitizeHtml(project.name));
        // Generate chat list
        const chatList = project.chats.map((chat, index) => {
            const relativePath = path.basename(chatPaths[index]);
            return `<li><a href="./${relativePath}">${this.sanitizeHtml(chat.title)}</a></li>`;
        }).join('\n');
        template = template.replace('{{CHAT_LIST}}', chatList);
        // Add metadata if needed
        let metadataHtml = '';
        if (options.includeMetadata) {
            metadataHtml = `
        <div class="metadata">
          <div class="metadata-item">ID: ${this.sanitizeHtml(project.id)}</div>
          ${options.includeTimestamps ? `
            <div class="metadata-item">Created: ${new Date(project.created).toLocaleString()}</div>
          ` : ''}
          <div class="metadata-item">Total Chats: ${project.chats.length}</div>
        </div>
      `;
        }
        template = template.replace('{{METADATA}}', metadataHtml);
        return template;
    }
    /**
     * Load a template file
     */
    loadTemplate(templateName) {
        try {
            const templateFilePath = path.join(this.templatePath, templateName);
            return fs.readFileSync(templateFilePath, 'utf-8');
        }
        catch (error) {
            // If template doesn't exist, return a basic fallback template
            logger_1.logger.error(constants_1.LOG_COMPONENTS.EXPORT_SERVICE, `Failed to load template ${templateName}`, error);
            if (templateName === 'chat.html') {
                return this.getFallbackChatTemplate();
            }
            else if (templateName === 'project-index.html') {
                return this.getFallbackProjectTemplate();
            }
            throw new Error(`Template not found and no fallback available: ${templateName}`);
        }
    }
    /**
     * Get a fallback chat template when the template file is missing
     */
    getFallbackChatTemplate() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{CHAT_TITLE}}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    .metadata { background: #f8f8f8; padding: 10px; margin-bottom: 20px; border-radius: 4px; }
    .metadata-item { margin-bottom: 5px; }
    .tag { background: #e0e0e0; padding: 2px 6px; border-radius: 3px; font-size: 12px; margin-right: 5px; }
    .dialogue { margin-bottom: 20px; padding: 10px; border-radius: 4px; }
    .user { background: #e6f7ff; border-left: 4px solid #1890ff; }
    .assistant { background: #f6ffed; border-left: 4px solid #52c41a; }
    .dialogue-header { display: flex; margin-bottom: 10px; font-size: 14px; color: #666; }
    .role { font-weight: bold; margin-right: 10px; }
    .timestamp { margin-right: 10px; }
    .dialogue-content { white-space: pre-wrap; }
    .code-block { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>{{CHAT_TITLE}}</h1>
  {{METADATA}}
  <div class="dialogues">
    {{DIALOGUES}}
  </div>
</body>
</html>`;
    }
    /**
     * Get a fallback project template when the template file is missing
     */
    getFallbackProjectTemplate() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{PROJECT_NAME}}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    .metadata { background: #f8f8f8; padding: 10px; margin-bottom: 20px; border-radius: 4px; }
    .metadata-item { margin-bottom: 5px; }
    ul { list-style-type: none; padding: 0; }
    li { margin-bottom: 10px; }
    a { color: #1890ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>{{PROJECT_NAME}}</h1>
  {{METADATA}}
  <h2>Chats</h2>
  <ul>
    {{CHAT_LIST}}
  </ul>
</body>
</html>`;
    }
    /**
     * Generate a file path for export
     */
    generateFilePath(basePath, title, format) {
        const filename = `${this.sanitizeFileName(title)}.${format}`;
        return path.join(basePath, filename);
    }
    /**
     * Write content to a file
     */
    async writeToFile(filePath, content) {
        try {
            // Ensure directory exists
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
            // Write file
            await fs.promises.writeFile(filePath, content, 'utf-8');
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.EXPORT_SERVICE, `Error writing to file ${filePath}`, error);
            throw error;
        }
    }
    /**
     * Sanitize a string for use as a filename
     */
    sanitizeFileName(input) {
        return input
            .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/_+/g, '_') // Replace multiple underscores with a single one
            .substring(0, 255); // Truncate to safe length
    }
    /**
     * Sanitize HTML to prevent XSS
     */
    sanitizeHtml(input) {
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
exports.ExportService = ExportService;
//# sourceMappingURL=exportService.js.map