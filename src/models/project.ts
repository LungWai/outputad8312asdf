import { Chat, ChatImpl } from './chat';

export interface Project {
  id: string;
  name: string;
  description: string;
  created: Date;
  isCustom: boolean;
  chats: Chat[];
  tags: string[];
  metadata?: Record<string, any>;
}

export class ProjectImpl implements Project {
  id: string;
  name: string;
  description: string;
  created: Date;
  isCustom: boolean;
  chats: Chat[];
  tags: string[];
  metadata?: Record<string, any>;

  constructor(
    id: string,
    name: string,
    description: string,
    created: Date,
    isCustom: boolean,
    chats: Chat[] = [],
    tags: string[] = [],
    metadata?: Record<string, any>
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.created = created;
    this.isCustom = isCustom;
    this.chats = chats;
    this.tags = tags;
    this.metadata = metadata;
  }

  addChat(chat: Chat): void {
    chat.projectId = this.id;
    if (!this.chats.some(c => c.id === chat.id)) {
      this.chats.push(chat);
    }
  }

  removeChat(chatId: string): boolean {
    const initialLength = this.chats.length;
    this.chats = this.chats.filter(c => c.id !== chatId);
    return this.chats.length !== initialLength;
  }

  updateMetadata(metadata: Record<string, any>): void {
    this.metadata = { ...this.metadata, ...metadata };
  }

  serialize(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      created: this.created.toISOString(),
      isCustom: this.isCustom,
      chats: this.chats.map(c => 
        c instanceof ChatImpl ? c.serialize() : c
      ),
      tags: this.tags,
      metadata: this.metadata
    };
  }

  static deserialize(data: Record<string, any>): ProjectImpl {
    return new ProjectImpl(
      data.id,
      data.name,
      data.description,
      new Date(data.created),
      data.isCustom,
      Array.isArray(data.chats) ? data.chats : [],
      Array.isArray(data.tags) ? data.tags : [],
      data.metadata
    );
  }
} 