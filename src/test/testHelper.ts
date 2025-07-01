import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// VS Code API mocks
export class MockMemento implements vscode.Memento {
  private storage: Record<string, any> = {};

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get(key: string, defaultValue?: any): any {
    if (this.storage[key] === undefined && defaultValue !== undefined) {
      return defaultValue;
    }
    return this.storage[key];
  }

  update(key: string, value: any): Thenable<void> {
    this.storage[key] = value;
    return Promise.resolve();
  }

  keys(): readonly string[] {
    return Object.keys(this.storage);
  }
}

export class MockExtensionContext implements Partial<vscode.ExtensionContext> {
  public subscriptions: { dispose(): any }[] = [];
  public workspaceState: vscode.Memento = new MockMemento();
  private globalMemento = new MockMemento();
  public globalState: vscode.Memento & { setKeysForSync(keys: readonly string[]): void } = {
    keys: (): readonly string[] => this.globalMemento.keys(),
    get: <T>(key: string, defaultValue?: T): T => {
      const value = this.globalMemento.get(key, defaultValue);
      return value as T;
    },
    update: (key: string, value: any): Thenable<void> => {
      return this.globalMemento.update(key, value);
    },
    setKeysForSync(keys: readonly string[]): void {}
  };
  public extensionPath: string = '';
  public asAbsolutePath(relativePath: string): string {
    return path.join(this.extensionPath, relativePath);
  }
}

// Create a temp SQLite database for testing
export function createTempSqliteDb(data: any = {}): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-chat-test-'));
  const dbPath = path.join(tempDir, 'test.db');
  
  // Here you would initialize the DB with test data
  // This is a placeholder - actual implementation would depend on your schema
  
  return dbPath;
}

// Mock VS Code commands and UI
export class MockTreeDataProvider<T> implements vscode.TreeDataProvider<T> {
  private _onDidChangeTreeData: vscode.EventEmitter<T | undefined | null | void> = new vscode.EventEmitter<T | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<T | undefined | null | void> = this._onDidChangeTreeData.event;
  
  private data: T[] = [];
  
  constructor(initialData: T[] = []) {
    this.data = initialData;
  }
  
  getTreeItem(element: T): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return new vscode.TreeItem(String(element));
  }
  
  getChildren(element?: T): vscode.ProviderResult<T[]> {
    if (element) {
      return [];
    }
    return this.data;
  }
  
  setData(newData: T[]): void {
    this.data = newData;
    this._onDidChangeTreeData.fire();
  }
}

// Mock file system operations (using Sinon instead of Jest)
let mockFileContents: Record<string, string> = {};

export function mockFileSystem(fileContents: Record<string, string>): void {
  mockFileContents = { ...fileContents };
}

// Restore mocked file system
export function restoreFileSystem(): void {
  mockFileContents = {};
}

// Sample chat data removed - no mock data allowed