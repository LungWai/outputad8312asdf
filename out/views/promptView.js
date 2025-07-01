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
exports.PromptView = exports.PromptTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const promptManager_1 = require("../services/promptManager");
class PromptTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, contextValue, id, iconPath, command, prompt) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.id = id;
        this.iconPath = iconPath;
        this.command = command;
        this.prompt = prompt;
        this.id = id;
        this.contextValue = contextValue;
        this.iconPath = iconPath;
        this.command = command;
        this.tooltip = label;
        // Add description for prompts showing their category
        if (prompt) {
            this.description = prompt.category || 'Uncategorized';
        }
    }
}
exports.PromptTreeItem = PromptTreeItem;
class PromptView {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.promptManager = promptManager_1.PromptManager.getInstance();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        // Root level - show all categories from PromptManager
        if (!element) {
            // Get all categories
            const categories = await this.promptManager.getCategories();
            const items = [];
            // Add popular prompts section
            items.push(new PromptTreeItem('Popular Prompts', vscode.TreeItemCollapsibleState.Expanded, 'popular', 'popular-prompts', new vscode.ThemeIcon('star-full')));
            // Add category nodes
            if (categories.length > 0) {
                // Sort categories alphabetically
                categories.sort();
                for (const category of categories) {
                    items.push(new PromptTreeItem(category, vscode.TreeItemCollapsibleState.Collapsed, 'category', `category-${category}`, new vscode.ThemeIcon('folder')));
                }
            }
            // Add uncategorized section
            items.push(new PromptTreeItem('Uncategorized', vscode.TreeItemCollapsibleState.Collapsed, 'category', 'category-uncategorized', new vscode.ThemeIcon('list-unordered')));
            return items;
        }
        // Popular prompts section
        if (element.contextValue === 'popular') {
            const popularPrompts = await this.promptManager.getPopularPrompts(5);
            if (popularPrompts.length === 0) {
                return [
                    new PromptTreeItem('No prompts used yet', vscode.TreeItemCollapsibleState.None, 'empty', 'no-popular-prompts', new vscode.ThemeIcon('info'))
                ];
            }
            return popularPrompts.map(prompt => {
                return new PromptTreeItem(`${prompt.title} (${prompt.usageCount} uses)`, vscode.TreeItemCollapsibleState.None, 'prompt', prompt.id, new vscode.ThemeIcon('file-text'), {
                    command: 'cursor-chat-manager.usePrompt',
                    title: 'Use Prompt',
                    arguments: [prompt.id]
                }, prompt);
            });
        }
        // Category level - show prompts in the category
        if (element.contextValue === 'category') {
            const categoryName = element.id.replace('category-', '');
            let prompts;
            if (categoryName === 'uncategorized') {
                // Get all prompts without a category
                prompts = (await this.promptManager.getPrompts()).filter(prompt => !prompt.category || prompt.category.trim() === '');
            }
            else {
                // Get prompts from this category
                prompts = await this.promptManager.getPromptsByCategory(categoryName);
            }
            if (prompts.length === 0) {
                return [
                    new PromptTreeItem('No prompts in this category', vscode.TreeItemCollapsibleState.None, 'empty', `no-prompts-${categoryName}`, new vscode.ThemeIcon('info'))
                ];
            }
            // Sort prompts by title
            prompts.sort((a, b) => a.title.localeCompare(b.title));
            return prompts.map(prompt => {
                const variableCount = prompt.variables.length;
                const variableText = variableCount === 1
                    ? '1 variable'
                    : `${variableCount} variables`;
                return new PromptTreeItem(prompt.title, vscode.TreeItemCollapsibleState.None, 'prompt', prompt.id, new vscode.ThemeIcon('file-text'), {
                    command: 'cursor-chat-manager.usePrompt',
                    title: 'Use Prompt',
                    arguments: [prompt.id]
                }, prompt);
            });
        }
        return [];
    }
    /**
     * Create a WebviewPanel to preview a prompt
     */
    async previewPrompt(promptId) {
        const prompt = await this.promptManager.getPromptById(promptId);
        if (!prompt) {
            vscode.window.showErrorMessage('Prompt not found');
            return;
        }
        // Create a new webview panel
        const panel = vscode.window.createWebviewPanel('cursor-chat-manager.promptPreview', `Prompt: ${prompt.title}`, vscode.ViewColumn.One, {
            enableScripts: true
        });
        // Set the HTML content
        panel.webview.html = this.getPromptHtml(prompt);
    }
    /**
     * Generate HTML for a prompt preview
     */
    getPromptHtml(prompt) {
        // Format tags
        const tagsHtml = prompt.tags && prompt.tags.length > 0
            ? prompt.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join(' ')
            : '<span class="tag-empty">No tags</span>';
        // Format variables
        const variablesHtml = prompt.variables.length > 0
            ? prompt.variables.map(variable => `
          <div class="variable">
            <div class="variable-name">{{${this.escapeHtml(variable.name)}}}</div>
            <div class="variable-description">${this.escapeHtml(variable.description)}</div>
            ${variable.defaultValue ? `<div class="variable-default">Default: ${this.escapeHtml(variable.defaultValue)}</div>` : ''}
          </div>
        `).join('')
            : '<div class="variables-empty">No variables</div>';
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt: ${this.escapeHtml(prompt.title)}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.5;
        }
        h1, h2 {
            color: var(--vscode-editor-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .info {
            background-color: var(--vscode-input-background);
            border-left: 4px solid var(--vscode-focusBorder);
            padding: 15px;
            margin-bottom: 20px;
        }
        .tag {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 3px 8px;
            border-radius: 3px;
            margin-right: 5px;
            font-size: 12px;
        }
        .tag-empty, .variables-empty {
            color: var(--vscode-disabledForeground);
            font-style: italic;
        }
        .template {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            font-size: 14px;
            margin-bottom: 20px;
        }
        .variable {
            background-color: var(--vscode-input-background);
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 4px;
        }
        .variable-name {
            font-weight: bold;
            color: var(--vscode-editor-foreground);
        }
        .variable-description {
            margin: 5px 0;
        }
        .variable-default {
            font-style: italic;
            color: var(--vscode-descriptionForeground);
        }
        .usage {
            margin-top: 10px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
    </style>
</head>
<body>
    <h1>${this.escapeHtml(prompt.title)}</h1>
    
    <div class="info">
        <p><strong>Category: </strong> ${this.escapeHtml(prompt.category || 'Uncategorized')}</p>
        <p><strong>Tags: </strong> ${tagsHtml}</p>
        <p><strong>Created: </strong> ${new Date(prompt.created).toLocaleString()}</p>
        <p><strong>Usage Count: </strong> ${prompt.usageCount}</p>
    </div>
    
    <h2>Template</h2>
    <div class="template">${this.escapeHtml(prompt.template)}</div>
    
    <h2>Variables</h2>
    <div class="variables">
        ${variablesHtml}
    </div>
    
    <div class="usage">
        <p>Use this prompt with the "Use Prompt" command in the context menu.</p>
    </div>
</body>
</html>`;
    }
    /**
     * Escape HTML special characters
     */
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
exports.PromptView = PromptView;
//# sourceMappingURL=promptView.js.map