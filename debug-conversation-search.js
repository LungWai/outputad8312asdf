const { DatabaseService } = require('./out/data/databaseService');
const { CursorDataProvider } = require('./out/data/cursorDataProvider');
const path = require('path');
const fs = require('fs');

async function findConversationData() {
  console.log('=== SEARCHING FOR REAL CURSOR CONVERSATION DATA ===');
  
  try {
    const dataProvider = CursorDataProvider.getInstance();
    const workspaceFolders = await dataProvider.findWorkspaceStorageFolders();
    
    if (workspaceFolders.length === 0) {
      console.log('No workspace folders found!');
      return;
    }
    
    // Take a few databases with meaningful sizes for analysis
    const largeDatabases = workspaceFolders
      .map(folder => {
        const dbPath = path.join(folder, 'state.vscdb');
        const size = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
        return { folder, dbPath, size };
      })
      .filter(db => db.size > 50000) // Focus on larger databases likely to contain conversations
      .sort((a, b) => b.size - a.size)
      .slice(0, 5); // Top 5 largest databases
    
    console.log(`\nAnalyzing ${largeDatabases.length} largest databases for conversation data...`);
    
    const databaseService = new DatabaseService();
    
    for (const db of largeDatabases) {
      console.log(`\n=== ANALYZING DATABASE ===`);
      console.log(`Path: ${db.dbPath}`);
      console.log(`Size: ${(db.size / 1024).toFixed(1)} KB`);
      
      try {
        await databaseService.openConnection(db.dbPath);
        
        // Search for ALL keys to understand the database structure
        console.log('\n--- SEARCHING ALL KEYS ---');
        const allKeysQuery = `SELECT DISTINCT key FROM ItemTable ORDER BY key`;
        
        try {
          const allKeys = await databaseService.executeQuery(allKeysQuery);
          console.log(`Found ${allKeys.length} unique keys in database`);
          
          // Filter for keys that might contain conversations
          const conversationKeys = allKeys.filter(row => {
            const key = row.key.toLowerCase();
            return key.includes('chat') || 
                   key.includes('conversation') || 
                   key.includes('message') || 
                   key.includes('dialogue') || 
                   key.includes('assistant') ||
                   key.includes('prompt') ||
                   key.includes('composer') ||
                   key.includes('ai') ||
                   key.includes('cursor');
          });
          
          console.log(`\nConversation-related keys (${conversationKeys.length}):`);
          conversationKeys.slice(0, 20).forEach((row, index) => {
            console.log(`  ${index + 1}. ${row.key}`);
          });
          
          // Analyze the most promising keys
          console.log(`\n--- ANALYZING PROMISING KEYS ---`);
          for (const keyRow of conversationKeys.slice(0, 10)) {
            const key = keyRow.key;
            
            try {
              const dataQuery = `SELECT value FROM ItemTable WHERE key = ?`;
              const results = await databaseService.executeQuery(dataQuery, [key]);
              
              if (results.length > 0) {
                const value = results[0].value;
                console.log(`\nKey: ${key}`);
                console.log(`Value length: ${value ? value.length : 0}`);
                
                if (value && value.length > 10) {
                  try {
                    const parsed = JSON.parse(value);
                    console.log(`Data type: ${typeof parsed} (${Array.isArray(parsed) ? 'array' : 'object'})`);
                    
                    if (Array.isArray(parsed)) {
                      console.log(`Array length: ${parsed.length}`);
                      if (parsed.length > 0 && parsed[0]) {
                        const firstItem = parsed[0];
                        if (typeof firstItem === 'object') {
                          const keys = Object.keys(firstItem);
                          console.log(`First item keys: ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? '...' : ''}`);
                          
                          // Look for message-like content
                          const messageFields = ['content', 'text', 'message', 'prompt', 'response'];
                          for (const field of messageFields) {
                            if (firstItem[field] && typeof firstItem[field] === 'string' && firstItem[field].length > 20) {
                              console.log(`*** POTENTIAL CONVERSATION CONTENT FOUND ***`);
                              console.log(`Field: ${field}`);
                              console.log(`Content preview: "${firstItem[field].substring(0, 150)}..."`);
                              
                              // Check if it looks like real conversation
                              const content = firstItem[field].toLowerCase();
                              const conversationIndicators = [
                                'help me', 'how do i', 'can you', 'i need', 'please',
                                'error', 'function', 'code', 'fix', 'debug',
                                'create', 'make', 'build', 'implement'
                              ];
                              const matches = conversationIndicators.filter(indicator => 
                                content.includes(indicator)
                              );
                              if (matches.length > 0) {
                                console.log(`*** LIKELY REAL CONVERSATION *** (indicators: ${matches.join(', ')})`);
                              }
                            }
                          }
                        }
                      }
                    } else {
                      // Object data
                      const objectKeys = Object.keys(parsed);
                      console.log(`Object keys: ${objectKeys.slice(0, 10).join(', ')}${objectKeys.length > 10 ? '...' : ''}`);
                      
                      // Check for conversation arrays within the object
                      const conversationArrays = ['messages', 'conversations', 'chats', 'history', 'entries'];
                      for (const arrayKey of conversationArrays) {
                        if (parsed[arrayKey] && Array.isArray(parsed[arrayKey]) && parsed[arrayKey].length > 0) {
                          console.log(`*** FOUND CONVERSATION ARRAY: ${arrayKey} (${parsed[arrayKey].length} items) ***`);
                          const firstMsg = parsed[arrayKey][0];
                          if (firstMsg && typeof firstMsg === 'object') {
                            console.log(`First message keys: ${Object.keys(firstMsg).join(', ')}`);
                            if (firstMsg.content || firstMsg.text || firstMsg.message) {
                              const content = firstMsg.content || firstMsg.text || firstMsg.message;
                              console.log(`Message content: "${content.substring(0, 100)}..."`);
                            }
                          }
                        }
                      }
                    }
                  } catch (parseError) {
                    console.log(`JSON parse failed: ${parseError.message}`);
                    // Show raw content preview for non-JSON data
                    console.log(`Raw preview: "${value.substring(0, 100)}..."`);
                  }
                }
              }
            } catch (queryError) {
              console.log(`Failed to query key ${key}: ${queryError.message}`);
            }
          }
          
        } catch (fallbackError) {
          console.log('Standard query failed, attempting fallback...');
          // Use fallback method to extract patterns
          console.log('Searching for conversation patterns in binary data...');
          
          const conversationPatterns = [
            'role":"user"',
            'role":"assistant"', 
            '"content":"',
            '"message":"',
            '"messages":[',
            'conversations',
            'chat_history'
          ];
          
          for (const pattern of conversationPatterns) {
            try {
              const patternQuery = `SELECT * FROM ItemTable WHERE value LIKE '%${pattern}%'`;
              const results = await databaseService.executeQuery(patternQuery);
              if (results.length > 0) {
                console.log(`*** FOUND PATTERN "${pattern}" in ${results.length} entries ***`);
                // Analyze first match
                const firstMatch = results[0];
                console.log(`Key: ${firstMatch.key}`);
                console.log(`Value preview: "${firstMatch.value.substring(0, 200)}..."`);
              }
            } catch (patternError) {
              // Pattern search failed - expected for fallback mode
            }
          }
        }
        
        await databaseService.closeConnection();
        
      } catch (dbError) {
        console.error(`Error analyzing database ${db.dbPath}: ${dbError.message}`);
      }
    }
    
  } catch (error) {
    console.error('Error in conversation search:', error);
  }
  
  console.log('\n=== CONVERSATION SEARCH COMPLETE ===');
}

findConversationData(); 