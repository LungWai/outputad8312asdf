"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TagManager = void 0;
const chat_1 = require("../models/chat");
const dialogue_1 = require("../models/dialogue");
const storageManager_1 = require("../data/storageManager");
class TagManager {
    constructor() {
        this.chatTags = new Map();
        this.dialogueTags = new Map();
        this.tagStats = new Map();
        this.tagCategories = [];
        this.storageManager = storageManager_1.StorageManager.getInstance();
    }
    static getInstance() {
        if (!TagManager.instance) {
            TagManager.instance = new TagManager();
        }
        return TagManager.instance;
    }
    async initialize() {
        try {
            // Load saved tag data
            const chatTagsData = await this.storageManager.getData('chatTags', {});
            const dialogueTagsData = await this.storageManager.getData('dialogueTags', {});
            const tagStatsData = await this.storageManager.getData('tagStats', {});
            const tagCategoriesData = await this.storageManager.getData('tagCategories', []);
            // Convert to maps
            this.chatTags = new Map(Object.entries(chatTagsData || {}));
            this.dialogueTags = new Map(Object.entries(dialogueTagsData || {}));
            this.tagStats = new Map(Object.entries(tagStatsData || {}));
            this.tagCategories = tagCategoriesData || [];
            // Ensure tag stats dates are Date objects
            this.tagStats.forEach((stats, tag) => {
                if (typeof stats.lastUsed === 'string') {
                    stats.lastUsed = new Date(stats.lastUsed);
                }
            });
        }
        catch (error) {
            console.error(`Error initializing tag manager: ${error}`);
        }
    }
    async saveState() {
        try {
            // Convert maps to objects for storage
            const chatTagsObj = Object.fromEntries(this.chatTags);
            const dialogueTagsObj = Object.fromEntries(this.dialogueTags);
            const tagStatsObj = Object.fromEntries(this.tagStats);
            // Save data
            await this.storageManager.saveData('chatTags', chatTagsObj);
            await this.storageManager.saveData('dialogueTags', dialogueTagsObj);
            await this.storageManager.saveData('tagStats', tagStatsObj);
            await this.storageManager.saveData('tagCategories', this.tagCategories);
        }
        catch (error) {
            console.error(`Error saving tag manager state: ${error}`);
        }
    }
    // Chat-level tagging
    async addTagToChat(chat, tag) {
        const normalizedTag = this.normalizeTag(tag);
        if (!this.validateTag(normalizedTag)) {
            return false;
        }
        // Update chat tags if it's an implementation
        if (chat instanceof chat_1.ChatImpl) {
            chat.addTag(normalizedTag);
        }
        // Update tag map
        const chatTags = this.chatTags.get(chat.id) || [];
        if (!chatTags.includes(normalizedTag)) {
            chatTags.push(normalizedTag);
            this.chatTags.set(chat.id, chatTags);
        }
        // Update tag stats
        this.updateTagStats(normalizedTag);
        // Save state
        await this.saveState();
        return true;
    }
    async removeTagFromChat(chat, tag) {
        const normalizedTag = this.normalizeTag(tag);
        // Update chat tags if it's an implementation
        let removed = false;
        if (chat instanceof chat_1.ChatImpl) {
            removed = chat.removeTag(normalizedTag);
        }
        // Update tag map
        const chatTags = this.chatTags.get(chat.id) || [];
        const updatedTags = chatTags.filter(t => t !== normalizedTag);
        this.chatTags.set(chat.id, updatedTags);
        // Save state
        await this.saveState();
        return removed || chatTags.length !== updatedTags.length;
    }
    getChatTags(chatId) {
        return this.chatTags.get(chatId) || [];
    }
    // Dialogue-level tagging
    async addTagToDialogue(dialogue, tag) {
        const normalizedTag = this.normalizeTag(tag);
        if (!this.validateTag(normalizedTag)) {
            return false;
        }
        // Update dialogue tags if it's an implementation
        if (dialogue instanceof dialogue_1.DialogueImpl) {
            dialogue.addTag(normalizedTag);
        }
        // Update tag map
        const dialogueTags = this.dialogueTags.get(dialogue.id) || [];
        if (!dialogueTags.includes(normalizedTag)) {
            dialogueTags.push(normalizedTag);
            this.dialogueTags.set(dialogue.id, dialogueTags);
        }
        // Update tag stats
        this.updateTagStats(normalizedTag);
        // Save state
        await this.saveState();
        return true;
    }
    async removeTagFromDialogue(dialogue, tag) {
        const normalizedTag = this.normalizeTag(tag);
        // Update dialogue tags if it's an implementation
        let removed = false;
        if (dialogue instanceof dialogue_1.DialogueImpl) {
            removed = dialogue.removeTag(normalizedTag);
        }
        // Update tag map
        const dialogueTags = this.dialogueTags.get(dialogue.id) || [];
        const updatedTags = dialogueTags.filter(t => t !== normalizedTag);
        this.dialogueTags.set(dialogue.id, updatedTags);
        // Save state
        await this.saveState();
        return removed || dialogueTags.length !== updatedTags.length;
    }
    getDialogueTags(dialogueId) {
        return this.dialogueTags.get(dialogueId) || [];
    }
    // Tag categories
    async createTagCategory(name) {
        if (!name || this.tagCategories.some(c => c.name === name)) {
            return false;
        }
        this.tagCategories.push({ name, tags: [] });
        await this.saveState();
        return true;
    }
    async addTagToCategory(tag, categoryName) {
        const normalizedTag = this.normalizeTag(tag);
        const category = this.tagCategories.find(c => c.name === categoryName);
        if (!category) {
            return false;
        }
        if (!category.tags.includes(normalizedTag)) {
            category.tags.push(normalizedTag);
            await this.saveState();
        }
        return true;
    }
    async removeTagFromCategory(tag, categoryName) {
        const normalizedTag = this.normalizeTag(tag);
        const category = this.tagCategories.find(c => c.name === categoryName);
        if (!category) {
            return false;
        }
        const initialLength = category.tags.length;
        category.tags = category.tags.filter(t => t !== normalizedTag);
        if (category.tags.length !== initialLength) {
            await this.saveState();
            return true;
        }
        return false;
    }
    getTagsInCategory(categoryName) {
        const category = this.tagCategories.find(c => c.name === categoryName);
        return category?.tags || [];
    }
    getCategories() {
        return [...this.tagCategories];
    }
    // Tag suggestions
    getSuggestedTags(count = 5) {
        // Get tags sorted by usage count
        const sortedByCount = Array.from(this.tagStats.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .map(([tag]) => tag);
        // Get tags sorted by recency
        const sortedByRecency = Array.from(this.tagStats.entries())
            .sort((a, b) => {
            const timeA = a[1].lastUsed instanceof Date ? a[1].lastUsed.getTime() : new Date(a[1].lastUsed).getTime();
            const timeB = b[1].lastUsed instanceof Date ? b[1].lastUsed.getTime() : new Date(b[1].lastUsed).getTime();
            return timeB - timeA;
        })
            .map(([tag]) => tag);
        // Combine the two lists, prioritizing tags that appear in both
        const combined = new Set();
        for (let i = 0; i < count * 2 && combined.size < count; i++) {
            const countIndex = Math.floor(i / 2);
            const recencyIndex = Math.floor(i / 2);
            if (i % 2 === 0 && countIndex < sortedByCount.length) {
                combined.add(sortedByCount[countIndex]);
            }
            else if (recencyIndex < sortedByRecency.length) {
                combined.add(sortedByRecency[recencyIndex]);
            }
        }
        return Array.from(combined).slice(0, count);
    }
    // Search by tags
    async findChatsByTags(tags) {
        if (!tags.length) {
            return [];
        }
        const normalizedTags = tags.map(tag => this.normalizeTag(tag));
        const chatIds = [];
        this.chatTags.forEach((chatTagList, chatId) => {
            if (normalizedTags.every(tag => chatTagList.includes(tag))) {
                chatIds.push(chatId);
            }
        });
        return chatIds;
    }
    async findDialoguesByTags(tags) {
        if (!tags.length) {
            return [];
        }
        const normalizedTags = tags.map(tag => this.normalizeTag(tag));
        const dialogueIds = [];
        this.dialogueTags.forEach((dialogueTagList, dialogueId) => {
            if (normalizedTags.every(tag => dialogueTagList.includes(tag))) {
                dialogueIds.push(dialogueId);
            }
        });
        return dialogueIds;
    }
    // Helper methods
    normalizeTag(tag) {
        // Remove leading # if present
        let normalizedTag = tag.trim();
        if (normalizedTag.startsWith('#')) {
            normalizedTag = normalizedTag.substring(1);
        }
        // Convert to kebab-case
        normalizedTag = normalizedTag
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
        return normalizedTag;
    }
    validateTag(tag) {
        // Check if tag is not empty and follows pattern
        return !!tag && /^[a-z0-9-]+$/.test(tag);
    }
    updateTagStats(tag) {
        const stats = this.tagStats.get(tag) || { name: tag, count: 0, lastUsed: new Date() };
        stats.count += 1;
        stats.lastUsed = new Date();
        this.tagStats.set(tag, stats);
    }
    getAllTags() {
        return Array.from(this.tagStats.keys());
    }
    getTagUsageCount(tag) {
        return this.tagStats.get(this.normalizeTag(tag))?.count || 0;
    }
}
exports.TagManager = TagManager;
//# sourceMappingURL=tagManager.js.map