const fs = require('fs');
const path = require('path');
const os = require('os');

// Import our enhanced database service
const { DatabaseService } = require('./out/data/databaseService');

async function discoverCursorStorageKeys() {
  console.log('=== COMPREHENSIVE CURSOR CHAT DATA DISCOVERY ===\n');
  
  // Expanded search locations for Cursor data
  const possibleLocations = [
    // Standard locations
    path.join(process.env.APPDATA || '', 'Cursor', 'User', 'workspaceStorage'),
    path.join(process.env.APPDATA || '', 'Cursor', 'User', 'globalStorage'),
    path.join(process.env.APPDATA || '', 'Cursor', 'User'),
    path.join(process.env.APPDATA || '', 'Cursor'),
    
    // Alternative locations
    path.join(os.homedir(), '.cursor'),
    path.join(os.homedir(), '.config', 'Cursor'),
    path.join(os.homedir(), 'AppData', 'Local', 'Cursor'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'),
    
    // Mac locations
    path.join(os.homedir(), 'Library', 'Application Support', 'Cursor'),
    path.join(os.homedir(), 'Library', 'Preferences', 'Cursor'),
    
    // Linux locations
    path.join(os.homedir(), '.config', 'cursor'),
    path.join(os.homedir(), '.local', 'share', 'cursor')
  ];
  
  console.log('Searching for Cursor data in the following locations:');
  possibleLocations.forEach((loc, i) => console.log(`${i + 1}. ${loc}`));
  console.log();
  
  // Find all database files
  const allDatabaseFiles = [];
  
  for (const location of possibleLocations) {
    if (fs.existsSync(location)) {
      console.log(`📁 Found directory: ${location}`);
      await findDatabaseFiles(location, allDatabaseFiles, 3); // Max depth 3
    }
  }
  
  console.log(`\n🔍 Found ${allDatabaseFiles.length} total database files\n`);
  
  if (allDatabaseFiles.length === 0) {
    console.error('❌ No database files found! Cursor might not be installed or uses a different storage format.');
    return;
  }
  
  // Group databases by type and size
  const dbsByType = {
    state: [],
    storage: [],
    other: [],
    large: [] // Files >100KB that might contain chat data
  };
  
  for (const dbFile of allDatabaseFiles) {
    const size = fs.statSync(dbFile).size;
    const basename = path.basename(dbFile);
    
    if (basename === 'state.vscdb') {
      dbsByType.state.push({ path: dbFile, size });
    } else if (basename.includes('storage')) {
      dbsByType.storage.push({ path: dbFile, size });
    } else if (size > 100000) { // >100KB
      dbsByType.large.push({ path: dbFile, size });
    } else {
      dbsByType.other.push({ path: dbFile, size });
    }
  }
  
  console.log('📊 Database file breakdown:');
  console.log(`  - State databases: ${dbsByType.state.length}`);
  console.log(`  - Storage databases: ${dbsByType.storage.length}`);
  console.log(`  - Large databases (>100KB): ${dbsByType.large.length}`);
  console.log(`  - Other databases: ${dbsByType.other.length}\n`);
  
  // Analyze each type of database
  const chatDataFindings = [];
  
  // 1. Check large databases first (most likely to contain chat data)
  if (dbsByType.large.length > 0) {
    console.log('🔎 Analyzing large databases (most likely to contain chat data)...\n');
    for (const db of dbsByType.large.slice(0, 5)) {
      console.log(`📄 ${path.basename(db.path)} (${db.size} bytes)`);
      const findings = await analyzeDatabase(db.path, true); // Deep analysis
      if (findings.length > 0) {
        chatDataFindings.push(...findings);
        console.log(`   ✅ Found ${findings.length} potential chat data keys!`);
      } else {
        console.log(`   ❌ No chat data found`);
      }
    }
  }
  
  // 2. Check storage databases
  if (dbsByType.storage.length > 0) {
    console.log('\n🗄️ Analyzing storage databases...\n');
    for (const db of dbsByType.storage.slice(0, 3)) {
      console.log(`📄 ${path.basename(db.path)} (${db.size} bytes)`);
      const findings = await analyzeDatabase(db.path, false); // Quick analysis
      if (findings.length > 0) {
        chatDataFindings.push(...findings);
        console.log(`   ✅ Found ${findings.length} potential chat data keys!`);
      }
    }
  }
  
  // 3. Check some state databases
  if (dbsByType.state.length > 0) {
    console.log('\n📝 Analyzing state databases...\n');
    for (const db of dbsByType.state.slice(0, 5)) {
      console.log(`📄 ${path.basename(db.path)} (${db.size} bytes)`);
      const findings = await analyzeDatabase(db.path, false); // Quick analysis
      if (findings.length > 0) {
        chatDataFindings.push(...findings);
        console.log(`   ✅ Found ${findings.length} potential chat data keys!`);
      }
    }
  }
  
  // Summary and recommendations
  console.log('\n' + '='.repeat(60));
  console.log('📋 DISCOVERY SUMMARY');
  console.log('='.repeat(60));
  
  if (chatDataFindings.length > 0) {
    console.log(`\n🎉 SUCCESS! Found ${chatDataFindings.length} potential chat data sources:\n`);
    
    chatDataFindings.forEach((finding, i) => {
      console.log(`${i + 1}. 📌 Key: "${finding.key}"`);
      console.log(`   📁 File: ${path.basename(finding.file)}`);
      console.log(`   📊 Data type: ${finding.dataType}`);
      console.log(`   📝 Structure: ${finding.structure}`);
      if (finding.sample) {
        console.log(`   💭 Sample: ${finding.sample.substring(0, 100)}...`);
      }
      console.log();
    });
    
    console.log('🔧 IMPLEMENTATION RECOMMENDATIONS:');
    console.log('1. Update CursorDataProvider to search these specific keys');
    console.log('2. Focus on the database files that contain actual chat data');
    console.log('3. Implement proper parsing for the discovered data structures');
    console.log('4. Test with actual Cursor chat conversations');
    
  } else {
    console.log('\n⚠️ NO CHAT DATA FOUND IN EXAMINED DATABASES');
    console.log('\nPossible reasons:');
    console.log('1. 🗨️ No chat conversations have been created in Cursor yet');
    console.log('2. 💾 Chat data is stored in a different format (cloud-based, encrypted)');
    console.log('3. 📍 Chat data is stored in a location we haven\'t searched');
    console.log('4. 🔄 Chat data is cleared/rotated frequently');
    console.log('\nNext steps:');
    console.log('1. Create some chat conversations in Cursor first');
    console.log('2. Run this discovery tool again after creating chats');
    console.log('3. Check if Cursor has cloud-based chat storage');
    console.log('4. Look for additional configuration files');
  }
}

async function findDatabaseFiles(dir, results, maxDepth) {
  if (maxDepth <= 0) return;
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isFile() && (item.endsWith('.db') || item.endsWith('.vscdb') || item.endsWith('.sqlite'))) {
        results.push(itemPath);
        console.log(`   📄 Found database: ${path.relative(dir, itemPath)}`);
      } else if (stat.isDirectory() && !item.startsWith('.') && maxDepth > 1) {
        // Recurse into subdirectories
        await findDatabaseFiles(itemPath, results, maxDepth - 1);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}

async function analyzeDatabase(dbPath, deepAnalysis = false) {
  const findings = [];
  const dbService = new DatabaseService();
  
  try {
    await dbService.openConnection(dbPath);
    
    // Define search patterns for chat data
    const chatSearchPatterns = [
      // Known patterns
      'aiService.prompts',
      'workbench.panel.aichat',
      'cursorChat',
      'composer',
      
      // Potential new patterns
      'chat',
      'conversation',
      'message',
      'dialogue',
      'assistant',
      'prompt',
      'session',
      'history'
    ];
    
    for (const pattern of chatSearchPatterns) {
      try {
        const query = `SELECT * FROM ItemTable WHERE key LIKE '%${pattern}%'`;
        const results = await dbService.executeQuery(query);
        
        for (const result of results) {
          if (result.value && result.value.length > 50) { // Only check substantial content
            try {
              const parsed = JSON.parse(result.value);
              const analysis = analyzeForChatContent(parsed);
              
              if (analysis.likelyChatData) {
                findings.push({
                  key: result.key,
                  file: dbPath,
                  dataType: analysis.type,
                  structure: analysis.structure,
                  sample: result.value,
                  confidence: analysis.confidence
                });
              }
            } catch (parseError) {
              // Not JSON, skip
            }
          }
        }
      } catch (queryError) {
        // Query failed, continue
      }
    }
    
    // If deep analysis requested, look for any keys with large values
    if (deepAnalysis) {
      try {
        const largeValueQuery = `SELECT key, length(value) as size FROM ItemTable WHERE length(value) > 1000 ORDER BY size DESC LIMIT 20`;
        const largeValues = await dbService.executeQuery(largeValueQuery);
        
        for (const item of largeValues) {
          if (!findings.some(f => f.key === item.key)) { // Don't duplicate
            try {
              const contentQuery = `SELECT value FROM ItemTable WHERE key = '${item.key.replace(/'/g, "''")}'`;
              const content = await dbService.executeQuery(contentQuery);
              
              if (content[0] && content[0].value) {
                try {
                  const parsed = JSON.parse(content[0].value);
                  const analysis = analyzeForChatContent(parsed);
                  
                  if (analysis.likelyChatData) {
                    findings.push({
                      key: item.key,
                      file: dbPath,
                      dataType: analysis.type,
                      structure: analysis.structure,
                      sample: content[0].value,
                      confidence: analysis.confidence
                    });
                  }
                } catch (parseError) {
                  // Not JSON
                }
              }
            } catch (error) {
              // Query failed
            }
          }
        }
      } catch (error) {
        // Deep analysis failed
      }
    }
    
    await dbService.closeConnection();
    
  } catch (error) {
    console.log(`   ⚠️ Error analyzing database: ${error.message}`);
  }
  
  return findings;
}

function analyzeForChatContent(data) {
  const analysis = {
    likelyChatData: false,
    type: 'unknown',
    structure: '',
    confidence: 0
  };
  
  if (!data || typeof data !== 'object') {
    return analysis;
  }
  
  // Look for chat-specific patterns
  let chatIndicators = 0;
  let totalIndicators = 0;
  
  if (Array.isArray(data)) {
    analysis.structure = `Array[${data.length}]`;
    
    if (data.length > 0) {
      const sampleItem = data[0];
      if (sampleItem && typeof sampleItem === 'object') {
        const keys = Object.keys(sampleItem);
        analysis.structure += ` with keys: ${keys.slice(0, 5).join(', ')}`;
        
        // Strong chat indicators
        if (keys.includes('role') && keys.includes('content')) {
          chatIndicators += 3;
          analysis.type = 'message_array';
        }
        if (keys.includes('messages') || keys.includes('conversation')) {
          chatIndicators += 2;
          analysis.type = 'conversation_container';
        }
        if (keys.includes('sender') && keys.includes('message')) {
          chatIndicators += 2;
          analysis.type = 'chat_message';
        }
        
        // Look for actual message content
        if (typeof sampleItem.content === 'string' && sampleItem.content.length > 10) {
          chatIndicators += 1;
        }
        if (typeof sampleItem.message === 'string' && sampleItem.message.length > 10) {
          chatIndicators += 1;
        }
        
        totalIndicators = 5;
      }
    }
  } else {
    // Object
    const keys = Object.keys(data);
    analysis.structure = `Object with ${keys.length} keys`;
    
    // Check for chat container patterns
    if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
      chatIndicators += 3;
      analysis.type = 'conversation_with_messages';
      analysis.structure += `, messages[${data.messages.length}]`;
    }
    
    if (data.conversations && Array.isArray(data.conversations) && data.conversations.length > 0) {
      chatIndicators += 3;
      analysis.type = 'conversation_collection';
      analysis.structure += `, conversations[${data.conversations.length}]`;
    }
    
    if (data.entries && Array.isArray(data.entries)) {
      chatIndicators += 1;
      analysis.type = 'entry_collection';
    }
    
    // Look for individual message structure
    if (data.role && data.content) {
      chatIndicators += 2;
      analysis.type = 'single_message';
    }
    
    totalIndicators = 4;
  }
  
  // Calculate confidence
  analysis.confidence = totalIndicators > 0 ? (chatIndicators / totalIndicators) : 0;
  analysis.likelyChatData = analysis.confidence >= 0.5; // 50% confidence threshold
  
  return analysis;
}

// Run the comprehensive discovery
discoverCursorStorageKeys().catch(console.error); 