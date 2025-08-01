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
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const test_electron_1 = require("@vscode/test-electron");
async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        // The path to the extension test runner script
        const extensionTestsPath = path.resolve(__dirname, './suite/index');
        // Create a temporary workspace for testing
        const tempWorkspace = path.join(os.tmpdir(), 'cursor-chat-test-workspace');
        if (!fs.existsSync(tempWorkspace)) {
            fs.mkdirSync(tempWorkspace, { recursive: true });
        }
        // Create a simple test file in the workspace
        const testFile = path.join(tempWorkspace, 'test.txt');
        if (!fs.existsSync(testFile)) {
            fs.writeFileSync(testFile, 'Test workspace file');
        }
        // Download VS Code, unzip it and run the integration test
        await (0, test_electron_1.runTests)({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                '--disable-extensions',
                '--disable-workspace-trust',
                '--no-sandbox',
                '--disable-updates',
                '--skip-welcome',
                '--skip-release-notes',
                tempWorkspace
            ],
            version: 'stable'
        });
    }
    catch (err) {
        console.error('Failed to run tests', err);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=runTest.js.map