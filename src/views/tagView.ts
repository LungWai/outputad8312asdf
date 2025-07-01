import * as vscode from 'vscode';
import { TagManager } from '../services/tagManager';

export class TagTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly id: string,
    public readonly count?: number,
    public readonly iconPath?: string | vscode.ThemeIcon,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.id = id;
    this.contextValue = contextValue;
    this.iconPath = iconPath;
    this.command = command;
    this.tooltip = label;
    
    if (count !== undefined) {
      this.description = `(${count})`;
    }
  }
}

export class TagView implements vscode.TreeDataProvider<TagTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TagTreeItem | undefined | null | void> = new vscode.EventEmitter<TagTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TagTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  private tagManager: TagManager;

  constructor(private context: vscode.ExtensionContext) {
    this.tagManager = TagManager.getInstance();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TagTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TagTreeItem): Promise<TagTreeItem[]> {
    // Root level - show "Chat Tags" and "Dialogue Tags" categories
    if (!element) {
      return [
        new TagTreeItem(
          'Chat Tags',
          vscode.TreeItemCollapsibleState.Expanded,
          'category',
          'chat-tags',
          undefined,
          new vscode.ThemeIcon('symbol-property')
        ),
        new TagTreeItem(
          'Dialogue Tags',
          vscode.TreeItemCollapsibleState.Expanded,
          'category',
          'dialogue-tags',
          undefined,
          new vscode.ThemeIcon('symbol-field')
        )
      ];
    }

    // Category level - show tags by category
    if (element.contextValue === 'category') {
      if (element.id === 'chat-tags') {
        // TODO: Implement this when TagManager is ready
        return [];
      } else if (element.id === 'dialogue-tags') {
        // TODO: Implement this when TagManager is ready
        return [];
      }
    }

    return [];
  }
} 