import * as vscode from 'vscode';
import { Chat } from '../models/chat';
import { Dialogue } from '../models/dialogue';
import { ProjectOrganizer } from '../services/projectOrganizer';
import { TagManager } from '../services/tagManager';

export class ChatView {
  private panel: vscode.WebviewPanel | undefined;
  private projectOrganizer: ProjectOrganizer;
  private tagManager: TagManager;
  private currentChat: Chat | undefined;
  private disposables: vscode.Disposable[] = [];
  
  constructor(private context: vscode.ExtensionContext) {
    this.projectOrganizer = ProjectOrganizer.getInstance();
    this.tagManager = TagManager.getInstance();
  }
  
  public async openChat(chatId: string, projectId: string): Promise<void> {
    console.log(`ChatView: openChat called with chatId=${chatId}, projectId=${projectId}`);
    
    const project = this.projectOrganizer.getProject(projectId);
    if (!project) {
      console.error(`ChatView: Project not found: ${projectId}`);
      vscode.window.showErrorMessage('Project not found');
      return;
    }
    
    const chat = project.chats.find(c => c.id === chatId);
    if (!chat) {
      console.error(`ChatView: Chat not found: ${chatId} in project ${projectId}`);
      vscode.window.showErrorMessage('Chat not found');
      return;
    }
    
    console.log(`ChatView: Found chat "${chat.title}" with ${chat.dialogues.length} dialogues`);
    this.currentChat = chat;
    
    // If we already have a panel, show it
    if (this.panel) {
      console.log(`ChatView: Revealing existing panel`);
      this.panel.reveal(vscode.ViewColumn.One);
      await this.updateContent(chat);
      return;
    }
    
    // Otherwise, create a new panel
    console.log(`ChatView: Creating new webview panel`);
    this.panel = vscode.window.createWebviewPanel(
      'cursor-chat-manager.chatView',
      `Chat: ${chat.title}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'resources')
        ]
      }
    );
    
    // Set icon
    this.panel.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      'resources',
      'icons',
      'cursor-chat.svg'
    );
    
    // Handle disposal
    this.panel.onDidDispose(() => {
      console.log(`ChatView: Panel disposed`);
      this.panel = undefined;
      this.disposeWebviewResources();
    }, null, this.disposables);
    
    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      this.handleMessage.bind(this),
      null,
      this.disposables
    );
    
    // Load initial content
    console.log(`ChatView: Loading initial content`);
    await this.updateContent(chat);
    console.log(`ChatView: Initial content loaded`);
  }
  
  private async updateContent(chat: Chat): Promise<void> {
    if (!this.panel) { 
      console.error(`ChatView: updateContent called but panel is undefined`);
      return; 
    }
    
    console.log(`ChatView: updateContent called for chat "${chat.title}" with ${chat.dialogues.length} dialogues`);
    
    // Get chat tags
    const chatTags = this.tagManager.getChatTags(chat.id);
    console.log(`ChatView: Found ${chatTags.length} chat tags`);
    
    // Generate the HTML content
    console.log(`ChatView: Generating HTML content...`);
    const htmlContent = this.generateHtmlContent(chat, chatTags);
    console.log(`ChatView: Generated HTML content (${htmlContent.length} chars)`);
    
    // Update the webview content
    this.panel.webview.html = htmlContent;
    console.log(`ChatView: Webview HTML content set`);
    
    // Update panel title
    this.panel.title = `Chat: ${chat.title}`;
    console.log(`ChatView: Panel title updated to "${this.panel.title}"`);
  }
  
  private generateHtmlContent(chat: Chat, chatTags: string[]): string {
    console.log(`ChatView: generateHtmlContent for chat with ${chat.dialogues.length} dialogues`);
    
    // Get CSS URI
    const styleUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'chat-view.css')
    );
    
    // Generate dialogue HTML
    const dialoguesHtml = chat.dialogues.map((dialogue, index) => {
      console.log(`ChatView: Processing dialogue ${index}: isUser=${dialogue.isUser}, content length=${dialogue.content.length}`);
      const dialogueTags = this.tagManager.getDialogueTags(dialogue.id);
      const html = this.generateDialogueHtml(dialogue, dialogueTags);
      console.log(`ChatView: Generated dialogue HTML (${html.length} chars)`);
      return html;
    }).join('');
    
    console.log(`ChatView: Generated dialogues HTML: ${dialoguesHtml.length} chars total`);
    if (dialoguesHtml.length === 0) {
      console.warn(`ChatView: No dialogue HTML generated!`);
    }
    
    // Add fallback content if no dialogues
    const contentToDisplay = dialoguesHtml.length > 0 ? dialoguesHtml : 
      '<div class="no-dialogues"><p><strong>No messages found in this chat.</strong></p><p>This might indicate that the chat data was not properly extracted from the Cursor database, or the validation rules are too strict.</p></div>';

    // Format date
    const formattedDate = chat.timestamp.toLocaleString();
    
    // Generate chat tags HTML
    const chatTagsHtml = chatTags.length > 0 
      ? `<div class="chat-tags">Tags: ${chatTags.map(tag => `<span class="tag">#${tag}</span>`).join(' ')}</div>`
      : '<div class="chat-tags">No tags</div>';
    
    console.log(`ChatView: Final content preparation - chat tags: ${chatTagsHtml.length} chars, content: ${contentToDisplay.length} chars`);

    return /*html*/`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chat: ${chat.title}</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            padding: 10px;
            max-width: 900px;
            margin: 0 auto;
          }
          
          .chat-header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          
          .chat-title {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .chat-date {
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 5px;
          }
          
          .chat-tags {
            margin-bottom: 10px;
          }
          
          .tag {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 0.85em;
            margin-right: 5px;
          }

          .no-dialogues {
            padding: 20px;
            background-color: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
          }
          
          .dialog-container {
            margin-bottom: 15px;
          }
          
          .user-message, .ai-message {
            padding: 10px 15px;
            margin-bottom: 5px;
            border-radius: 5px;
          }
          
          .user-message {
            background-color: var(--vscode-panel-background);
            border-left: 3px solid var(--vscode-activityBarBadge-background);
          }
          
          .ai-message {
            background-color: var(--vscode-panel-background);
            border-left: 3px solid var(--vscode-terminal-ansiCyan);
          }
          
          .message-sender {
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .message-content {
            white-space: pre-wrap;
            line-height: 1.5;
          }
          
          .message-tags {
            margin-top: 5px;
            font-size: 0.85em;
          }
          
          .action-bar {
            display: flex;
            margin-top: 5px;
            gap: 5px;
          }
          
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 0.85em;
          }
          
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          
          code {
            font-family: var(--vscode-editor-font-family);
            background-color: var(--vscode-textBlockQuote-background);
            padding: 2px 5px;
            border-radius: 3px;
          }
          
          pre {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
            margin: 10px 0;
          }
          
          .footer {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid var(--vscode-panel-border);
          }
        </style>
      </head>
      <body>
        <div class="chat-header">
          <div class="chat-title">${chat.title}</div>
          <div class="chat-date">${formattedDate}</div>
          ${chatTagsHtml}
          <div class="action-bar">
            <button class="add-tag-btn" data-id="${chat.id}">Add Tag</button>
            <button class="move-btn" data-id="${chat.id}">Move to Project</button>
            <button class="export-btn" data-id="${chat.id}">Export Chat</button>
          </div>
        </div>
        
        <div class="chat-content">
          ${contentToDisplay}
        </div>
        
        <div class="footer">
          <button class="refresh-btn">Refresh</button>
        </div>
        
        <script>
          (function() {
            const vscode = acquireVsCodeApi();
            
            // Add event listeners to buttons
            document.addEventListener('DOMContentLoaded', function() {
              // Chat-level actions
              document.querySelector('.add-tag-btn').addEventListener('click', function() {
                vscode.postMessage({
                  command: 'addTagToChat',
                  chatId: this.dataset.id
                });
              });
              
              document.querySelector('.move-btn').addEventListener('click', function() {
                vscode.postMessage({
                  command: 'moveChat',
                  chatId: this.dataset.id
                });
              });
              
              document.querySelector('.export-btn').addEventListener('click', function() {
                vscode.postMessage({
                  command: 'exportChat',
                  chatId: this.dataset.id
                });
              });
              
              document.querySelector('.refresh-btn').addEventListener('click', function() {
                vscode.postMessage({
                  command: 'refreshChat'
                });
              });
              
              // Add listeners for dialogue actions
              document.querySelectorAll('.add-dialogue-tag-btn').forEach(button => {
                button.addEventListener('click', function() {
                  vscode.postMessage({
                    command: 'addTagToDialogue',
                    dialogueId: this.dataset.id
                  });
                });
              });
              
              document.querySelectorAll('.copy-btn').forEach(button => {
                button.addEventListener('click', function() {
                  vscode.postMessage({
                    command: 'copyDialogue',
                    dialogueId: this.dataset.id
                  });
                });
              });
              
              document.querySelectorAll('.extract-btn').forEach(button => {
                button.addEventListener('click', function() {
                  vscode.postMessage({
                    command: 'extractDialogue',
                    dialogueId: this.dataset.id
                  });
                });
              });
              
              document.querySelectorAll('.save-rule-btn').forEach(button => {
                button.addEventListener('click', function() {
                  vscode.postMessage({
                    command: 'saveRule',
                    dialogueId: this.dataset.id
                  });
                });
              });
            });
          })();
        </script>
      </body>
      </html>
    `;
  }
  
  private generateDialogueHtml(dialogue: Dialogue, dialogueTags: string[]): string {
    // Process message content for code blocks
    const processedContent = this.processCodeBlocks(dialogue.content);
    
    // Generate dialogue tags HTML
    const dialogueTagsHtml = dialogueTags.length > 0 
      ? `<div class="message-tags">Tags: ${dialogueTags.map(tag => `<span class="tag">#${tag}</span>`).join(' ')}</div>`
      : '';
    
    // Format timestamp if available
    const timestampHtml = dialogue.timestamp 
      ? `<span class="message-time">${dialogue.timestamp.toLocaleTimeString()}</span>`
      : '';
    
    return /*html*/`
      <div class="dialog-container">
        <div class="${dialogue.isUser ? 'user-message' : 'ai-message'}">
          <div class="message-sender">
            ${dialogue.isUser ? 'User' : 'AI'} ${timestampHtml}
          </div>
          <div class="message-content">${processedContent}</div>
          ${dialogueTagsHtml}
          <div class="action-bar">
            <button class="add-dialogue-tag-btn" data-id="${dialogue.id}">Add Tag</button>
            <button class="copy-btn" data-id="${dialogue.id}">Copy</button>
            <button class="extract-btn" data-id="${dialogue.id}">Extract</button>
            ${!dialogue.isUser ? `<button class="save-rule-btn" data-id="${dialogue.id}">Save as Rule</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }
  
  private processCodeBlocks(content: string): string {
    // Convert markdown-style code blocks to HTML
    let processed = content;
    
    // Replace code blocks ```language ... ``` with <pre><code>...</code></pre>
    processed = processed.replace(/```(\w*)\n([\s\S]*?)\n```/g, (_, language, code) => {
      return `<pre><code class="language-${language}">${this.escapeHtml(code)}</code></pre>`;
    });
    
    // Replace inline code `...` with <code>...</code>
    processed = processed.replace(/`([^`]+)`/g, (_, code) => {
      return `<code>${this.escapeHtml(code)}</code>`;
    });
    
    // Convert URLs to links
    processed = processed.replace(
      /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, 
      '<a href="$1" target="_blank">$1</a>'
    );
    
    // Convert newlines to <br>
    processed = processed.replace(/\n/g, '<br>');
    
    return processed;
  }
  
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  private async handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'refreshChat':
        if (this.currentChat) {
          await this.updateContent(this.currentChat);
        }
        break;
        
      case 'addTagToChat':
        await this.handleAddTagToChat(message.chatId);
        break;
        
      case 'moveChat':
        this.handleMoveChat(message.chatId);
        break;
        
      case 'exportChat':
        this.handleExportChat(message.chatId);
        break;
        
      case 'addTagToDialogue':
        await this.handleAddTagToDialogue(message.dialogueId);
        break;
        
      case 'copyDialogue':
        await this.handleCopyDialogue(message.dialogueId);
        break;
        
      case 'extractDialogue':
        await this.handleExtractDialogue(message.dialogueId);
        break;
        
      case 'saveRule':
        await this.handleSaveRule(message.dialogueId);
        break;
    }
  }
  
  private async handleAddTagToChat(chatId: string): Promise<void> {
    const chat = this.currentChat;
    if (!chat || chat.id !== chatId) { return; }
    
    const tag = await vscode.window.showInputBox({
      prompt: 'Enter a tag for this chat',
      placeHolder: 'tag-name'
    });
    
    if (!tag) { return; } // User cancelled
    
    const added = await this.tagManager.addTagToChat(chat, tag);
    if (added) {
      vscode.window.showInformationMessage(`Tag '${tag}' added to chat`);
      await this.updateContent(chat);
    } else {
      vscode.window.showErrorMessage(`Failed to add tag '${tag}' to chat`);
    }
  }
  
  private handleMoveChat(chatId: string): void {
    if (!this.currentChat || this.currentChat.id !== chatId) { return; }
    
    // Use the existing command
    vscode.commands.executeCommand(
      'cursor-chat-manager.moveOrCopyChat',
      chatId,
      this.currentChat.projectId
    );
  }
  
  private handleExportChat(chatId: string): void {
    if (!this.currentChat || this.currentChat.id !== chatId) { return; }
    
    // Use the existing command
    vscode.commands.executeCommand(
      'cursor-chat-manager.exportChats',
      [chatId]
    );
  }
  
  private async handleAddTagToDialogue(dialogueId: string): Promise<void> {
    if (!this.currentChat) { return; }
    
    const dialogue = this.currentChat.dialogues.find(d => d.id === dialogueId);
    if (!dialogue) { return; }
    
    const tag = await vscode.window.showInputBox({
      prompt: 'Enter a tag for this dialogue',
      placeHolder: 'tag-name'
    });
    
    if (!tag) { return; } // User cancelled
    
    const added = await this.tagManager.addTagToDialogue(dialogue, tag);
    if (added) {
      vscode.window.showInformationMessage(`Tag '${tag}' added to dialogue`);
      await this.updateContent(this.currentChat);
    } else {
      vscode.window.showErrorMessage(`Failed to add tag '${tag}' to dialogue`);
    }
  }
  
  private async handleCopyDialogue(dialogueId: string): Promise<void> {
    if (!this.currentChat) { return; }
    
    const dialogue = this.currentChat.dialogues.find(d => d.id === dialogueId);
    if (!dialogue) { return; }
    
    // Copy to clipboard
    await vscode.env.clipboard.writeText(dialogue.content);
    vscode.window.showInformationMessage('Dialogue content copied to clipboard');
  }
  
  private async handleExtractDialogue(dialogueId: string): Promise<void> {
    if (!this.currentChat) { return; }
    
    const dialogue = this.currentChat.dialogues.find(d => d.id === dialogueId);
    if (!dialogue) { return; }
    
    // Show extract options
    const option = await vscode.window.showQuickPick([
      { label: 'New Chat in Current Project', value: 'new-current' },
      { label: 'New Chat in Custom Project', value: 'new-custom' },
      { label: 'Existing Chat', value: 'existing' }
    ], {
      placeHolder: 'Select extraction target'
    });
    
    if (!option) { return; } // User cancelled
    
    if (option.value === 'new-current') {
      const title = await vscode.window.showInputBox({
        prompt: 'Enter a title for the new chat',
        placeHolder: 'Chat Title',
        value: `Extracted from ${this.currentChat.title}`
      });
      
      if (!title) { return; } // User cancelled
      
      // Extract to new chat in current project
      const projectOrganizer = this.projectOrganizer;
      const newChatId = await projectOrganizer.extractDialogueToNewChat(
        dialogueId,
        this.currentChat.id,
        this.currentChat.projectId,
        title
      );
      
      if (newChatId) {
        vscode.window.showInformationMessage('Dialogue extracted to new chat');
      } else {
        vscode.window.showErrorMessage('Failed to extract dialogue');
      }
    } else {
      vscode.window.showInformationMessage('This extraction option will be implemented in a future update');
    }
  }
  
  private async handleSaveRule(dialogueId: string): Promise<void> {
    if (!this.currentChat) { return; }
    
    const dialogue = this.currentChat.dialogues.find(d => d.id === dialogueId);
    if (!dialogue) { return; }
    
    vscode.window.showInformationMessage('Rule saving will be implemented in a future update');
  }
  
  private disposeWebviewResources(): void {
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
  
  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
    }
    this.disposeWebviewResources();
  }
} 