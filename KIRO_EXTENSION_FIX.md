# Kiro Extension Error Fix Guide

## Problem Summary
You're experiencing VS Code extension errors related to missing command handlers for `kiroAgent.getAutonomyMode`, `kiroAgent.updateCoachingStatus`, and `config/getSerializedProfileInfo`.

## Root Cause
The `kiro.kiroAgent` extension is failing to activate properly due to a JSON parsing error, which prevents its command handlers from being registered.

## Solution Steps

### Step 1: Disable and Reinstall the Kiro Extension
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Kiro Agent" or "kiro.kiroAgent"
4. Disable the extension
5. Uninstall the extension
6. Restart VS Code
7. Reinstall the extension from the marketplace

### Step 2: Clear Extension Cache
1. Close VS Code completely
2. Navigate to `%APPDATA%\Kiro\User\globalStorage\kiro.kiroagent\`
3. Delete the contents of this folder (but keep the folder structure)
4. Restart VS Code

### Step 3: Check Network Connection
The extension might be failing due to network connectivity issues. Ensure:
- You have a stable internet connection
- No firewall is blocking VS Code
- Your proxy settings (if any) are correct

### Step 4: Alternative Solution - Disable Problematic Extension
If reinstalling doesn't work, you can temporarily disable the extension to stop the errors:
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Find "Kiro Agent"
4. Right-click and select "Disable"

### Step 5: Update VS Code
Ensure you're using the latest version of VS Code:
1. Go to Help > Check for Updates
2. Install any available updates
3. Restart VS Code

## Temporary Workaround
If you need to continue working while fixing this issue, you can suppress the error messages by adding this to your VS Code settings:

```json
{
  "extensions.ignoreRecommendations": true,
  "extensions.autoUpdate": false
}
```

## Verification
After applying the fix:
1. Open the Developer Console (Help > Toggle Developer Tools)
2. Check if the error messages no longer appear
3. Verify that the extension is working as expected

## If Problem Persists
If the issue continues after trying these steps:
1. Check for conflicting extensions
2. Try using VS Code with a different user profile
3. Consider resetting VS Code settings to defaults
4. Contact Kiro support for further assistance