import { v4 as uuidv4 } from 'uuid';
import { Chat, ChatImpl } from '../models/chat';
import { DialogueImpl } from '../models/dialogue';
import { Project, ProjectImpl } from '../models/project';
import { CursorDataProvider } from '../data/cursorDataProvider';
import { StorageManager } from '../data/storageManager';
import { TagManager } from './tagManager';
import { WorkspaceData, Prompt, ChatData, isPrompt, isNumericKeyObject, isChatData } from '../types/cursor';
import { logger } from '../utils/logger';
import { LOG_COMPONENTS } from '../config/constants';

// Debug gate
export const DEBUG = process.env.CURSOR_DEBUG === '1';
const dbg = (...a: any[]) => DEBUG && logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, a.join(' '));

export class ChatProcessor {
  private static instance: ChatProcessor;
  private cursorDataProvider: CursorDataProvider;
  private storageManager: StorageManager;
  private tagManager: TagManager;

  private constructor() {
    this.cursorDataProvider = CursorDataProvider.getInstance();
    this.storageManager = StorageManager.getInstance();
    this.tagManager = TagManager.getInstance();
  }

  // ①  ───────────────────────────────────
  // Add helper just below class fields
  
  /**
   * Restore tags for a dialogue from TagManager
   */
  private restoreDialogueTags(dialogue: DialogueImpl): void {
    const existingTags = this.tagManager.getDialogueTags(dialogue.id);
    if (existingTags && existingTags.length > 0) {
      existingTags.forEach(tag => dialogue.addTag(tag));
      logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Restored ${existingTags.length} tags for dialogue ${dialogue.id}`);
    }
  }
  private isNumericKeyObject(obj: any): boolean {
    return isNumericKeyObject(obj);
  }

  // ── helper to detect single prompt objects ───────────────────────────
  private isSinglePrompt(obj: any): obj is Prompt {
    return isPrompt(obj);
  }
  // ①  ───────────────────────────────────

  public static getInstance(): ChatProcessor {
    if (!ChatProcessor.instance) {
      ChatProcessor.instance = new ChatProcessor();
    }
    return ChatProcessor.instance;
  }

  public async processChats(): Promise<{
    projects: Project[];
    chats: Chat[];
  }> {
    // Fetch raw data from Cursor storage
    const rawChatData = await this.cursorDataProvider.getChatData();

    dbg(`Received ${rawChatData.length} raw chat data items`);

    // Track data sources
    const sourceCounts = new Map<string, number>();
    for (const item of rawChatData) {
      const source = item.source || 'unknown';
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    }

    // Process into structured data
    const projects: Map<string, ProjectImpl> = new Map();
    const chats: Chat[] = [];
    let validChatCount = 0;
    let invalidDataCount = 0;

    for (const item of rawChatData) {
      try {
        // Log the first few items for debugging
        if (rawChatData.indexOf(item) < 3) {
          logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Sample item ${rawChatData.indexOf(item)}: source="${item.source}", data type=${typeof item.data}, data keys=${item.data && typeof item.data === 'object' ? Object.keys(item.data).join(',') : 'N/A'}`);
        }

        // Different processing based on data source
        let processedCount = 0;

        // Task 5: Check for rich chat data first before other branches
        if (isChatData(item.data)) {
          // Rich chatData row – treat it like a normal chat object
          processedCount = await this.processAiServicePrompts(item, projects, chats);
          if (processedCount > 0) {
            validChatCount += processedCount;
          } else {
            invalidDataCount++;
          }
        } else if (item.source.includes('aiService.prompts')) {
          processedCount = await this.processAiServicePrompts(item, projects, chats);
          if (processedCount > 0) {
            validChatCount += processedCount;
          } else {
            invalidDataCount++;
          }
        } else if (item.source.includes('workbench.panel.aichat')) {
          processedCount = await this.processWorkbenchChatData(item, projects, chats);
          if (processedCount > 0) {
            validChatCount += processedCount;
          } else {
            invalidDataCount++;
          }
        } else {
          // Handle fallback data that might not have the correct source pattern
          if (item.source.includes('fallback.extracted.data')) {
            // Try to determine the data type from the content
            processedCount = await this.processFallbackData(item, projects, chats);
            if (processedCount > 0) {
              validChatCount += processedCount;
            } else {
              invalidDataCount++;
            }
          }
        }
      } catch (error) {
        logger.error(LOG_COMPONENTS.CHAT_PROCESSOR, 'Error processing chat data', error);
      }
    }

    // Convert Maps to arrays
    const finalProjects = Array.from(projects.values());
    logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, '*** FINAL PROCESSING RESULTS ***');
    logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, `  - Total items processed: ${rawChatData.length}`);
    logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, `  - Valid chat conversations found: ${validChatCount}`);
    logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, `  - Invalid/system data skipped: ${invalidDataCount}`);
    logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, `  - Final projects: ${finalProjects.length}`);
    logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, `  - Final chats: ${chats.length}`);
    logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, '*** END RESULTS ***');

    return {
      projects: finalProjects,
      chats
    };
  }

  private async processFallbackData(
    item: Record<string, any>,
    projects: Map<string, ProjectImpl>,
    chats: Chat[]
  ): Promise<number> {
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
        } else if (this.looksLikeWorkbenchChat(dataItem)) {
          const count = await this.processWorkbenchChatData({ ...item, data: { entries: [dataItem] } }, projects, chats);
          processedCount += count;
        }
      }
    } else {
      // Single object
      if (this.looksLikeAiServicePrompt(data)) {
        const count = await this.processAiServicePrompts({ ...item, data: [data] }, projects, chats);
        processedCount += count;
      } else if (this.looksLikeWorkbenchChat(data)) {
        const count = await this.processWorkbenchChatData({ ...item, data: { entries: [data] } }, projects, chats);
        processedCount += count;
      } else if (data.conversations && Array.isArray(data.conversations)) {
        // Handle conversations array
        const count = await this.processAiServicePrompts({ ...item, data: data.conversations }, projects, chats);
        processedCount += count;
      } else if (data.entries && Array.isArray(data.entries)) {
        // Handle entries array
        const count = await this.processWorkbenchChatData(item, projects, chats);
        processedCount += count;
      }
    }
    
    return processedCount;
  }

  // ②  ───────────────────────────────────
  // Update looksLikeAiServicePrompt()
  private looksLikeAiServicePrompt(data: any): boolean {
    if (!data || typeof data !== 'object') return false;

    // NEW: Check for nested chatData structure (rich chat data)
    if (data.chatData && typeof data.chatData === 'object' && 
        (Array.isArray(data.chatData.messages) || Array.isArray(data.chatData.chunks))) {
      return true;
    }

    // NEW: accept Cursor's numeric-key objects immediately
    if (this.isNumericKeyObject(data)) return true;

    // ── 1️⃣ accept single prompt objects ────────────────
    if (this.isSinglePrompt(data)) return true;

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
    const chatish = (
          Array.isArray(data.messages)  ||
          Array.isArray(data.chunks)    ||
          Array.isArray(data.parts)     ||
          Array.isArray(data.conversations) ||
          Array.isArray(data.entries)   ||
          this.isNumericKeyObject(data)      // <-- here too
        )
        && jsonLen > 120;   // was 500

    if (!chatish) return false;
    return true;
  }
  // ②  ───────────────────────────────────

  private looksLikeWorkbenchChat(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Must have entries array
    if (!data.entries || !Array.isArray(data.entries)) {
      return false;
    }

    // Entries must contain actual chat conversations
    const hasValidEntries = data.entries.some((entry: any) => {
      if (!entry || typeof entry !== 'object') return false;
      
      // Must have conversation array with messages
      if (!entry.conversation || !Array.isArray(entry.conversation)) return false;
      
      // Conversation must have valid messages
      return entry.conversation.some((msg: any) =>
        msg && typeof msg === 'object' &&
        typeof msg.message === 'string' &&
        msg.message.trim().length > 0 &&
        (msg.sender === 'user' || msg.sender === 'assistant' || msg.sender === 'system')
      );
    });

    if (!hasValidEntries) {
      dbg(`Rejecting workbench data - no valid conversations in entries`);
      return false;
    }

    return true;
  }

  private async processAiServicePrompts(
    item: Record<string, any>,
    projects: Map<string, ProjectImpl>,
    chats: Chat[]
  ): Promise<number> {
    // ③  ───────────────────────────────────
    // Top of processAiServicePrompts(): replace first 25 lines up to promptsToProcess declaration
    const data = item.data;
    let promptsToProcess: any[] = [];

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
        promptsToProcess = [data];  // Pass the whole object with chatData
      } else if (Array.isArray(data.entries)) {
        // Convert each entry to a flat "messages" object
        promptsToProcess = data.entries
          .filter((e: any) => Array.isArray(e.conversation) || Array.isArray(e.messages))
          .map((e: any) => ({ messages: e.conversation ?? e.messages }));
      } else if (Array.isArray(data.conversations)) {
        promptsToProcess = data.conversations;
      } else if (Array.isArray(data.messages)) {
        promptsToProcess = [data];   // treat as single chat
      } else {
        promptsToProcess = [data];
      }
    }

    // ── DEBUG start ──
    if (Array.isArray(promptsToProcess) && promptsToProcess.length > 0) {
      const sample = promptsToProcess[0];
      dbg('first inner value type:', typeof sample);
      if (typeof sample === 'string') {
        dbg('string length:', sample.length, 'first 200 chars:', sample.slice(0,200));
      } else {
        dbg('keys:', Object.keys(sample));
        dbg('snippet:', JSON.stringify(sample).slice(0,300));
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
            logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Extracted workspace name from UI state: "${extractedWorkspaceName}"`);
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
            logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Skipping item - no chat data found. Keys: ${prompt && typeof prompt === 'object' ? Object.keys(prompt).join(',') : typeof prompt}`);
          }
          continue;
        }

        // Add null check and debugging
        if (!actualChatData || typeof actualChatData !== 'object') {
          logger.warn(LOG_COMPONENTS.CHAT_PROCESSOR, `Skipping invalid chat data: ${typeof actualChatData}`);
          continue;
        }



        // Task 4: Improve project naming - prioritize workspaceName from rich chat data
        const folderPath = item.folderName ?? item.databasePath ?? '';
        const folderName = require('path').basename(folderPath);
        
        // Try to extract workspace name from parent directory if folder is a hash
        let betterFolderName = folderName;
        if (folderName.match(/^[a-f0-9]{32}$/)) {
          // Get parent directory name as it might be the actual project name
          const parentDir = require('path').dirname(folderPath);
          const parentName = require('path').basename(parentDir);
          // Use parent name if it's not also a hash and not a system directory
          if (parentName && !parentName.match(/^[a-f0-9]{32}$/) && 
              !['Cursor', 'User', 'Code', 'AppData', 'Application Support'].includes(parentName)) {
            betterFolderName = parentName;
          } else {
            betterFolderName = `Workspace ${folderName.slice(0,8)}`;
          }
        }
        
        const baseProjectName =
              actualChatData.workspaceName
           || item.workspaceRealName
           || betterFolderName
           || extractedWorkspaceName
           || item.workspace
           || 'Unknown Project';

        let finalProjectName = baseProjectName;

        const finalProjectId = `original-${finalProjectName.replace(/\s+/g, '-').toLowerCase()}`;
        


        // Ensure project exists
        if (!projects.has(finalProjectId)) {
          const newProject = new ProjectImpl(
            finalProjectId,
            finalProjectName,
            `Original project from Cursor: ${finalProjectName}`,
            new Date(),
            false, // Not a custom project
            [],
            []
          );
          projects.set(finalProjectId, newProject);
          logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, `Created new project: "${finalProjectName}" (ID: ${finalProjectId})`);
        } else {
          logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Using existing project: "${finalProjectName}" (ID: ${finalProjectId})`);
        }
        
        // Create chat with better null checking
        const chatId = (actualChatData && actualChatData.id) || uuidv4();
        const chatTitle = (actualChatData && actualChatData.title) || `Chat from ${new Date((actualChatData && actualChatData.createdAt) || Date.now()).toLocaleString()}`;
        const timestamp = new Date((actualChatData && actualChatData.createdAt) || Date.now());

        const chat = new ChatImpl(
          chatId,
          chatTitle,
          timestamp,
          finalProjectId, // Use the final project ID
          [],
          []
        );

        // Restore tags for this chat from TagManager
        const existingChatTags = this.tagManager.getChatTags(chatId);
        if (existingChatTags && existingChatTags.length > 0) {
          existingChatTags.forEach(tag => chat.addTag(tag));
          logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Restored ${existingChatTags.length} tags for chat "${chatTitle}"`);
        }

        // Process dialogues with enhanced handling
        this.processMessagesFromChatData(actualChatData, chat);
        
        // Only add chat if it has dialogues or meaningful content
        if (chat.dialogues.length > 0) {
          // Add chat to list and to project
          chats.push(chat);
          const project = projects.get(finalProjectId); // Use final project ID
          if (project) {
            project.addChat(chat);
            logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, `Added chat "${chatTitle}" to project "${project.name}" (now has ${project.chats.length} chats)`);
          } else {
            logger.error(LOG_COMPONENTS.CHAT_PROCESSOR, `Failed to find project ${finalProjectId} when adding chat ${chatTitle}`);
          }
          processedCount++;
          logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, `Successfully processed chat "${chatTitle}" with ${chat.dialogues.length} dialogues`);
        } else {
          logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Skipping empty chat "${chatTitle}"`);
        }
      } catch (error) {
        logger.error(LOG_COMPONENTS.CHAT_PROCESSOR, 'Error processing prompt data', error);
      }
    }
    
    return processedCount;
  }

  /**
   * Task 2: Extract message array from various chat data structures
   */
  private extractAnyMessageArray(chatData: any): any[] {
    if (!chatData || typeof chatData !== 'object') {
      return [];
    }

    /*  -------- NEW --------  */
    if (
      chatData.chatData?.messages &&
      Array.isArray(chatData.chatData.messages)
    ) {
      logger.debug(
        LOG_COMPONENTS.CHAT_PROCESSOR,
        `Found ${chatData.chatData.messages.length} rich messages`
      );
      return chatData.chatData.messages;          // ← the assistant lives here
    }
    /*  ---------------------  */

    // Try standard formats first
    if (chatData.messages && Array.isArray(chatData.messages)) {
      logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Found ${chatData.messages.length} messages in 'messages' array`);
      return chatData.messages;
    }

    // Cursor often uses 'chunks' instead of 'messages'
    if (chatData.chunks && Array.isArray(chatData.chunks)) {
      logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Found ${chatData.chunks.length} messages in 'chunks' array`);
      return chatData.chunks;
    }

    // Or 'parts'
    if (chatData.parts && Array.isArray(chatData.parts)) {
      logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Found ${chatData.parts.length} messages in 'parts' array`);
      return chatData.parts;
    }

    // Or nested in conversation
    if (chatData.conversation && Array.isArray(chatData.conversation)) {
      logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Found ${chatData.conversation.length} messages in 'conversation' array`);
      return chatData.conversation;
    }

    // Or in entries
    if (chatData.entries && Array.isArray(chatData.entries)) {
      const messages: any[] = [];
      for (const entry of chatData.entries) {
        if (entry.conversation && Array.isArray(entry.conversation)) {
          messages.push(...entry.conversation);
        } else if (entry.messages && Array.isArray(entry.messages)) {
          messages.push(...entry.messages);
        }
      }
      logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Extracted ${messages.length} messages from entries`);
      return messages;
    }

    // Single message format
    if (chatData.role && (chatData.content || chatData.text || chatData.message)) {
      logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, 'Processing single message format');
      return [chatData];
    }

    return [];
  }

  /**
   * Check if data looks like direct chat conversation data
   */
  private looksLikeDirectChatData(data: any): boolean {
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
  private extractNestedChatData(data: any): any | null {
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
        const hasValidMessages = data[field].some((item: any) =>
          item && typeof item === 'object' &&
          ((item.role && item.content) ||
           (item.sender && item.message) ||
           (item.messages && Array.isArray(item.messages)))
        );
        
        if (hasValidMessages) {
          // entries[] contains its own conversation array
          if (field === 'entries') {
            const flattened: any[] = [];
            for (const e of data.entries) {
              if (Array.isArray(e.conversation)) flattened.push(...e.conversation);
              if (Array.isArray(e.messages)) flattened.push(...e.messages);
            }
            if (flattened.length) return { messages: flattened };
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
  private processMessagesFromChatData(chatData: any, chat: ChatImpl): number {
    let messagesProcessed = 0;

    // Handle nested chatData structure (rich chat data)
    if (chatData.chatData && typeof chatData.chatData === 'object') {
      logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, 'Detected nested chatData structure, extracting inner data');
      return this.processMessagesFromChatData(chatData.chatData, chat);
    }

    // ── 3️⃣ Handle single prompt text at the very top ───────
    if (chatData.text && typeof chatData.text === 'string') {
      const messages = [{ role: 'user', content: chatData.text,
                    timestamp: chatData.createdAt ?? Date.now() }];

      // Process the single message
      for (const message of messages) {
        const dialogue = new DialogueImpl(
          uuidv4(),            // dialogue id
          chat.id,             // parent chat id
          message.content,     // dialogue content
          message.role === 'user', // isUser flag
          new Date(message.timestamp)
        );
        this.restoreDialogueTags(dialogue);
        chat.addDialogue(dialogue);
        messagesProcessed++;
      }

      logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Processed single prompt text into ${messagesProcessed} dialogue(s)`);
      return messagesProcessed;
    }

    // Task 2: Extract message array using helper method
    const messages = this.extractAnyMessageArray(chatData);
    if (messages.length === 0) {
      logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, 'No messages found in chat data');
      return 0;
    }

    logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Found ${messages.length} messages to process`);

    // Helper function to extract text from parts array
    const textFromParts = (parts: any): string =>
      Array.isArray(parts)
        ? parts
            .map(p =>
              typeof p === 'string'
                ? p
                : (typeof p?.text === 'string' ? p.text : '')
            )
            .join('')
        : typeof parts === 'string'
            ? parts
            : '';

    // Task 1: Create message flattening function that handles both rich and fallback formats
    const flatten = (msg: any) => {
      /* ==== rich Cursor format ==== */
      if (msg.authorKind !== undefined) {
        const role =
          msg.authorKind === 1 ? 'user'
          : msg.authorKind === 2 ? 'assistant'
          :                       'system';       // authorKind 3

        return {
          role,
          content : textFromParts(msg.parts ?? msg.content?.parts),
          ts      : (msg.createTime ?? msg.timestamp ?? Date.now()) * 1000
        };
      }

      /* ==== fallback / legacy ==== */
      const role = msg.role || msg.sender || (msg.isUser ? 'user' : 'assistant');
      const content = msg.content ?? msg.text ?? msg.message ?? '';
      const ts = msg.timestamp ?? msg.createdAt ?? Date.now();
      return { role, content, ts };
    };

    // Debug logging to check message structure
    logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, 'Sample messages structure:', 
      messages.slice(0, 3).map(m => ({
        role: m.role ?? m.authorKind,
        preview: JSON.stringify(m).slice(0, 80)
      }))
    );

    // Quick sanity check
    logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, 'Message sanity check:', messages.slice(0,3).map(m => ({
      r: m.role ?? m.authorKind,
      t: textFromParts(m.parts ?? m.content?.parts ?? m.text).slice(0,40)
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
        const dialogue = new DialogueImpl(
          uuidv4(),            // dialogue id
          chat.id,             // parent chat id
          normalized.content.toString(),  // dialogue content
          normalized.role === 'user',     // isUser flag
          new Date(normalized.ts)
        );

        this.restoreDialogueTags(dialogue);
        chat.addDialogue(dialogue);
        messagesProcessed++;

      } catch (error) {
        logger.error(LOG_COMPONENTS.CHAT_PROCESSOR, 'Error processing message', error);
      }
    }

    logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Processed ${messagesProcessed} messages into dialogues`);
    return messagesProcessed;
  }

  private async processWorkbenchChatData(
    item: Record<string, any>,
    projects: Map<string, ProjectImpl>,
    chats: Chat[]
  ): Promise<number> {
    const data = item.data;
    if (!data || !data.entries || !Array.isArray(data.entries)) {
      return 0;
    }

    let processedCount = 0;

    // Extract project name from workspace with improved logic (same as processAiServicePrompts)
    const baseProjectName = item.workspaceRealName || item.workspace || 'Unknown Project';
    
    // Add detailed debugging for project naming
    logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, '*** WORKBENCH PROJECT NAMING DEBUG ***');
    logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `  - item.workspace: ${item.workspace}`);
    logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `  - item.source: ${item.source}`);
    logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `  - Computed baseProjectName: "${baseProjectName}"`);
    
    // Try to extract better project name from available data
    let improvedProjectName = baseProjectName;
    
    // Check item-level data for project hints
    if (item.data && typeof item.data === 'object') {
      const itemKeys = Object.keys(item.data);
      logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `  - Item data keys: ${itemKeys.join(', ')}`);
      
      // Look for workspace or project-related fields in the raw data
      const projectFields = ['workspaceName', 'projectName', 'folderName', 'name'];
      for (const field of projectFields) {
        if (item.data[field] && typeof item.data[field] === 'string') {
          logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `  - Found item.data.${field}: ${item.data[field]}`);
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
    
    logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `  - FINAL projectName: "${finalProjectName}"`);
    logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `  - FINAL projectId: "${finalProjectId}"`);
    logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, '*** END WORKBENCH PROJECT NAMING DEBUG ***');
    
    // Ensure project exists
    if (!projects.has(finalProjectId)) {
      const newProject = new ProjectImpl(
        finalProjectId,
        finalProjectName,
        `Original project from Cursor: ${finalProjectName}`,
        new Date(),
        false, // Not a custom project
        [],
        []
      );
      projects.set(finalProjectId, newProject);
      logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, `Created new workbench project: "${finalProjectName}" (ID: ${finalProjectId})`);
    } else {
      logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Using existing workbench project: "${finalProjectName}" (ID: ${finalProjectId})`);
    }
    
    for (const entry of data.entries) {
      try {
        // Create chat
        const chatId = entry.id || uuidv4();
        const chatTitle = entry.title || `Chat from ${new Date(entry.timestamp || Date.now()).toLocaleString()}`;
        const timestamp = new Date(entry.timestamp || Date.now());
        
        const chat = new ChatImpl(
          chatId,
          chatTitle,
          timestamp,
          finalProjectId, // Use final project ID
          [],
          []
        );
        
        // Process dialogues
        if (Array.isArray(entry.conversation)) {
          logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Processing ${entry.conversation.length} workbench messages for chat "${chatTitle}"`);
          
          for (const message of entry.conversation) {
            const dialogueId = message.id || uuidv4();
            const isUser = message.sender === 'user';
            const dialogueTimestamp = new Date(message.timestamp || chat.timestamp);
            
            const dialogue = new DialogueImpl(
              dialogueId,
              chat.id,
              message.message || '',
              isUser,
              dialogueTimestamp,
              []
            );
            
            this.restoreDialogueTags(dialogue);
            chat.addDialogue(dialogue);
          }
        }
        
        // Add chat to list and to project
        if (chat.dialogues.length > 0) {
          chats.push(chat);
          const project = projects.get(finalProjectId); // Use final project ID
          if (project) {
            project.addChat(chat);
            logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, `Added workbench chat "${chatTitle}" to project "${project.name}" (now has ${project.chats.length} chats)`);
          } else {
            logger.error(LOG_COMPONENTS.CHAT_PROCESSOR, `Failed to find workbench project ${finalProjectId} when adding chat ${chatTitle}`);
          }
          processedCount++;
          logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, `Successfully processed workbench chat "${chatTitle}" with ${chat.dialogues.length} dialogues`);
        } else {
          logger.debug(LOG_COMPONENTS.CHAT_PROCESSOR, `Skipping empty workbench chat "${chatTitle}"`);
        }
      } catch (error) {
        logger.error(LOG_COMPONENTS.CHAT_PROCESSOR, 'Error processing workbench chat entry', error);
      }
    }
    
    return processedCount;
  }

  public async saveProcessedData(
    projects: Project[],
    chats: Chat[]
  ): Promise<boolean> {
    try {
      // Save projects
      await this.storageManager.saveData('projects', projects.map(p => 
        p instanceof ProjectImpl ? p.serialize() : p
      ));
      
      // Save chats
      await this.storageManager.saveData('chats', chats.map(c => 
        c instanceof ChatImpl ? c.serialize() : c
      ));
      
      return true;
    } catch (error) {
      logger.error(LOG_COMPONENTS.CHAT_PROCESSOR, 'Error saving processed data', error);
      return false;
    }
  }

  public async loadProcessedData(): Promise<{
    projects: Project[];
    chats: Chat[];
  }> {
    try {
      // Load projects
      const projectsData = await this.storageManager.getData<any[]>('projects', []);
      const projects: Project[] = (projectsData || []).map((p: any) => ProjectImpl.deserialize(p));

      // Load chats
      const chatsData = await this.storageManager.getData<any[]>('chats', []);
      const chats: Chat[] = (chatsData || []).map((c: any) => ChatImpl.deserialize(c));

      return { projects, chats };
    } catch (error) {
      logger.error(LOG_COMPONENTS.CHAT_PROCESSOR, 'Error loading processed data', error);
      return { projects: [], chats: [] };
    }
  }

  /**
   * Clear all cached and stored data to force fresh processing
   */
  public async clearAllCachedData(): Promise<void> {
    logger.info(LOG_COMPONENTS.CHAT_PROCESSOR, 'Clearing all cached and stored data');

    // Clear storage
    await this.storageManager.removeData('projects');
    await this.storageManager.removeData('chats');

    // Clear CursorDataProvider cache
    this.cursorDataProvider.clearCache();
  }

  /**
   * Public method to expose validation logic for debugging
   */
  public testValidation(data: any): boolean {
    return this.looksLikeAiServicePrompt(data);
  }

  /**
   * Public method to get detailed validation information
   */
  public getValidationDetails(data: any): Record<string, any> {
    if (!data || typeof data !== 'object') {
      return { valid: false, reason: 'Data is not an object' };
    }

    const details: Record<string, any> = {
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
        } else {
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
      } else {
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

    const systemKeys = keys.filter(key => 
      systemConfigPatterns.some(pattern => pattern.test(key))
    );

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