import { Chat, ChatImpl } from '../models/chat';
import { Dialogue, DialogueImpl } from '../models/dialogue';
import { StorageManager } from '../data/storageManager';
import { logger } from '../utils/logger';
import { LOG_COMPONENTS } from '../config/constants';

interface TagStats {
  name: string;
  count: number;
  lastUsed: Date;
}

interface TagCategory {
  name: string;
  tags: string[];
}

export class TagManager {
  private static instance: TagManager;
  private storageManager: StorageManager;
  private chatTags: Map<string, string[]> = new Map();
  private dialogueTags: Map<string, string[]> = new Map();
  private tagStats: Map<string, TagStats> = new Map();
  private tagCategories: TagCategory[] = [];

  private constructor() {
    this.storageManager = StorageManager.getInstance();
  }

  public static getInstance(): TagManager {
    if (!TagManager.instance) {
      TagManager.instance = new TagManager();
    }
    return TagManager.instance;
  }

  public async initialize(): Promise<void> {
    try {
      // Load saved tag data
      const chatTagsData = await this.storageManager.getData<Record<string, string[]>>('chatTags', {});
      const dialogueTagsData = await this.storageManager.getData<Record<string, string[]>>('dialogueTags', {});
      const tagStatsData = await this.storageManager.getData<Record<string, TagStats>>('tagStats', {});
      const tagCategoriesData = await this.storageManager.getData<TagCategory[]>('tagCategories', []);
      
      // Convert to maps
      this.chatTags = new Map(Object.entries(chatTagsData || {}));
      this.dialogueTags = new Map(Object.entries(dialogueTagsData || {}));
      this.tagStats = new Map(Object.entries(tagStatsData || {}));
      this.tagCategories = tagCategoriesData || [];
      
      // Ensure tag stats dates are Date objects
      this.tagStats.forEach((stats, tag) => {
        if (typeof stats.lastUsed === 'string') {
          stats.lastUsed = new Date(stats.lastUsed);
        }
      });
    } catch (error) {
      logger.error(LOG_COMPONENTS.TAG_MANAGER, 'Error initializing tag manager', error);
    }
  }

  public async saveState(): Promise<void> {
    try {
      // Convert maps to objects for storage
      const chatTagsObj = Object.fromEntries(this.chatTags);
      const dialogueTagsObj = Object.fromEntries(this.dialogueTags);
      const tagStatsObj = Object.fromEntries(this.tagStats);
      
      // Save data
      await this.storageManager.saveData('chatTags', chatTagsObj);
      await this.storageManager.saveData('dialogueTags', dialogueTagsObj);
      await this.storageManager.saveData('tagStats', tagStatsObj);
      await this.storageManager.saveData('tagCategories', this.tagCategories);
    } catch (error) {
      logger.error(LOG_COMPONENTS.TAG_MANAGER, 'Error saving tag manager state', error);
    }
  }

  // Chat-level tagging
  public async addTagToChat(chat: Chat, tag: string): Promise<boolean> {
    const normalizedTag = this.normalizeTag(tag);
    if (!this.validateTag(normalizedTag)) {
      return false;
    }
    
    // Update chat tags if it's an implementation
    if (chat instanceof ChatImpl) {
      chat.addTag(normalizedTag);
    }
    
    // Update tag map
    const chatTags = this.chatTags.get(chat.id) || [];
    if (!chatTags.includes(normalizedTag)) {
      chatTags.push(normalizedTag);
      this.chatTags.set(chat.id, chatTags);
    }
    
    // Update tag stats
    this.updateTagStats(normalizedTag);
    
    // Save state
    await this.saveState();
    return true;
  }

  public async removeTagFromChat(chat: Chat, tag: string): Promise<boolean> {
    const normalizedTag = this.normalizeTag(tag);
    
    // Update chat tags if it's an implementation
    let removed = false;
    if (chat instanceof ChatImpl) {
      removed = chat.removeTag(normalizedTag);
    }
    
    // Update tag map
    const chatTags = this.chatTags.get(chat.id) || [];
    const updatedTags = chatTags.filter(t => t !== normalizedTag);
    this.chatTags.set(chat.id, updatedTags);
    
    // Save state
    await this.saveState();
    return removed || chatTags.length !== updatedTags.length;
  }

  public getChatTags(chatId: string): string[] {
    return this.chatTags.get(chatId) || [];
  }

  // Dialogue-level tagging
  public async addTagToDialogue(dialogue: Dialogue, tag: string): Promise<boolean> {
    const normalizedTag = this.normalizeTag(tag);
    if (!this.validateTag(normalizedTag)) {
      return false;
    }
    
    // Update dialogue tags if it's an implementation
    if (dialogue instanceof DialogueImpl) {
      dialogue.addTag(normalizedTag);
    }
    
    // Update tag map
    const dialogueTags = this.dialogueTags.get(dialogue.id) || [];
    if (!dialogueTags.includes(normalizedTag)) {
      dialogueTags.push(normalizedTag);
      this.dialogueTags.set(dialogue.id, dialogueTags);
    }
    
    // Update tag stats
    this.updateTagStats(normalizedTag);
    
    // Save state
    await this.saveState();
    return true;
  }

  public async removeTagFromDialogue(dialogue: Dialogue, tag: string): Promise<boolean> {
    const normalizedTag = this.normalizeTag(tag);
    
    // Update dialogue tags if it's an implementation
    let removed = false;
    if (dialogue instanceof DialogueImpl) {
      removed = dialogue.removeTag(normalizedTag);
    }
    
    // Update tag map
    const dialogueTags = this.dialogueTags.get(dialogue.id) || [];
    const updatedTags = dialogueTags.filter(t => t !== normalizedTag);
    this.dialogueTags.set(dialogue.id, updatedTags);
    
    // Save state
    await this.saveState();
    return removed || dialogueTags.length !== updatedTags.length;
  }

  public getDialogueTags(dialogueId: string): string[] {
    return this.dialogueTags.get(dialogueId) || [];
  }

  // Tag categories
  public async createTagCategory(name: string): Promise<boolean> {
    if (!name || this.tagCategories.some(c => c.name === name)) {
      return false;
    }
    
    this.tagCategories.push({ name, tags: [] });
    await this.saveState();
    return true;
  }

  public async addTagToCategory(tag: string, categoryName: string): Promise<boolean> {
    const normalizedTag = this.normalizeTag(tag);
    const category = this.tagCategories.find(c => c.name === categoryName);
    if (!category) {
      return false;
    }
    
    if (!category.tags.includes(normalizedTag)) {
      category.tags.push(normalizedTag);
      await this.saveState();
    }
    return true;
  }

  public async removeTagFromCategory(tag: string, categoryName: string): Promise<boolean> {
    const normalizedTag = this.normalizeTag(tag);
    const category = this.tagCategories.find(c => c.name === categoryName);
    if (!category) {
      return false;
    }
    
    const initialLength = category.tags.length;
    category.tags = category.tags.filter(t => t !== normalizedTag);
    
    if (category.tags.length !== initialLength) {
      await this.saveState();
      return true;
    }
    return false;
  }

  public getTagsInCategory(categoryName: string): string[] {
    const category = this.tagCategories.find(c => c.name === categoryName);
    return category?.tags || [];
  }

  public getCategories(): TagCategory[] {
    return [...this.tagCategories];
  }

  // Tag suggestions
  public getSuggestedTags(count: number = 5): string[] {
    // Get tags sorted by usage count
    const sortedByCount = Array.from(this.tagStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([tag]) => tag);
    
    // Get tags sorted by recency
    const sortedByRecency = Array.from(this.tagStats.entries())
      .sort((a, b) => {
        const timeA = a[1].lastUsed instanceof Date ? a[1].lastUsed.getTime() : new Date(a[1].lastUsed).getTime();
        const timeB = b[1].lastUsed instanceof Date ? b[1].lastUsed.getTime() : new Date(b[1].lastUsed).getTime();
        return timeB - timeA;
      })
      .map(([tag]) => tag);
    
    // Combine the two lists, prioritizing tags that appear in both
    const combined = new Set<string>();
    
    for (let i = 0; i < count * 2 && combined.size < count; i++) {
      const countIndex = Math.floor(i / 2);
      const recencyIndex = Math.floor(i / 2);
      
      if (i % 2 === 0 && countIndex < sortedByCount.length) {
        combined.add(sortedByCount[countIndex]);
      } else if (recencyIndex < sortedByRecency.length) {
        combined.add(sortedByRecency[recencyIndex]);
      }
    }
    
    return Array.from(combined).slice(0, count);
  }

  // Search by tags
  public async findChatsByTags(tags: string[]): Promise<string[]> {
    if (!tags.length) {
      return [];
    }
    
    const normalizedTags = tags.map(tag => this.normalizeTag(tag));
    const chatIds: string[] = [];
    
    this.chatTags.forEach((chatTagList, chatId) => {
      if (normalizedTags.every(tag => chatTagList.includes(tag))) {
        chatIds.push(chatId);
      }
    });
    
    return chatIds;
  }

  public async findDialoguesByTags(tags: string[]): Promise<string[]> {
    if (!tags.length) {
      return [];
    }
    
    const normalizedTags = tags.map(tag => this.normalizeTag(tag));
    const dialogueIds: string[] = [];
    
    this.dialogueTags.forEach((dialogueTagList, dialogueId) => {
      if (normalizedTags.every(tag => dialogueTagList.includes(tag))) {
        dialogueIds.push(dialogueId);
      }
    });
    
    return dialogueIds;
  }

  // Helper methods
  private normalizeTag(tag: string): string {
    // Remove leading # if present
    let normalizedTag = tag.trim();
    if (normalizedTag.startsWith('#')) {
      normalizedTag = normalizedTag.substring(1);
    }
    
    // Convert to kebab-case
    normalizedTag = normalizedTag
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    return normalizedTag;
  }

  private validateTag(tag: string): boolean {
    // Check if tag is not empty and follows pattern
    return !!tag && /^[a-z0-9-]+$/.test(tag);
  }

  private updateTagStats(tag: string): void {
    const stats = this.tagStats.get(tag) || { name: tag, count: 0, lastUsed: new Date() };
    stats.count += 1;
    stats.lastUsed = new Date();
    this.tagStats.set(tag, stats);
  }

  public getAllTags(): string[] {
    return Array.from(this.tagStats.keys());
  }

  public getTagUsageCount(tag: string): number {
    return this.tagStats.get(this.normalizeTag(tag))?.count || 0;
  }
} 