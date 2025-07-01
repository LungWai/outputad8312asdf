"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatImpl = void 0;
const dialogue_1 = require("./dialogue");
class ChatImpl {
    constructor(id, title, timestamp, projectId, dialogues = [], tags = [], metadata) {
        this.id = id;
        this.title = title;
        this.timestamp = timestamp;
        this.projectId = projectId;
        this.dialogues = dialogues;
        this.tags = tags;
        this.metadata = metadata;
    }
    addDialogue(dialogue) {
        dialogue.chatId = this.id;
        this.dialogues.push(dialogue);
    }
    removeDialogue(dialogueId) {
        const initialLength = this.dialogues.length;
        this.dialogues = this.dialogues.filter(d => d.id !== dialogueId);
        return this.dialogues.length !== initialLength;
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
    serialize() {
        return {
            id: this.id,
            title: this.title,
            timestamp: this.timestamp.toISOString(),
            projectId: this.projectId,
            dialogues: this.dialogues.map(d => d instanceof dialogue_1.DialogueImpl ? d.serialize() : d),
            tags: this.tags,
            metadata: this.metadata
        };
    }
    static deserialize(data) {
        return new ChatImpl(data.id, data.title, new Date(data.timestamp), data.projectId, Array.isArray(data.dialogues) ? data.dialogues : [], Array.isArray(data.tags) ? data.tags : [], data.metadata);
    }
}
exports.ChatImpl = ChatImpl;
//# sourceMappingURL=chat.js.map