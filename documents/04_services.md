# Business Logic Services

## 1. Services Overview

The services layer implements the core business logic of the extension, providing functionality to process, organize, and manage chats, tags, projects, exports, rules, and prompts. This layer sits between the data access layer and the UI components, orchestrating complex operations and enforcing business rules.

```mermaid
graph TB
    Extension[Extension] --> Services[Business Logic Services]
    Services --> ChatProc[chatProcessor.ts]
    Services --> TagMgr[tagManager.ts]
    Services --> ProjOrg[projectOrganizer.ts]
    Services --> Export[exportService.ts]
    Services --> RuleMgr[ruleManager.ts]
    Services --> PromptMgr[promptManager.ts]
    
    ChatProc --> DataAccess[Data Access Layer]
    TagMgr --> DataAccess
    ProjOrg --> DataAccess
    Export --> DataAccess
    RuleMgr --> DataAccess
    PromptMgr --> DataAccess
    
    UI[UI Layer] --> Services
    
    classDef service fill:#f9f9f9,stroke:#333,stroke-width:1px
    class ChatProc,TagMgr,ProjOrg,Export,RuleMgr,PromptMgr service
```

## 2. Detailed Service Specifications

### 2.1 chatProcessor.ts
- **Purpose**: Process and organize chat data
- **Functionality**:
  - Parse raw chat data from Cursor
  - Convert into structured chat and dialogue models
  - Handle relationships between chats and projects
- **Technical Details**:
  - Implement parsing algorithms for Cursor's chat format
  - Error handling for malformed data
- **Processing Flow**:

```mermaid
sequenceDiagram
    participant Extension as Extension
    participant Processor as chatProcessor
    participant DataProvider as cursorDataProvider
    participant Models as Data Models

    Extension->>Processor: processChatData()
    Processor->>DataProvider: getRawChatData()
    DataProvider-->>Processor: rawData
    
    loop For Each Chat Entry
        Processor->>Processor: parseChatEntry(entry)
        Processor->>Models: createChatModel(parsed)
        
        loop For Each Dialogue in Chat
            Processor->>Models: createDialogueModel(dialogueData)
            Models-->>Processor: dialogue
            Processor->>Models: addDialogueToChat(chat, dialogue)
        end
        
        Models-->>Processor: completedChat
    end
    
    Processor-->>Extension: structuredChats
```

### 2.2 tagManager.ts
- **Purpose**: Handle chat and dialogue-level tags
- **Functionality**:
  - Provide two-level tagging system
  - Implement tag CRUD operations
  - Support filtering and searching by tags
  - Manage tag categories and relationships
- **Technical Details**:
  - Efficient tag storage and retrieval
  - Tag suggestion algorithms
- **Tagging Operations Flow**:

```mermaid
sequenceDiagram
    participant User as User
    participant UI as UI Component
    participant Manager as tagManager
    participant Storage as storageManager
    
    User->>UI: Add Tag Action
    UI->>Manager: addTag(entity, tag)
    
    alt Entity is Chat
        Manager->>Manager: validateTag(tag)
        Manager->>Storage: getChatTags()
        Storage-->>Manager: existingTags
        Manager->>Manager: addToTagList(existingTags, tag)
        Manager->>Storage: updateChatTags(entityId, updatedTags)
    else Entity is Dialogue
        Manager->>Manager: validateTag(tag)
        Manager->>Storage: getDialogueTags()
        Storage-->>Manager: existingTags
        Manager->>Manager: addToTagList(existingTags, tag)
        Manager->>Storage: updateDialogueTags(entityId, updatedTags)
    end
    
    Storage-->>Manager: success
    Manager-->>UI: success
    UI-->>User: Tag Added Confirmation
```

### 2.3 projectOrganizer.ts
- **Purpose**: Manage custom organization of chats
- **Functionality**:
  - Create custom projects
  - Move or copy chats between projects
  - Extract individual dialogues to custom projects
  - Maintain references to original chat sources
- **Technical Details**:
  - Preserve original data integrity
  - Implement efficient reference system
- **Chat Organization Flow**:

```mermaid
sequenceDiagram
    participant User as User
    participant UI as UI Component
    participant Organizer as projectOrganizer
    participant ChatProc as chatProcessor
    participant Storage as storageManager
    
    User->>UI: Move Chat to Custom Project
    UI->>Organizer: moveChatToProject(chatId, projectId)
    Organizer->>Storage: getChat(chatId)
    Storage-->>Organizer: chatData
    Organizer->>Storage: getProject(projectId)
    Storage-->>Organizer: projectData
    
    alt Copy Mode
        Organizer->>Organizer: createChatCopy(chatData)
        Organizer->>Storage: addChatToProject(chatCopy, projectId)
    else Move Mode
        Organizer->>Storage: removeChatFromProject(chatId, originalProjectId)
        Organizer->>Storage: addChatToProject(chatData, projectId)
    end
    
    Storage-->>Organizer: success
    Organizer-->>UI: success
    UI-->>User: Chat Moved/Copied Confirmation
```

### 2.4 exportService.ts
- **Purpose**: Handle export to different formats
- **Functionality**:
  - Export chats to JSON format
  - Generate HTML exports with styling
  - Create plain text exports
  - Support customization options for each format
- **Technical Details**:
  - Templating system for HTML exports
  - JSON schema design
  - Markdown conversion options
- **Export Process Flow**:

```mermaid
sequenceDiagram
    participant User as User
    participant UI as Export View
    participant Service as exportService
    participant Storage as storageManager
    participant FileSystem as File System
    
    User->>UI: Configure Export Options
    UI->>Service: exportChats(options)
    Service->>Storage: getChatsToExport(options.chatIds)
    Storage-->>Service: chatsData
    
    alt Format is JSON
        Service->>Service: convertToJSON(chatsData, options)
    else Format is HTML
        Service->>Service: loadTemplate()
        Service->>Service: renderHTML(chatsData, template, options)
    else Format is Text
        Service->>Service: convertToPlainText(chatsData, options)
    end
    
    Service->>FileSystem: writeToFile(exportPath, formattedData)
    FileSystem-->>Service: success
    Service-->>UI: exportCompleted
    UI-->>User: Export Success Notification
```

### 2.5 ruleManager.ts
- **Purpose**: Store, import, and apply rules
- **Functionality**:
  - Manage global rule repository
  - Import rules from projects
  - Export rules to projects
  - Apply rules across projects
- **Technical Details**:
  - .mdc file parsing and creation
  - Rule application mechanisms
  - Integration with Cursor's rule system
- **Rule Management Flow**:

```mermaid
sequenceDiagram
    participant User as User
    participant UI as Rule View
    participant Manager as ruleManager
    participant Storage as storageManager
    participant FileSystem as File System
    
    Note over User,FileSystem: Rule Import
    User->>UI: Import Rule Action
    UI->>Manager: importRuleFromFile(filePath)
    Manager->>FileSystem: readFile(filePath)
    FileSystem-->>Manager: mdcContent
    Manager->>Manager: parseMDCContent(mdcContent)
    Manager->>Storage: saveRule(parsedRule)
    Storage-->>Manager: success
    Manager-->>UI: importSuccess
    UI-->>User: Rule Imported Notification
    
    Note over User,FileSystem: Rule Application
    User->>UI: Apply Rule Action
    UI->>Manager: applyRuleToProject(ruleId, projectId)
    Manager->>Storage: getRule(ruleId)
    Storage-->>Manager: ruleData
    Manager->>FileSystem: createMDCInProjectFolder(projectId, ruleData)
    FileSystem-->>Manager: success
    Manager-->>UI: applySuccess
    UI-->>User: Rule Applied Notification
```

### 2.6 promptManager.ts
- **Purpose**: Manage saved prompts
- **Functionality**:
  - Store reusable prompt templates
  - Support variable templating
  - Organize prompts by tags and categories
  - Track prompt usage statistics
- **Technical Details**:
  - Template variable parsing and application
  - Integration with Cursor's chat interface
- **Prompt Usage Flow**:

```mermaid
sequenceDiagram
    participant User as User
    participant UI as Prompt View
    participant Manager as promptManager
    participant Storage as storageManager
    participant Cursor as Cursor Chat Interface
    
    User->>UI: Select Prompt
    UI->>Manager: getPromptById(promptId)
    Manager->>Storage: retrievePrompt(promptId)
    Storage-->>Manager: promptData
    Manager-->>UI: promptWithVariables
    
    UI-->>User: Display Variable Input Form
    User->>UI: Fill Variables
    UI->>Manager: fillPrompt(promptId, variableValues)
    Manager->>Manager: processTemplate(promptData, variableValues)
    Manager->>Manager: incrementPromptUsage(promptId)
    Manager-->>UI: filledPromptText
    
    User->>UI: Send to Cursor
    UI->>Cursor: sendToCursorChat(filledPromptText)
    Cursor-->>UI: success
    UI-->>User: Prompt Sent Confirmation
``` 