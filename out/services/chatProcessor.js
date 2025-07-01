"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatProcessor = exports.DEBUG = void 0;
const uuid_1 = require("uuid");
const chat_1 = require("../models/chat");
const dialogue_1 = require("../models/dialogue");
const project_1 = require("../models/project");
const cursorDataProvider_1 = require("../data/cursorDataProvider");
const storageManager_1 = require("../data/storageManager");
const cursor_1 = require("../types/cursor");
// Debug gate
exports.DEBUG = process.env.CURSOR_DEBUG === '1';
const dbg = (...a) => exports.DEBUG && console.log('[CP]', ...a);
class ChatProcessor {
    constructor() {
        this.cursorDataProvider = cursorDataProvider_1.CursorDataProvider.getInstance();
        this.storageManager = storageManager_1.StorageManager.getInstance();
    }
    // ①  ───────────────────────────────────
    // Add helper just below class fields
    isNumericKeyObject(obj) {
        return (0, cursor_1.isNumericKeyObject)(obj);
    }
    // ── helper to detect single prompt objects ───────────────────────────
    isSinglePrompt(obj) {
        return (0, cursor_1.isPrompt)(obj);
    }
    // ①  ───────────────────────────────────
    static getInstance() {
        if (!ChatProcessor.instance) {
            ChatProcessor.instance = new ChatProcessor();
        }
        return ChatProcessor.instance;
    }
    async processChats() {
        // Fetch raw data from Cursor storage
        const rawChatData = await this.cursorDataProvider.getChatData();
        dbg(`Received ${rawChatData.length} raw chat data items`);
        // Track data sources
        const sourceCounts = new Map();
        for (const item of rawChatData) {
            const source = item.source || 'unknown';
            sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
        }
        // Process into structured data
        const projects = new Map();
        const chats = [];
        let validChatCount = 0;
        let invalidDataCount = 0;
        for (const item of rawChatData) {
            try {
                // Log the first few items for debugging
                if (rawChatData.indexOf(item) < 3) {
                    console.log(`ChatProcessor: Sample item ${rawChatData.indexOf(item)}: source="${item.source}", data type=${typeof item.data}, data keys=${item.data && typeof item.data === 'object' ? Object.keys(item.data).join(',') : 'N/A'}`);
                }
                // Different processing based on data source
                let processedCount = 0;
                // Task 5: Check for rich chat data first before other branches
                if ((0, cursor_1.isChatData)(item.data)) {
                    // Rich chatData row – treat it like a normal chat object
                    processedCount = await this.processAiServicePrompts(item, projects, chats);
                    if (processedCount > 0) {
                        validChatCount += processedCount;
                    }
                    else {
                        invalidDataCount++;
                    }
                }
                else if (item.source.includes('aiService.prompts')) {
                    processedCount = await this.processAiServicePrompts(item, projects, chats);
                    if (processedCount > 0) {
                        validChatCount += processedCount;
                    }
                    else {
                        invalidDataCount++;
                    }
                }
                else if (item.source.includes('workbench.panel.aichat')) {
                    processedCount = await this.processWorkbenchChatData(item, projects, chats);
                    if (processedCount > 0) {
                        validChatCount += processedCount;
                    }
                    else {
                        invalidDataCount++;
                    }
                }
                else {
                    // Handle fallback data that might not have the correct source pattern
                    if (item.source.includes('fallback.extracted.data')) {
                        // Try to determine the data type from the content
                        processedCount = await this.processFallbackData(item, projects, chats);
                        if (processedCount > 0) {
                            validChatCount += processedCount;
                        }
                        else {
                            invalidDataCount++;
                        }
                    }
                }
            }
            catch (error) {
                console.error(`Error processing chat data: ${error}`);
            }
        }
        // Convert Maps to arrays
        const finalProjects = Array.from(projects.values());
        console.log(`ChatProcessor: *** FINAL PROCESSING RESULTS ***`);
        console.log(`  - Total items processed: ${rawChatData.length}`);
        console.log(`  - Valid chat conversations found: ${validChatCount}`);
        console.log(`  - Invalid/system data skipped: ${invalidDataCount}`);
        console.log(`  - Final projects: ${finalProjects.length}`);
        console.log(`  - Final chats: ${chats.length}`);
        console.log(`ChatProcessor: *** END RESULTS ***`);
        return {
            projects: finalProjects,
            chats
        };
    }
    async processFallbackData(item, projects, chats) {
        const data = item.data;
        if (!data || typeof data !== 'object') {
            return 0;
        }
        let processedCount = 0;
        // Try to determine if this is AI service prompts or workbench chat data
        if (Array.isArray(data)) {
            // Check if entire array consists of single prompts - process as one unit
            if (data.every(d => this.isSinglePrompt(d))) {
                return this.processAiServicePrompts(item, projects, chats);
            }
            // Otherwise, treat each item as potential chat data
            for (const dataItem of data) {
                if (this.looksLikeAiServicePrompt(dataItem)) {
                    const count = await this.processAiServicePrompts({ ...item, data: [dataItem] }, projects, chats);
                    processedCount += count;
                }
                else if (this.looksLikeWorkbenchChat(dataItem)) {
                    const count = await this.processWorkbenchChatData({ ...item, data: { entries: [dataItem] } }, projects, chats);
                    processedCount += count;
                }
            }
        }
        else {
            // Single object
            if (this.looksLikeAiServicePrompt(data)) {
                const count = await this.processAiServicePrompts({ ...item, data: [data] }, projects, chats);
                processedCount += count;
            }
            else if (this.looksLikeWorkbenchChat(data)) {
                const count = await this.processWorkbenchChatData({ ...item, data: { entries: [data] } }, projects, chats);
                processedCount += count;
            }
            else if (data.conversations && Array.isArray(data.conversations)) {
                // Handle conversations array
                const count = await this.processAiServicePrompts({ ...item, data: data.conversations }, projects, chats);
                processedCount += count;
            }
            else if (data.entries && Array.isArray(data.entries)) {
                // Handle entries array
                const count = await this.processWorkbenchChatData(item, projects, chats);
                processedCount += count;
            }
        }
        return processedCount;
    }
    // ②  ───────────────────────────────────
    // Update looksLikeAiServicePrompt()
    looksLikeAiServicePrompt(data) {
        if (!data || typeof data !== 'object')
            return false;
        // NEW: Check for nested chatData structure (rich chat data)
        if (data.chatData && typeof data.chatData === 'object' &&
            (Array.isArray(data.chatData.messages) || Array.isArray(data.chatData.chunks))) {
            return true;
        }
        // NEW: accept Cursor's numeric-key objects immediately
        if (this.isNumericKeyObject(data))
            return true;
        // ── 1️⃣ accept single prompt objects ────────────────
        if (this.isSinglePrompt(data))
            return true;
        // (existing terminal-indicator rejection unchanged) …
        const terminalIndicators = [
            'pid', 'ppid', 'shellIntegrationNonce', 'titleSource', 'isOrphan',
            'environmentVariableCollections', 'isFeatureTerminal', 'hasChildProcesses',
            'shellPath', 'shellType', 'activePersistentProcessId'
        ];
        const dataKeys = Object.keys(data);
        const hasTerminalIndicators = terminalIndicators.some(indicator => dataKeys.includes(indicator));
        if (hasTerminalIndicators) {
            dbg(`Rejecting terminal/shell data with keys: ${dataKeys.join(', ')}`);
            return false;
        }
        // LOWER the size threshold and loosen rules
        const jsonLen = JSON.stringify(data).length;
        const chatish = (Array.isArray(data.messages) ||
            Array.isArray(data.chunks) ||
            Array.isArray(data.parts) ||
            Array.isArray(data.conversations) ||
            Array.isArray(data.entries) ||
            this.isNumericKeyObject(data) // <-- here too
        )
            && jsonLen > 120; // was 500
        if (!chatish)
            return false;
        return true;
    }
    // ②  ───────────────────────────────────
    looksLikeWorkbenchChat(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }
        // Must have entries array
        if (!data.entries || !Array.isArray(data.entries)) {
            return false;
        }
        // Entries must contain actual chat conversations
        const hasValidEntries = data.entries.some((entry) => {
            if (!entry || typeof entry !== 'object')
                return false;
            // Must have conversation array with messages
            if (!entry.conversation || !Array.isArray(entry.conversation))
                return false;
            // Conversation must have valid messages
            return entry.conversation.some((msg) => msg && typeof msg === 'object' &&
                typeof msg.message === 'string' &&
                msg.message.trim().length > 0 &&
                (msg.sender === 'user' || msg.sender === 'assistant' || msg.sender === 'system'));
        });
        if (!hasValidEntries) {
            dbg(`Rejecting workbench data - no valid conversations in entries`);
            return false;
        }
        return true;
    }
    async processAiServicePrompts(item, projects, chats) {
        // ③  ───────────────────────────────────
        // Top of processAiServicePrompts(): replace first 25 lines up to promptsToProcess declaration
        const data = item.data;
        let promptsToProcess = [];
        // NORMALISE shapes:
        //  • If it's Cursor's numeric-key object ⇒ convert to user messages
        if (this.isNumericKeyObject(data)) {
            const ordered = Object.keys(data)
                .sort((a, b) => Number(a) - Number(b))
                .map(k => data[k]);
            // Convert to user messages (real assistant replies will be extracted from rich data)
            const conversationMessages = ordered.map(p => ({
                role: 'user',
                content: p.text || p.content || String(p),
                createdAt: p.createdAt || Date.now()
            }));
            promptsToProcess = [{ messages: conversationMessages }];
        }
        //  • Array of single prompts ⇒ merge into one conversation
        else if (Array.isArray(data) && data.every(item => this.isSinglePrompt(item))) {
            // Convert to user messages (real assistant replies will be extracted from rich data)
            const conversationMessages = data.map(p => ({
                role: 'user',
                content: p.text,
                createdAt: p.createdAt || Date.now()
            }));
            promptsToProcess = [{ messages: conversationMessages }];
        }
        //  • Already an array?  Filter out any non-chat records later
        else if (Array.isArray(data)) {
            promptsToProcess = data;
        }
        //  • Object with conversations/messages/etc.
        else if (data && typeof data === 'object') {
            // Handle rich chat data with nested chatData property
            if (data.chatData && typeof data.chatData === 'object' &&
                (Array.isArray(data.chatData.messages) || Array.isArray(data.chatData.chunks))) {
                promptsToProcess = [data]; // Pass the whole object with chatData
            }
            else if (Array.isArray(data.entries)) {
                // Convert each entry to a flat "messages" object
                promptsToProcess = data.entries
                    .filter((e) => Array.isArray(e.conversation) || Array.isArray(e.messages))
                    .map((e) => ({ messages: e.conversation ?? e.messages }));
            }
            else if (Array.isArray(data.conversations)) {
                promptsToProcess = data.conversations;
            }
            else if (Array.isArray(data.messages)) {
                promptsToProcess = [data]; // treat as single chat
            }
            else {
                promptsToProcess = [data];
            }
        }
        // ── DEBUG start ──
        if (Array.isArray(promptsToProcess) && promptsToProcess.length > 0) {
            const sample = promptsToProcess[0];
            dbg('first inner value type:', typeof sample);
            if (typeof sample === 'string') {
                dbg('string length:', sample.length, 'first 200 chars:', sample.slice(0, 200));
            }
            else {
                dbg('keys:', Object.keys(sample));
                dbg('snippet:', JSON.stringify(sample).slice(0, 300));
            }
        }
        // ── DEBUG end ──
        // final clean-up – keep only things that *look* like chat
        promptsToProcess = promptsToProcess.filter(p => this.looksLikeAiServicePrompt(p));
        if (promptsToProcess.length === 0) {
            dbg(`(aiService) nothing chat-like; keys=${Object.keys(data ?? {}).join()}`);
            return 0;
        }
        // ③  ───────────────────────────────────
        let processedCount = 0;
        dbg(`Processing ${promptsToProcess.length} potential prompt items...`);
        for (const prompt of promptsToProcess) {
            try {
                // ENHANCED: Handle different data structures
                let actualChatData = null;
                let extractedWorkspaceName = null;
                // ── 2️⃣ Handle single prompt objects BEFORE looksLikeDirectChatData ──
                if (this.isSinglePrompt(prompt)) {
                    const messages = [{ role: 'user', content: prompt.text, createdAt: Date.now() }];
                    actualChatData = { messages };
                    // you can also carry prompt.commandType in metadata if needed
                }
                // Case 1: Direct chat conversation object
                else if (this.looksLikeDirectChatData(prompt)) {
                    actualChatData = prompt;
                }
                // Case 2: UI state object that might contain workspace info
                else if (prompt && typeof prompt === 'object') {
                    // Extract workspace/project name from UI state
                    if (prompt.name && typeof prompt.name === 'string' && prompt.name.length > 5) {
                        extractedWorkspaceName = prompt.name;
                        console.log(`ChatProcessor: Extracted workspace name from UI state: "${extractedWorkspaceName}"`);
                    }
                    // Look for nested chat data in UI state
                    const nestedChatData = this.extractNestedChatData(prompt);
                    if (nestedChatData) {
                        actualChatData = nestedChatData;
                    }
                }
                // Skip if no actual chat data found
                if (!actualChatData) {
                    if (promptsToProcess.indexOf(prompt) < 5) {
                        console.log(`ChatProcessor: Skipping item - no chat data found. Keys: ${prompt && typeof prompt === 'object' ? Object.keys(prompt).join(',') : typeof prompt}`);
                    }
                    continue;
                }
                // Add null check and debugging
                if (!actualChatData || typeof actualChatData !== 'object') {
                    console.log(`ChatProcessor: Skipping invalid chat data: ${typeof actualChatData}`);
                    continue;
                }
                // Task 4: Improve project naming - prioritize workspaceName from rich chat data
                const folderName = require('path').basename(item.folderName ?? item.databasePath ?? '');
                const baseProjectName = actualChatData.workspaceName
                    || item.workspaceRealName
                    || (folderName.match(/^[a-f0-9]{32}$/) ? `Workspace ${folderName.slice(0, 8)}` : folderName)
                    || extractedWorkspaceName
                    || item.workspace
                    || 'Unknown Project';
                let finalProjectName = baseProjectName;
                const finalProjectId = `original-${finalProjectName.replace(/\s+/g, '-').toLowerCase()}`;
                // Ensure project exists
                if (!projects.has(finalProjectId)) {
                    const newProject = new project_1.ProjectImpl(finalProjectId, finalProjectName, `Original project from Cursor: ${finalProjectName}`, new Date(), false, // Not a custom project
                    [], []);
                    projects.set(finalProjectId, newProject);
                    console.log(`ChatProcessor: Created new project: "${finalProjectName}" (ID: ${finalProjectId})`);
                }
                else {
                    console.log(`ChatProcessor: Using existing project: "${finalProjectName}" (ID: ${finalProjectId})`);
                }
                // Create chat with better null checking
                const chatId = (actualChatData && actualChatData.id) || (0, uuid_1.v4)();
                const chatTitle = (actualChatData && actualChatData.title) || `Chat from ${new Date((actualChatData && actualChatData.createdAt) || Date.now()).toLocaleString()}`;
                const timestamp = new Date((actualChatData && actualChatData.createdAt) || Date.now());
                const chat = new chat_1.ChatImpl(chatId, chatTitle, timestamp, finalProjectId, // Use the final project ID
                [], []);
                // Process dialogues with enhanced handling
                this.processMessagesFromChatData(actualChatData, chat);
                // Only add chat if it has dialogues or meaningful content
                if (chat.dialogues.length > 0) {
                    // Add chat to list and to project
                    chats.push(chat);
                    const project = projects.get(finalProjectId); // Use final project ID
                    if (project) {
                        project.addChat(chat);
                        console.log(`ChatProcessor: Added chat "${chatTitle}" to project "${project.name}" (now has ${project.chats.length} chats)`);
                    }
                    else {
                        console.error(`ChatProcessor: Failed to find project ${finalProjectId} when adding chat ${chatTitle}`);
                    }
                    processedCount++;
                    console.log(`ChatProcessor: Successfully processed chat "${chatTitle}" with ${chat.dialogues.length} dialogues`);
                }
                else {
                    console.log(`ChatProcessor: Skipping empty chat "${chatTitle}"`);
                }
            }
            catch (error) {
                console.error(`Error processing prompt data: ${error}`);
            }
        }
        return processedCount;
    }
    /**
     * Task 2: Extract message array from various chat data structures
     */
    extractAnyMessageArray(chatData) {
        if (!chatData || typeof chatData !== 'object') {
            return [];
        }
        /*  -------- NEW --------  */
        if (chatData.chatData?.messages &&
            Array.isArray(chatData.chatData.messages)) {
            console.log(`ChatProcessor: Found ${chatData.chatData.messages.length} rich messages`);
            return chatData.chatData.messages; // ← the assistant lives here
        }
        /*  ---------------------  */
        // Try standard formats first
        if (chatData.messages && Array.isArray(chatData.messages)) {
            console.log(`ChatProcessor: Found ${chatData.messages.length} messages in 'messages' array`);
            return chatData.messages;
        }
        // Cursor often uses 'chunks' instead of 'messages'
        if (chatData.chunks && Array.isArray(chatData.chunks)) {
            console.log(`ChatProcessor: Found ${chatData.chunks.length} messages in 'chunks' array`);
            return chatData.chunks;
        }
        // Or 'parts'
        if (chatData.parts && Array.isArray(chatData.parts)) {
            console.log(`ChatProcessor: Found ${chatData.parts.length} messages in 'parts' array`);
            return chatData.parts;
        }
        // Or nested in conversation
        if (chatData.conversation && Array.isArray(chatData.conversation)) {
            console.log(`ChatProcessor: Found ${chatData.conversation.length} messages in 'conversation' array`);
            return chatData.conversation;
        }
        // Or in entries
        if (chatData.entries && Array.isArray(chatData.entries)) {
            const messages = [];
            for (const entry of chatData.entries) {
                if (entry.conversation && Array.isArray(entry.conversation)) {
                    messages.push(...entry.conversation);
                }
                else if (entry.messages && Array.isArray(entry.messages)) {
                    messages.push(...entry.messages);
                }
            }
            console.log(`ChatProcessor: Extracted ${messages.length} messages from entries`);
            return messages;
        }
        // Single message format
        if (chatData.role && (chatData.content || chatData.text || chatData.message)) {
            console.log(`ChatProcessor: Processing single message format`);
            return [chatData];
        }
        return [];
    }
    /**
     * Check if data looks like direct chat conversation data
     */
    looksLikeDirectChatData(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }
        // Must NOT have terminal/shell indicators
        const terminalIndicators = ['pid', 'shellIntegrationNonce', 'isFeatureTerminal'];
        if (terminalIndicators.some(indicator => data.hasOwnProperty(indicator))) {
            return false;
        }
        // Check for rich chat data with nested chatData
        if (data.chatData && typeof data.chatData === 'object' &&
            (Array.isArray(data.chatData.messages) || Array.isArray(data.chatData.chunks))) {
            return true;
        }
        // Must have chat structure
        return (data.messages && Array.isArray(data.messages) && data.messages.length > 0) ||
            (data.conversations && Array.isArray(data.conversations) && data.conversations.length > 0) ||
            (data.role && data.content && ['user', 'assistant', 'system'].includes(data.role));
    }
    /**
     * Extract nested chat data from UI state objects
     */
    extractNestedChatData(data) {
        if (!data || typeof data !== 'object') {
            return null;
        }
        // Check for rich chat data structure first
        if (data.chatData && typeof data.chatData === 'object' &&
            (Array.isArray(data.chatData.messages) || Array.isArray(data.chatData.chunks))) {
            return data; // Return the whole object to preserve structure
        }
        // Look for nested chat data in various possible locations
        const possibleChatFields = ['messages', 'conversations', 'entries', 'chats', 'dialogs', 'history'];
        for (const field of possibleChatFields) {
            if (data[field] && Array.isArray(data[field]) && data[field].length > 0) {
                // Check if this array contains valid chat messages
                const hasValidMessages = data[field].some((item) => item && typeof item === 'object' &&
                    ((item.role && item.content) ||
                        (item.sender && item.message) ||
                        (item.messages && Array.isArray(item.messages))));
                if (hasValidMessages) {
                    // entries[] contains its own conversation array
                    if (field === 'entries') {
                        const flattened = [];
                        for (const e of data.entries) {
                            if (Array.isArray(e.conversation))
                                flattened.push(...e.conversation);
                            if (Array.isArray(e.messages))
                                flattened.push(...e.messages);
                        }
                        if (flattened.length)
                            return { messages: flattened };
                    }
                    return { messages: data[field] };
                }
            }
        }
        // Check for deeply nested structures
        if (data.data && typeof data.data === 'object') {
            return this.extractNestedChatData(data.data);
        }
        return null;
    }
    /**
     * Process messages from chat data with enhanced handling for various formats
     */
    processMessagesFromChatData(chatData, chat) {
        let messagesProcessed = 0;
        // Handle nested chatData structure (rich chat data)
        if (chatData.chatData && typeof chatData.chatData === 'object') {
            console.log(`ChatProcessor: Detected nested chatData structure, extracting inner data`);
            return this.processMessagesFromChatData(chatData.chatData, chat);
        }
        // ── 3️⃣ Handle single prompt text at the very top ───────
        if (chatData.text && typeof chatData.text === 'string') {
            const messages = [{ role: 'user', content: chatData.text,
                    timestamp: chatData.createdAt ?? Date.now() }];
            // Process the single message
            for (const message of messages) {
                const dialogue = new dialogue_1.DialogueImpl((0, uuid_1.v4)(), // dialogue id
                chat.id, // parent chat id
                message.content, // dialogue content
                message.role === 'user', // isUser flag
                new Date(message.timestamp));
                chat.addDialogue(dialogue);
                messagesProcessed++;
            }
            console.log(`ChatProcessor: Processed single prompt text into ${messagesProcessed} dialogue(s)`);
            return messagesProcessed;
        }
        // Task 2: Extract message array using helper method
        const messages = this.extractAnyMessageArray(chatData);
        if (messages.length === 0) {
            console.log(`ChatProcessor: No messages found in chat data`);
            return 0;
        }
        console.log(`ChatProcessor: Found ${messages.length} messages to process`);
        // Helper function to extract text from parts array
        const textFromParts = (parts) => Array.isArray(parts)
            ? parts
                .map(p => typeof p === 'string'
                ? p
                : (typeof p?.text === 'string' ? p.text : ''))
                .join('')
            : typeof parts === 'string'
                ? parts
                : '';
        // Task 1: Create message flattening function that handles both rich and fallback formats
        const flatten = (msg) => {
            /* ==== rich Cursor format ==== */
            if (msg.authorKind !== undefined) {
                const role = msg.authorKind === 1 ? 'user'
                    : msg.authorKind === 2 ? 'assistant'
                        : 'system'; // authorKind 3
                return {
                    role,
                    content: textFromParts(msg.parts ?? msg.content?.parts),
                    ts: (msg.createTime ?? msg.timestamp ?? Date.now()) * 1000
                };
            }
            /* ==== fallback / legacy ==== */
            const role = msg.role || msg.sender || (msg.isUser ? 'user' : 'assistant');
            const content = msg.content ?? msg.text ?? msg.message ?? '';
            const ts = msg.timestamp ?? msg.createdAt ?? Date.now();
            return { role, content, ts };
        };
        // Debug logging to check message structure
        console.log('ChatProcessor: Sample messages structure:', messages.slice(0, 3).map(m => ({
            role: m.role ?? m.authorKind,
            preview: JSON.stringify(m).slice(0, 80)
        })));
        // Quick sanity check
        console.log(messages.slice(0, 3).map(m => ({
            r: m.role ?? m.authorKind,
            t: textFromParts(m.parts ?? m.content?.parts ?? m.text).slice(0, 40)
        })));
        // Process each message using the flattening function
        for (const message of messages) {
            try {
                // Skip if not an object
                if (!message || typeof message !== 'object') {
                    continue;
                }
                // Use the flatten function to normalize the message
                const normalized = flatten(message);
                // Skip empty messages
                if (!normalized.content || (typeof normalized.content === 'string' && normalized.content.trim().length === 0)) {
                    continue;
                }
                // Create dialogue
                const dialogue = new dialogue_1.DialogueImpl((0, uuid_1.v4)(), // dialogue id
                chat.id, // parent chat id
                normalized.content.toString(), // dialogue content
                normalized.role === 'user', // isUser flag
                new Date(normalized.ts));
                chat.addDialogue(dialogue);
                messagesProcessed++;
            }
            catch (error) {
                console.error(`Error processing message: ${error}`);
            }
        }
        console.log(`ChatProcessor: Processed ${messagesProcessed} messages into dialogues`);
        return messagesProcessed;
    }
    async processWorkbenchChatData(item, projects, chats) {
        const data = item.data;
        if (!data || !data.entries || !Array.isArray(data.entries)) {
            return 0;
        }
        let processedCount = 0;
        // Extract project name from workspace with improved logic (same as processAiServicePrompts)
        const baseProjectName = item.workspaceRealName || item.workspace || 'Unknown Project';
        // Add detailed debugging for project naming
        console.log(`ChatProcessor: *** WORKBENCH PROJECT NAMING DEBUG ***`);
        console.log(`  - item.workspace: ${item.workspace}`);
        console.log(`  - item.source: ${item.source}`);
        console.log(`  - Computed baseProjectName: "${baseProjectName}"`);
        // Try to extract better project name from available data
        let improvedProjectName = baseProjectName;
        // Check item-level data for project hints
        if (item.data && typeof item.data === 'object') {
            const itemKeys = Object.keys(item.data);
            console.log(`  - Item data keys: ${itemKeys.join(', ')}`);
            // Look for workspace or project-related fields in the raw data
            const projectFields = ['workspaceName', 'projectName', 'folderName', 'name'];
            for (const field of projectFields) {
                if (item.data[field] && typeof item.data[field] === 'string') {
                    console.log(`  - Found item.data.${field}: ${item.data[field]}`);
                    if (!item.data[field].match(/^[a-f0-9]{8,}$/)) { // Avoid hash-like strings
                        improvedProjectName = item.data[field];
                        break;
                    }
                }
            }
        }
        // Use improved name if found
        const finalProjectName = improvedProjectName !== baseProjectName ? improvedProjectName : baseProjectName;
        const finalProjectId = `original-${finalProjectName.replace(/\s+/g, '-').toLowerCase()}`;
        console.log(`  - FINAL projectName: "${finalProjectName}"`);
        console.log(`  - FINAL projectId: "${finalProjectId}"`);
        console.log(`ChatProcessor: *** END WORKBENCH PROJECT NAMING DEBUG ***`);
        // Ensure project exists
        if (!projects.has(finalProjectId)) {
            const newProject = new project_1.ProjectImpl(finalProjectId, finalProjectName, `Original project from Cursor: ${finalProjectName}`, new Date(), false, // Not a custom project
            [], []);
            projects.set(finalProjectId, newProject);
            console.log(`ChatProcessor: Created new workbench project: "${finalProjectName}" (ID: ${finalProjectId})`);
        }
        else {
            console.log(`ChatProcessor: Using existing workbench project: "${finalProjectName}" (ID: ${finalProjectId})`);
        }
        for (const entry of data.entries) {
            try {
                // Create chat
                const chatId = entry.id || (0, uuid_1.v4)();
                const chatTitle = entry.title || `Chat from ${new Date(entry.timestamp || Date.now()).toLocaleString()}`;
                const timestamp = new Date(entry.timestamp || Date.now());
                const chat = new chat_1.ChatImpl(chatId, chatTitle, timestamp, finalProjectId, // Use final project ID
                [], []);
                // Process dialogues
                if (Array.isArray(entry.conversation)) {
                    console.log(`ChatProcessor: Processing ${entry.conversation.length} workbench messages for chat "${chatTitle}"`);
                    for (const message of entry.conversation) {
                        const dialogueId = message.id || (0, uuid_1.v4)();
                        const isUser = message.sender === 'user';
                        const dialogueTimestamp = new Date(message.timestamp || chat.timestamp);
                        const dialogue = new dialogue_1.DialogueImpl(dialogueId, chat.id, message.message || '', isUser, dialogueTimestamp, []);
                        chat.addDialogue(dialogue);
                    }
                }
                // Add chat to list and to project
                if (chat.dialogues.length > 0) {
                    chats.push(chat);
                    const project = projects.get(finalProjectId); // Use final project ID
                    if (project) {
                        project.addChat(chat);
                        console.log(`ChatProcessor: Added workbench chat "${chatTitle}" to project "${project.name}" (now has ${project.chats.length} chats)`);
                    }
                    else {
                        console.error(`ChatProcessor: Failed to find workbench project ${finalProjectId} when adding chat ${chatTitle}`);
                    }
                    processedCount++;
                    console.log(`ChatProcessor: Successfully processed workbench chat "${chatTitle}" with ${chat.dialogues.length} dialogues`);
                }
                else {
                    console.log(`ChatProcessor: Skipping empty workbench chat "${chatTitle}"`);
                }
            }
            catch (error) {
                console.error(`Error processing workbench chat entry: ${error}`);
            }
        }
        return processedCount;
    }
    async saveProcessedData(projects, chats) {
        try {
            // Save projects
            await this.storageManager.saveData('projects', projects.map(p => p instanceof project_1.ProjectImpl ? p.serialize() : p));
            // Save chats
            await this.storageManager.saveData('chats', chats.map(c => c instanceof chat_1.ChatImpl ? c.serialize() : c));
            return true;
        }
        catch (error) {
            console.error(`Error saving processed data: ${error}`);
            return false;
        }
    }
    async loadProcessedData() {
        try {
            // Load projects
            const projectsData = await this.storageManager.getData('projects', []);
            const projects = (projectsData || []).map((p) => project_1.ProjectImpl.deserialize(p));
            // Load chats
            const chatsData = await this.storageManager.getData('chats', []);
            const chats = (chatsData || []).map((c) => chat_1.ChatImpl.deserialize(c));
            return { projects, chats };
        }
        catch (error) {
            console.error(`Error loading processed data: ${error}`);
            return { projects: [], chats: [] };
        }
    }
    /**
     * Clear all cached and stored data to force fresh processing
     */
    async clearAllCachedData() {
        console.log('ChatProcessor: Clearing all cached and stored data');
        // Clear storage
        await this.storageManager.removeData('projects');
        await this.storageManager.removeData('chats');
        // Clear CursorDataProvider cache
        this.cursorDataProvider.clearCache();
    }
    /**
     * Public method to expose validation logic for debugging
     */
    testValidation(data) {
        return this.looksLikeAiServicePrompt(data);
    }
    /**
     * Public method to get detailed validation information
     */
    getValidationDetails(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, reason: 'Data is not an object' };
        }
        const details = {
            valid: false,
            dataType: typeof data,
            isArray: Array.isArray(data),
            keys: Object.keys(data),
            reasons: []
        };
        // Check for messages array with proper message format
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            details.hasMessages = true;
            details.messageCount = data.messages.length;
            // Check first message structure
            const firstMsg = data.messages[0];
            if (firstMsg && typeof firstMsg === 'object') {
                details.firstMessageKeys = Object.keys(firstMsg);
                details.firstMessageHasRole = 'role' in firstMsg;
                details.firstMessageHasContent = 'content' in firstMsg;
                if (typeof firstMsg.role === 'string' &&
                    ['user', 'assistant', 'system'].includes(firstMsg.role) &&
                    typeof firstMsg.content === 'string' &&
                    firstMsg.content.trim().length > 0) {
                    details.valid = true;
                    details.reasons.push('Valid messages array found');
                    return details;
                }
                else {
                    details.reasons.push('Messages exist but lack proper role/content structure');
                }
            }
        }
        // Check for individual message structure
        if (data.role && data.content) {
            details.hasRoleContent = true;
            if (typeof data.role === 'string' &&
                ['user', 'assistant', 'system'].includes(data.role) &&
                typeof data.content === 'string' &&
                data.content.trim().length > 0) {
                details.valid = true;
                details.reasons.push('Valid individual message structure');
                return details;
            }
            else {
                details.reasons.push('Has role/content but invalid structure');
            }
        }
        // Check for chat structure with conversations
        if (data.conversations && Array.isArray(data.conversations)) {
            details.hasConversations = true;
            details.conversationCount = data.conversations.length;
            if (data.conversations.length > 0) {
                details.valid = true;
                details.reasons.push('Has conversations array');
                return details;
            }
        }
        // Check system config rejection patterns
        const keys = Object.keys(data);
        const systemConfigPatterns = [
            /^\d+$/, /^editor/, /^terminal/, /^isActive/, /^activePersistentProcessId/,
            /^text$/, /^state$/, /^\$mid$/, /^external$/, /^path$/, /^scheme$/, /^authority$/
        ];
        const systemKeys = keys.filter(key => systemConfigPatterns.some(pattern => pattern.test(key)));
        if (systemKeys.length > 0) {
            details.systemKeys = systemKeys;
            details.reasons.push(`Rejected due to system config keys: ${systemKeys.join(', ')}`);
            return details;
        }
        // Fallback validation
        if (data.messages && Array.isArray(data.messages)) {
            details.valid = true;
            details.reasons.push('Fallback: Has messages array');
            return details;
        }
        if (data.id && data.title) {
            details.valid = true;
            details.reasons.push('Fallback: Has id and title');
            return details;
        }
        details.reasons.push('No valid chat patterns found');
        return details;
    }
}
exports.ChatProcessor = ChatProcessor;
//# sourceMappingURL=chatProcessor.js.map