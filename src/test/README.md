# Testing the Cursor Chat Manager Extension

This directory contains tests for the Cursor Chat Manager VS Code extension. The tests are organized into the following categories:

## Test Structure

- `unit/`: Unit tests for individual components
- `integration/`: Integration tests for component interactions
- `suite/`: Extension-level and UI tests

## Test Helpers

The `testHelper.ts` file provides mock implementations and utilities for testing:

- `MockMemento`: Mock implementation of VS Code Memento storage
- `MockExtensionContext`: Mock implementation of VS Code extension context
- `MockTreeDataProvider`: Mock implementation of TreeDataProvider for testing views
- `createTempSqliteDb`: Utility to create a temporary SQLite database for testing
- `mockFileSystem` and `restoreFileSystem`: Utilities to mock file system operations
- `sampleChatData`: Sample chat data for testing

## Running Tests

The following npm scripts are available for running tests:

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests with coverage reporting
npm run test:coverage
```

## Test Coverage

Test coverage is generated using nyc (Istanbul). After running the coverage script, a report will be available in the `coverage/` directory.

## Writing Tests

### Unit Tests

Unit tests should focus on testing individual components in isolation. Dependencies should be mocked.

Example:
```typescript
import { StorageManager } from '../../data/storageManager';
import { MockExtensionContext } from '../testHelper';

suite('StorageManager Tests', () => {
  let storageManager: StorageManager;
  let mockContext: MockExtensionContext;
  
  setup(() => {
    // Reset singleton and set up test environment
    storageManager = StorageManager.getInstance();
    mockContext = new MockExtensionContext();
    storageManager.initialize(mockContext as any);
  });
  
  test('saveData should store data with correct format', async () => {
    // Test implementation
  });
});
```

### Integration Tests

Integration tests should focus on testing interactions between components.

Example:
```typescript
suite('Chat Processing Pipeline Integration Tests', () => {
  // Setup components
  
  test('Complete chat processing pipeline should work correctly', async () => {
    // Test the entire workflow from data loading to processing
  });
});
```

### UI Tests

UI tests should focus on testing the extension's user interface components.

Example:
```typescript
suite('ProjectView UI Tests', () => {
  // Setup UI components
  
  test('ProjectView should display projects', async () => {
    // Test UI behavior
  });
});
```

## Best Practices

1. **Isolation**: Each test should run in isolation and not depend on the state from other tests.
2. **Mocking**: Dependencies should be mocked to isolate the component being tested.
3. **Setup/Teardown**: Use setup() and teardown() to initialize and clean up test environments.
4. **Assertions**: Use explicit assertions to verify behavior.
5. **Error Handling**: Test both success and error cases.
6. **Coverage**: Aim for high test coverage, especially for critical components.
7. **VS Code API**: Use the VS Code testing API to test extension-specific functionality. 