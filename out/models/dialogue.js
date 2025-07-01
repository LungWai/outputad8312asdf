"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialogueImpl = void 0;
const chat_1 = require("./chat");
const uuid_1 = require("uuid");
class DialogueImpl {
    constructor(id, chatId, content, isUser, timestamp, tags = [], metadata) {
        this.id = id;
        this.chatId = chatId;
        this.content = content;
        this.isUser = isUser;
        this.timestamp = timestamp;
        this.tags = tags;
        this.metadata = metadata;
    }
    addTag(tag) {
        if (!this.tags.includes(tag)) {
            this.tags.push(tag);
        }
    }
    removeTag(tag) {
        const initialLength = this.tags.length;
        this.tags = this.tags.filter(t => t !== tag);
        return this.tags.length !== initialLength;
    }
    extractToNewChat(title) {
        // Create a new chat from this dialogue
        return new chat_1.ChatImpl((0, uuid_1.v4)(), title || `Extracted from ${this.chatId} - ${new Date().toLocaleString()}`, new Date(), '', // ProjectId will be set when adding to a project
        [this], // Add this dialogue to the new chat
        [], // No tags initially
        { extractedFrom: this.chatId, extractedDialogue: this.id });
    }
    serialize() {
        return {
            id: this.id,
            chatId: this.chatId,
            content: this.content,
            isUser: this.isUser,
            timestamp: this.timestamp.toISOString(),
            tags: this.tags,
            metadata: this.metadata
        };
    }
    static deserialize(data) {
        return new DialogueImpl(data.id, data.chatId, data.content, data.isUser, new Date(data.timestamp), Array.isArray(data.tags) ? data.tags : [], data.metadata);
    }
}
exports.DialogueImpl = DialogueImpl;
//# sourceMappingURL=dialogue.js.map