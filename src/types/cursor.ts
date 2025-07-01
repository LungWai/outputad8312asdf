/**
 * TypeScript interfaces for Cursor chat data types
 */

export interface Prompt {
  text: string;
  commandType?: number;
  createdAt?: number;
}

export interface CursorMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  timestamp?: number;
  sender?: string;
  message?: string;
  text?: string;
  value?: string;
}

export interface ChatData {
  id?: string;
  title?: string;
  messages?: CursorMessage[];
  chunks?: CursorMessage[];
  parts?: CursorMessage[];
  conversation?: CursorMessage[];
  entries?: ChatEntry[];
  conversations?: ChatData[];
  workspaceName?: string;
  projectName?: string;
  folderName?: string;
  name?: string;
  createdAt?: number;
}

export interface ChatEntry {
  id?: string;
  title?: string;
  timestamp?: number;
  conversation?: CursorMessage[];
  messages?: CursorMessage[];
}

export interface WorkspaceData {
  source: string;
  data: ChatData | ChatData[] | Prompt[] | Record<string, Prompt>;
  workspace?: string;
  workspaceRealName?: string;
  databasePath: string;
  folderName: string;
  rowSize: number;
}

export interface NumericKeyObject {
  [key: string]: Prompt;
}

export function isPrompt(obj: any): obj is Prompt {
  return obj && typeof obj === 'object' && typeof obj.text === 'string' && obj.text.trim().length > 0;
}

export function isNumericKeyObject(obj: any): obj is NumericKeyObject {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  return keys.length > 0 && keys.every(k => /^\d+$/.test(k));
}

export function isChatData(obj: any): obj is ChatData {
  if (!obj || typeof obj !== 'object') return false;
  
  // Check for nested chatData structure (rich chat data)
  if (obj.chatData && typeof obj.chatData === 'object') {
    return isChatData(obj.chatData);
  }
  
  return (
    Array.isArray(obj.messages) ||
    Array.isArray(obj.chunks) ||
    Array.isArray(obj.parts) ||
    Array.isArray(obj.conversation) ||
    Array.isArray(obj.entries) ||
    Array.isArray(obj.conversations)
  );
}
