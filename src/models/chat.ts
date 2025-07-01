import { Dialogue, DialogueImpl } from './dialogue';

export interface Chat {
  id: string;
  title: string;
  timestamp: Date;
  projectId: string;
  dialogues: Dialogue[];
  tags: string[];
  metadata?: Record<string, any>;
}

export class ChatImpl implements Chat {
  id: string;
  title: string;
  timestamp: Date;
  projectId: string;
  dialogues: Dialogue[];
  tags: string[];
  metadata?: Record<string, any>;

  constructor(
    id: string,
    title: string,
    timestamp: Date,
    projectId: string,
    dialogues: Dialogue[] = [],
    tags: string[] = [],
    metadata?: Record<string, any>
  ) {
    this.id = id;
    this.title = title;
    this.timestamp = timestamp;
    this.projectId = projectId;
    this.dialogues = dialogues;
    this.tags = tags;
    this.metadata = metadata;
  }

  addDialogue(dialogue: Dialogue): void {
    dialogue.chatId = this.id;
    this.dialogues.push(dialogue);
  }

  removeDialogue(dialogueId: string): boolean {
    const initialLength = this.dialogues.length;
    this.dialogues = this.dialogues.filter(d => d.id !== dialogueId);
    return this.dialogues.length !== initialLength;
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

  serialize(): Record<string, any> {
    return {
      id: this.id,
      title: this.title,
      timestamp: this.timestamp.toISOString(),
      projectId: this.projectId,
      dialogues: this.dialogues.map(d => 
        d instanceof DialogueImpl ? d.serialize() : d
      ),
      tags: this.tags,
      metadata: this.metadata
    };
  }

  static deserialize(data: Record<string, any>): ChatImpl {
    return new ChatImpl(
      data.id,
      data.title,
      new Date(data.timestamp),
      data.projectId,
      Array.isArray(data.dialogues) ? data.dialogues : [],
      Array.isArray(data.tags) ? data.tags : [],
      data.metadata
    );
  }
} 