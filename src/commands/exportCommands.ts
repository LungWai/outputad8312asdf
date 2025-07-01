import * as vscode from 'vscode';
import * as path from 'path';
import { ExportService, ExportFormat, ExportOptions } from '../services/exportService';
import { ProjectOrganizer } from '../services/projectOrganizer';
import { ExportView } from '../views/exportView';

export function registerExportCommands(context: vscode.ExtensionContext): void {
  // Export chats command
  const exportChatsCommand = vscode.commands.registerCommand(
    'cursor-chat-manager.exportChats',
    async () => {
      // Open the export view
      ExportView.createOrShow(context);
    }
  );

  // Register commands
  context.subscriptions.push(
    exportChatsCommand
  );
} 