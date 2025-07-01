"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectImpl = void 0;
const chat_1 = require("./chat");
class ProjectImpl {
    constructor(id, name, description, created, isCustom, chats = [], tags = [], metadata) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.created = created;
        this.isCustom = isCustom;
        this.chats = chats;
        this.tags = tags;
        this.metadata = metadata;
    }
    addChat(chat) {
        chat.projectId = this.id;
        if (!this.chats.some(c => c.id === chat.id)) {
            this.chats.push(chat);
        }
    }
    removeChat(chatId) {
        const initialLength = this.chats.length;
        this.chats = this.chats.filter(c => c.id !== chatId);
        return this.chats.length !== initialLength;
    }
    updateMetadata(metadata) {
        this.metadata = { ...this.metadata, ...metadata };
    }
    serialize() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            created: this.created.toISOString(),
            isCustom: this.isCustom,
            chats: this.chats.map(c => c instanceof chat_1.ChatImpl ? c.serialize() : c),
            tags: this.tags,
            metadata: this.metadata
        };
    }
    static deserialize(data) {
        return new ProjectImpl(data.id, data.name, data.description, new Date(data.created), data.isCustom, Array.isArray(data.chats) ? data.chats : [], Array.isArray(data.tags) ? data.tags : [], data.metadata);
    }
}
exports.ProjectImpl = ProjectImpl;
//# sourceMappingURL=project.js.map