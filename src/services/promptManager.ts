import * as vscode from 'vscode';
import { Prompt, PromptImpl, Variable, VariableImpl } from '../models/prompt';
import { StorageManager } from '../data/storageManager';
import { logger } from '../utils/logger';
import { LOG_COMPONENTS } from '../config/constants';

export class PromptManager {
  private static instance: PromptManager;
  private storageManager: StorageManager;
  private prompts: Map<string, PromptImpl> = new Map();
  private categories: Set<string> = new Set();
  private initialized: boolean = false;

  private constructor() {
    this.storageManager = StorageManager.getInstance();
  }

  public static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  /**
   * Initialize the prompt manager by loading prompts from storage
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load saved prompts
      const promptsData = await this.storageManager.getData<any[]>('prompts', []);
      const categoriesData = await this.storageManager.getData<string[]>('promptCategories', []);
      
      // Convert to prompts
      this.prompts = new Map();
      (promptsData || []).forEach((promptData: any) => {
        const prompt = PromptImpl.deserialize(promptData);
        this.prompts.set(prompt.id, prompt);
      });
      
      // Load categories
      this.categories = new Set(categoriesData || []);
      
      // Extract categories from existing prompts
      this.prompts.forEach(prompt => {
        if (prompt.category) {
          this.categories.add(prompt.category);
        }
      });

      this.initialized = true;
    } catch (error) {
      logger.error(LOG_COMPONENTS.PROMPT_MANAGER, 'Failed to initialize prompt manager', error);
      throw new Error(`Prompt manager initialization failed: ${error}`);
    }
  }

  /**
   * Get all prompts
   */
  public async getPrompts(): Promise<PromptImpl[]> {
    await this.ensureInitialized();
    return Array.from(this.prompts.values());
  }

  /**
   * Get prompts by category
   */
  public async getPromptsByCategory(category: string): Promise<PromptImpl[]> {
    await this.ensureInitialized();
    return Array.from(this.prompts.values()).filter(prompt => prompt.category === category);
  }

  /**
   * Get prompts by tag
   */
  public async getPromptsByTag(tag: string): Promise<PromptImpl[]> {
    await this.ensureInitialized();
    return Array.from(this.prompts.values()).filter(prompt => prompt.tags.includes(tag));
  }

  /**
   * Get a prompt by ID
   */
  public async getPromptById(promptId: string): Promise<PromptImpl | undefined> {
    await this.ensureInitialized();
    return this.prompts.get(promptId);
  }

  /**
   * Get all categories
   */
  public async getCategories(): Promise<string[]> {
    await this.ensureInitialized();
    return Array.from(this.categories);
  }

  /**
   * Add a new category
   */
  public async addCategory(category: string): Promise<void> {
    await this.ensureInitialized();
    if (category && !this.categories.has(category)) {
      this.categories.add(category);
      // No need to save this separately as categories are derived from prompts
    }
  }

  /**
   * Get all unique tags used across prompts
   */
  public async getAllTags(): Promise<string[]> {
    await this.ensureInitialized();
    const tags = new Set<string>();
    this.prompts.forEach(prompt => {
      prompt.tags.forEach(tag => tags.add(tag));
    });
    return [...tags];
  }

  /**
   * Create a new prompt
   */
  public async createPrompt(
    title: string,
    template: string,
    category: string = '',
    tags: string[] = []
  ): Promise<PromptImpl> {
    await this.ensureInitialized();

    // Generate a more robust unique ID using crypto-style randomness
    const promptId = this.generateUniquePromptId();

    // Extract variables from template
    const variableNames = PromptImpl.extractVariablesFromTemplate(template);
    const variables: VariableImpl[] = variableNames.map(name =>
      new VariableImpl(this.generateUniqueVariableId(name), name, `Variable: ${name}`, '')
    );
    
    const prompt = new PromptImpl(
      promptId,
      title,
      template,
      variables,
      new Date(),
      0,
      category,
      tags
    );
    
    this.prompts.set(promptId, prompt);
    
    // Add category if new
    if (category) {
      this.categories.add(category);
    }
    
    await this.saveState();
    return prompt;
  }

  /**
   * Update an existing prompt
   */
  public async updatePrompt(
    promptId: string,
    updates: {
      title?: string;
      template?: string;
      category?: string;
      tags?: string[];
    }
  ): Promise<boolean> {
    await this.ensureInitialized();

    const prompt = this.prompts.get(promptId);
    if (!prompt) {
      return false;
    }
    
    if (updates.title) {
      prompt.title = updates.title;
    }
    
    if (updates.template) {
      prompt.template = updates.template;
      
      // Re-extract variables from updated template
      const variableNames = PromptImpl.extractVariablesFromTemplate(updates.template);
      const newVariables: VariableImpl[] = variableNames.map(name => {
        // Try to find existing variable with same name
        const existingVar = prompt.variables.find(v => v.name === name);
        if (existingVar) {
          return existingVar instanceof VariableImpl ? existingVar : 
            new VariableImpl(existingVar.id, existingVar.name, existingVar.description, existingVar.defaultValue);
        }
        return new VariableImpl(`var-${Date.now()}-${name}`, name, `Variable: ${name}`, '');
      });
      
      prompt.variables = newVariables;
    }
    
    if (updates.category) {
      prompt.category = updates.category;
      this.categories.add(updates.category);
    }
    
    if (updates.tags) {
      prompt.tags = [...updates.tags];
    }
    
    await this.saveState();
    return true;
  }

  /**
   * Delete a prompt
   */
  public async deletePrompt(promptId: string): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.prompts.has(promptId)) {
      return false;
    }

    this.prompts.delete(promptId);
    await this.saveState();
    return true;
  }

  /**
   * Fill a prompt template with variable values
   */
  public async fillPromptTemplate(
    promptId: string,
    variableValues: Record<string, string>
  ): Promise<string | null> {
    await this.ensureInitialized();

    const prompt = this.prompts.get(promptId);
    if (!prompt || typeof prompt.fillTemplate !== 'function') {
      return null;
    }

    // Increment usage count
    if (typeof prompt.incrementUsage === 'function') {
      prompt.incrementUsage();
      await this.saveState();
    }

    return prompt.fillTemplate(variableValues);
  }

  /**
   * Add a variable to a prompt
   */
  public async addVariableToPrompt(promptId: string, variable: Variable): Promise<boolean> {
    await this.ensureInitialized();

    const prompt = this.prompts.get(promptId);
    if (!prompt) {
      return false;
    }

    const variableImpl = variable instanceof VariableImpl ? variable :
      new VariableImpl(variable.id, variable.name, variable.description, variable.defaultValue);
    
    if (typeof prompt.addVariable === 'function') {
      prompt.addVariable(variableImpl);
      await this.saveState();
      return true;
    }

    return false;
  }

  /**
   * Remove a variable from a prompt
   */
  public async removeVariableFromPrompt(promptId: string, variableId: string): Promise<boolean> {
    await this.ensureInitialized();

    const prompt = this.prompts.get(promptId);
    if (!prompt || typeof prompt.removeVariable !== 'function') {
      return false;
    }

    const removed = prompt.removeVariable(variableId);
    if (removed) {
      await this.saveState();
    }
    return removed;
  }

  /**
   * Save the current state of the prompt manager
   */
  public async saveState(): Promise<void> {
    try {
      // Save prompts
      const promptsArray = Array.from(this.prompts.values());
      await this.storageManager.saveData('prompts', promptsArray.map(p => p.serialize()));
      
      // Save categories
      await this.storageManager.saveData('promptCategories', Array.from(this.categories));
    } catch (error) {
      logger.error(LOG_COMPONENTS.PROMPT_MANAGER, 'Error saving prompt manager state', error);
    }
  }

  /**
   * Export prompts to a file
   */
  public async exportPrompts(promptIds: string[], filePath: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const promptsToExport = promptIds.map(id => this.prompts.get(id))
        .filter((prompt): prompt is PromptImpl => !!prompt)
        .map(prompt => typeof prompt.serialize === 'function' ? prompt.serialize() : prompt);

      if (promptsToExport.length === 0) {
        return false;
      }

      const exportData = {
        version: 1,
        prompts: promptsToExport
      };

      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(filePath),
        Buffer.from(JSON.stringify(exportData, null, 2), 'utf8')
      );

      return true;
    } catch (error) {
      logger.error(LOG_COMPONENTS.PROMPT_MANAGER, 'Failed to export prompts', error);
      return false;
    }
  }

  /**
   * Import prompts from a file
   */
  public async importPrompts(filePath: string): Promise<number> {
    await this.ensureInitialized();

    try {
      const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      const data = JSON.parse(fileContent.toString());

      if (!data || !Array.isArray(data.prompts)) {
        throw new Error('Invalid prompt file format');
      }

      let importedCount = 0;
      for (const promptData of data.prompts) {
        try {
          const prompt = PromptImpl.deserialize(promptData);

          // Generate a new unique ID to avoid conflicts
          prompt.id = this.generateUniquePromptId();

          this.prompts.set(prompt.id, prompt);
          if (prompt.category) {
            this.categories.add(prompt.category);
          }

          importedCount++;
        } catch (err) {
          logger.error(LOG_COMPONENTS.PROMPT_MANAGER, 'Error importing prompt', err);
        }
      }

      if (importedCount > 0) {
        await this.saveState();
      }

      return importedCount;
    } catch (error) {
      logger.error(LOG_COMPONENTS.PROMPT_MANAGER, 'Failed to import prompts', error);
      throw new Error(`Prompt import failed: ${error}`);
    }
  }

  /**
   * Get prompts sorted by usage count (most used first)
   */
  public async getPopularPrompts(limit: number = 5): Promise<PromptImpl[]> {
    await this.ensureInitialized();
    
    return Array.from(this.prompts.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Generate a unique prompt ID with better collision resistance
   */
  private generateUniquePromptId(): string {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substr(2, 12);
    const extraRandom = Math.random().toString(36).substr(2, 6);
    return `prompt-${timestamp}-${randomPart}-${extraRandom}`;
  }

  /**
   * Generate a unique variable ID
   */
  private generateUniqueVariableId(variableName: string): string {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substr(2, 8);
    return `var-${timestamp}-${variableName}-${randomPart}`;
  }

  /**
   * Ensure manager is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}