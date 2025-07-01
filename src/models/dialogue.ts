import { Chat, ChatImpl } from './chat';
import { v4 as uuidv4 } from 'uuid';

export interface Dialogue {
  id: string;
  chatId: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  tags: string[];
  metadata?: Record<string, any>;
}

export class DialogueImpl implements Dialogue {
  id: string;
  chatId: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  tags: string[];
  metadata?: Record<string, any>;

  constructor(
    id: string,
    chatId: string,
    content: string,
    isUser: boolean,
    timestamp: Date,
    tags: string[] = [],
    metadata?: Record<string, any>
  ) {
    this.id = id;
    this.chatId = chatId;
    this.content = content;
    this.isUser = isUser;
    this.timestamp = timestamp;
    this.tags = tags;
    this.metadata = metadata;
  }

  addTag(tag: string): void {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  removeTag(tag: string): boolean {
    const initialLength = this.tags.length;
    this.tags = this.tags.filter(t => t !== tag);
    return this.tags.length !== initialLength;
  }

  extractToNewChat(title?: string): Chat {
    // Create a new chat from this dialogue
    return new ChatImpl(
      uuidv4(),
      title || `Extracted from ${this.chatId} - ${new Date().toLocaleString()}`,
      new Date(),
      '', // ProjectId will be set when adding to a project
      [this], // Add this dialogue to the new chat
      [], // No tags initially
      { extractedFrom: this.chatId, extractedDialogue: this.id }
    );
  }

  serialize(): Record<string, any> {
    return {
      id: this.id,
      chatId: this.chatId,
      content: this.content,
      isUser: this.isUser,
      timestamp: this.timestamp.toISOString(),
      tags: this.tags,
      metadata: this.metadata
    };
  }

  static deserialize(data: Record<string, any>): DialogueImpl {
    return new DialogueImpl(
      data.id,
      data.chatId,
      data.content,
      data.isUser,
      new Date(data.timestamp),
      Array.isArray(data.tags) ? data.tags : [],
      data.metadata
    );
  }
} 