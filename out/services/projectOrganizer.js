"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectOrganizer = exports.OrganizationMode = void 0;
const uuid_1 = require("uuid");
const project_1 = require("../models/project");
const chat_1 = require("../models/chat");
const dialogue_1 = require("../models/dialogue");
const storageManager_1 = require("../data/storageManager");
var OrganizationMode;
(function (OrganizationMode) {
    OrganizationMode["COPY"] = "copy";
    OrganizationMode["MOVE"] = "move";
})(OrganizationMode || (exports.OrganizationMode = OrganizationMode = {}));
class ProjectOrganizer {
    constructor() {
        this.projects = new Map();
        this.originalProjects = new Map();
        this.customProjects = new Map();
        this.storageManager = storageManager_1.StorageManager.getInstance();
    }
    static getInstance() {
        if (!ProjectOrganizer.instance) {
            ProjectOrganizer.instance = new ProjectOrganizer();
        }
        return ProjectOrganizer.instance;
    }
    async initialize(projects) {
        console.log(`ProjectOrganizer.initialize: Called with ${projects.length} projects`);
        this.projects = new Map();
        this.originalProjects = new Map();
        this.customProjects = new Map();
        // Log input projects for debugging
        projects.forEach((project, index) => {
            console.log(`  - Input Project ${index}: "${project.name}" (ID: ${project.id}, isCustom: ${project.isCustom}) with ${project.chats.length} chats`);
        });
        // Load custom projects from storage
        const customProjectsData = await this.storageManager.getData('customProjects', []);
        console.log(`ProjectOrganizer.initialize: Loaded ${(customProjectsData || []).length} custom projects from storage`);
        const customProjects = (customProjectsData || [])
            .map((p) => project_1.ProjectImpl.deserialize(p));
        // Add all projects to maps
        const allProjects = [...projects, ...customProjects];
        console.log(`ProjectOrganizer.initialize: Processing ${allProjects.length} total projects (${projects.length} input + ${customProjects.length} stored)`);
        for (const project of allProjects) {
            const projectImpl = project instanceof project_1.ProjectImpl ? project :
                new project_1.ProjectImpl(project.id, project.name, project.description, project.created, project.isCustom, project.chats, project.tags, project.metadata);
            console.log(`ProjectOrganizer.initialize: Adding project "${projectImpl.name}" (ID: ${projectImpl.id}, isCustom: ${projectImpl.isCustom}) with ${projectImpl.chats.length} chats`);
            this.projects.set(projectImpl.id, projectImpl);
            if (projectImpl.isCustom) {
                this.customProjects.set(projectImpl.id, projectImpl);
                console.log(`  - Added to customProjects map`);
            }
            else {
                this.originalProjects.set(projectImpl.id, projectImpl);
                console.log(`  - Added to originalProjects map`);
            }
        }
        console.log(`ProjectOrganizer.initialize: Final state:`);
        console.log(`  - Total projects: ${this.projects.size}`);
        console.log(`  - Original projects: ${this.originalProjects.size}`);
        console.log(`  - Custom projects: ${this.customProjects.size}`);
        // Log detailed breakdown
        console.log(`ProjectOrganizer.initialize: Original projects breakdown:`);
        Array.from(this.originalProjects.values()).forEach((project, index) => {
            console.log(`    ${index}: "${project.name}" (${project.chats.length} chats)`);
        });
        console.log(`ProjectOrganizer.initialize: Custom projects breakdown:`);
        Array.from(this.customProjects.values()).forEach((project, index) => {
            console.log(`    ${index}: "${project.name}" (${project.chats.length} chats)`);
        });
    }
    async saveState() {
        try {
            // Save only custom projects
            const customProjectsArray = Array.from(this.customProjects.values());
            await this.storageManager.saveData('customProjects', customProjectsArray.map(p => p.serialize()));
        }
        catch (error) {
            console.error(`Error saving project organizer state: ${error}`);
        }
    }
    async createCustomProject(name, description, tags = []) {
        const projectId = `custom-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        const newProject = new project_1.ProjectImpl(projectId, name, description, new Date(), true, // Is custom project
        [], // No chats initially
        tags);
        this.projects.set(projectId, newProject);
        this.customProjects.set(projectId, newProject);
        await this.saveState();
        return newProject;
    }
    async updateProject(projectId, updates) {
        const project = this.projects.get(projectId);
        if (!project) {
            return false;
        }
        // Only custom projects can be updated
        if (!project.isCustom) {
            return false;
        }
        if (updates.name) {
            project.name = updates.name;
        }
        if (updates.description) {
            project.description = updates.description;
        }
        if (updates.tags) {
            project.tags = [...updates.tags];
        }
        await this.saveState();
        return true;
    }
    async deleteCustomProject(projectId) {
        // Only custom projects can be deleted
        if (!this.customProjects.has(projectId)) {
            return false;
        }
        this.projects.delete(projectId);
        this.customProjects.delete(projectId);
        await this.saveState();
        return true;
    }
    async organizeChatToProject(chatId, sourceProjectId, targetProjectId, mode) {
        const sourceProject = this.projects.get(sourceProjectId);
        const targetProject = this.projects.get(targetProjectId);
        if (!sourceProject || !targetProject) {
            return false;
        }
        // Find the chat in source project
        const chat = sourceProject.chats.find(c => c.id === chatId);
        if (!chat) {
            return false;
        }
        if (mode === OrganizationMode.COPY) {
            // Create a copy of the chat
            const chatCopy = new chat_1.ChatImpl(`${chat.id}-copy-${Date.now()}`, chat.title, chat.timestamp, targetProjectId, [...chat.dialogues], // Copy dialogues
            [...chat.tags], // Copy tags
            { ...chat.metadata, copiedFrom: chat.id });
            // Add to target project
            targetProject.addChat(chatCopy);
        }
        else {
            // Move: Remove from source and add to target
            sourceProject.removeChat(chatId);
            chat.projectId = targetProjectId;
            targetProject.addChat(chat);
        }
        await this.saveState();
        return true;
    }
    async extractDialogueToNewChat(dialogueId, chatId, projectId, title, tags = []) {
        const project = this.projects.get(projectId);
        if (!project) {
            return null;
        }
        // Find the source chat
        const sourceChat = project.chats.find(c => c.id === chatId);
        if (!sourceChat) {
            return null;
        }
        // Find the dialogue
        const dialogue = sourceChat.dialogues.find(d => d.id === dialogueId);
        if (!dialogue) {
            return null;
        }
        // Create a new chat with this dialogue
        const newChat = new chat_1.ChatImpl((0, uuid_1.v4)(), title || `Extracted from ${sourceChat.title}`, new Date(), projectId, [dialogue], // Add the dialogue
        tags, // Apply tags
        { extractedFrom: chatId, extractedDialogue: dialogueId });
        // Add to project
        project.addChat(newChat);
        await this.saveState();
        return newChat.id;
    }
    async extractDialogueToExistingChat(dialogueId, sourceChatId, targetChatId) {
        // Find source chat and target chat
        let sourceChat;
        let targetChat;
        for (const project of this.projects.values()) {
            if (!sourceChat) {
                sourceChat = project.chats.find(c => c.id === sourceChatId);
            }
            if (!targetChat) {
                targetChat = project.chats.find(c => c.id === targetChatId);
            }
            if (sourceChat && targetChat) {
                break;
            }
        }
        if (!sourceChat || !targetChat) {
            return false;
        }
        // Find the dialogue
        const dialogueIndex = sourceChat.dialogues.findIndex(d => d.id === dialogueId);
        if (dialogueIndex === -1) {
            return false;
        }
        // Copy the dialogue to target chat
        const dialogue = sourceChat.dialogues[dialogueIndex];
        const dialogueCopy = new dialogue_1.DialogueImpl(`${dialogue.id}-copy-${Date.now()}`, targetChat.id, dialogue.content, dialogue.isUser, dialogue.timestamp, [...dialogue.tags], dialogue.metadata);
        // Add to target chat if it's an implementation
        if (targetChat instanceof chat_1.ChatImpl) {
            targetChat.addDialogue(dialogueCopy);
        }
        else {
            // Fallback: add to dialogues array directly
            targetChat.dialogues.push(dialogueCopy);
        }
        await this.saveState();
        return true;
    }
    getProject(projectId) {
        return this.projects.get(projectId);
    }
    getAllProjects() {
        return Array.from(this.projects.values());
    }
    getOriginalProjects() {
        return Array.from(this.originalProjects.values());
    }
    getCustomProjects() {
        return Array.from(this.customProjects.values());
    }
    async findProjectByChat(chatId) {
        for (const project of this.projects.values()) {
            if (project.chats.some(c => c.id === chatId)) {
                return project;
            }
        }
        return undefined;
    }
    async findChatById(chatId) {
        for (const project of this.projects.values()) {
            const chat = project.chats.find(c => c.id === chatId);
            if (chat) {
                return chat;
            }
        }
        return undefined;
    }
    async findDialogueById(dialogueId) {
        for (const project of this.projects.values()) {
            for (const chat of project.chats) {
                const dialogue = chat.dialogues.find(d => d.id === dialogueId);
                if (dialogue) {
                    return { dialogue, chat, project };
                }
            }
        }
        return undefined;
    }
}
exports.ProjectOrganizer = ProjectOrganizer;
//# sourceMappingURL=projectOrganizer.js.map