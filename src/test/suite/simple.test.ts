import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, before } from 'mocha';

suite('Extension Test Suite', () => {
  before(async function() {
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
      if (extension) break;
    }

    // If not found by ID, check all extensions
    if (!extension) {
      const allExtensions = vscode.extensions.all;
      extension = allExtensions.find(ext =>
        ext.packageJSON?.name === 'cursor-chat-manager' ||
        ext.packageJSON?.displayName === 'Cursor Chat Manager'
      );
    }

    if (extension && !extension.isActive) {
      await extension.activate();
    }
  });

  test('Basic test', () => {
    assert.strictEqual(1 + 1, 2, 'Basic math should work');
  });

  test('String test', () => {
    assert.strictEqual('hello'.toUpperCase(), 'HELLO', 'String methods should work');
  });

  test('Array test', () => {
    const arr = [1, 2, 3];
    assert.strictEqual(arr.length, 3, 'Array length should be correct');
    assert.ok(arr.includes(2), 'Array should contain expected element');
  });

  test('VS Code API available', () => {
    assert.ok(vscode, 'VS Code API should be available');
    assert.ok(vscode.window, 'VS Code window API should be available');
    assert.ok(vscode.commands, 'VS Code commands API should be available');
  });

  test('Extension is present', () => {
    // Try different possible extension IDs
    const possibleIds = [
      'cursor-chat-manager-dev.cursor-chat-manager',
      'cursor-chat-manager',
      'undefined_publisher.cursor-chat-manager'
    ];

    let extension = null;
    for (const id of possibleIds) {
      extension = vscode.extensions.getExtension(id);
      if (extension) break;
    }

    // If not found by ID, check all extensions for our extension
    if (!extension) {
      const allExtensions = vscode.extensions.all;
      extension = allExtensions.find(ext =>
        ext.packageJSON?.name === 'cursor-chat-manager' ||
        ext.packageJSON?.displayName === 'Cursor Chat Manager'
      );
    }

    assert.ok(extension, 'Extension should be found');
  });
});
