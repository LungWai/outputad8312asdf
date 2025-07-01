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
exports.RuleManager = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const rule_1 = require("../models/rule");
const storageManager_1 = require("../data/storageManager");
class RuleManager {
    constructor() {
        this.globalRules = [];
        this.projectRules = new Map();
        this.initialized = false;
        this.storageManager = storageManager_1.StorageManager.getInstance();
    }
    static getInstance() {
        if (!RuleManager.instance) {
            RuleManager.instance = new RuleManager();
        }
        return RuleManager.instance;
    }
    /**
     * Initialize the rule manager by loading rules from storage
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            // Load global rules
            const globalRulesData = await this.storageManager.getData('globalRules', []);
            this.globalRules = (globalRulesData || []).map((ruleData) => rule_1.RuleImpl.deserialize(ruleData));
            // Load project rules
            const projectRulesData = await this.storageManager.getData('projectRules', {});
            this.projectRules = new Map();
            Object.entries(projectRulesData || {}).forEach(([projectId, rulesArray]) => {
                const rules = rulesArray.map((ruleData) => rule_1.RuleImpl.deserialize(ruleData));
                this.projectRules.set(projectId, rules);
            });
            // Auto-import local rules from .cursor/rules folder
            await this.importLocalRules();
            this.initialized = true;
        }
        catch (error) {
            console.error('Failed to initialize rule manager:', error);
            throw new Error(`Rule manager initialization failed: ${error}`);
        }
    }
    /**
     * Get all global rules
     */
    async getGlobalRules() {
        await this.ensureInitialized();
        return [...this.globalRules];
    }
    /**
     * Get rules for a specific project
     */
    async getProjectRules(projectId) {
        await this.ensureInitialized();
        return this.projectRules.get(projectId) || [];
    }
    /**
     * Get a specific rule by ID
     */
    async getRuleById(ruleId) {
        await this.ensureInitialized();
        // Check global rules first
        const globalRule = this.globalRules.find(rule => rule.id === ruleId);
        if (globalRule) {
            return globalRule;
        }
        // Check project rules
        for (const rules of this.projectRules.values()) {
            const projectRule = rules.find(rule => rule.id === ruleId);
            if (projectRule) {
                return projectRule;
            }
        }
        return undefined;
    }
    /**
     * Get all rules
     */
    async getAllRules() {
        await this.ensureInitialized();
        const allRules = [...this.globalRules];
        for (const rules of this.projectRules.values()) {
            allRules.push(...rules);
        }
        return allRules;
    }
    /**
     * Import a rule from an .mdc file
     */
    async importRuleFromFile(filePath) {
        await this.ensureInitialized();
        try {
            // Parse the MDC file
            const rule = await rule_1.RuleImpl.fromMDCFile(filePath);
            // Add to global rules by default
            this.globalRules.push(rule);
            // Save the rule
            await this.saveState();
            return rule;
        }
        catch (error) {
            console.error('Failed to import rule from file:', error);
            throw new Error(`Rule import failed: ${error}`);
        }
    }
    /**
     * Apply a rule to a project
     */
    async applyRuleToProject(ruleId, projectId) {
        await this.ensureInitialized();
        // Find the rule
        const rule = await this.getRuleById(ruleId);
        if (!rule) {
            throw new Error(`Rule with ID ${ruleId} not found`);
        }
        // Apply the rule to the project
        const applied = rule.applyToProject(projectId);
        if (applied) {
            // Add to project rules if not already there
            const projectRules = this.projectRules.get(projectId) || [];
            if (!projectRules.some(r => r.id === ruleId)) {
                projectRules.push(rule);
                this.projectRules.set(projectId, projectRules);
            }
            // Save the updated rule
            await this.saveState();
        }
        return applied;
    }
    /**
     * Save a rule (new or updated)
     */
    async saveState() {
        await this.ensureInitialized();
        try {
            // Save global rules
            await this.storageManager.saveData('globalRules', this.globalRules.map(r => r.serialize()));
            // Save project rules
            const projectRulesObj = {};
            this.projectRules.forEach((rules, projectId) => {
                projectRulesObj[projectId] = rules.map(r => r.serialize());
            });
            await this.storageManager.saveData('projectRules', projectRulesObj);
        }
        catch (error) {
            console.error(`Error saving rule manager state: ${error}`);
        }
    }
    /**
     * Delete a rule
     */
    async deleteRule(ruleId) {
        await this.ensureInitialized();
        // Check if rule is in global rules
        const globalIndex = this.globalRules.findIndex(r => r.id === ruleId);
        if (globalIndex >= 0) {
            this.globalRules.splice(globalIndex, 1);
            await this.saveState();
            return true;
        }
        // Check if rule is in project rules
        let found = false;
        for (const [projectId, rules] of this.projectRules.entries()) {
            const projectIndex = rules.findIndex(r => r.id === ruleId);
            if (projectIndex >= 0) {
                rules.splice(projectIndex, 1);
                this.projectRules.set(projectId, rules);
                found = true;
            }
        }
        if (found) {
            await this.saveState();
            return true;
        }
        return false;
    }
    /**
     * Make a rule global
     */
    async makeRuleGlobal(ruleId) {
        await this.ensureInitialized();
        // Check if rule is already in global rules
        if (this.globalRules.some(r => r.id === ruleId)) {
            return true; // Already global
        }
        // Find the rule in project rules
        let rule;
        let projectId;
        for (const [pId, rules] of this.projectRules.entries()) {
            const foundRule = rules.find(r => r.id === ruleId);
            if (foundRule) {
                rule = foundRule;
                projectId = pId;
                break;
            }
        }
        if (rule && projectId) {
            // Remove from project rules
            const projectRules = this.projectRules.get(projectId) || [];
            this.projectRules.set(projectId, projectRules.filter(r => r.id !== ruleId));
            // Make global
            rule.isGlobal = true;
            this.globalRules.push(rule);
            // Save changes
            await this.saveState();
            return true;
        }
        return false;
    }
    /**
     * Export a rule to an .mdc file
     */
    async exportRuleToFile(ruleId, targetPath) {
        await this.ensureInitialized();
        // Find the rule
        const rule = await this.getRuleById(ruleId);
        if (!rule) {
            throw new Error(`Rule with ID ${ruleId} not found`);
        }
        // Export the rule
        if (rule instanceof rule_1.RuleImpl && rule.exportToFile) {
            return await rule.exportToFile(targetPath);
        }
        else if (rule.exportToFile) {
            return await rule.exportToFile(targetPath);
        }
        else {
            throw new Error(`Rule doesn't support export functionality`);
        }
    }
    /**
     * Find rules by tag
     */
    async findRulesByTag(tag) {
        await this.ensureInitialized();
        const allRules = await this.getAllRules();
        return allRules.filter(rule => rule.tags.includes(tag));
    }
    /**
     * Get rule categories based on tags
     */
    async getRuleCategories() {
        await this.ensureInitialized();
        const allRules = await this.getAllRules();
        const allTags = new Set();
        allRules.forEach(rule => {
            rule.tags.forEach(tag => allTags.add(tag));
        });
        return [...allTags];
    }
    /**
     * Create a rule from dialogue content
     */
    async createRuleFromDialogue(content, name, description = '', tags = []) {
        await this.ensureInitialized();
        const rule = new rule_1.RuleImpl(`rule-${Date.now()}`, name, description, content, false, // Not global by default
        tags, {}, // Empty frontmatter
        [] // Not applied to any projects
        );
        await this.saveState();
        return rule;
    }
    /**
     * Refresh local rules by re-scanning .cursor/rules folder
     */
    async refreshLocalRules() {
        await this.ensureInitialized();
        await this.importLocalRules();
    }
    /**
     * Import rules from local .cursor/rules folder
     */
    async importLocalRules() {
        try {
            // Get workspace folders
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return; // No workspace open
            }
            // Check each workspace folder for .cursor/rules directory
            for (const workspaceFolder of workspaceFolders) {
                const cursorRulesPath = path.join(workspaceFolder.uri.fsPath, '.cursor', 'rules');
                try {
                    const stat = await fs.stat(cursorRulesPath);
                    if (stat.isDirectory()) {
                        await this.scanAndImportRulesFromDirectory(cursorRulesPath);
                    }
                }
                catch (error) {
                    // Directory doesn't exist, skip silently
                    continue;
                }
            }
        }
        catch (error) {
            console.error('Error importing local rules:', error);
        }
    }
    /**
     * Scan directory for .mdc files and import them as rules
     */
    async scanAndImportRulesFromDirectory(directoryPath) {
        try {
            const files = await fs.readdir(directoryPath);
            for (const file of files) {
                if (file.endsWith('.mdc') || file.endsWith('.md')) {
                    const filePath = path.join(directoryPath, file);
                    try {
                        // Check if this rule is already imported by checking if we have a rule with the same file path
                        const existingRule = this.globalRules.find(rule => rule.frontmatter?.sourcePath === filePath);
                        if (!existingRule) {
                            const rule = await rule_1.RuleImpl.fromMDCFile(filePath);
                            // Mark this rule as coming from local folder
                            rule.frontmatter = {
                                ...rule.frontmatter,
                                sourcePath: filePath,
                                isLocalRule: true,
                                autoImported: true
                            };
                            this.globalRules.push(rule);
                            console.log(`Auto-imported local rule: ${rule.name} from ${filePath}`);
                        }
                    }
                    catch (error) {
                        console.error(`Error importing rule from ${filePath}:`, error);
                    }
                }
            }
            // Save the updated rules
            await this.saveState();
            // Notify that rules have been updated
            this.notifyRulesUpdated();
        }
        catch (error) {
            console.error(`Error scanning directory ${directoryPath}:`, error);
        }
    }
    /**
     * Notify listeners that rules have been updated
     */
    notifyRulesUpdated() {
        // Emit an event that can be listened to by views
        if (typeof this.onRulesUpdated === 'function') {
            this.onRulesUpdated();
        }
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
exports.RuleManager = RuleManager;
//# sourceMappingURL=ruleManager.js.map