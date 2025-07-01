# Operational Workflows

This document provides detailed operational flows for the key user workflows in the Cursor Chat Manager extension, illustrating how different components interact and how the user experience unfolds for various tasks.

## 1. Chat Data Extraction and Processing Flow

This workflow shows how the extension extracts and processes chat data from Cursor's internal storage.

```mermaid
sequenceDiagram
    participant User as User
    participant Extension as Extension
    participant DataProvider as cursorDataProvider
    participant DBService as databaseService
    participant ChatProcessor as chatProcessor
    participant Storage as storageManager
    
    User->>Extension: Open Extension
    Extension->>DataProvider: initializeDataProvider()
    DataProvider->>DataProvider: detectOSType()
    DataProvider->>DataProvider: resolveCursorStoragePath()
    
    Extension->>DataProvider: fetchChatData()
    DataProvider->>DBService: connectToDatabase(dbPath)
    DBService-->>DataProvider: connection
    DataProvider->>DBService: executeQuery(chatDataQuery)
    DBService-->>DataProvider: rawChatData
    
    DataProvider-->>Extension: rawChatData
    Extension->>ChatProcessor: processChatData(rawData)
    
    loop For Each Chat
        ChatProcessor->>ChatProcessor: parseChatMetadata()
        ChatProcessor->>ChatProcessor: parseDialogues()
        ChatProcessor->>Storage: storeProcessedChat(chat)
    end
    
    ChatProcessor-->>Extension: processedChats
    Extension-->>User: Display Project/Chat List
```

## 2. Custom Project Organization Flow

This workflow demonstrates how users can organize chats into custom projects.

```mermaid
sequenceDiagram
    participant User as User
    participant ProjectView as projectView
    participant ChatView as chatView
    participant OrganizerPanel as Project Organization Panel
    participant ProjectOrg as projectOrganizer
    participant Storage as storageManager
    
    User->>ProjectView: Browse Projects
    ProjectView-->>User: Display Project List
    User->>ProjectView: Create Custom Project
    ProjectView->>ProjectOrg: createCustomProject(name)
    ProjectOrg->>Storage: storeCustomProject(projectData)
    Storage-->>ProjectOrg: success
    ProjectOrg-->>ProjectView: projectCreated
    ProjectView-->>User: Show New Project
    
    User->>ChatView: Select Chat to Organize
    ChatView-->>User: Display Chat
    User->>ChatView: Select "Move to Project"
    ChatView->>OrganizerPanel: openOrganizer(chatId)
    OrganizerPanel-->>User: Show Organization Panel
    
    User->>OrganizerPanel: Select Target Project
    User->>OrganizerPanel: Choose Copy/Move Mode
    User->>OrganizerPanel: Confirm Action
    OrganizerPanel->>ProjectOrg: organizeChatToProject(chatId, projectId, mode)
    
    alt Copy Mode
        ProjectOrg->>Storage: getChatById(chatId)
        Storage-->>ProjectOrg: chatData
        ProjectOrg->>ProjectOrg: createChatCopy(chatData)
        ProjectOrg->>Storage: addChatToProject(chatCopy, projectId)
    else Move Mode
        ProjectOrg->>Storage: getChatById(chatId)
        Storage-->>ProjectOrg: chatData
        ProjectOrg->>Storage: removeChatFromProject(chatId, sourceProjectId)
        ProjectOrg->>Storage: addChatToProject(chatData, projectId)
    end
    
    Storage-->>ProjectOrg: success
    ProjectOrg-->>OrganizerPanel: organizationComplete
    OrganizerPanel-->>User: Show Success Message
    ProjectView->>Storage: refreshProjectData()
    Storage-->>ProjectView: updatedProjects
    ProjectView-->>User: Update Project View
```

## 3. Dialogue Extraction Flow

This workflow shows how individual dialogue entries can be extracted and organized.

```mermaid
sequenceDiagram
    participant User as User
    participant ChatView as chatView
    participant DialogueView as dialogueView
    participant ExtractDialog as Extract Dialogue Panel
    participant ProjectOrg as projectOrganizer
    participant Storage as storageManager
    
    User->>ChatView: Browse Chat
    ChatView-->>User: Display Chat Messages
    User->>DialogueView: Select Dialogue
    User->>DialogueView: Click "Extract" Button
    DialogueView->>ExtractDialog: openExtractPanel(dialogueId)
    ExtractDialog-->>User: Show Extract Options
    
    User->>ExtractDialog: Select Destination
    User->>ExtractDialog: Add Tags
    User->>ExtractDialog: Click "Extract" Button
    
    alt Extract to New Chat
        ExtractDialog->>ProjectOrg: extractToNewChat(dialogueId, projectId, tags)
        ProjectOrg->>Storage: getDialogueById(dialogueId)
        Storage-->>ProjectOrg: dialogueData
        ProjectOrg->>ProjectOrg: createNewChatFromDialogue(dialogueData)
        ProjectOrg->>Storage: saveNewChat(newChat, projectId)
    else Extract to Existing Chat
        ExtractDialog->>ProjectOrg: extractToExistingChat(dialogueId, chatId, tags)
        ProjectOrg->>Storage: getDialogueById(dialogueId)
        Storage-->>ProjectOrg: dialogueData
        ProjectOrg->>Storage: getChatById(chatId)
        Storage-->>ProjectOrg: chatData
        ProjectOrg->>ProjectOrg: addDialogueToChat(dialogueData, chatData)
        ProjectOrg->>Storage: updateChat(chatData)
    end
    
    Storage-->>ProjectOrg: success
    ProjectOrg-->>ExtractDialog: extractionComplete
    ExtractDialog-->>User: Show Success Message
    ChatView->>Storage: refreshChatData()
    Storage-->>ChatView: updatedChat
    ChatView-->>User: Update Chat View
```

## 4. Tagging System Flow

This workflow illustrates how the two-level tagging system operates.

```mermaid
sequenceDiagram
    participant User as User
    participant ChatView as chatView
    participant DialogueView as dialogueView
    participant TagManager as tagManager
    participant Storage as storageManager
    
    Note over User,Storage: Chat-Level Tagging
    User->>ChatView: Open Chat
    ChatView-->>User: Display Chat
    User->>ChatView: Click "Manage Tags"
    ChatView->>TagManager: getChatTags(chatId)
    TagManager->>Storage: fetchChatTags(chatId)
    Storage-->>TagManager: existingTags
    TagManager-->>ChatView: availableTags
    ChatView-->>User: Show Tag Management Dialog
    
    User->>ChatView: Add New Tag
    ChatView->>TagManager: addTagToChat(chatId, tag)
    TagManager->>TagManager: validateTag(tag)
    TagManager->>Storage: updateChatTags(chatId, tags)
    Storage-->>TagManager: success
    TagManager-->>ChatView: tagAdded
    ChatView-->>User: Update Tag Display
    
    Note over User,Storage: Dialogue-Level Tagging
    User->>DialogueView: Select Dialogue
    User->>DialogueView: Click "Add Tag"
    DialogueView->>TagManager: getDialogueTags(dialogueId)
    TagManager->>Storage: fetchDialogueTags(dialogueId)
    Storage-->>TagManager: existingTags
    TagManager-->>DialogueView: availableTags
    DialogueView-->>User: Show Tag Input
    
    User->>DialogueView: Enter Tag
    DialogueView->>TagManager: addTagToDialogue(dialogueId, tag)
    TagManager->>TagManager: validateTag(tag)
    TagManager->>Storage: updateDialogueTags(dialogueId, tags)
    Storage-->>TagManager: success
    TagManager-->>DialogueView: tagAdded
    DialogueView-->>User: Update Tag Display
    
    Note over User,Storage: Tag Filtering
    User->>ChatView: Filter by Tag
    ChatView->>TagManager: filterByTag(tag)
    TagManager->>Storage: findChatsByTag(tag)
    Storage-->>TagManager: matchingChats
    TagManager-->>ChatView: filteredChats
    ChatView-->>User: Display Filtered Results
```

## 5. Rule Management Flow

This workflow shows how rules are managed and applied across projects.

```mermaid
sequenceDiagram
    participant User as User
    participant RuleView as ruleView
    participant RuleManager as ruleManager
    participant Storage as storageManager
    participant FileSystem as File System
    
    Note over User,FileSystem: Rule Import
    User->>RuleView: Open Rules View
    RuleView-->>User: Display Rules List
    User->>RuleView: Click "Import Rule"
    RuleView->>FileSystem: openFileDialog()
    FileSystem-->>User: File Selection Dialog
    User->>FileSystem: Select .mdc File
    FileSystem-->>RuleView: selectedFilePath
    
    RuleView->>RuleManager: importRule(filePath)
    RuleManager->>FileSystem: readFile(filePath)
    FileSystem-->>RuleManager: fileContent
    RuleManager->>RuleManager: parseMDCContent(content)
    RuleManager->>RuleManager: validateRule(rule)
    RuleManager->>Storage: saveRule(rule, isGlobal)
    Storage-->>RuleManager: success
    RuleManager-->>RuleView: ruleImported
    RuleView-->>User: Show Success Message
    
    Note over User,FileSystem: Rule Application
    User->>RuleView: Select Rule
    RuleView-->>User: Show Rule Details
    User->>RuleView: Click "Apply to Project"
    RuleView-->>User: Show Project Selection Dialog
    User->>RuleView: Select Target Project
    RuleView->>RuleManager: applyRuleToProject(ruleId, projectId)
    
    RuleManager->>Storage: getRule(ruleId)
    Storage-->>RuleManager: ruleData
    RuleManager->>Storage: getProjectPath(projectId)
    Storage-->>RuleManager: projectPath
    RuleManager->>FileSystem: createMDCFile(projectPath, ruleData)
    FileSystem-->>RuleManager: success
    
    RuleManager->>Storage: updateRuleUsage(ruleId, projectId)
    Storage-->>RuleManager: success
    RuleManager-->>RuleView: ruleApplied
    RuleView-->>User: Show Success Message
```

## 6. Prompt Management Flow

This workflow demonstrates how prompt templates are created, managed, and used.

```mermaid
sequenceDiagram
    participant User as User
    participant PromptView as promptView
    participant PromptManager as promptManager
    participant Storage as storageManager
    participant CursorChat as Cursor Chat API
    
    Note over User,CursorChat: Create Prompt
    User->>PromptView: Open Prompts View
    PromptView-->>User: Display Prompts List
    User->>PromptView: Click "New Prompt"
    PromptView-->>User: Show New Prompt Form
    
    User->>PromptView: Enter Title, Category
    User->>PromptView: Write Template with Variables
    User->>PromptView: Add Tags
    User->>PromptView: Click "Save"
    
    PromptView->>PromptManager: createPrompt(promptData)
    PromptManager->>PromptManager: validatePrompt(promptData)
    PromptManager->>PromptManager: extractVariables(template)
    PromptManager->>Storage: savePrompt(promptData)
    Storage-->>PromptManager: success
    PromptManager-->>PromptView: promptCreated
    PromptView-->>User: Show Success Message
    
    Note over User,CursorChat: Use Prompt
    User->>PromptView: Select Existing Prompt
    User->>PromptView: Click "Use in Chat"
    PromptView->>PromptManager: getPrompt(promptId)
    PromptManager->>Storage: retrievePrompt(promptId)
    Storage-->>PromptManager: promptData
    PromptManager-->>PromptView: promptWithVariables
    
    PromptView-->>User: Show Variable Input Form
    User->>PromptView: Fill in Variables
    User->>PromptView: Click "Send to Cursor"
    
    PromptView->>PromptManager: processPrompt(promptId, variables)
    PromptManager->>PromptManager: fillTemplate(template, variables)
    PromptManager->>PromptManager: incrementUsageCount(promptId)
    PromptManager->>Storage: updatePromptUsage(promptId)
    
    PromptManager->>CursorChat: sendToChat(processedPrompt)
    CursorChat-->>User: Open Chat with Prompt
    PromptManager-->>PromptView: promptSent
    PromptView-->>User: Show Success Message
```

## 7. Export Process Flow

This workflow shows how chat export functionality works.

```mermaid
sequenceDiagram
    participant User as User
    participant ChatView as chatView
    participant ExportView as exportView
    participant ExportService as exportService
    participant Storage as storageManager
    participant FileSystem as File System
    
    User->>ChatView: Select Chat(s)
    User->>ChatView: Click "Export"
    ChatView->>ExportView: openExportDialog(selectedChatIds)
    ExportView-->>User: Show Export Options
    
    User->>ExportView: Select Format (JSON, HTML, Text)
    User->>ExportView: Configure Options
    User->>ExportView: Choose Export Location
    User->>ExportView: Click "Export"
    
    ExportView->>ExportService: exportChats(chatIds, format, options)
    ExportService->>Storage: getChatsById(chatIds)
    Storage-->>ExportService: chatsData
    
    alt JSON Format
        ExportService->>ExportService: convertToJSON(chatsData, options)
    else HTML Format
        ExportService->>ExportService: loadHTMLTemplate()
        ExportService->>ExportService: renderHTML(chatsData, template, options)
    else Text Format
        ExportService->>ExportService: convertToText(chatsData, options)
    end
    
    ExportService->>FileSystem: writeToFile(exportPath, formattedData)
    FileSystem-->>ExportService: success
    ExportService-->>ExportView: exportComplete
    ExportView-->>User: Show Success Message
```

## 8. Complete Workflow Integration

This diagram illustrates how all major components of the extension interact to deliver the complete functionality.

```mermaid
graph TB
    User([User])
    UI{UI Layer}
    Services{Business Logic}
    DataAccess{Data Access}
    CursorStorage[(Cursor Storage)]
    ExtStorage[(Extension Storage)]
    FileSystem[(File System)]
    
    User --> UI
    UI --> Services
    Services --> DataAccess
    DataAccess --> CursorStorage
    DataAccess --> ExtStorage
    DataAccess --> FileSystem
    
    subgraph UI Components
        ProjectView[Project View]
        ChatView[Chat View]
        DialogueView[Dialogue View]
        RuleView[Rule View]
        PromptView[Prompt View]
        ExportView[Export View]
    end
    
    subgraph Service Components
        ChatProc[Chat Processor]
        TagMgr[Tag Manager]
        ProjOrg[Project Organizer]
        RuleMgr[Rule Manager]
        PromptMgr[Prompt Manager]
        ExportSvc[Export Service]
    end
    
    subgraph Data Layer
        CursorData[Cursor Data Provider]
        StorageMgr[Storage Manager]
        DBService[Database Service]
    end
    
    UI --> ProjectView
    UI --> ChatView
    UI --> DialogueView
    UI --> RuleView
    UI --> PromptView
    UI --> ExportView
    
    Services --> ChatProc
    Services --> TagMgr
    Services --> ProjOrg
    Services --> RuleMgr
    Services --> PromptMgr
    Services --> ExportSvc
    
    DataAccess --> CursorData
    DataAccess --> StorageMgr
    DataAccess --> DBService
    
    ProjectView --> ProjOrg
    ChatView --> ChatProc
    ChatView --> TagMgr
    DialogueView --> ChatProc
    RuleView --> RuleMgr
    PromptView --> PromptMgr
    ExportView --> ExportSvc
    
    ChatProc --> CursorData
    ProjOrg --> StorageMgr
    TagMgr --> StorageMgr
    RuleMgr --> StorageMgr
    PromptMgr --> StorageMgr
    ExportSvc --> StorageMgr
    
    CursorData --> DBService
    StorageMgr --> DBService
    
    classDef user fill:#d0e0ff,stroke:#333,stroke-width:2px
    classDef ui fill:#ffe0d0,stroke:#333,stroke-width:1px
    classDef service fill:#d0ffe0,stroke:#333,stroke-width:1px
    classDef data fill:#fff0d0,stroke:#333,stroke-width:1px
    classDef storage fill:#f0f0f0,stroke:#333,stroke-width:1px
    
    class User user
    class ProjectView,ChatView,DialogueView,RuleView,PromptView,ExportView ui
    class ChatProc,TagMgr,ProjOrg,RuleMgr,PromptMgr,ExportSvc service
    class CursorData,StorageMgr,DBService data
    class CursorStorage,ExtStorage,FileSystem storage