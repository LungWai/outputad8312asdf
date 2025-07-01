const { DatabaseService } = require('./out/data/databaseService');
const { CursorDataProvider } = require('./out/data/cursorDataProvider');
const path = require('path');
const fs = require('fs');

async function debugRawData() {
  console.log('=== SEARCHING FOR REAL CHAT DATA ===');
  
  try {
    // Get the CursorDataProvider instance
    const dataProvider = CursorDataProvider.getInstance();
    
    // Get workspace folders
    const folders = await dataProvider.findWorkspaceStorageFolders();
    console.log(`Found ${folders.length} workspace folders:`);
    
    if (folders.length === 0) {
      console.log('No workspace folders found!');
      return;
    }
    
    // Take the first folder for detailed examination
    const folder = folders[0];
    const dbPath = path.join(folder, 'state.vscdb');
    
    console.log(`\n=== EXAMINING DATABASE: ${dbPath} ===`);
    console.log(`Folder name: ${path.basename(folder)}`);
    console.log(`Database exists: ${fs.existsSync(dbPath)}`);
    console.log(`Database size: ${fs.statSync(dbPath).size} bytes`);
    
    // Test database connection
    const dbService = new DatabaseService();
    await dbService.openConnection(dbPath);
    
    // Search for different patterns that might contain chat data
    const chatPatterns = [
      '%chat%',
      '%conversation%',
      '%message%', 
      '%prompt%',
      '%ai%',
      '%cursor%',
      '%dialogue%',
      '%assistant%',
      '%user%'
    ];
    
    console.log(`\n=== SEARCHING FOR CHAT-RELATED KEYS ===`);
    
    for (const pattern of chatPatterns) {
      const query = `SELECT key, length(value) as value_length FROM ItemTable WHERE key LIKE '${pattern}' LIMIT 10`;
      console.log(`\nSearching for pattern: ${pattern}`);
      
      try {
        const results = await dbService.executeQuery(query);
        console.log(`Found ${results.length} keys matching '${pattern}':`);
        
        results.forEach((result, index) => {
          console.log(`  ${index}: key="${result.key}", value_length=${result.value_length}`);
        });
      } catch (error) {
        console.log(`  Error searching for ${pattern}: ${error.message}`);
      }
    }
    
    // Get all keys to understand the database structure
    console.log(`\n=== ALL DATABASE KEYS ===`);
    try {
      const allKeysQuery = `SELECT DISTINCT key FROM ItemTable ORDER BY key`;
      const allKeys = await dbService.executeQuery(allKeysQuery);
      console.log(`Found ${allKeys.length} unique keys in database:`);
      
      allKeys.forEach((result, index) => {
        console.log(`  ${index}: ${result.key}`);
      });
    } catch (error) {
      console.log(`Error getting all keys: ${error.message}`);
    }
    
    // Look for keys that contain actual message/conversation data
    console.log(`\n=== EXAMINING PROMISING KEYS ===`);
    const promisingPatterns = [
      '%aichat%', 
      '%chat%',
      '%conversation%',
      '%messages%'
    ];
    
    for (const pattern of promisingPatterns) {
      console.log(`\n--- Examining pattern: ${pattern} ---`);
      const query = `SELECT * FROM ItemTable WHERE key LIKE '${pattern}' LIMIT 5`;
      
      try {
        const results = await dbService.executeQuery(query);
        console.log(`Found ${results.length} entries for ${pattern}:`);
        
        results.forEach((result, index) => {
          console.log(`\nEntry ${index}:`);
          console.log(`  Key: ${result.key}`);
          console.log(`  Value length: ${result.value ? result.value.length : 'null'}`);
          console.log(`  Raw value preview: ${result.value ? result.value.substring(0, 200) + '...' : 'null'}`);
          
          if (result.value) {
            try {
              const parsed = JSON.parse(result.value);
              console.log(`  Parsed type: ${typeof parsed}`);
              console.log(`  Is array: ${Array.isArray(parsed)}`);
              
              if (Array.isArray(parsed)) {
                console.log(`  Array length: ${parsed.length}`);
                if (parsed.length > 0) {
                  console.log(`  First item keys: ${typeof parsed[0] === 'object' ? Object.keys(parsed[0]).join(', ') : 'N/A'}`);
                  console.log(`  First item: ${JSON.stringify(parsed[0]).substring(0, 150)}...`);
                }
              } else if (typeof parsed === 'object') {
                console.log(`  Object keys: ${Object.keys(parsed).join(', ')}`);
                console.log(`  Object preview: ${JSON.stringify(parsed).substring(0, 200)}...`);
              }
            } catch (parseError) {
              console.log(`  Parse error: ${parseError.message}`);
            }
          }
        });
      } catch (error) {
        console.log(`Error examining ${pattern}: ${error.message}`);
      }
    }
    
    await dbService.closeConnection();
    
  } catch (error) {
    console.error(`Error in debug script: ${error}`);
    console.error(error.stack);
  }
  
  console.log('\n=== DEBUG COMPLETED ===');
}

debugRawData(); 