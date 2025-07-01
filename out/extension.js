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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const projectCommands_1 = require("./commands/projectCommands");
const exportCommands_1 = require("./commands/exportCommands");
const ruleCommands_1 = require("./commands/ruleCommands");
const promptCommands_1 = require("./commands/promptCommands");
const projectView_1 = require("./views/projectView");
const ruleView_1 = require("./views/ruleView");
const tagView_1 = require("./views/tagView");
const promptView_1 = require("./views/promptView");
const storageManager_1 = require("./data/storageManager");
const tagManager_1 = require("./services/tagManager");
const ruleManager_1 = require("./services/ruleManager");
const promptManager_1 = require("./services/promptManager");
const chatProcessor_1 = require("./services/chatProcessor");
async function activate(context) {
    try {
        console.log('Cursor Chat Manager: Starting activation...');
        // Environment detection for logging purposes
        const isRunningInCursor = detectCursorEnvironment();
        if (isRunningInCursor) {
            console.log('Cursor Chat Manager: Running in Cursor IDE - proceeding with real data access');
        }
        else {
            console.log('Cursor Chat Manager: Running in VS Code - full activation');
        }
        // ALWAYS use full activation with real data access - no more safe mode
        // Initialize data providers and services with error handling
        const storageManager = storageManager_1.StorageManager.getInstance();
        storageManager.initialize(context);
        console.log('Cursor Chat Manager: Initializing tag manager...');
        const tagManager = tagManager_1.TagManager.getInstance();
        await tagManager.initialize();
        console.log('Cursor Chat Manager: Initializing rule manager...');
        const ruleManager = ruleManager_1.RuleManager.getInstance();
        await ruleManager.initialize();
        console.log('Cursor Chat Manager: Initializing prompt manager...');
        const promptManager = promptManager_1.PromptManager.getInstance();
        await promptManager.initialize();
        // Initialize chat processor
        const chatProcessor = chatProcessor_1.ChatProcessor.getInstance();
        // Register views
        const projectViewProvider = new projectView_1.ProjectView(context);
        const ruleViewProvider = new ruleView_1.RuleView(context);
        const tagViewProvider = new tagView_1.TagView(context);
        const promptViewProvider = new promptView_1.PromptView(context);
        // Register tree views
        vscode.window.registerTreeDataProvider('cursor-chat-manager.projectView', projectViewProvider);
        vscode.window.registerTreeDataProvider('cursor-chat-manager.ruleView', ruleViewProvider);
        vscode.window.registerTreeDataProvider('cursor-chat-manager.tagView', tagViewProvider);
        vscode.window.registerTreeDataProvider('cursor-chat-manager.promptView', promptViewProvider);
        // Connect rule manager to rule view for auto-refresh
        ruleManager.onRulesUpdated = () => {
            console.log('Cursor Chat Manager: Rules updated, refreshing rule view');
            ruleViewProvider.refresh();
        };
        // Register view-related commands
        vscode.commands.registerCommand('cursor-chat-manager.viewRule', (ruleId) => {
            ruleViewProvider.viewRule(ruleId);
        });
        vscode.commands.registerCommand('cursor-chat-manager.previewPrompt', (promptId) => {
            promptViewProvider.previewPrompt(promptId);
        });
        // Register commands
        (0, projectCommands_1.registerProjectCommands)(context, projectViewProvider);
        (0, exportCommands_1.registerExportCommands)(context);
        (0, ruleCommands_1.registerRuleCommands)(context, ruleViewProvider);
        (0, promptCommands_1.registerPromptCommands)(context, promptViewProvider);
        // Register other commands
        const clearCacheCommand = vscode.commands.registerCommand('cursor-chat-manager.clearAllCache', async () => {
            try {
                // Clear all cached data
                await chatProcessor.clearAllCachedData();
                // Refresh tree views
                projectViewProvider.refresh();
                ruleViewProvider.refresh();
                tagViewProvider.refresh();
                promptViewProvider.refresh();
                vscode.window.showInformationMessage('All cached data cleared. Refreshing views...');
                // Force reload of data
                vscode.commands.executeCommand('cursor-chat-manager.refreshChats');
            }
            catch (error) {
                console.error('Error clearing cache:', error);
                vscode.window.showErrorMessage(`Failed to clear cache: ${error}`);
            }
        });
        const debugDataCommand = vscode.commands.registerCommand('cursor-chat-manager.debugData', async () => {
            try {
                console.log('=== DEBUG DATA COMMAND STARTED ===');
                // Get the current processed data
                const { projects, chats } = await chatProcessor.loadProcessedData();
                console.log(`Loaded processed data: ${projects.length} projects, ${chats.length} chats`);
                // Show project and chat details
                let totalDialogues = 0;
                projects.forEach((project, pIndex) => {
                    console.log(`Project ${pIndex}: "${project.name}" (${project.chats.length} chats)`);
                    project.chats.forEach((chat, cIndex) => {
                        console.log(`  Chat ${cIndex}: "${chat.title}" (${chat.dialogues.length} dialogues)`);
                        totalDialogues += chat.dialogues.length;
                        if (chat.dialogues.length > 0) {
                            chat.dialogues.slice(0, 2).forEach((dialogue, dIndex) => {
                                console.log(`    Dialogue ${dIndex}: isUser=${dialogue.isUser}, content="${dialogue.content.substring(0, 50)}..."`);
                            });
                        }
                    });
                });
                const message = `Debug Results:\n- ${projects.length} projects\n- ${chats.length} chats\n- ${totalDialogues} total dialogues\n\nCheck console for detailed output.`;
                vscode.window.showInformationMessage(message);
                console.log('=== DEBUG DATA COMMAND COMPLETED ===');
            }
            catch (error) {
                console.error('Error in debug command:', error);
                vscode.window.showErrorMessage(`Debug failed: ${error}`);
            }
        });
        const inspectRawDataCommand = vscode.commands.registerCommand('cursor-chat-manager.inspectRawData', async () => {
            try {
                console.log('=== RAW DATA INSPECTION STARTED ===');
                // Get raw data from CursorDataProvider
                const cursorDataProvider = require('./data/cursorDataProvider').CursorDataProvider.getInstance();
                const rawData = await cursorDataProvider.getChatData();
                console.log(`Raw data inspection: Found ${rawData.length} items`);
                // Examine first few items in detail
                rawData.slice(0, 3).forEach((item, index) => {
                    console.log(`\n--- Raw Item ${index} ---`);
                    console.log(`Source: ${item.source}`);
                    console.log(`Workspace: ${item.workspace}`);
                    console.log(`Data type: ${typeof item.data}`);
                    console.log(`Data is array: ${Array.isArray(item.data)}`);
                    if (item.data && typeof item.data === 'object') {
                        console.log(`Data keys: ${Object.keys(item.data).join(', ')}`);
                        // Look for message-like structures
                        if (item.data.messages && Array.isArray(item.data.messages)) {
                            console.log(`Found messages array with ${item.data.messages.length} items`);
                            if (item.data.messages.length > 0) {
                                const msg = item.data.messages[0];
                                console.log(`First message keys: ${Object.keys(msg).join(', ')}`);
                                console.log(`First message sample: ${JSON.stringify(msg).substring(0, 200)}...`);
                            }
                        }
                        if (item.data.conversations && Array.isArray(item.data.conversations)) {
                            console.log(`Found conversations array with ${item.data.conversations.length} items`);
                            if (item.data.conversations.length > 0) {
                                const conv = item.data.conversations[0];
                                console.log(`First conversation keys: ${Object.keys(conv).join(', ')}`);
                                console.log(`First conversation sample: ${JSON.stringify(conv).substring(0, 200)}...`);
                            }
                        }
                        // Check if it's an array of items
                        if (Array.isArray(item.data)) {
                            console.log(`Data is array with ${item.data.length} items`);
                            if (item.data.length > 0) {
                                console.log(`First array item keys: ${Object.keys(item.data[0]).join(', ')}`);
                                console.log(`First array item sample: ${JSON.stringify(item.data[0]).substring(0, 200)}...`);
                            }
                        }
                    }
                    else {
                        console.log(`Data content: ${JSON.stringify(item.data).substring(0, 200)}...`);
                    }
                });
                // Test the validation logic
                console.log('\n--- VALIDATION TEST ---');
                const processor = require('./services/chatProcessor').ChatProcessor.getInstance();
                let validCount = 0;
                let invalidCount = 0;
                rawData.forEach((item, index) => {
                    if (index < 10) { // Test first 10 items
                        const validationDetails = processor.getValidationDetails ?
                            processor.getValidationDetails(item.data) :
                            { valid: 'validation method not accessible' };
                        console.log(`\n--- Item ${index} Validation ---`);
                        console.log(`Valid: ${validationDetails.valid}`);
                        console.log(`Data type: ${validationDetails.dataType}`);
                        console.log(`Is array: ${validationDetails.isArray}`);
                        console.log(`Keys: ${validationDetails.keys ? validationDetails.keys.join(', ') : 'none'}`);
                        console.log(`Reasons: ${validationDetails.reasons ? validationDetails.reasons.join('; ') : 'none'}`);
                        if (validationDetails.hasMessages) {
                            console.log(`Has messages: ${validationDetails.messageCount} items`);
                            if (validationDetails.firstMessageKeys) {
                                console.log(`First message keys: ${validationDetails.firstMessageKeys.join(', ')}`);
                            }
                        }
                        if (validationDetails.hasConversations) {
                            console.log(`Has conversations: ${validationDetails.conversationCount} items`);
                        }
                        if (validationDetails.systemKeys) {
                            console.log(`System keys detected: ${validationDetails.systemKeys.join(', ')}`);
                        }
                        if (validationDetails.valid === true)
                            validCount++;
                        else if (validationDetails.valid === false)
                            invalidCount++;
                    }
                });
                console.log(`\nValidation summary: ${validCount} valid, ${invalidCount} invalid out of first 10 items`);
                const message = `Raw Data Inspection:\n- ${rawData.length} total items\n- Check console for detailed analysis\n- Validation: ${validCount} valid, ${invalidCount} invalid (first 10)`;
                vscode.window.showInformationMessage(message);
                console.log('=== RAW DATA INSPECTION COMPLETED ===');
            }
            catch (error) {
                console.error('Error in raw data inspection:', error);
                vscode.window.showErrorMessage(`Raw data inspection failed: ${error}`);
            }
        });
        const testSqliteExtractionCommand = vscode.commands.registerCommand('cursor-chat-manager.testSqliteExtraction', async () => {
            try {
                console.log('=== SQLITE EXTRACTION TEST STARTED ===');
                // Force use of fallback implementation for testing
                const databaseService = require('./data/databaseService').DatabaseService;
                const service = new databaseService();
                // Get workspace folders
                const cursorDataProvider = require('./data/cursorDataProvider').CursorDataProvider.getInstance();
                const folders = await cursorDataProvider.findWorkspaceStorageFolders();
                console.log(`Found ${folders.length} workspace folders to test`);
                if (folders.length > 0) {
                    const firstFolder = folders[0];
                    const dbPath = require('path').join(firstFolder, 'state.vscdb');
                    console.log(`Testing SQLite extraction on: ${dbPath}`);
                    await service.openConnection(dbPath);
                    // Test both types of queries
                    const aiQuery = "SELECT * FROM ItemTable WHERE key LIKE '%aiService.prompts%'";
                    const workbenchQuery = "SELECT * FROM ItemTable WHERE key LIKE '%workbench.panel.aichat%'";
                    console.log('\n--- Testing AI Prompts Query ---');
                    const aiResults = await service.executeQuery(aiQuery);
                    console.log(`AI prompts query returned ${aiResults.length} results`);
                    if (aiResults.length > 0) {
                        aiResults.slice(0, 2).forEach((result, index) => {
                            console.log(`\nAI Result ${index}:`);
                            console.log(`  Key: ${result.key}`);
                            console.log(`  Value type: ${typeof result.value}`);
                            console.log(`  Value length: ${result.value ? result.value.length : 'null'}`);
                            if (result.value) {
                                try {
                                    const parsed = JSON.parse(result.value);
                                    console.log(`  Parsed type: ${typeof parsed}`);
                                    console.log(`  Parsed keys: ${typeof parsed === 'object' ? Object.keys(parsed).join(', ') : 'N/A'}`);
                                    console.log(`  Content preview: ${JSON.stringify(parsed).substring(0, 300)}...`);
                                }
                                catch (e) {
                                    console.log(`  Parse error: ${e}`);
                                }
                            }
                        });
                    }
                    console.log('\n--- Testing Workbench Query ---');
                    const workbenchResults = await service.executeQuery(workbenchQuery);
                    console.log(`Workbench query returned ${workbenchResults.length} results`);
                    if (workbenchResults.length > 0) {
                        workbenchResults.slice(0, 2).forEach((result, index) => {
                            console.log(`\nWorkbench Result ${index}:`);
                            console.log(`  Key: ${result.key}`);
                            console.log(`  Value type: ${typeof result.value}`);
                            console.log(`  Value length: ${result.value ? result.value.length : 'null'}`);
                            if (result.value) {
                                try {
                                    const parsed = JSON.parse(result.value);
                                    console.log(`  Parsed type: ${typeof parsed}`);
                                    console.log(`  Parsed keys: ${typeof parsed === 'object' ? Object.keys(parsed).join(', ') : 'N/A'}`);
                                    console.log(`  Content preview: ${JSON.stringify(parsed).substring(0, 300)}...`);
                                }
                                catch (e) {
                                    console.log(`  Parse error: ${e}`);
                                }
                            }
                        });
                    }
                    await service.closeConnection();
                }
                const message = `SQLite Extraction Test Completed\nCheck console for detailed results`;
                vscode.window.showInformationMessage(message);
                console.log('=== SQLITE EXTRACTION TEST COMPLETED ===');
            }
            catch (error) {
                console.error('Error in SQLite extraction test:', error);
                vscode.window.showErrorMessage(`SQLite extraction test failed: ${error}`);
            }
        });
        const testChatViewingCommand = vscode.commands.registerCommand('cursor-chat-manager.testChatViewing', async () => {
            try {
                console.log('=== CHAT VIEWING FUNCTIONALITY TEST ===');
                // Get projects and chats
                const projectOrganizer = require('./services/projectOrganizer').ProjectOrganizer.getInstance();
                const allProjects = projectOrganizer.getAllProjects();
                console.log(`Found ${allProjects.length} projects for testing`);
                if (allProjects.length === 0) {
                    vscode.window.showErrorMessage('No projects found. Run "Debug Chat Data" first to load data.');
                    return;
                }
                // Find a project with chats
                let testProject = null;
                let testChat = null;
                for (const project of allProjects) {
                    if (project.chats.length > 0) {
                        testProject = project;
                        testChat = project.chats[0];
                        break;
                    }
                }
                if (!testProject || !testChat) {
                    vscode.window.showErrorMessage('No projects with chats found. Import some chat data first.');
                    return;
                }
                console.log(`Testing with project: "${testProject.name}" (${testProject.chats.length} chats)`);
                console.log(`Test chat: "${testChat.title}" (${testChat.dialogues.length} dialogues)`);
                // Log dialogue details
                if (testChat.dialogues.length > 0) {
                    console.log('Sample dialogues:');
                    testChat.dialogues.slice(0, 3).forEach((dialogue, index) => {
                        console.log(`  ${index + 1}. ${dialogue.isUser ? 'User' : 'AI'}: "${dialogue.content.substring(0, 100)}..."`);
                    });
                }
                else {
                    console.warn('Test chat has no dialogues - this will show empty chat view');
                }
                // Test creating ChatView directly
                console.log('Creating ChatView instance...');
                const { ChatView } = require('./views/chatView');
                const chatView = new ChatView(context);
                console.log('Opening chat view...');
                await chatView.openChat(testChat.id, testProject.id);
                console.log('Chat view opened successfully!');
                const message = `Chat Viewing Test Results:\n- Project: "${testProject.name}"\n- Chat: "${testChat.title}"\n- Dialogues: ${testChat.dialogues.length}\n- ChatView opened successfully\n\nCheck console for detailed logs.`;
                vscode.window.showInformationMessage(message);
            }
            catch (error) {
                console.error('Error in chat viewing test:', error);
                console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
                vscode.window.showErrorMessage(`Chat viewing test failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // PROOF: Force load data immediately to show proof logs
        console.log('Cursor Chat Manager: *** FORCING DATA LOAD TO SHOW PROOF ***');
        try {
            console.log('Cursor Chat Manager: Calling projectViewProvider.loadProjects()...');
            const loadResult = await projectViewProvider.loadProjects();
            console.log('Cursor Chat Manager: *** PROOF LOAD COMPLETED ***');
            if (loadResult) {
                console.log(`Cursor Chat Manager: FINAL RESULT - ${loadResult.projectCount} projects, ${loadResult.chatCount} chats`);
                // Additional debugging to verify tree view state
                console.log('Cursor Chat Manager: *** VERIFYING TREE VIEW STATE ***');
                // Try to get the current state from project organizer
                console.log('Cursor Chat Manager: Getting current state from ProjectOrganizer...');
                const projectOrganizer = require('./services/projectOrganizer').ProjectOrganizer.getInstance();
                const allProjects = projectOrganizer.getAllProjects();
                const originalProjects = projectOrganizer.getOriginalProjects();
                const customProjects = projectOrganizer.getCustomProjects();
                console.log(`ProjectOrganizer state: ${allProjects.length} total, ${originalProjects.length} original, ${customProjects.length} custom`);
                // Try to trigger a manual refresh of the tree view
                console.log('Cursor Chat Manager: Manually refreshing ProjectView...');
                projectViewProvider.refresh();
                console.log('Cursor Chat Manager: *** END TREE VIEW VERIFICATION ***');
            }
            else {
                console.error('Cursor Chat Manager: *** PROOF LOAD RETURNED NULL ***');
            }
        }
        catch (error) {
            console.error('Cursor Chat Manager: *** PROOF LOAD FAILED ***', error);
        }
        // Show welcome message
        console.log('Cursor Chat Manager: Activation completed successfully');
        vscode.window.showInformationMessage('Cursor Chat Manager has been activated!');
        // Add commands to subscriptions
        context.subscriptions.push(clearCacheCommand, debugDataCommand, inspectRawDataCommand, testSqliteExtractionCommand, testChatViewingCommand);
    }
    catch (error) {
        console.error('Cursor Chat Manager: Failed to activate:', error);
        vscode.window.showErrorMessage(`Cursor Chat Manager failed to activate: ${error instanceof Error ? error.message : String(error)}`);
        // Don't throw the error to prevent VS Code from disabling the extension
        // Instead, show a notification and continue with limited functionality
    }
}
/**
 * Detect if we're running inside Cursor IDE
 */
function detectCursorEnvironment() {
    const processName = process.execPath.toLowerCase();
    const isCursor = processName.includes('cursor') ||
        process.env.TERM_PROGRAM === 'cursor' ||
        process.env.VSCODE_PID !== undefined;
    console.log('Cursor Chat Manager: Environment detection:', {
        processPath: process.execPath,
        termProgram: process.env.TERM_PROGRAM,
        vscodePid: process.env.VSCODE_PID,
        isCursor: isCursor
    });
    return isCursor;
}
// Safe mode removed - always use real data access
function deactivate() {
    try {
        console.log('Cursor Chat Manager: Starting deactivation...');
        // Clean up database connections
        const { DatabaseService } = require('./data/databaseService');
        const dbService = new DatabaseService();
        dbService.closeAllConnections();
        // Clean up any other resources
        console.log('Cursor Chat Manager: Deactivation completed');
    }
    catch (error) {
        console.error('Cursor Chat Manager: Error during deactivation:', error);
    }
}
//# sourceMappingURL=extension.js.map