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
exports.ProjectView = exports.ProjectTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const projectOrganizer_1 = require("../services/projectOrganizer");
const chatProcessor_1 = require("../services/chatProcessor");
const logger_1 = require("../utils/logger");
const constants_1 = require("../config/constants");
class ProjectTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, contextValue, id, iconPath, command, project, chat) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.id = id;
        this.iconPath = iconPath;
        this.command = command;
        this.project = project;
        this.chat = chat;
        this.id = id;
        this.contextValue = contextValue;
        this.iconPath = iconPath;
        this.command = command;
        this.tooltip = label;
    }
}
exports.ProjectTreeItem = ProjectTreeItem;
class ProjectView {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.projectOrganizer = projectOrganizer_1.ProjectOrganizer.getInstance();
        this.chatProcessor = chatProcessor_1.ChatProcessor.getInstance();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `getChildren called with element: ${element ? `${element.contextValue}:${element.id}` : 'ROOT'}`);
        // Root level - show "Original Projects" and "Custom Projects" categories
        if (!element) {
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, 'Returning root categories');
            return [
                new ProjectTreeItem('Original Projects', vscode.TreeItemCollapsibleState.Expanded, 'category', 'original-projects', new vscode.ThemeIcon('folder')),
                new ProjectTreeItem('Custom Projects', vscode.TreeItemCollapsibleState.Expanded, 'category', 'custom-projects', new vscode.ThemeIcon('folder'))
            ];
        }
        // Category level - show projects under the category
        if (element.contextValue === 'category') {
            if (element.id === 'original-projects') {
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, 'Getting original projects...');
                const originalProjects = this.projectOrganizer.getOriginalProjects();
                logger_1.logger.info(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `Found ${originalProjects.length} original projects`);
                originalProjects.forEach((project, index) => {
                    logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `Project ${index}: "${project.name}" (ID: ${project.id}) with ${project.chats.length} chats`);
                    if (project.chats.length > 0) {
                        project.chats.slice(0, 2).forEach((chat, chatIndex) => {
                            logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `  Chat ${chatIndex}: "${chat.title}" (${chat.dialogues.length} dialogues)`);
                        });
                    }
                });
                const items = this.createProjectTreeItems(originalProjects, false);
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `Created ${items.length} tree items for original projects`);
                return items;
            }
            else if (element.id === 'custom-projects') {
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, 'Getting custom projects...');
                const customProjects = this.projectOrganizer.getCustomProjects();
                logger_1.logger.info(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `Found ${customProjects.length} custom projects`);
                customProjects.forEach((project, index) => {
                    logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `Custom Project ${index}: "${project.name}" (ID: ${project.id}) with ${project.chats.length} chats`);
                });
                const items = this.createProjectTreeItems(customProjects, true);
                // Add "Create Custom Project" button
                items.push(new ProjectTreeItem('+ New Custom Project', vscode.TreeItemCollapsibleState.None, 'new-project', 'new-custom-project', new vscode.ThemeIcon('add'), {
                    command: 'cursor-chat-manager.createCustomProject',
                    title: 'Create Custom Project',
                    arguments: []
                }));
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `Created ${items.length} tree items for custom projects (including add button)`);
                return items;
            }
        }
        // Project level - show chats under the project
        if (element.contextValue === 'project' && element.project) {
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `Getting chats for project "${element.project.name}" (ID: ${element.project.id})`);
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `Project has ${element.project.chats.length} chats`);
            element.project.chats.forEach((chat, index) => {
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `Chat ${index}: "${chat.title}" (ID: ${chat.id}) with ${chat.dialogues.length} dialogues`);
            });
            const chatItems = this.createChatTreeItems(element.project.chats, element.project.id);
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `Created ${chatItems.length} chat tree items`);
            return chatItems;
        }
        // Chat level - show dialogues under the chat
        if (element.contextValue === 'chat' && element.chat) {
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `Chat level requested for "${element.chat.title}" - returning empty (dialogues shown in ChatView)`);
            return []; // Dialogues are shown in the chat view, not in the tree
        }
        logger_1.logger.debug(constants_1.LOG_COMPONENTS.VIEW_PROJECT, 'No matching case, returning empty array');
        return [];
    }
    createProjectTreeItems(projects, isCustom) {
        return projects.map(project => {
            const chatCount = project.chats.length;
            const label = `${project.name} (${chatCount} chat${chatCount !== 1 ? 's' : ''})`;
            return new ProjectTreeItem(label, vscode.TreeItemCollapsibleState.Collapsed, 'project', project.id, new vscode.ThemeIcon(isCustom ? 'folder-library' : 'folder'), {
                command: 'cursor-chat-manager.openProject',
                title: 'Open Project',
                arguments: [project.id]
            }, project);
        }).sort((a, b) => a.label.localeCompare(b.label));
    }
    createChatTreeItems(chats, projectId) {
        return chats.map(chat => {
            const dialogueCount = chat.dialogues.length;
            const label = `${chat.title} (${dialogueCount} message${dialogueCount !== 1 ? 's' : ''})`;
            return new ProjectTreeItem(label, vscode.TreeItemCollapsibleState.None, 'chat', chat.id, new vscode.ThemeIcon('comment'), {
                command: 'cursor-chat-manager.openChat',
                title: 'Open Chat',
                arguments: [chat.id, projectId]
            }, undefined, chat);
        }).sort((a, b) => {
            // Sort by date if available in chat
            const dateA = a.chat?.timestamp;
            const dateB = b.chat?.timestamp;
            if (dateA && dateB) {
                // Ensure both are Date objects
                const timeA = dateA instanceof Date ? dateA.getTime() : new Date(dateA).getTime();
                const timeB = dateB instanceof Date ? dateB.getTime() : new Date(dateB).getTime();
                // Newest first
                return timeB - timeA;
            }
            return a.label.localeCompare(b.label);
        });
    }
    async loadProjects() {
        try {
            logger_1.logger.info(constants_1.LOG_COMPONENTS.VIEW_PROJECT, '*** STARTING LOAD PROJECTS ***');
            // PROOF: Clear all cached/stored data to force fresh processing
            logger_1.logger.info(constants_1.LOG_COMPONENTS.VIEW_PROJECT, '*** CLEARING ALL CACHED DATA ***');
            await this.chatProcessor.clearAllCachedData();
            // PROOF: Force fresh data processing to show proof logs
            logger_1.logger.info(constants_1.LOG_COMPONENTS.VIEW_PROJECT, 'Calling chatProcessor.processChats() to get FRESH data...');
            const { projects, chats } = await this.chatProcessor.processChats();
            logger_1.logger.info(constants_1.LOG_COMPONENTS.VIEW_PROJECT, `processChats returned ${projects.length} projects, ${chats.length} chats`);
            // Initialize projectOrganizer with the processed projects
            await this.projectOrganizer.initialize(projects);
            // Save processed data
            await this.chatProcessor.saveProcessedData(projects, chats);
            // Refresh the view
            this.refresh();
            // Return information about what was loaded
            return {
                projectCount: projects.length,
                chatCount: chats.length
            };
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.VIEW_PROJECT, 'Error loading projects', error);
            vscode.window.showErrorMessage('Failed to load Cursor chat data. Please try again.');
            return null;
        }
    }
}
exports.ProjectView = ProjectView;
//# sourceMappingURL=projectView.js.map