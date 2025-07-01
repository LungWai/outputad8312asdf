/**
 * Application-wide constants
 */

export const APP_CONSTANTS = {
  // Extension
  EXTENSION_ID: 'cursor-chat-manager',
  EXTENSION_NAME: 'Cursor Chat Manager',
  
  // Database
  DB_FILE_NAME: 'state.vscdb',
  DB_TIMEOUT: 10000,
  DB_MAX_RETRIES: 3,
  
  // File limits
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_EXPORT_SIZE: 100 * 1024 * 1024, // 100MB
  
  // UI
  TREE_VIEW_ID: 'cursorChatManager.projectView',
  WEBVIEW_TYPE: 'cursorChatManager.chatView',
  
  // Performance
  BATCH_SIZE: 100,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  DEBOUNCE_DELAY: 300, // 300ms
  
  // Patterns
  HASH_FOLDER_PATTERN: /^[a-f0-9]{32}$/,
  WORKSPACE_HASH_PATTERN: /^[a-f0-9]{8,}$/,
  
  // Default values
  DEFAULT_PROJECT_NAME: 'Unknown Project',
  DEFAULT_CHAT_TITLE: 'Untitled Chat',
  DEFAULT_EXPORT_FORMAT: 'json',
  
  // Limits
  MAX_TAGS_PER_ITEM: 10,
  MAX_TAG_LENGTH: 50,
  MAX_PROJECTS: 1000,
  MAX_CHATS_PER_PROJECT: 500,
  MAX_DIALOGUES_PER_CHAT: 1000,
} as const;

export const ERROR_MESSAGES = {
  DATABASE_CONNECTION: 'Failed to connect to database',
  DATABASE_QUERY: 'Database query failed',
  FILE_NOT_FOUND: 'File not found',
  INVALID_DATA: 'Invalid data format',
  EXPORT_FAILED: 'Export operation failed',
  IMPORT_FAILED: 'Import operation failed',
  PERMISSION_DENIED: 'Permission denied',
  NETWORK_ERROR: 'Network request failed',
} as const;

export const LOG_COMPONENTS = {
  EXTENSION: 'Extension',
  DATABASE: 'Database',
  DATA_PROVIDER: 'DataProvider',
  STORAGE_MANAGER: 'StorageManager',
  CHAT_PROCESSOR: 'ChatProcessor',
  TAG_MANAGER: 'TagManager',
  PROJECT_ORGANIZER: 'ProjectOrganizer',
  EXPORT_SERVICE: 'ExportService',
  RULE_MANAGER: 'RuleManager',
  PROMPT_MANAGER: 'PromptManager',
  VIEW_PROJECT: 'ProjectView',
  VIEW_CHAT: 'ChatView',
  VIEW_DIALOGUE: 'DialogueView',
  VIEW_RULE: 'RuleView',
  VIEW_TAG: 'TagView',
  VIEW_PROMPT: 'PromptView',
  VIEW_EXPORT: 'ExportView',
} as const;