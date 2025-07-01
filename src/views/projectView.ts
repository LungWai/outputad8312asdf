import * as vscode from 'vscode';
import { Project } from '../models/project';
import { Chat } from '../models/chat';
import { ProjectOrganizer } from '../services/projectOrganizer';
import { ChatProcessor } from '../services/chatProcessor';
import { logger } from '../utils/logger';
import { LOG_COMPONENTS } from '../config/constants';

export class ProjectTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly id: string,
    public readonly iconPath?: string | vscode.ThemeIcon,
    public readonly command?: vscode.Command,
    public readonly project?: Project,
    public readonly chat?: Chat
  ) {
    super(label, collapsibleState);
    this.id = id;
    this.contextValue = contextValue;
    this.iconPath = iconPath;
    this.command = command;
    this.tooltip = label;
  }
}

export class ProjectView implements vscode.TreeDataProvider<ProjectTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ProjectTreeItem | undefined | null | void> = new vscode.EventEmitter<ProjectTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ProjectTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  private projectOrganizer: ProjectOrganizer;
  private chatProcessor: ChatProcessor;

  constructor(private context: vscode.ExtensionContext) {
    this.projectOrganizer = ProjectOrganizer.getInstance();
    this.chatProcessor = ChatProcessor.getInstance();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProjectTreeItem): Promise<ProjectTreeItem[]> {
    logger.debug(LOG_COMPONENTS.VIEW_PROJECT, `getChildren called with element: ${element ? `${element.contextValue}:${element.id}` : 'ROOT'}`);
    
    // Root level - show "Original Projects" and "Custom Projects" categories
    if (!element) {
      logger.debug(LOG_COMPONENTS.VIEW_PROJECT, 'Returning root categories');
      return [
        new ProjectTreeItem(
          'Original Projects',
          vscode.TreeItemCollapsibleState.Expanded,
          'category',
          'original-projects',
          new vscode.ThemeIcon('folder')
        ),
        new ProjectTreeItem(
          'Custom Projects',
          vscode.TreeItemCollapsibleState.Expanded,
          'category',
          'custom-projects',
          new vscode.ThemeIcon('folder')
        )
      ];
    }

    // Category level - show projects under the category
    if (element.contextValue === 'category') {
      if (element.id === 'original-projects') {
        logger.debug(LOG_COMPONENTS.VIEW_PROJECT, 'Getting original projects...');
        const originalProjects = this.projectOrganizer.getOriginalProjects();
        logger.info(LOG_COMPONENTS.VIEW_PROJECT, `Found ${originalProjects.length} original projects`);
        
        originalProjects.forEach((project, index) => {
          logger.debug(LOG_COMPONENTS.VIEW_PROJECT, `Project ${index}: "${project.name}" (ID: ${project.id}) with ${project.chats.length} chats`);
          if (project.chats.length > 0) {
            project.chats.slice(0, 2).forEach((chat, chatIndex) => {
              logger.debug(LOG_COMPONENTS.VIEW_PROJECT, `  Chat ${chatIndex}: "${chat.title}" (${chat.dialogues.length} dialogues)`);
            });
          }
        });
        
        const items = this.createProjectTreeItems(originalProjects, false);
        logger.debug(LOG_COMPONENTS.VIEW_PROJECT, `Created ${items.length} tree items for original projects`);
        return items;
        
      } else if (element.id === 'custom-projects') {
        logger.debug(LOG_COMPONENTS.VIEW_PROJECT, 'Getting custom projects...');
        const customProjects = this.projectOrganizer.getCustomProjects();
        logger.info(LOG_COMPONENTS.VIEW_PROJECT, `Found ${customProjects.length} custom projects`);
        
        customProjects.forEach((project, index) => {
          logger.debug(LOG_COMPONENTS.VIEW_PROJECT, `Custom Project ${index}: "${project.name}" (ID: ${project.id}) with ${project.chats.length} chats`);
        });
        
        const items = this.createProjectTreeItems(customProjects, true);
        
        // Add "Create Custom Project" button
        items.push(
          new ProjectTreeItem(
            '+ New Custom Project',
            vscode.TreeItemCollapsibleState.None,
            'new-project',
            'new-custom-project',
            new vscode.ThemeIcon('add'),
            {
              command: 'cursor-chat-manager.createCustomProject',
              title: 'Create Custom Project',
              arguments: []
            }
          )
        );
        
        logger.debug(LOG_COMPONENTS.VIEW_PROJECT, `Created ${items.length} tree items for custom projects (including add button)`);
        return items;
      }
    }

    // Project level - show chats under the project
    if (element.contextValue === 'project' && element.project) {
      logger.debug(LOG_COMPONENTS.VIEW_PROJECT, `Getting chats for project "${element.project.name}" (ID: ${element.project.id})`);
      logger.debug(LOG_COMPONENTS.VIEW_PROJECT, `Project has ${element.project.chats.length} chats`);
      
      element.project.chats.forEach((chat, index) => {
        logger.debug(LOG_COMPONENTS.VIEW_PROJECT, `Chat ${index}: "${chat.title}" (ID: ${chat.id}) with ${chat.dialogues.length} dialogues`);
      });
      
      const chatItems = this.createChatTreeItems(element.project.chats, element.project.id);
      logger.debug(LOG_COMPONENTS.VIEW_PROJECT, `Created ${chatItems.length} chat tree items`);
      return chatItems;
    }

    // Chat level - show dialogues under the chat
    if (element.contextValue === 'chat' && element.chat) {
      logger.debug(LOG_COMPONENTS.VIEW_PROJECT, `Chat level requested for "${element.chat.title}" - returning empty (dialogues shown in ChatView)`);
      return []; // Dialogues are shown in the chat view, not in the tree
    }

    logger.debug(LOG_COMPONENTS.VIEW_PROJECT, 'No matching case, returning empty array');
    return [];
  }

  private createProjectTreeItems(projects: Project[], isCustom: boolean): ProjectTreeItem[] {
    return projects.map(project => {
      const chatCount = project.chats.length;
      const label = `${project.name} (${chatCount} chat${chatCount !== 1 ? 's' : ''})`;
      
      return new ProjectTreeItem(
        label,
        vscode.TreeItemCollapsibleState.Collapsed,
        'project',
        project.id,
        new vscode.ThemeIcon(isCustom ? 'folder-library' : 'folder'),
        {
          command: 'cursor-chat-manager.openProject',
          title: 'Open Project',
          arguments: [project.id]
        },
        project
      );
    }).sort((a, b) => a.label.localeCompare(b.label));
  }

  private createChatTreeItems(chats: Chat[], projectId: string): ProjectTreeItem[] {
    return chats.map(chat => {
      const dialogueCount = chat.dialogues.length;
      const label = `${chat.title} (${dialogueCount} message${dialogueCount !== 1 ? 's' : ''})`;
      
      return new ProjectTreeItem(
        label,
        vscode.TreeItemCollapsibleState.None,
        'chat',
        chat.id,
        new vscode.ThemeIcon('comment'),
        {
          command: 'cursor-chat-manager.openChat',
          title: 'Open Chat',
          arguments: [chat.id, projectId]
        },
        undefined,
        chat
      );
    }).sort((a, b) => {
      // Sort by date if available in chat
      const dateA = a.chat?.timestamp;
      const dateB = b.chat?.timestamp;
      if (dateA && dateB) {
        // Ensure both are Date objects
        const timeA = dateA instanceof Date ? dateA.getTime() : new Date(dateA).getTime();
        const timeB = dateB instanceof Date ? dateB.getTime() : new Date(dateB).getTime();
        // Newest first
        return timeB - timeA;
      }
      return a.label.localeCompare(b.label);
    });
  }

  public async loadProjects(): Promise<{ projectCount: number; chatCount: number } | null> {
    try {
      logger.info(LOG_COMPONENTS.VIEW_PROJECT, '*** STARTING LOAD PROJECTS ***');

      // PROOF: Clear all cached/stored data to force fresh processing
      logger.info(LOG_COMPONENTS.VIEW_PROJECT, '*** CLEARING ALL CACHED DATA ***');
      await this.chatProcessor.clearAllCachedData();

      // PROOF: Force fresh data processing to show proof logs
      logger.info(LOG_COMPONENTS.VIEW_PROJECT, 'Calling chatProcessor.processChats() to get FRESH data...');
      const { projects, chats } = await this.chatProcessor.processChats();
      logger.info(LOG_COMPONENTS.VIEW_PROJECT, `processChats returned ${projects.length} projects, ${chats.length} chats`);

      // Initialize projectOrganizer with the processed projects
      await this.projectOrganizer.initialize(projects);

      // Save processed data
      await this.chatProcessor.saveProcessedData(projects, chats);

      // Refresh the view
      this.refresh();

      // Return information about what was loaded
      return {
        projectCount: projects.length,
        chatCount: chats.length
      };
    } catch (error) {
      logger.error(LOG_COMPONENTS.VIEW_PROJECT, 'Error loading projects', error);
      vscode.window.showErrorMessage('Failed to load Cursor chat data. Please try again.');
      return null;
    }
  }
} 