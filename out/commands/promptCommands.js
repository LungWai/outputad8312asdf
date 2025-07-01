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
exports.registerPromptCommands = registerPromptCommands;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const promptManager_1 = require("../services/promptManager");
const prompt_1 = require("../models/prompt");
function registerPromptCommands(context, promptView) {
    const promptManager = promptManager_1.PromptManager.getInstance();
    // Create prompt template command
    const createPromptCommand = vscode.commands.registerCommand('cursor-chat-manager.createPrompt', async () => {
        try {
            // Ask for prompt title
            const title = await vscode.window.showInputBox({
                prompt: 'Enter a title for the prompt template',
                placeHolder: 'Prompt Title',
                validateInput: value => value ? null : 'Title is required'
            });
            if (!title) {
                return; // User cancelled
            }
            // Ask for template content
            const template = await vscode.window.showInputBox({
                prompt: 'Enter the prompt template (use {{variable}} for variables)',
                placeHolder: 'Generate a {{language}} class named {{className}} that implements {{interface}}',
                validateInput: value => value ? null : 'Template is required'
            });
            if (!template) {
                return; // User cancelled
            }
            // Extract variables from template
            const variableNames = template.match(/{{(\s*[\w\d]+\s*)}}/g) || [];
            const extractedVars = new Set();
            variableNames.forEach(match => {
                // Remove {{ }} and trim
                const varName = match.replace(/{{|}}/g, '').trim();
                extractedVars.add(varName);
            });
            // Create variables with descriptions and default values
            const variables = [];
            for (const varName of extractedVars) {
                // Ask for variable description
                const description = await vscode.window.showInputBox({
                    prompt: `Enter description for variable "${varName}"`,
                    placeHolder: `Description for ${varName}`,
                    validateInput: value => value ? null : 'Description is required'
                });
                if (!description) {
                    return; // User cancelled
                }
                // Ask for default value
                const defaultValue = await vscode.window.showInputBox({
                    prompt: `Enter default value for variable "${varName}" (optional)`,
                    placeHolder: `Default value for ${varName}`
                });
                // Create variable
                variables.push(new prompt_1.VariableImpl(`var-${Date.now()}-${variables.length}`, varName, description, defaultValue || ''));
            }
            // Get existing categories
            const categories = await promptManager.getCategories();
            // Ask for category
            let category;
            if (categories.length > 0) {
                // Show quick pick with existing categories and option to create new
                const categoryOptions = [
                    { label: '+ Create New Category', value: 'new' },
                    ...categories.map(cat => ({ label: cat, value: cat }))
                ];
                const selectedCategory = await vscode.window.showQuickPick(categoryOptions, { placeHolder: 'Select or create a category' });
                if (!selectedCategory) {
                    return; // User cancelled
                }
                if (selectedCategory.value === 'new') {
                    // Ask for new category name
                    const newCategory = await vscode.window.showInputBox({
                        prompt: 'Enter a name for the new category',
                        placeHolder: 'Category Name',
                        validateInput: value => value ? null : 'Category name is required'
                    });
                    if (!newCategory) {
                        return; // User cancelled
                    }
                    category = newCategory;
                }
                else {
                    category = selectedCategory.value;
                }
            }
            else {
                // Ask for new category name
                const newCategory = await vscode.window.showInputBox({
                    prompt: 'Enter a name for the category',
                    placeHolder: 'Category Name',
                    validateInput: value => value ? null : 'Category name is required'
                });
                if (!newCategory) {
                    return; // User cancelled
                }
                category = newCategory;
            }
            // Ask for tags
            const tagsInput = await vscode.window.showInputBox({
                prompt: 'Enter tags for the prompt (comma-separated)',
                placeHolder: 'tag1, tag2, tag3'
            });
            const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(Boolean) : [];
            // Create the prompt
            const prompt = await promptManager.createPrompt(title, template, category, tags);
            // Refresh the prompt view
            promptView.refresh();
            vscode.window.showInformationMessage(`Prompt template "${prompt.title}" created`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create prompt: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Use prompt command
    const usePromptCommand = vscode.commands.registerCommand('cursor-chat-manager.usePrompt', async (promptId) => {
        try {
            // Get the prompt
            const prompt = await promptManager.getPromptById(promptId);
            if (!prompt) {
                vscode.window.showErrorMessage('Prompt not found');
                return;
            }
            // Collect variable values
            const variableValues = {};
            for (const variable of prompt.variables) {
                // Ask for variable value
                const value = await vscode.window.showInputBox({
                    prompt: variable.description || `Enter value for ${variable.name}`,
                    placeHolder: variable.name,
                    value: variable.defaultValue || ''
                });
                if (value === undefined) {
                    return; // User cancelled
                }
                variableValues[variable.name] = value;
            }
            // Fill the template
            const filledPrompt = await promptManager.fillPromptTemplate(promptId, variableValues);
            if (!filledPrompt) {
                vscode.window.showErrorMessage('Failed to fill prompt template');
                return;
            }
            // Ask what to do with the filled prompt
            const action = await vscode.window.showQuickPick([
                { label: 'Copy to Clipboard', value: 'copy' },
                { label: 'Insert at Cursor', value: 'insert' }
            ], { placeHolder: 'What would you like to do with the prompt?' });
            if (!action) {
                return; // User cancelled
            }
            if (action.value === 'copy') {
                // Copy to clipboard
                await vscode.env.clipboard.writeText(filledPrompt);
                vscode.window.showInformationMessage('Prompt copied to clipboard');
            }
            else if (action.value === 'insert') {
                // Insert at cursor
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    await editor.edit(editBuilder => {
                        editBuilder.insert(editor.selection.active, filledPrompt);
                    });
                    vscode.window.showInformationMessage('Prompt inserted at cursor');
                }
                else {
                    vscode.window.showErrorMessage('No active text editor');
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Edit prompt command
    const editPromptCommand = vscode.commands.registerCommand('cursor-chat-manager.editPrompt', async (promptId) => {
        try {
            // Get the prompt
            const prompt = await promptManager.getPromptById(promptId);
            if (!prompt) {
                vscode.window.showErrorMessage('Prompt not found');
                return;
            }
            // Ask for prompt title
            const title = await vscode.window.showInputBox({
                prompt: 'Enter a title for the prompt template',
                placeHolder: 'Prompt Title',
                value: prompt.title,
                validateInput: value => value ? null : 'Title is required'
            });
            if (!title) {
                return; // User cancelled
            }
            // Ask for template content
            const template = await vscode.window.showInputBox({
                prompt: 'Enter the prompt template (use {{variable}} for variables)',
                placeHolder: 'Generate a {{language}} class named {{className}} that implements {{interface}}',
                value: prompt.template,
                validateInput: value => value ? null : 'Template is required'
            });
            if (!template) {
                return; // User cancelled
            }
            // Get existing categories
            const categories = await promptManager.getCategories();
            // Ask for category
            let category;
            if (categories.length > 0) {
                // Show quick pick with existing categories and option to create new
                const categoryOptions = [
                    { label: '+ Create New Category', value: 'new' },
                    ...categories.map(cat => ({ label: cat, value: cat }))
                ];
                const selectedCategory = await vscode.window.showQuickPick(categoryOptions, { placeHolder: 'Select or create a category' });
                if (!selectedCategory) {
                    return; // User cancelled
                }
                if (selectedCategory.value === 'new') {
                    // Ask for new category name
                    const newCategory = await vscode.window.showInputBox({
                        prompt: 'Enter a name for the new category',
                        placeHolder: 'Category Name',
                        validateInput: value => value ? null : 'Category name is required'
                    });
                    if (!newCategory) {
                        return; // User cancelled
                    }
                    category = newCategory;
                }
                else {
                    category = selectedCategory.value;
                }
            }
            else {
                // Ask for new category name
                const newCategory = await vscode.window.showInputBox({
                    prompt: 'Enter a name for the category',
                    placeHolder: 'Category Name',
                    value: prompt.category,
                    validateInput: value => value ? null : 'Category name is required'
                });
                if (!newCategory) {
                    return; // User cancelled
                }
                category = newCategory;
            }
            // Ask for tags
            const tagsInput = await vscode.window.showInputBox({
                prompt: 'Enter tags for the prompt (comma-separated)',
                placeHolder: 'tag1, tag2, tag3',
                value: prompt.tags.join(', ')
            });
            const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(Boolean) : [];
            // Update the prompt
            const updated = await promptManager.updatePrompt(promptId, {
                title,
                template,
                category,
                tags
            });
            if (updated) {
                // Refresh the prompt view
                promptView.refresh();
                vscode.window.showInformationMessage(`Prompt template "${title}" updated`);
            }
            else {
                vscode.window.showErrorMessage('Failed to update prompt template');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Delete prompt command
    const deletePromptCommand = vscode.commands.registerCommand('cursor-chat-manager.deletePrompt', async (promptId) => {
        try {
            // Get the prompt
            const prompt = await promptManager.getPromptById(promptId);
            if (!prompt) {
                vscode.window.showErrorMessage('Prompt not found');
                return;
            }
            // Confirm deletion
            const response = await vscode.window.showWarningMessage(`Are you sure you want to delete the prompt template "${prompt.title}"?`, { modal: true }, 'Delete', 'Cancel');
            if (response !== 'Delete') {
                return; // User cancelled
            }
            // Delete the prompt
            const deleted = await promptManager.deletePrompt(promptId);
            if (deleted) {
                // Refresh the prompt view
                promptView.refresh();
                vscode.window.showInformationMessage(`Prompt template "${prompt.title}" deleted`);
            }
            else {
                vscode.window.showErrorMessage(`Failed to delete prompt template "${prompt.title}"`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Import prompts command
    const importPromptsCommand = vscode.commands.registerCommand('cursor-chat-manager.importPrompts', async () => {
        try {
            // Show file picker for JSON files
            const fileUris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    'JSON Files': ['json']
                },
                title: 'Select Prompts File to Import'
            });
            if (!fileUris || fileUris.length === 0) {
                return; // User cancelled
            }
            // Import the prompts
            const importedCount = await promptManager.importPrompts(fileUris[0].fsPath);
            // Refresh the prompt view
            promptView.refresh();
            vscode.window.showInformationMessage(`${importedCount} prompt templates imported`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to import prompts: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Export prompts command
    const exportPromptsCommand = vscode.commands.registerCommand('cursor-chat-manager.exportPrompts', async (promptIds) => {
        try {
            // If no prompt IDs provided, export all
            let idsToExport = promptIds || [];
            if (!idsToExport.length) {
                // Get all prompts
                const prompts = await promptManager.getPrompts();
                // Let user select prompts to export
                const promptItems = prompts.map(prompt => ({
                    label: prompt.title,
                    description: prompt.category,
                    id: prompt.id,
                    picked: false
                }));
                const selectedPrompts = await vscode.window.showQuickPick(promptItems, {
                    placeHolder: 'Select prompts to export',
                    canPickMany: true
                });
                if (!selectedPrompts || selectedPrompts.length === 0) {
                    return; // User cancelled
                }
                idsToExport = selectedPrompts.map(item => item.id);
            }
            // Show save dialog
            const defaultUri = vscode.Uri.file(path.join((await vscode.env.appRoot) || '', 'cursor_prompts.json'));
            const fileUri = await vscode.window.showSaveDialog({
                defaultUri,
                filters: {
                    'JSON Files': ['json']
                },
                saveLabel: 'Export Prompts',
                title: 'Export Prompt Templates'
            });
            if (!fileUri) {
                return; // User cancelled
            }
            // Export the prompts
            const exported = await promptManager.exportPrompts(idsToExport, fileUri.fsPath);
            if (exported) {
                vscode.window.showInformationMessage(`${idsToExport.length} prompt templates exported successfully`);
            }
            else {
                vscode.window.showErrorMessage('Failed to export prompt templates');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Register commands
    context.subscriptions.push(createPromptCommand, usePromptCommand, editPromptCommand, deletePromptCommand, importPromptsCommand, exportPromptsCommand);
}
//# sourceMappingURL=promptCommands.js.map