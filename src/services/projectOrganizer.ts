import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectImpl } from '../models/project';
import { Chat, ChatImpl } from '../models/chat';
import { Dialogue, DialogueImpl } from '../models/dialogue';
import { StorageManager } from '../data/storageManager';

export enum OrganizationMode {
  COPY = 'copy',
  MOVE = 'move'
}

export class ProjectOrganizer {
  private static instance: ProjectOrganizer;
  private storageManager: StorageManager;
  private projects: Map<string, ProjectImpl> = new Map();
  private originalProjects: Map<string, ProjectImpl> = new Map();
  private customProjects: Map<string, ProjectImpl> = new Map();

  private constructor() {
    this.storageManager = StorageManager.getInstance();
  }

  public static getInstance(): ProjectOrganizer {
    if (!ProjectOrganizer.instance) {
      ProjectOrganizer.instance = new ProjectOrganizer();
    }
    return ProjectOrganizer.instance;
  }

  public async initialize(projects: Project[]): Promise<void> {
    console.log(`ProjectOrganizer.initialize: Called with ${projects.length} projects`);
    
    this.projects = new Map();
    this.originalProjects = new Map();
    this.customProjects = new Map();
    
    // Log input projects for debugging
    projects.forEach((project, index) => {
      console.log(`  - Input Project ${index}: "${project.name}" (ID: ${project.id}, isCustom: ${project.isCustom}) with ${project.chats.length} chats`);
    });
    
    // Load custom projects from storage
    const customProjectsData = await this.storageManager.getData<any[]>('customProjects', []);
    console.log(`ProjectOrganizer.initialize: Loaded ${(customProjectsData || []).length} custom projects from storage`);
    
    const customProjects: ProjectImpl[] = (customProjectsData || [])
      .map((p: any) => ProjectImpl.deserialize(p));
    
    // Add all projects to maps
    const allProjects = [...projects, ...customProjects];
    console.log(`ProjectOrganizer.initialize: Processing ${allProjects.length} total projects (${projects.length} input + ${customProjects.length} stored)`);
    
    for (const project of allProjects) {
      const projectImpl = project instanceof ProjectImpl ? project : 
        new ProjectImpl(project.id, project.name, project.description, project.created, project.isCustom, project.chats, project.tags, project.metadata);
      
      console.log(`ProjectOrganizer.initialize: Adding project "${projectImpl.name}" (ID: ${projectImpl.id}, isCustom: ${projectImpl.isCustom}) with ${projectImpl.chats.length} chats`);
      
      this.projects.set(projectImpl.id, projectImpl);
      if (projectImpl.isCustom) {
        this.customProjects.set(projectImpl.id, projectImpl);
        console.log(`  - Added to customProjects map`);
      } else {
        this.originalProjects.set(projectImpl.id, projectImpl);
        console.log(`  - Added to originalProjects map`);
      }
    }
    
    console.log(`ProjectOrganizer.initialize: Final state:`);
    console.log(`  - Total projects: ${this.projects.size}`);
    console.log(`  - Original projects: ${this.originalProjects.size}`);
    console.log(`  - Custom projects: ${this.customProjects.size}`);
    
    // Log detailed breakdown
    console.log(`ProjectOrganizer.initialize: Original projects breakdown:`);
    Array.from(this.originalProjects.values()).forEach((project, index) => {
      console.log(`    ${index}: "${project.name}" (${project.chats.length} chats)`);
    });
    
    console.log(`ProjectOrganizer.initialize: Custom projects breakdown:`);
    Array.from(this.customProjects.values()).forEach((project, index) => {
      console.log(`    ${index}: "${project.name}" (${project.chats.length} chats)`);
    });
  }

  public async saveState(): Promise<void> {
    try {
      // Save only custom projects
      const customProjectsArray = Array.from(this.customProjects.values());
      await this.storageManager.saveData('customProjects', customProjectsArray.map(p => 
        p.serialize()
      ));
    } catch (error) {
      console.error(`Error saving project organizer state: ${error}`);
    }
  }

  public async createCustomProject(
    name: string,
    description: string,
    tags: string[] = []
  ): Promise<ProjectImpl> {
    const projectId = `custom-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    
    const newProject = new ProjectImpl(
      projectId,
      name,
      description,
      new Date(),
      true, // Is custom project
      [], // No chats initially
      tags
    );
    
    this.projects.set(projectId, newProject);
    this.customProjects.set(projectId, newProject);
    
    await this.saveState();
    return newProject;
  }

  public async updateProject(
    projectId: string,
    updates: { name?: string; description?: string; tags?: string[] }
  ): Promise<boolean> {
    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }
    
    // Only custom projects can be updated
    if (!project.isCustom) {
      return false;
    }
    
    if (updates.name) {
      project.name = updates.name;
    }
    
    if (updates.description) {
      project.description = updates.description;
    }
    
    if (updates.tags) {
      project.tags = [...updates.tags];
    }
    
    await this.saveState();
    return true;
  }

  public async deleteCustomProject(projectId: string): Promise<boolean> {
    // Only custom projects can be deleted
    if (!this.customProjects.has(projectId)) {
      return false;
    }
    
    this.projects.delete(projectId);
    this.customProjects.delete(projectId);
    
    await this.saveState();
    return true;
  }

  public async organizeChatToProject(
    chatId: string,
    sourceProjectId: string,
    targetProjectId: string,
    mode: OrganizationMode
  ): Promise<boolean> {
    const sourceProject = this.projects.get(sourceProjectId);
    const targetProject = this.projects.get(targetProjectId);
    
    if (!sourceProject || !targetProject) {
      return false;
    }
    
    // Find the chat in source project
    const chat = sourceProject.chats.find(c => c.id === chatId);
    if (!chat) {
      return false;
    }
    
    if (mode === OrganizationMode.COPY) {
      // Create a copy of the chat
      const chatCopy = new ChatImpl(
        `${chat.id}-copy-${Date.now()}`,
        chat.title,
        chat.timestamp,
        targetProjectId,
        [...chat.dialogues], // Copy dialogues
        [...chat.tags], // Copy tags
        { ...chat.metadata, copiedFrom: chat.id }
      );
      
      // Add to target project
      targetProject.addChat(chatCopy);
    } else {
      // Move: Remove from source and add to target
      sourceProject.removeChat(chatId);
      chat.projectId = targetProjectId;
      targetProject.addChat(chat);
    }
    
    await this.saveState();
    return true;
  }

  public async extractDialogueToNewChat(
    dialogueId: string,
    chatId: string,
    projectId: string,
    title?: string,
    tags: string[] = []
  ): Promise<string | null> {
    const project = this.projects.get(projectId);
    if (!project) {
      return null;
    }
    
    // Find the source chat
    const sourceChat = project.chats.find(c => c.id === chatId);
    if (!sourceChat) {
      return null;
    }
    
    // Find the dialogue
    const dialogue = sourceChat.dialogues.find(d => d.id === dialogueId);
    if (!dialogue) {
      return null;
    }
    
    // Create a new chat with this dialogue
    const newChat = new ChatImpl(
      uuidv4(),
      title || `Extracted from ${sourceChat.title}`,
      new Date(),
      projectId,
      [dialogue], // Add the dialogue
      tags, // Apply tags
      { extractedFrom: chatId, extractedDialogue: dialogueId }
    );
    
    // Add to project
    project.addChat(newChat);
    
    await this.saveState();
    return newChat.id;
  }

  public async extractDialogueToExistingChat(
    dialogueId: string,
    sourceChatId: string,
    targetChatId: string
  ): Promise<boolean> {
    // Find source chat and target chat
    let sourceChat: Chat | undefined;
    let targetChat: Chat | undefined;
    
    for (const project of this.projects.values()) {
      if (!sourceChat) {
        sourceChat = project.chats.find(c => c.id === sourceChatId);
      }
      
      if (!targetChat) {
        targetChat = project.chats.find(c => c.id === targetChatId);
      }
      
      if (sourceChat && targetChat) {
        break;
      }
    }
    
    if (!sourceChat || !targetChat) {
      return false;
    }
    
    // Find the dialogue
    const dialogueIndex = sourceChat.dialogues.findIndex(d => d.id === dialogueId);
    if (dialogueIndex === -1) {
      return false;
    }
    
    // Copy the dialogue to target chat
    const dialogue = sourceChat.dialogues[dialogueIndex];
    const dialogueCopy = new DialogueImpl(
      `${dialogue.id}-copy-${Date.now()}`,
      targetChat.id,
      dialogue.content,
      dialogue.isUser,
      dialogue.timestamp,
      [...dialogue.tags],
      dialogue.metadata
    );
    
    // Add to target chat if it's an implementation
    if (targetChat instanceof ChatImpl) {
      targetChat.addDialogue(dialogueCopy);
    } else {
      // Fallback: add to dialogues array directly
      targetChat.dialogues.push(dialogueCopy);
    }
    
    await this.saveState();
    return true;
  }

  public getProject(projectId: string): ProjectImpl | undefined {
    return this.projects.get(projectId);
  }

  public getAllProjects(): ProjectImpl[] {
    return Array.from(this.projects.values());
  }

  public getOriginalProjects(): ProjectImpl[] {
    return Array.from(this.originalProjects.values());
  }

  public getCustomProjects(): ProjectImpl[] {
    return Array.from(this.customProjects.values());
  }

  public async findProjectByChat(chatId: string): Promise<ProjectImpl | undefined> {
    for (const project of this.projects.values()) {
      if (project.chats.some(c => c.id === chatId)) {
        return project;
      }
    }
    return undefined;
  }

  public async findChatById(chatId: string): Promise<Chat | undefined> {
    for (const project of this.projects.values()) {
      const chat = project.chats.find(c => c.id === chatId);
      if (chat) {
        return chat;
      }
    }
    return undefined;
  }

  public async findDialogueById(dialogueId: string): Promise<{ 
    dialogue: Dialogue, 
    chat: Chat, 
    project: ProjectImpl 
  } | undefined> {
    for (const project of this.projects.values()) {
      for (const chat of project.chats) {
        const dialogue = chat.dialogues.find(d => d.id === dialogueId);
        if (dialogue) {
          return { dialogue, chat, project };
        }
      }
    }
    return undefined;
  }
} 