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
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const mocha_1 = require("mocha");
(0, mocha_1.suite)('Extension Test Suite', () => {
    (0, mocha_1.before)(async function () {
        // Increase timeout for extension activation
        this.timeout(30000);
        // Try to find and activate the extension
        const possibleIds = [
            'cursor-chat-manager-dev.cursor-chat-manager',
            'cursor-chat-manager',
            'undefined_publisher.cursor-chat-manager'
        ];
        let extension = null;
        for (const id of possibleIds) {
            extension = vscode.extensions.getExtension(id);
            if (extension)
                break;
        }
        // If not found by ID, check all extensions
        if (!extension) {
            const allExtensions = vscode.extensions.all;
            extension = allExtensions.find(ext => ext.packageJSON?.name === 'cursor-chat-manager' ||
                ext.packageJSON?.displayName === 'Cursor Chat Manager');
        }
        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });
    (0, mocha_1.test)('Basic test', () => {
        assert.strictEqual(1 + 1, 2, 'Basic math should work');
    });
    (0, mocha_1.test)('String test', () => {
        assert.strictEqual('hello'.toUpperCase(), 'HELLO', 'String methods should work');
    });
    (0, mocha_1.test)('Array test', () => {
        const arr = [1, 2, 3];
        assert.strictEqual(arr.length, 3, 'Array length should be correct');
        assert.ok(arr.includes(2), 'Array should contain expected element');
    });
    (0, mocha_1.test)('VS Code API available', () => {
        assert.ok(vscode, 'VS Code API should be available');
        assert.ok(vscode.window, 'VS Code window API should be available');
        assert.ok(vscode.commands, 'VS Code commands API should be available');
    });
    (0, mocha_1.test)('Extension is present', () => {
        // Try different possible extension IDs
        const possibleIds = [
            'cursor-chat-manager-dev.cursor-chat-manager',
            'cursor-chat-manager',
            'undefined_publisher.cursor-chat-manager'
        ];
        let extension = null;
        for (const id of possibleIds) {
            extension = vscode.extensions.getExtension(id);
            if (extension)
                break;
        }
        // If not found by ID, check all extensions for our extension
        if (!extension) {
            const allExtensions = vscode.extensions.all;
            extension = allExtensions.find(ext => ext.packageJSON?.name === 'cursor-chat-manager' ||
                ext.packageJSON?.displayName === 'Cursor Chat Manager');
        }
        assert.ok(extension, 'Extension should be found');
    });
});
//# sourceMappingURL=simple.test.js.map