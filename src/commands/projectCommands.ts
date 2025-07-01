import * as vscode from 'vscode';
import { ProjectView } from '../views/projectView';
import { ProjectOrganizer, OrganizationMode } from '../services/projectOrganizer';
import { TagManager } from '../services/tagManager';
import { v4 as uuidv4 } from 'uuid';
import { ChatProcessor } from '../services/chatProcessor';
import { ChatView } from '../views/chatView';
import { logger } from '../utils/logger';
import { LOG_COMPONENTS } from '../config/constants';

export function registerProjectCommands(
  context: vscode.ExtensionContext, 
  projectView: ProjectView
): void {
  // Refresh chats command
  const refreshChatsCommand = vscode.commands.registerCommand(
    'cursor-chat-manager.refreshChats',
    async () => {
      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Loading Cursor Chat data...',
          cancellable: false
        }, async (progress) => {
          progress.report({ increment: 0 });
          const loadResult = await projectView.loadProjects();
          progress.report({ increment: 100 });

          // Show appropriate message based on what was loaded
          if (loadResult && loadResult.projectCount > 0) {
            vscode.window.showInformationMessage(
              `Cursor Chat data loaded successfully! Found ${loadResult.projectCount} projects with ${loadResult.chatCount} chats.`
            );
          } else {
            vscode.window.showWarningMessage(
              'No Cursor chat data found. Make sure Cursor IDE is installed and you have created some chats.'
            );
          }
        });
      } catch (error) {
        logger.error(LOG_COMPONENTS.EXTENSION, 'Error refreshing chats', error);
        vscode.window.showErrorMessage('Failed to refresh chats. Please try again.');
      }
    }
  );

  // Create custom project command
  const createCustomProjectCommand = vscode.commands.registerCommand(
    'cursor-chat-manager.createCustomProject',
    async () => {
      try {
        const projectOrganizer = ProjectOrganizer.getInstance();
        
        // Prompt for project name
        const projectName = await vscode.window.showInputBox({
          prompt: 'Enter a name for the new custom project',
          placeHolder: 'Project Name',
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return 'Project name cannot be empty';
            }
            return null;
          }
        });
        
        if (!projectName) {
          return; // User cancelled
        }
        
        // Prompt for description
        const description = await vscode.window.showInputBox({
          prompt: 'Enter a description for the project (optional)',
          placeHolder: 'Project Description'
        }) || '';
        
        // Create the project
        await projectOrganizer.createCustomProject(projectName, description);
        
        // Refresh the view
        projectView.refresh();
        
        vscode.window.showInformationMessage(`Project "${projectName}" created successfully!`);
      } catch (error) {
        logger.error(LOG_COMPONENTS.EXTENSION, 'Error creating custom project', error);
        vscode.window.showErrorMessage('Failed to create custom project. Please try again.');
      }
    }
  );

  // Delete custom project command
  const deleteCustomProjectCommand = vscode.commands.registerCommand(
    'cursor-chat-manager.deleteCustomProject',
    async (projectId: string) => {
      try {
        const projectOrganizer = ProjectOrganizer.getInstance();
        const project = projectOrganizer.getProject(projectId);
        
        if (!project) {
          vscode.window.showErrorMessage('Project not found');
          return;
        }
        
        if (!project.isCustom) {
          vscode.window.showErrorMessage('Only custom projects can be deleted');
          return;
        }
        
        // Confirm deletion
        const confirmation = await vscode.window.showWarningMessage(
          `Are you sure you want to delete the project "${project.name}"?`,
          { modal: true },
          'Delete'
        );
        
        if (confirmation !== 'Delete') {
          return; // User cancelled
        }
        
        // Delete the project
        await projectOrganizer.deleteCustomProject(projectId);
        
        // Refresh the view
        projectView.refresh();
        
        vscode.window.showInformationMessage(`Project "${project.name}" deleted successfully!`);
      } catch (error) {
        logger.error(LOG_COMPONENTS.EXTENSION, 'Error deleting custom project', error);
        vscode.window.showErrorMessage('Failed to delete custom project. Please try again.');
      }
    }
  );

  // Rename custom project command
  const renameCustomProjectCommand = vscode.commands.registerCommand(
    'cursor-chat-manager.renameCustomProject',
    async (projectId: string) => {
      try {
        const projectOrganizer = ProjectOrganizer.getInstance();
        const project = projectOrganizer.getProject(projectId);
        
        if (!project) {
          vscode.window.showErrorMessage('Project not found');
          return;
        }
        
        if (!project.isCustom) {
          vscode.window.showErrorMessage('Only custom projects can be renamed');
          return;
        }
        
        // Prompt for new name
        const newName = await vscode.window.showInputBox({
          prompt: 'Enter a new name for the project',
          placeHolder: 'Project Name',
          value: project.name,
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return 'Project name cannot be empty';
            }
            return null;
          }
        });
        
        if (!newName) {
          return; // User cancelled
        }
        
        // Update the project
        await projectOrganizer.updateProject(projectId, { name: newName });
        
        // Refresh the view
        projectView.refresh();
        
        vscode.window.showInformationMessage(`Project renamed to "${newName}" successfully!`);
      } catch (error) {
        logger.error(LOG_COMPONENTS.EXTENSION, 'Error renaming custom project', error);
        vscode.window.showErrorMessage('Failed to rename custom project. Please try again.');
      }
    }
  );

  // Open project command (placeholder)
  const openProjectCommand = vscode.commands.registerCommand(
    'cursor-chat-manager.openProject',
    async (projectId: string) => {
      // Nothing to do here, just for expanding the tree
    }
  );

  // Open chat command
  const openChatCommand = vscode.commands.registerCommand(
    'cursor-chat-manager.openChat',
    async (chatId: string, projectId: string) => {
      try {
        logger.info(LOG_COMPONENTS.EXTENSION, `Opening chat: ${chatId} from project: ${projectId}`);
        
        const projectOrganizer = ProjectOrganizer.getInstance();
        const project = projectOrganizer.getProject(projectId);
        
        if (!project) {
          logger.error(LOG_COMPONENTS.EXTENSION, `Project not found: ${projectId}`);
          vscode.window.showErrorMessage('Project not found');
          return;
        }
        
        const chat = project.chats.find(c => c.id === chatId);
        if (!chat) {
          logger.error(LOG_COMPONENTS.EXTENSION, `Chat not found: ${chatId} in project ${projectId}`);
          vscode.window.showErrorMessage('Chat not found');
          return;
        }

        logger.info(LOG_COMPONENTS.EXTENSION, `Found chat: "${chat.title}" with ${chat.dialogues.length} dialogues`);
        
        // Debug: Log first few dialogues
        if (chat.dialogues.length > 0) {
          chat.dialogues.slice(0, 3).forEach((dialogue, index) => {
            logger.debug(LOG_COMPONENTS.EXTENSION, `Dialogue ${index}: isUser=${dialogue.isUser}, content="${dialogue.content.substring(0, 100)}..."`);
          });
        } else {
          logger.warn(LOG_COMPONENTS.EXTENSION, `Chat "${chat.title}" has no dialogues!`);
        }
        
        // Create and open ChatView
        logger.debug(LOG_COMPONENTS.EXTENSION, 'Creating ChatView...');
        const chatView = new ChatView(context);
        
        logger.debug(LOG_COMPONENTS.EXTENSION, 'Opening chat view...');
        await chatView.openChat(chatId, projectId);
        
        logger.info(LOG_COMPONENTS.EXTENSION, `Chat view opened successfully for: "${chat.title}"`);
      } catch (error) {
        logger.error(LOG_COMPONENTS.EXTENSION, 'Error opening chat', error);
        vscode.window.showErrorMessage(`Failed to open chat: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // Move/copy chat to project command
  const moveOrCopyChatCommand = vscode.commands.registerCommand(
    'cursor-chat-manager.moveOrCopyChat',
    async (chatId: string, sourceProjectId: string) => {
      try {
        const projectOrganizer = ProjectOrganizer.getInstance();
        const sourceProject = projectOrganizer.getProject(sourceProjectId);
        
        if (!sourceProject) {
          vscode.window.showErrorMessage('Source project not found');
          return;
        }
        
        const chat = sourceProject.chats.find(c => c.id === chatId);
        if (!chat) {
          vscode.window.showErrorMessage('Chat not found');
          return;
        }
        
        // Get all projects for selection
        const allProjects = projectOrganizer.getAllProjects()
          .filter(p => p.id !== sourceProjectId); // Exclude source project
        
        if (allProjects.length === 0) {
          vscode.window.showErrorMessage('No target projects available');
          return;
        }
        
        // Show project selection
        const projectItems = allProjects.map(p => ({
          label: p.name,
          description: p.isCustom ? 'Custom Project' : 'Original Project',
          id: p.id
        }));
        
        const selectedProject = await vscode.window.showQuickPick(projectItems, {
          placeHolder: 'Select target project'
        });
        
        if (!selectedProject) {
          return; // User cancelled
        }
        
        // Ask for copy or move
        const mode = await vscode.window.showQuickPick([
          { label: 'Copy', description: 'Keep in original project', value: OrganizationMode.COPY },
          { label: 'Move', description: 'Remove from original project', value: OrganizationMode.MOVE }
        ], {
          placeHolder: 'Choose operation'
        });
        
        if (!mode) {
          return; // User cancelled
        }
        
        // Execute the operation
        await projectOrganizer.organizeChatToProject(
          chatId,
          sourceProjectId,
          selectedProject.id,
          mode.value
        );
        
        // Refresh the view
        projectView.refresh();
        
        vscode.window.showInformationMessage(
          `Chat ${mode.value === OrganizationMode.COPY ? 'copied to' : 'moved to'} ${selectedProject.label} successfully!`
        );
      } catch (error) {
        logger.error(LOG_COMPONENTS.EXTENSION, 'Error organizing chat', error);
        vscode.window.showErrorMessage('Failed to organize chat. Please try again.');
      }
    }
  );

  // Register all commands
  context.subscriptions.push(
    refreshChatsCommand,
    createCustomProjectCommand,
    deleteCustomProjectCommand,
    renameCustomProjectCommand,
    openProjectCommand,
    openChatCommand,
    moveOrCopyChatCommand
  );

  // Initialize data on activation
  vscode.commands.executeCommand('cursor-chat-manager.refreshChats');
} 