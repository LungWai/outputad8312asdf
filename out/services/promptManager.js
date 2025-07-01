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
exports.PromptManager = void 0;
const vscode = __importStar(require("vscode"));
const prompt_1 = require("../models/prompt");
const storageManager_1 = require("../data/storageManager");
class PromptManager {
    constructor() {
        this.prompts = new Map();
        this.categories = new Set();
        this.initialized = false;
        this.storageManager = storageManager_1.StorageManager.getInstance();
    }
    static getInstance() {
        if (!PromptManager.instance) {
            PromptManager.instance = new PromptManager();
        }
        return PromptManager.instance;
    }
    /**
     * Initialize the prompt manager by loading prompts from storage
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            // Load saved prompts
            const promptsData = await this.storageManager.getData('prompts', []);
            const categoriesData = await this.storageManager.getData('promptCategories', []);
            // Convert to prompts
            this.prompts = new Map();
            (promptsData || []).forEach((promptData) => {
                const prompt = prompt_1.PromptImpl.deserialize(promptData);
                this.prompts.set(prompt.id, prompt);
            });
            // Load categories
            this.categories = new Set(categoriesData || []);
            // Extract categories from existing prompts
            this.prompts.forEach(prompt => {
                if (prompt.category) {
                    this.categories.add(prompt.category);
                }
            });
            this.initialized = true;
        }
        catch (error) {
            console.error('Failed to initialize prompt manager:', error);
            throw new Error(`Prompt manager initialization failed: ${error}`);
        }
    }
    /**
     * Get all prompts
     */
    async getPrompts() {
        await this.ensureInitialized();
        return Array.from(this.prompts.values());
    }
    /**
     * Get prompts by category
     */
    async getPromptsByCategory(category) {
        await this.ensureInitialized();
        return Array.from(this.prompts.values()).filter(prompt => prompt.category === category);
    }
    /**
     * Get prompts by tag
     */
    async getPromptsByTag(tag) {
        await this.ensureInitialized();
        return Array.from(this.prompts.values()).filter(prompt => prompt.tags.includes(tag));
    }
    /**
     * Get a prompt by ID
     */
    async getPromptById(promptId) {
        await this.ensureInitialized();
        return this.prompts.get(promptId);
    }
    /**
     * Get all categories
     */
    async getCategories() {
        await this.ensureInitialized();
        return Array.from(this.categories);
    }
    /**
     * Add a new category
     */
    async addCategory(category) {
        await this.ensureInitialized();
        if (category && !this.categories.has(category)) {
            this.categories.add(category);
            // No need to save this separately as categories are derived from prompts
        }
    }
    /**
     * Get all unique tags used across prompts
     */
    async getAllTags() {
        await this.ensureInitialized();
        const tags = new Set();
        this.prompts.forEach(prompt => {
            prompt.tags.forEach(tag => tags.add(tag));
        });
        return [...tags];
    }
    /**
     * Create a new prompt
     */
    async createPrompt(title, template, category = '', tags = []) {
        await this.ensureInitialized();
        // Generate a more robust unique ID using crypto-style randomness
        const promptId = this.generateUniquePromptId();
        // Extract variables from template
        const variableNames = prompt_1.PromptImpl.extractVariablesFromTemplate(template);
        const variables = variableNames.map(name => new prompt_1.VariableImpl(this.generateUniqueVariableId(name), name, `Variable: ${name}`, ''));
        const prompt = new prompt_1.PromptImpl(promptId, title, template, variables, new Date(), 0, category, tags);
        this.prompts.set(promptId, prompt);
        // Add category if new
        if (category) {
            this.categories.add(category);
        }
        await this.saveState();
        return prompt;
    }
    /**
     * Update an existing prompt
     */
    async updatePrompt(promptId, updates) {
        await this.ensureInitialized();
        const prompt = this.prompts.get(promptId);
        if (!prompt) {
            return false;
        }
        if (updates.title) {
            prompt.title = updates.title;
        }
        if (updates.template) {
            prompt.template = updates.template;
            // Re-extract variables from updated template
            const variableNames = prompt_1.PromptImpl.extractVariablesFromTemplate(updates.template);
            const newVariables = variableNames.map(name => {
                // Try to find existing variable with same name
                const existingVar = prompt.variables.find(v => v.name === name);
                if (existingVar) {
                    return existingVar instanceof prompt_1.VariableImpl ? existingVar :
                        new prompt_1.VariableImpl(existingVar.id, existingVar.name, existingVar.description, existingVar.defaultValue);
                }
                return new prompt_1.VariableImpl(`var-${Date.now()}-${name}`, name, `Variable: ${name}`, '');
            });
            prompt.variables = newVariables;
        }
        if (updates.category) {
            prompt.category = updates.category;
            this.categories.add(updates.category);
        }
        if (updates.tags) {
            prompt.tags = [...updates.tags];
        }
        await this.saveState();
        return true;
    }
    /**
     * Delete a prompt
     */
    async deletePrompt(promptId) {
        await this.ensureInitialized();
        if (!this.prompts.has(promptId)) {
            return false;
        }
        this.prompts.delete(promptId);
        await this.saveState();
        return true;
    }
    /**
     * Fill a prompt template with variable values
     */
    async fillPromptTemplate(promptId, variableValues) {
        await this.ensureInitialized();
        const prompt = this.prompts.get(promptId);
        if (!prompt || typeof prompt.fillTemplate !== 'function') {
            return null;
        }
        // Increment usage count
        if (typeof prompt.incrementUsage === 'function') {
            prompt.incrementUsage();
            await this.saveState();
        }
        return prompt.fillTemplate(variableValues);
    }
    /**
     * Add a variable to a prompt
     */
    async addVariableToPrompt(promptId, variable) {
        await this.ensureInitialized();
        const prompt = this.prompts.get(promptId);
        if (!prompt) {
            return false;
        }
        const variableImpl = variable instanceof prompt_1.VariableImpl ? variable :
            new prompt_1.VariableImpl(variable.id, variable.name, variable.description, variable.defaultValue);
        if (typeof prompt.addVariable === 'function') {
            prompt.addVariable(variableImpl);
            await this.saveState();
            return true;
        }
        return false;
    }
    /**
     * Remove a variable from a prompt
     */
    async removeVariableFromPrompt(promptId, variableId) {
        await this.ensureInitialized();
        const prompt = this.prompts.get(promptId);
        if (!prompt || typeof prompt.removeVariable !== 'function') {
            return false;
        }
        const removed = prompt.removeVariable(variableId);
        if (removed) {
            await this.saveState();
        }
        return removed;
    }
    /**
     * Save the current state of the prompt manager
     */
    async saveState() {
        try {
            // Save prompts
            const promptsArray = Array.from(this.prompts.values());
            await this.storageManager.saveData('prompts', promptsArray.map(p => p.serialize()));
            // Save categories
            await this.storageManager.saveData('promptCategories', Array.from(this.categories));
        }
        catch (error) {
            console.error(`Error saving prompt manager state: ${error}`);
        }
    }
    /**
     * Export prompts to a file
     */
    async exportPrompts(promptIds, filePath) {
        await this.ensureInitialized();
        try {
            const promptsToExport = promptIds.map(id => this.prompts.get(id))
                .filter((prompt) => !!prompt)
                .map(prompt => typeof prompt.serialize === 'function' ? prompt.serialize() : prompt);
            if (promptsToExport.length === 0) {
                return false;
            }
            const exportData = {
                version: 1,
                prompts: promptsToExport
            };
            await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(JSON.stringify(exportData, null, 2), 'utf8'));
            return true;
        }
        catch (error) {
            console.error('Failed to export prompts:', error);
            return false;
        }
    }
    /**
     * Import prompts from a file
     */
    async importPrompts(filePath) {
        await this.ensureInitialized();
        try {
            const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            const data = JSON.parse(fileContent.toString());
            if (!data || !Array.isArray(data.prompts)) {
                throw new Error('Invalid prompt file format');
            }
            let importedCount = 0;
            for (const promptData of data.prompts) {
                try {
                    const prompt = prompt_1.PromptImpl.deserialize(promptData);
                    // Generate a new unique ID to avoid conflicts
                    prompt.id = this.generateUniquePromptId();
                    this.prompts.set(prompt.id, prompt);
                    if (prompt.category) {
                        this.categories.add(prompt.category);
                    }
                    importedCount++;
                }
                catch (err) {
                    console.error('Error importing prompt:', err);
                }
            }
            if (importedCount > 0) {
                await this.saveState();
            }
            return importedCount;
        }
        catch (error) {
            console.error('Failed to import prompts:', error);
            throw new Error(`Prompt import failed: ${error}`);
        }
    }
    /**
     * Get prompts sorted by usage count (most used first)
     */
    async getPopularPrompts(limit = 5) {
        await this.ensureInitialized();
        return Array.from(this.prompts.values())
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, limit);
    }
    /**
     * Generate a unique prompt ID with better collision resistance
     */
    generateUniquePromptId() {
        const timestamp = Date.now();
        const randomPart = Math.random().toString(36).substr(2, 12);
        const extraRandom = Math.random().toString(36).substr(2, 6);
        return `prompt-${timestamp}-${randomPart}-${extraRandom}`;
    }
    /**
     * Generate a unique variable ID
     */
    generateUniqueVariableId(variableName) {
        const timestamp = Date.now();
        const randomPart = Math.random().toString(36).substr(2, 8);
        return `var-${timestamp}-${variableName}-${randomPart}`;
    }
    /**
     * Ensure manager is initialized
     */
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
}
exports.PromptManager = PromptManager;
//# sourceMappingURL=promptManager.js.map