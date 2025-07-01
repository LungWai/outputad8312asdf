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
const logger_1 = require("./utils/logger");
const constants_1 = require("./config/constants");
async function activate(context) {
    try {
        logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, 'Starting activation');
        // Environment detection for logging purposes
        const isRunningInCursor = detectCursorEnvironment();
        if (isRunningInCursor) {
            logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, 'Running in Cursor IDE - proceeding with real data access');
        }
        else {
            logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, 'Running in VS Code - full activation');
        }
        // ALWAYS use full activation with real data access - no more safe mode
        // Initialize data providers and services with error handling
        const storageManager = storageManager_1.StorageManager.getInstance();
        storageManager.initialize(context);
        logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, 'Initializing tag manager');
        const tagManager = tagManager_1.TagManager.getInstance();
        await tagManager.initialize();
        logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, 'Initializing rule manager');
        const ruleManager = ruleManager_1.RuleManager.getInstance();
        await ruleManager.initialize();
        logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, 'Initializing prompt manager');
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
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Rules updated, refreshing rule view');
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
                logger_1.logger.error(constants_1.LOG_COMPONENTS.EXTENSION, 'Error clearing cache', error);
                vscode.window.showErrorMessage(`Failed to clear cache: ${error}`);
            }
        });
        const debugDataCommand = vscode.commands.registerCommand('cursor-chat-manager.debugData', async () => {
            try {
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Debug data command started');
                // Get the current processed data
                const { projects, chats } = await chatProcessor.loadProcessedData();
                logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, `Loaded processed data: ${projects.length} projects, ${chats.length} chats`);
                // Show project and chat details
                let totalDialogues = 0;
                logger_1.logger.group(constants_1.LOG_COMPONENTS.EXTENSION, 'Project and chat details', () => {
                    projects.forEach((project, pIndex) => {
                        logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, `Project ${pIndex}: "${project.name}" (${project.chats.length} chats)`);
                        project.chats.forEach((chat, cIndex) => {
                            logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, `  Chat ${cIndex}: "${chat.title}" (${chat.dialogues.length} dialogues)`);
                            totalDialogues += chat.dialogues.length;
                            if (chat.dialogues.length > 0) {
                                chat.dialogues.slice(0, 2).forEach((dialogue, dIndex) => {
                                    logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, `    Dialogue ${dIndex}: isUser=${dialogue.isUser}, content="${dialogue.content.substring(0, 50)}..."`);
                                });
                            }
                        });
                    });
                });
                const message = `Debug Results:\n- ${projects.length} projects\n- ${chats.length} chats\n- ${totalDialogues} total dialogues\n\nCheck console for detailed output.`;
                vscode.window.showInformationMessage(message);
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Debug data command completed');
            }
            catch (error) {
                logger_1.logger.error(constants_1.LOG_COMPONENTS.EXTENSION, 'Error in debug command', error);
                vscode.window.showErrorMessage(`Debug failed: ${error}`);
            }
        });
        const inspectRawDataCommand = vscode.commands.registerCommand('cursor-chat-manager.inspectRawData', async () => {
            try {
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Raw data inspection started');
                // Get raw data from CursorDataProvider
                const cursorDataProvider = require('./data/cursorDataProvider').CursorDataProvider.getInstance();
                const rawData = await cursorDataProvider.getChatData();
                logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, `Raw data inspection: Found ${rawData.length} items`);
                // Examine first few items in detail (only in debug mode)
                logger_1.logger.group(constants_1.LOG_COMPONENTS.EXTENSION, 'Raw data samples', () => {
                    rawData.slice(0, 3).forEach((item, index) => {
                        logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, `Raw Item ${index}`, {
                            source: item.source,
                            workspace: item.workspace,
                            dataType: typeof item.data,
                            isArray: Array.isArray(item.data)
                        });
                        if (item.data && typeof item.data === 'object') {
                            const dataKeys = Object.keys(item.data);
                            logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, `Item ${index} keys: ${dataKeys.join(', ')}`);
                            // Look for message-like structures
                            if (item.data.messages && Array.isArray(item.data.messages)) {
                                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, `Found messages array with ${item.data.messages.length} items`);
                            }
                            if (item.data.conversations && Array.isArray(item.data.conversations)) {
                                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, `Found conversations array with ${item.data.conversations.length} items`);
                            }
                            // Check if it's an array of items
                            if (Array.isArray(item.data)) {
                                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, `Data is array with ${item.data.length} items`);
                            }
                        }
                    });
                });
                // Test the validation logic
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Running validation test');
                const processor = require('./services/chatProcessor').ChatProcessor.getInstance();
                let validCount = 0;
                let invalidCount = 0;
                rawData.slice(0, 10).forEach((item, index) => {
                    const validationDetails = processor.getValidationDetails ?
                        processor.getValidationDetails(item.data) :
                        { valid: 'validation method not accessible' };
                    logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, `Item ${index} validation`, {
                        valid: validationDetails.valid,
                        dataType: validationDetails.dataType,
                        isArray: validationDetails.isArray,
                        hasMessages: validationDetails.hasMessages,
                        hasConversations: validationDetails.hasConversations
                    });
                    if (validationDetails.valid === true)
                        validCount++;
                    else if (validationDetails.valid === false)
                        invalidCount++;
                });
                logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, `Validation summary: ${validCount} valid, ${invalidCount} invalid out of first 10 items`);
                const message = `Raw Data Inspection:\n- ${rawData.length} total items\n- Check console for detailed analysis\n- Validation: ${validCount} valid, ${invalidCount} invalid (first 10)`;
                vscode.window.showInformationMessage(message);
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Raw data inspection completed');
            }
            catch (error) {
                logger_1.logger.error(constants_1.LOG_COMPONENTS.EXTENSION, 'Error in raw data inspection', error);
                vscode.window.showErrorMessage(`Raw data inspection failed: ${error}`);
            }
        });
        const testSqliteExtractionCommand = vscode.commands.registerCommand('cursor-chat-manager.testSqliteExtraction', async () => {
            try {
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'SQLite extraction test started');
                // Force use of fallback implementation for testing
                const databaseService = require('./data/databaseService').DatabaseService;
                const service = new databaseService();
                // Get workspace folders
                const cursorDataProvider = require('./data/cursorDataProvider').CursorDataProvider.getInstance();
                const folders = await cursorDataProvider.findWorkspaceStorageFolders();
                logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, `Found ${folders.length} workspace folders to test`);
                if (folders.length > 0) {
                    const firstFolder = folders[0];
                    const dbPath = require('path').join(firstFolder, 'state.vscdb');
                    logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, `Testing SQLite extraction on: ${dbPath}`);
                    await service.openConnection(dbPath);
                    // Test both types of queries
                    const aiQuery = "SELECT * FROM ItemTable WHERE key LIKE '%aiService.prompts%'";
                    const workbenchQuery = "SELECT * FROM ItemTable WHERE key LIKE '%workbench.panel.aichat%'";
                    const aiResults = await service.executeQuery(aiQuery);
                    logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, `AI prompts query returned ${aiResults.length} results`);
                    const workbenchResults = await service.executeQuery(workbenchQuery);
                    logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, `Workbench query returned ${workbenchResults.length} results`);
                    // Sample detailed results in debug mode only
                    logger_1.logger.group(constants_1.LOG_COMPONENTS.EXTENSION, 'Sample query results', () => {
                        if (aiResults.length > 0) {
                            logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'AI Results sample', {
                                count: aiResults.length,
                                firstKey: aiResults[0].key,
                                firstValueType: typeof aiResults[0].value
                            });
                        }
                        if (workbenchResults.length > 0) {
                            logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Workbench Results sample', {
                                count: workbenchResults.length,
                                firstKey: workbenchResults[0].key,
                                firstValueType: typeof workbenchResults[0].value
                            });
                        }
                    });
                    await service.closeConnection();
                }
                const message = `SQLite Extraction Test Completed\nCheck console for detailed results`;
                vscode.window.showInformationMessage(message);
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'SQLite extraction test completed');
            }
            catch (error) {
                logger_1.logger.error(constants_1.LOG_COMPONENTS.EXTENSION, 'Error in SQLite extraction test', error);
                vscode.window.showErrorMessage(`SQLite extraction test failed: ${error}`);
            }
        });
        const testChatViewingCommand = vscode.commands.registerCommand('cursor-chat-manager.testChatViewing', async () => {
            try {
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Chat viewing functionality test started');
                // Get projects and chats
                const projectOrganizer = require('./services/projectOrganizer').ProjectOrganizer.getInstance();
                const allProjects = projectOrganizer.getAllProjects();
                logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, `Found ${allProjects.length} projects for testing`);
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
                logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, `Testing with project: "${testProject.name}" (${testProject.chats.length} chats)`);
                logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, `Test chat: "${testChat.title}" (${testChat.dialogues.length} dialogues)`);
                // Log dialogue details
                if (testChat.dialogues.length > 0) {
                    logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Sample dialogues');
                    testChat.dialogues.slice(0, 3).forEach((dialogue, index) => {
                        logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, `  ${index + 1}. ${dialogue.isUser ? 'User' : 'AI'}: "${dialogue.content.substring(0, 100)}..."`);
                    });
                }
                else {
                    logger_1.logger.warn(constants_1.LOG_COMPONENTS.EXTENSION, 'Test chat has no dialogues - this will show empty chat view');
                }
                // Test creating ChatView directly
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Creating ChatView instance');
                const { ChatView } = require('./views/chatView');
                const chatView = new ChatView(context);
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Opening chat view');
                await chatView.openChat(testChat.id, testProject.id);
                logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, 'Chat view opened successfully');
                const message = `Chat Viewing Test Results:\n- Project: "${testProject.name}"\n- Chat: "${testChat.title}"\n- Dialogues: ${testChat.dialogues.length}\n- ChatView opened successfully\n\nCheck console for detailed logs.`;
                vscode.window.showInformationMessage(message);
            }
            catch (error) {
                logger_1.logger.error(constants_1.LOG_COMPONENTS.EXTENSION, 'Error in chat viewing test', error);
                vscode.window.showErrorMessage(`Chat viewing test failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // PROOF: Force load data immediately to show proof logs
        logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, 'Forcing data load to show proof');
        try {
            logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Calling projectViewProvider.loadProjects()');
            const loadResult = await projectViewProvider.loadProjects();
            logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, 'Proof load completed');
            if (loadResult) {
                logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, `Final result - ${loadResult.projectCount} projects, ${loadResult.chatCount} chats`);
                // Additional debugging to verify tree view state
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Verifying tree view state');
                // Try to get the current state from project organizer
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Getting current state from ProjectOrganizer');
                const projectOrganizer = require('./services/projectOrganizer').ProjectOrganizer.getInstance();
                const allProjects = projectOrganizer.getAllProjects();
                const originalProjects = projectOrganizer.getOriginalProjects();
                const customProjects = projectOrganizer.getCustomProjects();
                logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, `ProjectOrganizer state: ${allProjects.length} total, ${originalProjects.length} original, ${customProjects.length} custom`);
                // Try to trigger a manual refresh of the tree view
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Manually refreshing ProjectView');
                projectViewProvider.refresh();
                logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Tree view verification completed');
            }
            else {
                logger_1.logger.error(constants_1.LOG_COMPONENTS.EXTENSION, 'Proof load returned null');
            }
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.EXTENSION, 'Proof load failed', error);
        }
        // Show welcome message
        logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, 'Activation completed successfully');
        vscode.window.showInformationMessage('Cursor Chat Manager has been activated!');
        // Add commands to subscriptions
        context.subscriptions.push(clearCacheCommand, debugDataCommand, inspectRawDataCommand, testSqliteExtractionCommand, testChatViewingCommand);
    }
    catch (error) {
        logger_1.logger.error(constants_1.LOG_COMPONENTS.EXTENSION, 'Failed to activate', error);
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
    logger_1.logger.debug(constants_1.LOG_COMPONENTS.EXTENSION, 'Environment detection', {
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
        logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, 'Starting deactivation');
        // Clean up database connections
        const { DatabaseService } = require('./data/databaseService');
        const dbService = new DatabaseService();
        dbService.closeAllConnections();
        // Clean up any other resources
        logger_1.logger.info(constants_1.LOG_COMPONENTS.EXTENSION, 'Deactivation completed');
    }
    catch (error) {
        logger_1.logger.error(constants_1.LOG_COMPONENTS.EXTENSION, 'Error during deactivation', error);
    }
}
//# sourceMappingURL=extension.js.map