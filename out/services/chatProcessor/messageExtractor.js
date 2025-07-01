"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageExtractor = void 0;
const logger_1 = require("../../utils/logger");
/**
 * Handles message extraction from various chat data formats
 */
class MessageExtractor {
    /**
     * Extract messages from any supported format
     */
    static extractAnyMessageArray(data) {
        if (!data || typeof data !== 'object') {
            return [];
        }
        // Direct array
        if (Array.isArray(data)) {
            return data;
        }
        // Try various message field names
        const messageFields = ['messages', 'chunks', 'parts', 'conversation'];
        for (const field of messageFields) {
            if (Array.isArray(data[field])) {
                logger_1.logger.debug(this.COMPONENT, `Found messages in field: ${field}`, { count: data[field].length });
                return data[field];
            }
        }
        // Handle entries with nested conversations
        if (Array.isArray(data.entries)) {
            const allMessages = [];
            for (const entry of data.entries) {
                if (entry.conversation && Array.isArray(entry.conversation)) {
                    allMessages.push(...entry.conversation);
                }
                else if (entry.messages && Array.isArray(entry.messages)) {
                    allMessages.push(...entry.messages);
                }
            }
            if (allMessages.length > 0) {
                logger_1.logger.debug(this.COMPONENT, `Extracted messages from entries`, { count: allMessages.length });
                return allMessages;
            }
        }
        logger_1.logger.debug(this.COMPONENT, 'No messages found in data structure');
        return [];
    }
    /**
     * Normalize message format from various schemas
     */
    static normalizeMessage(message) {
        if (!message || typeof message !== 'object') {
            return null;
        }
        // Extract content
        let content = '';
        if (typeof message.content === 'string') {
            content = message.content;
        }
        else if (typeof message.message === 'string') {
            content = message.message;
        }
        else if (Array.isArray(message.parts)) {
            content = message.parts
                .filter((p) => typeof p === 'string')
                .join('\n');
        }
        else if (typeof message.text === 'string') {
            content = message.text;
        }
        if (!content || content.trim().length === 0) {
            return null;
        }
        // Extract role
        let role = 'user';
        if (message.role) {
            role = message.role;
        }
        else if (message.sender) {
            role = message.sender;
        }
        else if (typeof message.authorKind === 'number') {
            // Cursor's schema: 1=user, 2=assistant, 3=system
            role = message.authorKind === 1 ? 'user' :
                message.authorKind === 2 ? 'assistant' : 'system';
        }
        // Extract timestamp
        let timestamp = Date.now();
        if (message.timestamp) {
            timestamp = message.timestamp;
        }
        else if (message.createdAt) {
            timestamp = message.createdAt;
        }
        else if (message.createTime) {
            timestamp = message.createTime;
        }
        else if (message.ts) {
            timestamp = message.ts;
        }
        return { content, role, timestamp };
    }
    /**
     * Extract nested chat data from complex structures
     */
    static extractNestedChatData(data) {
        if (!data || typeof data !== 'object') {
            return null;
        }
        // Handle Cursor's nested structures
        if (data.chatData && typeof data.chatData === 'object') {
            logger_1.logger.debug(this.COMPONENT, 'Found nested chatData structure');
            return this.extractNestedChatData(data.chatData);
        }
        // Check for conversation or messages arrays
        if (data.conversation && Array.isArray(data.conversation)) {
            return { messages: data.conversation };
        }
        if (data.messages && Array.isArray(data.messages)) {
            return data;
        }
        // Handle entries array
        if (data.entries && Array.isArray(data.entries)) {
            const conversations = data.entries
                .filter((e) => e && (e.conversation || e.messages))
                .map((e) => e.conversation || e.messages)
                .flat();
            if (conversations.length > 0) {
                return { messages: conversations };
            }
        }
        // Check for deeply nested structures
        if (data.data && typeof data.data === 'object') {
            return this.extractNestedChatData(data.data);
        }
        return null;
    }
}
exports.MessageExtractor = MessageExtractor;
MessageExtractor.COMPONENT = 'MessageExtractor';
//# sourceMappingURL=messageExtractor.js.map