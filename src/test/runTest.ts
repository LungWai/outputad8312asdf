import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { runTests } from '@vscode/test-electron';

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
    await runTests({
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
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

main();