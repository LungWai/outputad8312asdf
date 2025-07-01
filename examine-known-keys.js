const fs = require('fs');
const path = require('path');
const os = require('os');

// Import our database service
const { DatabaseService } = require('./out/data/databaseService');

async function examineKnownKeys() {
  console.log('=== EXAMINING KNOWN CURSOR STORAGE KEYS ===\n');
  
  // Find Cursor workspace storage
  const cursorStoragePath = path.join(process.env.APPDATA || '', 'Cursor', 'User', 'workspaceStorage');
  
  if (!fs.existsSync(cursorStoragePath)) {
    console.error('Cursor storage not found at:', cursorStoragePath);
    return;
  }
  
  // Get all workspace folders
  const workspaceFolders = fs.readdirSync(cursorStoragePath)
    .filter(folder => {
      const dbPath = path.join(cursorStoragePath, folder, 'state.vscdb');
      return fs.existsSync(dbPath);
    });
  
  console.log(`Found ${workspaceFolders.length} workspace databases\n`);
  
  // Known keys to examine
  const knownKeys = [
    'aiService.prompts',
    'workbench.panel.aichat.view.aichat.chatdata',
    'workbench.panel.aichat',
    'cursorChat.conversations',
    'cursor.chatHistory',
    'composer.sessions',
    'aichat.messages'
  ];
  
  // Track findings
  const findings = {
    terminal: 0,
    chat: 0,
    empty: 0,
    other: 0,
    keys: new Map()
  };
  
  // Examine databases
  let databasesExamined = 0;
  
  for (const folder of workspaceFolders.slice(0, 10)) { // Examine first 10
    const dbPath = path.join(cursorStoragePath, folder, 'state.vscdb');
    const dbSize = fs.statSync(dbPath).size;
    
    if (dbSize < 10000) continue; // Skip small databases
    
    console.log(`\n=== DATABASE: ${folder.substring(0, 16)}... ===`);
    console.log(`Size: ${dbSize} bytes`);
    
    const dbService = new DatabaseService();
    
    try {
      await dbService.openConnection(dbPath);
      databasesExamined++;
      
      for (const key of knownKeys) {
        try {
          const query = `SELECT * FROM ItemTable WHERE key LIKE '%${key}%'`;
          const results = await dbService.executeQuery(query);
          
          if (results.length > 0) {
            console.log(`\n✅ Found key: "${key}"`);
            
            for (const result of results) {
              if (result.value) {
                try {
                  const parsed = JSON.parse(result.value);
                  const analysis = analyzeData(parsed);
                  
                  console.log(`  Type: ${analysis.type}`);
                  console.log(`  Structure: ${analysis.structure}`);
                  
                  if (analysis.type === 'terminal') {
                    findings.terminal++;
                    console.log('  ❌ TERMINAL DATA - Not chat data');
                    console.log(`  Terminal indicators: ${analysis.terminalIndicators.join(', ')}`);
                  } else if (analysis.type === 'chat') {
                    findings.chat++;
                    console.log('  ✅ CHAT DATA FOUND!');
                    console.log(`  Chat structure: ${analysis.chatStructure}`);
                    
                    // Store sample
                    if (!findings.keys.has(result.key)) {
                      findings.keys.set(result.key, {
                        sampleData: JSON.stringify(parsed, null, 2).substring(0, 500),
                        structure: analysis.structure,
                        count: 1
                      });
                    } else {
                      findings.keys.get(result.key).count++;
                    }
                  } else if (analysis.type === 'empty') {
                    findings.empty++;
                    console.log('  ⚠️ EMPTY DATA');
                  } else {
                    findings.other++;
                    console.log('  ❓ OTHER DATA TYPE');
                  }
                  
                } catch (parseError) {
                  console.log('  ⚠️ Failed to parse JSON');
                }
              }
            }
          }
        } catch (queryError) {
          // Query failed, continue
        }
      }
      
      await dbService.closeConnection();
      
    } catch (error) {
      console.error(`Error with database: ${error.message}`);
    }
  }
  
  // Summary
  console.log('\n\n=== SUMMARY ===');
  console.log(`Databases examined: ${databasesExamined}`);
  console.log(`Terminal data found: ${findings.terminal}`);
  console.log(`Chat data found: ${findings.chat}`);
  console.log(`Empty data found: ${findings.empty}`);
  console.log(`Other data found: ${findings.other}`);
  
  if (findings.keys.size > 0) {
    console.log('\n=== CHAT DATA STORAGE KEYS ===');
    for (const [key, info] of findings.keys.entries()) {
      console.log(`\n📌 Key: "${key}"`);
      console.log(`  Found in ${info.count} databases`);
      console.log(`  Structure: ${info.structure}`);
      console.log(`  Sample:\n${info.sampleData}`);
    }
  }
  
  console.log('\n=== RECOMMENDATIONS ===');
  console.log('1. The key "aiService.prompts" often contains terminal/shell data, not chat data');
  console.log('2. Look for keys that contain actual message arrays with role/content structure');
  console.log('3. Check if Cursor stores chat data in a different location or format');
  console.log('4. Consider that chat data might be stored in binary format or compressed');
}

function analyzeData(data) {
  const analysis = {
    type: 'unknown',
    structure: '',
    terminalIndicators: [],
    chatStructure: ''
  };
  
  if (!data || typeof data !== 'object') {
    analysis.type = 'invalid';
    return analysis;
  }
  
  // Check if array
  if (Array.isArray(data)) {
    analysis.structure = `Array[${data.length}]`;
    
    if (data.length === 0) {
      analysis.type = 'empty';
      return analysis;
    }
    
    // Check first item
    const firstItem = data[0];
    if (firstItem && typeof firstItem === 'object') {
      const keys = Object.keys(firstItem);
      analysis.structure += ` with keys: ${keys.join(', ')}`;
      
      // Terminal indicators
      const terminalKeys = ['pid', 'shellIntegrationNonce', 'isFeatureTerminal', 'hasChildProcesses'];
      const hasTerminal = terminalKeys.some(key => keys.includes(key));
      
      if (hasTerminal) {
        analysis.type = 'terminal';
        analysis.terminalIndicators = keys.filter(k => terminalKeys.includes(k));
      } else if (keys.includes('role') && keys.includes('content')) {
        analysis.type = 'chat';
        analysis.chatStructure = 'messages with role/content';
      } else if (keys.includes('messages') || keys.includes('conversations')) {
        analysis.type = 'chat';
        analysis.chatStructure = 'conversation container';
      }
    }
  } else {
    // Object
    const keys = Object.keys(data);
    analysis.structure = `Object with keys: ${keys.slice(0, 10).join(', ')}`;
    
    // Check for terminal data
    const terminalKeys = ['pid', 'shellIntegrationNonce', 'isFeatureTerminal', 'workspaceName'];
    const hasTerminal = terminalKeys.some(key => keys.includes(key));
    
    if (hasTerminal) {
      analysis.type = 'terminal';
      analysis.terminalIndicators = keys.filter(k => terminalKeys.includes(k));
    } else if (data.messages && Array.isArray(data.messages)) {
      analysis.type = 'chat';
      analysis.chatStructure = `messages array[${data.messages.length}]`;
    } else if (data.conversations && Array.isArray(data.conversations)) {
      analysis.type = 'chat';
      analysis.chatStructure = `conversations array[${data.conversations.length}]`;
    } else if (data.entries && Array.isArray(data.entries)) {
      analysis.type = 'chat';
      analysis.chatStructure = `entries array[${data.entries.length}]`;
    } else if (keys.length === 0) {
      analysis.type = 'empty';
    }
  }
  
  return analysis;
}

// Run the examination
examineKnownKeys().catch(console.error); 