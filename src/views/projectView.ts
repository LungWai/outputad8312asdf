import * as vscode from 'vscode';
import { Project } from '../models/project';
import { Chat } from '../models/chat';
import { ProjectOrganizer } from '../services/projectOrganizer';
import { ChatProcessor } from '../services/chatProcessor';

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
    console.log(`ProjectView.getChildren: Called with element: ${element ? `${element.contextValue}:${element.id}` : 'ROOT'}`);
    
    // Root level - show "Original Projects" and "Custom Projects" categories
    if (!element) {
      console.log('ProjectView.getChildren: Returning root categories');
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
        console.log('ProjectView.getChildren: Getting original projects...');
        const originalProjects = this.projectOrganizer.getOriginalProjects();
        console.log(`ProjectView.getChildren: Found ${originalProjects.length} original projects:`);
        
        originalProjects.forEach((project, index) => {
          console.log(`  - Project ${index}: "${project.name}" (ID: ${project.id}) with ${project.chats.length} chats`);
          if (project.chats.length > 0) {
            project.chats.slice(0, 2).forEach((chat, chatIndex) => {
              console.log(`    - Chat ${chatIndex}: "${chat.title}" (${chat.dialogues.length} dialogues)`);
            });
          }
        });
        
        const items = this.createProjectTreeItems(originalProjects, false);
        console.log(`ProjectView.getChildren: Created ${items.length} tree items for original projects`);
        return items;
        
      } else if (element.id === 'custom-projects') {
        console.log('ProjectView.getChildren: Getting custom projects...');
        const customProjects = this.projectOrganizer.getCustomProjects();
        console.log(`ProjectView.getChildren: Found ${customProjects.length} custom projects:`);
        
        customProjects.forEach((project, index) => {
          console.log(`  - Custom Project ${index}: "${project.name}" (ID: ${project.id}) with ${project.chats.length} chats`);
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
        
        console.log(`ProjectView.getChildren: Created ${items.length} tree items for custom projects (including add button)`);
        return items;
      }
    }

    // Project level - show chats under the project
    if (element.contextValue === 'project' && element.project) {
      console.log(`ProjectView.getChildren: Getting chats for project "${element.project.name}" (ID: ${element.project.id})`);
      console.log(`ProjectView.getChildren: Project has ${element.project.chats.length} chats:`);
      
      element.project.chats.forEach((chat, index) => {
        console.log(`  - Chat ${index}: "${chat.title}" (ID: ${chat.id}) with ${chat.dialogues.length} dialogues`);
      });
      
      const chatItems = this.createChatTreeItems(element.project.chats, element.project.id);
      console.log(`ProjectView.getChildren: Created ${chatItems.length} chat tree items`);
      return chatItems;
    }

    // Chat level - show dialogues under the chat
    if (element.contextValue === 'chat' && element.chat) {
      console.log(`ProjectView.getChildren: Chat level requested for "${element.chat.title}" - returning empty (dialogues shown in ChatView)`);
      return []; // Dialogues are shown in the chat view, not in the tree
    }

    console.log('ProjectView.getChildren: No matching case, returning empty array');
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
      console.log('ProjectView: *** STARTING LOAD PROJECTS ***');

      // PROOF: Clear all cached/stored data to force fresh processing
      console.log('ProjectView: *** CLEARING ALL CACHED DATA ***');
      await this.chatProcessor.clearAllCachedData();

      // PROOF: Force fresh data processing to show proof logs
      console.log('ProjectView: Calling chatProcessor.processChats() to get FRESH data...');
      const { projects, chats } = await this.chatProcessor.processChats();
      console.log(`ProjectView: processChats returned ${projects.length} projects, ${chats.length} chats`);

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
      console.error(`Error loading projects: ${error}`);
      vscode.window.showErrorMessage('Failed to load Cursor chat data. Please try again.');
      return null;
    }
  }
} 