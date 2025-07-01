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
exports.MockTreeDataProvider = exports.MockExtensionContext = exports.MockMemento = void 0;
exports.createTempSqliteDb = createTempSqliteDb;
exports.mockFileSystem = mockFileSystem;
exports.restoreFileSystem = restoreFileSystem;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
// VS Code API mocks
class MockMemento {
    constructor() {
        this.storage = {};
    }
    get(key, defaultValue) {
        if (this.storage[key] === undefined && defaultValue !== undefined) {
            return defaultValue;
        }
        return this.storage[key];
    }
    update(key, value) {
        this.storage[key] = value;
        return Promise.resolve();
    }
    keys() {
        return Object.keys(this.storage);
    }
}
exports.MockMemento = MockMemento;
class MockExtensionContext {
    constructor() {
        this.subscriptions = [];
        this.workspaceState = new MockMemento();
        this.globalMemento = new MockMemento();
        this.globalState = {
            keys: () => this.globalMemento.keys(),
            get: (key, defaultValue) => {
                const value = this.globalMemento.get(key, defaultValue);
                return value;
            },
            update: (key, value) => {
                return this.globalMemento.update(key, value);
            },
            setKeysForSync(keys) { }
        };
        this.extensionPath = '';
    }
    asAbsolutePath(relativePath) {
        return path.join(this.extensionPath, relativePath);
    }
}
exports.MockExtensionContext = MockExtensionContext;
// Create a temp SQLite database for testing
function createTempSqliteDb(data = {}) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-chat-test-'));
    const dbPath = path.join(tempDir, 'test.db');
    // Here you would initialize the DB with test data
    // This is a placeholder - actual implementation would depend on your schema
    return dbPath;
}
// Mock VS Code commands and UI
class MockTreeDataProvider {
    constructor(initialData = []) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.data = [];
        this.data = initialData;
    }
    getTreeItem(element) {
        return new vscode.TreeItem(String(element));
    }
    getChildren(element) {
        if (element) {
            return [];
        }
        return this.data;
    }
    setData(newData) {
        this.data = newData;
        this._onDidChangeTreeData.fire();
    }
}
exports.MockTreeDataProvider = MockTreeDataProvider;
// Mock file system operations (using Sinon instead of Jest)
let mockFileContents = {};
function mockFileSystem(fileContents) {
    mockFileContents = { ...fileContents };
}
// Restore mocked file system
function restoreFileSystem() {
    mockFileContents = {};
}
// Sample chat data removed - no mock data allowed
//# sourceMappingURL=testHelper.js.map