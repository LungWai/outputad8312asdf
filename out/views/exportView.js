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
exports.ExportView = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const exportService_1 = require("../services/exportService");
const projectOrganizer_1 = require("../services/projectOrganizer");
class ExportView {
    constructor(panel, context) {
        this.disposables = [];
        this.panel = panel;
        this.context = context;
        // Set the webview's initial html content
        this.updateWebview();
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'export':
                    await this.handleExport(message.data);
                    return;
            }
        }, null, this.disposables);
    }
    // Create or show export panel
    static createOrShow(context) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If we already have a panel, show it
        if (ExportView.currentPanel) {
            ExportView.currentPanel.panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel('cursorChatManagerExport', 'Export Cursor Chats', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath, 'resources'))
            ]
        });
        ExportView.currentPanel = new ExportView(panel, context);
    }
    // Handle export action from the webview
    async handleExport(data) {
        try {
            const exportService = exportService_1.ExportService.getInstance();
            const options = {
                format: data.format,
                includeMetadata: data.includeMetadata,
                includeTimestamps: data.includeTimestamps,
                includeTags: data.includeTags,
                targetPath: data.targetPath
            };
            // Start export process
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Exporting Chats",
                cancellable: false
            }, async (progress) => {
                if (data.exportType === 'all') {
                    // Export all projects
                    const projectOrganizer = projectOrganizer_1.ProjectOrganizer.getInstance();
                    const projects = await projectOrganizer.getAllProjects();
                    let totalProjects = projects.length;
                    let completedProjects = 0;
                    for (const project of projects) {
                        progress.report({
                            message: `Exporting project ${project.name} (${completedProjects + 1}/${totalProjects})`,
                            increment: (1 / totalProjects) * 100
                        });
                        await exportService.exportProject(project, options);
                        completedProjects++;
                    }
                }
                else if (data.exportType === 'project') {
                    // Export single project
                    const projectOrganizer = projectOrganizer_1.ProjectOrganizer.getInstance();
                    const project = await projectOrganizer.getProject(data.projectId);
                    if (project) {
                        progress.report({ message: `Exporting project ${project.name}`, increment: 50 });
                        await exportService.exportProject(project, options);
                        progress.report({ increment: 50 });
                    }
                    else {
                        throw new Error(`Project with ID ${data.projectId} not found`);
                    }
                }
                else if (data.exportType === 'chat') {
                    // Export single chat
                    const projectOrganizer = projectOrganizer_1.ProjectOrganizer.getInstance();
                    const projects = await projectOrganizer.getAllProjects();
                    let found = false;
                    for (const project of projects) {
                        const chat = project.chats.find(c => c.id === data.chatId);
                        if (chat) {
                            progress.report({ message: `Exporting chat ${chat.title}`, increment: 50 });
                            await exportService.exportChat(chat, options);
                            progress.report({ increment: 50 });
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        throw new Error(`Chat with ID ${data.chatId} not found`);
                    }
                }
                return Promise.resolve();
            });
            // Send success message to webview
            this.panel.webview.postMessage({
                command: 'exportComplete',
                success: true,
                targetPath: options.targetPath
            });
            vscode.window.showInformationMessage(`Export completed successfully to ${options.targetPath}`);
        }
        catch (error) {
            // Send error message to webview
            this.panel.webview.postMessage({
                command: 'exportComplete',
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
            vscode.window.showErrorMessage(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Update webview content
    async updateWebview() {
        const webview = this.panel.webview;
        try {
            // Get projects for the form
            const projectOrganizer = projectOrganizer_1.ProjectOrganizer.getInstance();
            const projects = await projectOrganizer.getAllProjects();
            // Generate HTML content
            webview.html = this.getWebviewContent(projects);
        }
        catch (error) {
            webview.html = this.getErrorHtml(error);
        }
    }
    // Generate webview HTML
    getWebviewContent(projects) {
        const webview = this.panel.webview;
        const nonce = this.getNonce();
        // Generate project options for select
        const projectOptions = projects.map(project => {
            return `<option value="${project.id}">${this.escapeHtml(project.name)} (${project.chats.length} chats)</option>`;
        }).join('\n');
        // Generate chat options grouped by project
        const chatOptions = projects.map(project => {
            const options = project.chats.map(chat => {
                return `<option value="${chat.id}">${this.escapeHtml(chat.title)}</option>`;
            }).join('\n');
            return `<optgroup label="${this.escapeHtml(project.name)}">${options}</optgroup>`;
        }).join('\n');
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Export Cursor Chats</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            padding: 20px;
            line-height: 1.5;
        }
        h1 {
            color: var(--vscode-editor-foreground);
            font-weight: 600;
            margin-bottom: 20px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
        }
        select, input[type="text"] {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
        }
        .checkbox-group {
            margin-top: 10px;
        }
        .checkbox-label {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            font-weight: normal;
        }
        input[type="checkbox"] {
            margin-right: 8px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 2px;
            font-weight: 500;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .export-type-fields {
            margin-top: 10px;
            padding-left: 20px;
        }
        .hidden {
            display: none;
        }
        .success {
            color: var(--vscode-notificationsSuccessIcon-foreground);
            margin-top: 20px;
        }
        .error {
            color: var(--vscode-notificationsErrorIcon-foreground);
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <h1>Export Cursor Chats</h1>
    
    <form id="exportForm">
        <div class="form-group">
            <label for="exportType">What to Export:</label>
            <select id="exportType" name="exportType">
                <option value="all">All Projects</option>
                <option value="project">Single Project</option>
                <option value="chat">Single Chat</option>
            </select>
        </div>
        
        <div id="projectField" class="form-group export-type-fields hidden">
            <label for="projectId">Select Project:</label>
            <select id="projectId" name="projectId">
                ${projectOptions}
            </select>
        </div>
        
        <div id="chatField" class="form-group export-type-fields hidden">
            <label for="chatId">Select Chat:</label>
            <select id="chatId" name="chatId">
                ${chatOptions}
            </select>
        </div>
        
        <div class="form-group">
            <label for="format">Export Format:</label>
            <select id="format" name="format">
                <option value="html">HTML</option>
                <option value="json">JSON</option>
                <option value="text">Plain Text</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="targetPath">Export Path:</label>
            <input type="text" id="targetPath" name="targetPath" placeholder="C:\\Path\\To\\Export\\Directory" />
            <small>Full path to directory where files will be saved</small>
        </div>
        
        <div class="form-group">
            <label>Export Options:</label>
            <div class="checkbox-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="includeMetadata" name="includeMetadata" checked />
                    Include Metadata
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" id="includeTimestamps" name="includeTimestamps" checked />
                    Include Timestamps
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" id="includeTags" name="includeTags" checked />
                    Include Tags
                </label>
            </div>
        </div>
        
        <button type="submit">Export</button>
    </form>
    
    <div id="result" class="hidden"></div>
    
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        document.addEventListener('DOMContentLoaded', () => {
            const exportForm = document.getElementById('exportForm');
            const exportTypeSelect = document.getElementById('exportType');
            const projectField = document.getElementById('projectField');
            const chatField = document.getElementById('chatField');
            const resultDiv = document.getElementById('result');
            
            // Show/hide fields based on export type
            exportTypeSelect.addEventListener('change', () => {
                const exportType = exportTypeSelect.value;
                
                if (exportType === 'project') {
                    projectField.classList.remove('hidden');
                    chatField.classList.add('hidden');
                } else if (exportType === 'chat') {
                    projectField.classList.add('hidden');
                    chatField.classList.remove('hidden');
                } else {
                    projectField.classList.add('hidden');
                    chatField.classList.add('hidden');
                }
            });
            
            // Handle form submission
            exportForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const exportType = exportTypeSelect.value;
                const format = document.getElementById('format').value;
                const targetPath = document.getElementById('targetPath').value;
                const includeMetadata = document.getElementById('includeMetadata').checked;
                const includeTimestamps = document.getElementById('includeTimestamps').checked;
                const includeTags = document.getElementById('includeTags').checked;
                
                if (!targetPath) {
                    showError('Please enter an export path');
                    return;
                }
                
                // Get project or chat ID if needed
                let projectId = null;
                let chatId = null;
                
                if (exportType === 'project') {
                    projectId = document.getElementById('projectId').value;
                } else if (exportType === 'chat') {
                    chatId = document.getElementById('chatId').value;
                }
                
                // Send message to extension
                vscode.postMessage({
                    command: 'export',
                    data: {
                        exportType,
                        projectId,
                        chatId,
                        format,
                        targetPath,
                        includeMetadata,
                        includeTimestamps,
                        includeTags
                    }
                });
            });
            
            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                
                if (message.command === 'exportComplete') {
                    if (message.success) {
                        showSuccess(\`Export completed successfully to \${message.targetPath}\`);
                    } else {
                        showError(\`Export failed: \${message.error}\`);
                    }
                }
            });
            
            function showSuccess(message) {
                resultDiv.innerHTML = \`<div class="success">\${message}</div>\`;
                resultDiv.classList.remove('hidden');
            }
            
            function showError(message) {
                resultDiv.innerHTML = \`<div class="error">\${message}</div>\`;
                resultDiv.classList.remove('hidden');
            }
        });
    </script>
</body>
</html>`;
    }
    // Generate error HTML
    getErrorHtml(error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Export Error</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            padding: 20px;
        }
        .error {
            color: var(--vscode-notificationsErrorIcon-foreground);
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <h1>Error Loading Export View</h1>
    <div class="error">${this.escapeHtml(errorMessage)}</div>
</body>
</html>`;
    }
    // Helper to generate a nonce
    getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
    // Escape HTML special characters
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    // Dispose of resources
    dispose() {
        ExportView.currentPanel = undefined;
        // Dispose of all disposables (i.e. commands) for this panel
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
        // Dispose of the panel
        this.panel.dispose();
    }
}
exports.ExportView = ExportView;
//# sourceMappingURL=exportView.js.map