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
exports.registerRuleCommands = registerRuleCommands;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const ruleManager_1 = require("../services/ruleManager");
const projectOrganizer_1 = require("../services/projectOrganizer");
function registerRuleCommands(context, ruleView) {
    console.log('Cursor Chat Manager: Registering rule commands...');
    const ruleManager = ruleManager_1.RuleManager.getInstance();
    // Import rule command
    console.log('Cursor Chat Manager: Registering importRule command...');
    const importRuleCommand = vscode.commands.registerCommand('cursor-chat-manager.importRule', async () => {
        try {
            // Show file picker for .mdc files
            const fileUris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    'Markdown with Code (MDC)': ['mdc', 'md']
                },
                title: 'Select Rule File to Import'
            });
            if (!fileUris || fileUris.length === 0) {
                return; // User cancelled
            }
            // Ask if the rule should be global
            const isGlobal = await vscode.window.showQuickPick([
                { label: 'Global Rule', description: 'Rule will be available for all projects', value: true },
                { label: 'Project Rule', description: 'Rule will be associated with a specific project', value: false }
            ], { placeHolder: 'Select rule scope' });
            if (!isGlobal) {
                return; // User cancelled
            }
            // Import the rule
            const rule = await ruleManager.importRuleFromFile(fileUris[0].fsPath);
            // If not global, ask which project to apply to
            if (!isGlobal.value) {
                const projectOrganizer = projectOrganizer_1.ProjectOrganizer.getInstance();
                const projects = await projectOrganizer.getAllProjects();
                const projectItems = projects.map(project => ({
                    label: project.name,
                    description: `${project.chats.length} chats`,
                    project: project
                }));
                const selectedProject = await vscode.window.showQuickPick(projectItems, {
                    placeHolder: 'Select a project to apply the rule to'
                });
                if (selectedProject) {
                    await ruleManager.applyRuleToProject(rule.id, selectedProject.project.id);
                }
            }
            // Refresh the rule view
            ruleView.refresh();
            vscode.window.showInformationMessage(`Rule "${rule.name}" imported successfully`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to import rule: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Make rule global command
    const makeRuleGlobalCommand = vscode.commands.registerCommand('cursor-chat-manager.makeRuleGlobal', async (ruleId) => {
        try {
            const success = await ruleManager.makeRuleGlobal(ruleId);
            if (success) {
                // Refresh the rule view
                ruleView.refresh();
                vscode.window.showInformationMessage('Rule is now available globally');
            }
            else {
                vscode.window.showErrorMessage('Failed to make rule global');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Apply rule to project command
    const applyRuleCommand = vscode.commands.registerCommand('cursor-chat-manager.applyRule', async (ruleId) => {
        try {
            // Get the rule
            const rule = await ruleManager.getRuleById(ruleId);
            if (!rule) {
                vscode.window.showErrorMessage('Rule not found');
                return;
            }
            // Get projects
            const projectOrganizer = projectOrganizer_1.ProjectOrganizer.getInstance();
            const projects = await projectOrganizer.getAllProjects();
            // Filter out projects that already have this rule
            const availableProjects = projects.filter(project => !rule.appliedProjects?.includes(project.id));
            if (availableProjects.length === 0) {
                vscode.window.showInformationMessage('Rule is already applied to all projects');
                return;
            }
            // Let user select a project
            const projectItems = availableProjects.map(project => ({
                label: project.name,
                description: `${project.chats.length} chats`,
                project: project
            }));
            const selectedProject = await vscode.window.showQuickPick(projectItems, { placeHolder: 'Select a project to apply the rule to' });
            if (!selectedProject) {
                return; // User cancelled
            }
            // Apply the rule
            const applied = await ruleManager.applyRuleToProject(ruleId, selectedProject.project.id);
            if (applied) {
                // Refresh the rule view
                ruleView.refresh();
                vscode.window.showInformationMessage(`Rule "${rule.name}" applied to project "${selectedProject.project.name}"`);
            }
            else {
                vscode.window.showInformationMessage('Rule is already applied to this project');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Export rule command
    const exportRuleCommand = vscode.commands.registerCommand('cursor-chat-manager.exportRule', async (ruleId) => {
        try {
            // Get the rule
            const rule = await ruleManager.getRuleById(ruleId);
            if (!rule) {
                vscode.window.showErrorMessage('Rule not found');
                return;
            }
            // Show save dialog
            const defaultUri = vscode.Uri.file(path.join((await vscode.env.appRoot) || '', `${rule.name.replace(/[\\/:*?"<>|]/g, '_')}.mdc`));
            const fileUri = await vscode.window.showSaveDialog({
                defaultUri,
                filters: {
                    'Markdown with Code (MDC)': ['mdc']
                },
                saveLabel: 'Export Rule',
                title: `Export Rule: ${rule.name}`
            });
            if (!fileUri) {
                return; // User cancelled
            }
            // Export the rule
            const exported = await ruleManager.exportRuleToFile(ruleId, fileUri.fsPath);
            if (exported) {
                vscode.window.showInformationMessage(`Rule "${rule.name}" exported successfully`);
            }
            else {
                vscode.window.showErrorMessage(`Failed to export rule "${rule.name}"`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Delete rule command
    const deleteRuleCommand = vscode.commands.registerCommand('cursor-chat-manager.deleteRule', async (ruleId) => {
        try {
            // Get the rule
            const rule = await ruleManager.getRuleById(ruleId);
            if (!rule) {
                vscode.window.showErrorMessage('Rule not found');
                return;
            }
            // Confirm deletion
            const response = await vscode.window.showWarningMessage(`Are you sure you want to delete the rule "${rule.name}"?`, { modal: true }, 'Delete', 'Cancel');
            if (response !== 'Delete') {
                return; // User cancelled
            }
            // Delete the rule
            const deleted = await ruleManager.deleteRule(ruleId);
            if (deleted) {
                // Refresh the rule view
                ruleView.refresh();
                vscode.window.showInformationMessage(`Rule "${rule.name}" deleted`);
            }
            else {
                vscode.window.showErrorMessage(`Failed to delete rule "${rule.name}"`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Create rule from selection command
    const createRuleFromSelectionCommand = vscode.commands.registerCommand('cursor-chat-manager.createRuleFromSelection', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active text editor');
                return;
            }
            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showErrorMessage('No text selected');
                return;
            }
            // Get selected text
            const text = editor.document.getText(selection);
            // Ask for rule name
            const name = await vscode.window.showInputBox({
                prompt: 'Enter a name for the rule',
                placeHolder: 'Rule Name',
                value: `Rule from ${path.basename(editor.document.fileName)}`
            });
            if (!name) {
                return; // User cancelled
            }
            // Ask for description
            const description = await vscode.window.showInputBox({
                prompt: 'Enter a description for the rule (optional)',
                placeHolder: 'Rule Description'
            });
            // Ask for tags
            const tagsInput = await vscode.window.showInputBox({
                prompt: 'Enter tags for the rule (comma-separated)',
                placeHolder: 'tag1, tag2, tag3'
            });
            const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(Boolean) : [];
            // Create the rule
            const rule = await ruleManager.createRuleFromDialogue(text, name, description || '', tags);
            // Ask if the rule should be global
            const isGlobal = await vscode.window.showQuickPick([
                { label: 'Global Rule', description: 'Rule will be available for all projects', value: true },
                { label: 'Project Rule', description: 'Rule will be associated with a specific project', value: false }
            ], { placeHolder: 'Select rule scope' });
            if (!isGlobal) {
                return; // User cancelled
            }
            if (isGlobal.value) {
                // Make rule global
                rule.isGlobal = true;
                await ruleManager.saveState();
            }
            else {
                // Let user select a project
                const projectOrganizer = projectOrganizer_1.ProjectOrganizer.getInstance();
                const projects = await projectOrganizer.getAllProjects();
                const projectItems = projects.map(project => ({
                    label: project.name,
                    description: `${project.chats.length} chats`,
                    project: project
                }));
                const selectedProject = await vscode.window.showQuickPick(projectItems, { placeHolder: 'Select a project to apply the rule to' });
                if (selectedProject) {
                    await ruleManager.applyRuleToProject(rule.id, selectedProject.project.id);
                }
            }
            // Refresh the rule view
            ruleView.refresh();
            vscode.window.showInformationMessage(`Rule "${rule.name}" created`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Refresh local rules command
    const refreshLocalRulesCommand = vscode.commands.registerCommand('cursor-chat-manager.refreshLocalRules', async () => {
        try {
            await ruleManager.refreshLocalRules();
            ruleView.refresh();
            vscode.window.showInformationMessage('Local rules refreshed successfully!');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh local rules: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Register commands
    context.subscriptions.push(importRuleCommand, makeRuleGlobalCommand, applyRuleCommand, exportRuleCommand, deleteRuleCommand, createRuleFromSelectionCommand, refreshLocalRulesCommand);
    console.log('Cursor Chat Manager: Rule commands registered successfully, including importRule');
}
//# sourceMappingURL=ruleCommands.js.map