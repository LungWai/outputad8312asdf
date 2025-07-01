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
exports.TagView = exports.TagTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const tagManager_1 = require("../services/tagManager");
class TagTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, contextValue, id, count, iconPath, command) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.id = id;
        this.count = count;
        this.iconPath = iconPath;
        this.command = command;
        this.id = id;
        this.contextValue = contextValue;
        this.iconPath = iconPath;
        this.command = command;
        this.tooltip = label;
        if (count !== undefined) {
            this.description = `(${count})`;
        }
    }
}
exports.TagTreeItem = TagTreeItem;
class TagView {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.tagManager = tagManager_1.TagManager.getInstance();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        // Root level - show "Chat Tags" and "Dialogue Tags" categories
        if (!element) {
            return [
                new TagTreeItem('Chat Tags', vscode.TreeItemCollapsibleState.Expanded, 'category', 'chat-tags', undefined, new vscode.ThemeIcon('symbol-property')),
                new TagTreeItem('Dialogue Tags', vscode.TreeItemCollapsibleState.Expanded, 'category', 'dialogue-tags', undefined, new vscode.ThemeIcon('symbol-field'))
            ];
        }
        // Category level - show tags by category
        if (element.contextValue === 'category') {
            if (element.id === 'chat-tags') {
                // TODO: Implement this when TagManager is ready
                return [];
            }
            else if (element.id === 'dialogue-tags') {
                // TODO: Implement this when TagManager is ready
                return [];
            }
        }
        return [];
    }
}
exports.TagView = TagView;
//# sourceMappingURL=tagView.js.map