import * as vscode from 'vscode';
import { Rule } from '../models/rule';
import { RuleManager } from '../services/ruleManager';
import { ProjectOrganizer } from '../services/projectOrganizer';

export class RuleTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly id: string,
    public readonly iconPath?: string | vscode.ThemeIcon,
    public readonly command?: vscode.Command,
    public readonly rule?: Rule,
    public readonly projectId?: string
  ) {
    super(label, collapsibleState);
    this.id = id;
    this.contextValue = contextValue;
    this.iconPath = iconPath;
    this.command = command;
    this.tooltip = label;
  }
}

export class RuleView implements vscode.TreeDataProvider<RuleTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<RuleTreeItem | undefined | null | void> = new vscode.EventEmitter<RuleTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<RuleTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
  private ruleManager: RuleManager;
  private projectOrganizer: ProjectOrganizer;

  constructor(private context: vscode.ExtensionContext) {
    this.ruleManager = RuleManager.getInstance();
    this.projectOrganizer = ProjectOrganizer.getInstance();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: RuleTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: RuleTreeItem): Promise<RuleTreeItem[]> {
    // Root level - show "Global Rules" and "Project Rules" categories
    if (!element) {
      return [
        new RuleTreeItem(
          'Global Rules',
          vscode.TreeItemCollapsibleState.Expanded,
          'category',
          'global-rules',
          new vscode.ThemeIcon('globe')
        ),
        new RuleTreeItem(
          'Project Rules',
          vscode.TreeItemCollapsibleState.Expanded,
          'category',
          'project-rules',
          new vscode.ThemeIcon('folder')
        )
      ];
    }

    // Category level - show rules by category
    if (element.contextValue === 'category') {
      if (element.id === 'global-rules') {
        // Get global rules
        const globalRules = await this.ruleManager.getGlobalRules();
        
        if (globalRules.length === 0) {
          return [
            new RuleTreeItem(
              'No global rules found',
              vscode.TreeItemCollapsibleState.None,
              'empty',
              'no-global-rules',
              new vscode.ThemeIcon('info')
            )
          ];
        }
        
        // Group global rules by tag
        const rulesByTag: Map<string, Rule[]> = new Map();
        rulesByTag.set('Uncategorized', []);
        
        for (const rule of globalRules) {
          if (rule.tags && rule.tags.length > 0) {
            for (const tag of rule.tags) {
              if (!rulesByTag.has(tag)) {
                rulesByTag.set(tag, []);
              }
              rulesByTag.get(tag)!.push(rule);
            }
          } else {
            rulesByTag.get('Uncategorized')!.push(rule);
          }
        }
        
        // Create tree items for tag groups
        const tagItems: RuleTreeItem[] = [];
        
        for (const [tag, rules] of rulesByTag.entries()) {
          if (rules.length === 0) {
            continue;
          }
          
          tagItems.push(
            new RuleTreeItem(
              tag,
              vscode.TreeItemCollapsibleState.Expanded,
              'tag-group',
              `tag-${tag}`,
              new vscode.ThemeIcon('tag'),
              undefined,
              undefined,
              undefined
            )
          );
        }
        
        return tagItems.sort((a, b) => a.label.localeCompare(b.label));
      } else if (element.id === 'project-rules') {
        // Get projects
        const projects = await this.projectOrganizer.getAllProjects();
        
        if (projects.length === 0) {
          return [
            new RuleTreeItem(
              'No projects found',
              vscode.TreeItemCollapsibleState.None,
              'empty',
              'no-projects',
              new vscode.ThemeIcon('info')
            )
          ];
        }
        
        // Create tree items for projects
        return projects.map(project => {
          return new RuleTreeItem(
            project.name,
            vscode.TreeItemCollapsibleState.Collapsed,
            'project',
            `project-${project.id}`,
            new vscode.ThemeIcon('folder'),
            undefined,
            undefined,
            project.id
          );
        });
      }
    }
    
    // Tag group level - show rules for a tag
    if (element.contextValue === 'tag-group') {
      const tag = element.label;
      const globalRules = await this.ruleManager.getGlobalRules();
      
      // Filter rules by tag
      let filteredRules: Rule[];
      if (tag === 'Uncategorized') {
        filteredRules = globalRules.filter(rule => !rule.tags || rule.tags.length === 0);
      } else {
        filteredRules = globalRules.filter(rule => rule.tags && rule.tags.includes(tag));
      }
      
      // Create tree items for rules
      return filteredRules.map(rule => {
        return new RuleTreeItem(
          rule.name,
          vscode.TreeItemCollapsibleState.None,
          'rule',
          rule.id,
          new vscode.ThemeIcon('file-code'),
          {
            command: 'cursor-chat-manager.viewRule',
            title: 'View Rule',
            arguments: [rule.id]
          },
          rule
        );
      });
    }
    
    // Project level - show rules for a project
    if (element.contextValue === 'project' && element.projectId) {
      const projectRules = await this.ruleManager.getProjectRules(element.projectId);
      
      if (projectRules.length === 0) {
        return [
          new RuleTreeItem(
            'No rules for this project',
            vscode.TreeItemCollapsibleState.None,
            'empty',
            `no-rules-${element.projectId}`,
            new vscode.ThemeIcon('info')
          )
        ];
      }
      
      // Create tree items for rules
      return projectRules.map(rule => {
        return new RuleTreeItem(
          rule.name,
          vscode.TreeItemCollapsibleState.None,
          'rule',
          rule.id,
          new vscode.ThemeIcon('file-code'),
          {
            command: 'cursor-chat-manager.viewRule',
            title: 'View Rule',
            arguments: [rule.id]
          },
          rule
        );
      });
    }

    return [];
  }
  
  /**
   * Create a WebviewPanel to view a rule
   */
  async viewRule(ruleId: string): Promise<void> {
    const rule = await this.ruleManager.getRuleById(ruleId);
    if (!rule) {
      vscode.window.showErrorMessage('Rule not found');
      return;
    }
    
    // Create a new webview panel
    const panel = vscode.window.createWebviewPanel(
      'cursor-chat-manager.ruleView',
      `Rule: ${rule.name}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true
      }
    );
    
    // Set the HTML content
    panel.webview.html = this.getRuleHtml(rule);
  }
  
  /**
   * Generate HTML for a rule
   */
  private getRuleHtml(rule: Rule): string {
    // Format tags
    const tagsHtml = rule.tags && rule.tags.length > 0
      ? rule.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join(' ')
      : '<span class="tag-empty">No tags</span>';
    
    // Format applied projects
    const appliedProjectsHtml = rule.appliedProjects && rule.appliedProjects.length > 0
      ? `<p><strong>Applied to: </strong> ${rule.appliedProjects.length} project(s)</p>`
      : '<p><strong>Applied to: </strong> None</p>';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rule: ${this.escapeHtml(rule.name)}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.5;
        }
        h1, h2 {
            color: var(--vscode-editor-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .info {
            background-color: var(--vscode-input-background);
            border-left: 4px solid var(--vscode-focusBorder);
            padding: 15px;
            margin-bottom: 20px;
        }
        .tag {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 3px 8px;
            border-radius: 3px;
            margin-right: 5px;
            font-size: 12px;
        }
        .tag-empty {
            color: var(--vscode-disabledForeground);
            font-style: italic;
        }
        .content {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            font-size: 14px;
        }
        .description {
            margin: 10px 0 20px 0;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <h1>${this.escapeHtml(rule.name)}</h1>
    
    <div class="info">
        <p><strong>Status: </strong> ${rule.isGlobal ? 'Global' : 'Project-specific'}</p>
        <p><strong>Tags: </strong> ${tagsHtml}</p>
        ${appliedProjectsHtml}
    </div>
    
    ${rule.description ? `<div class="description">${this.escapeHtml(rule.description)}</div>` : ''}
    
    <h2>Rule Content</h2>
    <div class="content">${this.escapeHtml(rule.content)}</div>
</body>
</html>`;
  }
  
  /**
   * Escape HTML special characters
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
} 