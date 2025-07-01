# Data Access Modules

## 1. Data Access Layer Overview

The Data Access Layer is responsible for retrieving data from Cursor IDE's internal storage, handling extension's global storage, and providing database operations for both. This layer ensures proper access to both original Cursor chat data and custom-organized data managed by the extension.

```mermaid
graph LR
    Extension[Extension] --> DataAccess[Data Access Layer]
    DataAccess --> CursorData[cursorDataProvider.ts]
    DataAccess --> Storage[storageManager.ts]
    DataAccess --> DB[databaseService.ts]
    CursorData --> SQLite[Cursor SQLite DB]
    Storage --> VSStorage[VSCode Extension Storage]
    DB --> SQLite
    DB --> VSStorage
    
    classDef module fill:#f9f9f9,stroke:#333,stroke-width:1px
    class CursorData,Storage,DB module
```

## 2. Detailed Module Specifications

### 2.1 cursorDataProvider.ts
- **Purpose**: Retrieve chat data from Cursor IDE's internal storage
- **Functionality**:
  - Access workspaceStorage directory based on OS (Windows, macOS, Linux)
  - Connect to state.vscdb SQLite databases
  - Extract chat data using SQL queries
  - Parse JSON data from database responses
- **Technical Details**:
  - OS-specific paths:
    - Windows: `%APPDATA%\Cursor\User\workspaceStorage`
    - macOS: `~/Library/Application Support/Cursor/User/workspaceStorage`
    - Linux: `~/.config/Cursor/User/workspaceStorage`
  - SQL queries target keys: `aiService.prompts` and `workbench.panel.aichat.view.aichat.chatdata`
- **Data Access Flow**:

```mermaid
sequenceDiagram
    participant Extension as Extension
    participant Provider as cursorDataProvider
    participant Paths as pathUtils
    participant DB as databaseService
    participant Cursor as Cursor Storage

    Extension->>Provider: requestChatData()
    Provider->>Paths: getOSSpecificPath()
    Paths-->>Provider: storageDirectoryPath
    Provider->>Provider: findWorkspaceStorageFolders()
    Provider->>DB: connectToDatabase(dbPath)
    DB->>Cursor: open state.vscdb
    Cursor-->>DB: connection
    DB-->>Provider: dbConnection
    Provider->>DB: executeQuery(chatDataQuery)
    DB-->>Provider: rawChatData
    Provider->>Provider: parseJSONData(rawChatData)
    Provider-->>Extension: structuredChatData
```

### 2.2 storageManager.ts
- **Purpose**: Manage extension's global storage
- **Functionality**:
  - Store custom project organization
  - Maintain global rules repository
  - Persist user tags and categories
  - Save prompt templates
- **Technical Details**:
  - Use VSCode's extension storage API
  - Implement data versioning for future compatibility
  - Handle synchronization across different workspace sessions
- **Storage Operations Flow**:

```mermaid
sequenceDiagram
    participant Extension as Extension
    participant Manager as storageManager
    participant VSCode as VSCode Storage API
    
    Note over Extension,VSCode: Save Operation
    Extension->>Manager: saveData(key, data)
    Manager->>Manager: validateData(data)
    Manager->>Manager: addVersionMetadata(data)
    Manager->>VSCode: update(key, serializedData)
    VSCode-->>Manager: success/failure
    Manager-->>Extension: result

    Note over Extension,VSCode: Retrieve Operation
    Extension->>Manager: getData(key)
    Manager->>VSCode: get(key)
    VSCode-->>Manager: serializedData
    Manager->>Manager: deserialize(data)
    Manager->>Manager: migrateIfNeeded(data)
    Manager-->>Extension: data
```

### 2.3 databaseService.ts
- **Purpose**: Handle SQLite operations
- **Functionality**:
  - Provide an interface to read from SQLite databases
  - Execute SQL queries to extract chat data
  - Handle database connection errors
- **Technical Details**:
  - Use better-sqlite3 or similar library
  - Implement connection pooling for performance
  - Add error handling and retry mechanisms
- **Database Access Flow**:

```mermaid
sequenceDiagram
    participant Client as Client Module
    participant Service as databaseService
    participant DB as SQLite Database
    
    Client->>Service: openConnection(dbPath)
    Service->>DB: connect()
    alt Connection Successful
        DB-->>Service: connection
        Service-->>Client: connection
    else Connection Failed
        DB-->>Service: error
        Service->>Service: retryConnection(maxRetries)
        alt Retry Successful
            Service-->>Client: connection
        else Retry Failed
            Service-->>Client: error
        end
    end
    
    Client->>Service: executeQuery(query, params)
    Service->>DB: run(query, params)
    DB-->>Service: results
    Service-->>Client: processedResults
    
    Client->>Service: closeConnection()
    Service->>DB: disconnect()
    DB-->>Service: success
    Service-->>Client: success
``` 