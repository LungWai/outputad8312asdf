"use strict";
/**
 * TypeScript interfaces for Cursor chat data types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPrompt = isPrompt;
exports.isNumericKeyObject = isNumericKeyObject;
exports.isChatData = isChatData;
function isPrompt(obj) {
    return obj && typeof obj === 'object' && typeof obj.text === 'string' && obj.text.trim().length > 0;
}
function isNumericKeyObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj))
        return false;
    const keys = Object.keys(obj);
    return keys.length > 0 && keys.every(k => /^\d+$/.test(k));
}
function isChatData(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    // Check for nested chatData structure (rich chat data)
    if (obj.chatData && typeof obj.chatData === 'object') {
        return isChatData(obj.chatData);
    }
    return (Array.isArray(obj.messages) ||
        Array.isArray(obj.chunks) ||
        Array.isArray(obj.parts) ||
        Array.isArray(obj.conversation) ||
        Array.isArray(obj.entries) ||
        Array.isArray(obj.conversations));
}
//# sourceMappingURL=cursor.js.map