const { ChatProcessor } = require('./out/services/chatProcessor');
const { CursorDataProvider } = require('./out/data/cursorDataProvider');
const { StorageManager } = require('./out/data/storageManager');

async function testRealCursorAccess() {
  console.log('=== TESTING REAL CURSOR DATABASE ACCESS ===');
  
  try {
    // Initialize storage manager to fix the "not initialized" error
    console.log('\n1. INITIALIZING STORAGE MANAGER...');
    const mockContext = {
      workspaceState: new Map(),
      globalState: new Map(),
      subscriptions: []
    };
    
    const storageManager = StorageManager.getInstance();
    storageManager.initialize(mockContext);
    console.log('✅ Storage manager initialized');
    
    // Test database discovery 
    console.log('\n2. TESTING DATABASE DISCOVERY...');
    const dataProvider = CursorDataProvider.getInstance();
    
    // Clear cache to force fresh discovery
    dataProvider.clearCache();
    
    // Get workspace folders with corrected logic
    const workspaceFolders = await dataProvider.findWorkspaceStorageFolders();
    console.log(`Found ${workspaceFolders.length} workspace folders`);
    
    // Verify paths are Cursor, not VS Code
    let cursorPaths = 0;
    let vscodePaths = 0;
    
    workspaceFolders.forEach((folder, index) => {
      console.log(`  ${index + 1}. ${folder}`);
      
      if (folder.toLowerCase().includes('cursor')) {
        cursorPaths++;
      } else if (folder.toLowerCase().includes('code') && !folder.toLowerCase().includes('cursor')) {
        vscodePaths++;
        console.log(`    ⚠️  WARNING: This looks like VS Code, not Cursor!`);
      }
    });
    
    console.log(`\nPath Analysis: ${cursorPaths} Cursor paths, ${vscodePaths} VS Code paths`);
    
    if (vscodePaths > 0) {
      console.log('❌ ISSUE: Still finding VS Code paths - database discovery needs more fixes');
    } else if (cursorPaths > 0) {
      console.log('✅ SUCCESS: Found Cursor paths only');
    } else {
      console.log('⚠️  WARNING: No Cursor or VS Code paths found - may need to install/use Cursor first');
    }
    
    // Test raw data extraction from corrected databases
    console.log('\n3. TESTING RAW DATA EXTRACTION...');
    const rawData = await dataProvider.getChatData();
    console.log(`Raw data items: ${rawData.length}`);
    
    if (rawData.length > 0) {
      // Show sample to verify it's actually Cursor data
      console.log('\n--- SAMPLE RAW DATA (First 3 items) ---');
      rawData.slice(0, 3).forEach((item, index) => {
        console.log(`\nSample ${index + 1}:`);
        console.log(`  Source: ${item.source}`);
        console.log(`  Workspace: ${item.workspace}`);
        console.log(`  Database: ${item.databasePath ? item.databasePath.substring(item.databasePath.length - 50) : 'N/A'}`);
        
        // Check if the database path contains "Cursor"
        if (item.databasePath && item.databasePath.toLowerCase().includes('cursor')) {
          console.log(`  ✅ Database path contains 'Cursor' - looks correct`);
        } else if (item.databasePath && item.databasePath.toLowerCase().includes('code')) {
          console.log(`  ❌ Database path contains 'Code' - still using VS Code databases!`);
        }
        
        // Quick check for chat-like content
        if (item.data) {
          if (Array.isArray(item.data)) {
            console.log(`  Data: Array with ${item.data.length} items`);
          } else if (typeof item.data === 'object') {
            const keys = Object.keys(item.data);
            console.log(`  Data: Object with keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
          }
        }
      });
    }
    
    // Test ChatProcessor with corrected data
    console.log('\n4. TESTING CHATPROCESSOR...');
    const chatProcessor = ChatProcessor.getInstance();
    
    try {
      const { projects, chats } = await chatProcessor.loadProcessedData();
      console.log(`Processed results: ${projects.length} projects, ${chats.length} chats`);
      
      if (projects.length > 0) {
        console.log('✅ SUCCESS: Projects found!');
        projects.slice(0, 3).forEach((project, index) => {
          console.log(`  Project ${index + 1}: "${project.name}" (${project.chats.length} chats)`);
        });
      } else {
        console.log('⚠️  No projects processed - may need to adjust validation rules');
      }
      
    } catch (processingError) {
      console.log(`ChatProcessor error: ${processingError.message}`);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
  
  console.log('\n=== TEST COMPLETED ===');
}

testRealCursorAccess(); 