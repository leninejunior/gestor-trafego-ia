const fs = require('fs');
const path = require('path');

// Script to fix Kiro extension issues
const fixKiroExtension = () => {
  console.log('Starting Kiro Extension Fix...');
  
  // Path to Kiro extension storage
  const kiroStoragePath = path.join(process.env.APPDATA, 'Kiro', 'User', 'globalStorage', 'kiro.kiroagent');
  
  try {
    // Check if Kiro storage directory exists
    if (fs.existsSync(kiroStoragePath)) {
      console.log('Found Kiro extension storage directory:', kiroStoragePath);
      
      // List files in the directory
      const files = fs.readdirSync(kiroStoragePath);
      console.log('Files in Kiro storage:', files);
      
      // Create backup of current state
      const backupPath = path.join(kiroStoragePath, '..', 'kiro_backup_' + Date.now());
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
        
        // Copy files to backup
        files.forEach(file => {
          const srcPath = path.join(kiroStoragePath, file);
          const destPath = path.join(backupPath, file);
          
          if (fs.statSync(srcPath).isDirectory()) {
            copyDirectory(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        });
        
        console.log('Created backup at:', backupPath);
      }
      
      // Clear problematic cache files
      const filesToRemove = ['index.sqlite', 'index.sqlite-shm', 'index.sqlite-wal', 'autocompleteCache.sqlite'];
      
      filesToRemove.forEach(file => {
        const filePath = path.join(kiroStoragePath, 'index', file);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log('Removed problematic file:', filePath);
          } catch (err) {
            console.error('Failed to remove file:', filePath, err);
          }
        }
      });
      
      // Clear global context file if it exists
      const globalContextPath = path.join(kiroStoragePath, 'index', 'globalContext.json');
      if (fs.existsSync(globalContextPath)) {
        try {
          // Read and clean the JSON file
          const content = fs.readFileSync(globalContextPath, 'utf8');
          const cleanedContent = content.replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
          
          // Try to parse and rewrite the JSON
          try {
            JSON.parse(cleanedContent);
            fs.writeFileSync(globalContextPath, cleanedContent);
            console.log('Cleaned globalContext.json');
          } catch (parseErr) {
            // If parsing fails, create a minimal valid JSON
            fs.writeFileSync(globalContextPath, '{}');
            console.log('Reset globalContext.json to empty object');
          }
        } catch (err) {
          console.error('Failed to clean globalContext.json:', err);
        }
      }
      
      console.log('Kiro extension fix completed successfully!');
      console.log('Please restart VS Code to apply the changes.');
      
    } else {
      console.log('Kiro extension storage directory not found. Extension may not be installed or activated.');
    }
  } catch (error) {
    console.error('Error fixing Kiro extension:', error);
  }
};

// Helper function to copy directories recursively
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Run the fix
fixKiroExtension();