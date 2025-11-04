# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Summary

**Bank Register Long** is a privacy-first Progressive Web App (PWA) for personal financial management. It's a digital checkbook register that operates entirely in the browser with zero external dependencies, no build process, and complete client-side data storage using IndexedDB. All financial data remains local to the user's device.

**Key Facts**:
- Zero external dependencies (vanilla JavaScript, ES6 modules)
- No build process required
- ~1,200 lines total code across 4 main files
- Deployed as static files (HTML, CSS, JS)
- Service worker enables offline functionality

## Common Development Commands

### Start Local Development Server

```bash
# Windows
start_banking_server.bat

# Then open browser to http://localhost:[port]/
```

The batch file launches a local HTTP server needed for:
- Service worker registration (requires HTTPS or localhost)
- Proper ES6 module loading
- Avoiding CORS issues during development

### File Editing

```bash
# Edit files directly - no build step needed
# Changes take effect on browser refresh
vim script.js        # Main application logic
vim database.js      # IndexedDB wrapper
vim data-io.js       # JSON/CSV import-export
vim style.css        # Styles
vim index.html       # UI markup

# After editing, refresh browser (Ctrl+R or Cmd+R)
```

### Testing

```bash
# Manual testing workflow:
1. Edit files directly
2. Refresh browser
3. Test in browser DevTools
4. For offline testing: DevTools → Network tab → Offline checkbox
5. Inspect IndexedDB: DevTools → Application → IndexedDB → checkbookDB_v3
```

### Service Worker Cache Versioning

```javascript
// When you need to force cache refresh across users:
// In service-worker.js, increment the cache version number

const CACHE_NAME = 'checkbook-cache-v19';  // Change v19 → v20 to force refresh
```

### Git Workflow

```bash
# Check status
git status

# View recent commits
git log --oneline -10

# Commit changes
git add .
git commit -m "Description of changes"

# Push to remote
git push origin main
```

## Architecture Overview

### Module Structure

```
index.html              ← Entry point (UI markup and form structure)
    ↓ imports
script.js               ← Main controller (state management, event handling, rendering)
    ├─ imports database.js    (IndexedDB abstraction)
    └─ imports data-io.js     (JSON/CSV import-export)

style.css               ← All styling
service-worker.js       ← Offline caching & PWA features
manifest.json           ← PWA configuration
```

### Data Flow

```
User Interaction (clicks, form input in index.html)
         ↓
Event Handler (script.js)
         ↓
State Update + UI Render
         ↓
Database Operation (database.js) ← IndexedDB
         ↓
LocalStorage (backup state)
```

### Application State (in script.js)

```javascript
currentAccountId        // Selected account ID
transactions            // Array of transactions for current account
filters                 // Active filter settings
displayTxs              // Filtered/sorted transactions (used for export)

// Persisted in localStorage:
checkbook_lastAccountId
checkbook_filters
```

## Key Architectural Decisions

### 1. Zero External Dependencies
- Entire app built with browser APIs only
- Reduces complexity, improves maintainability
- No npm, no build tools, no framework overhead
- Direct file serving works with any HTTP server

### 2. Module-Based Organization (ES6 Modules)
- `index.html`: HTML structure only (169 lines)
- `script.js`: Application logic (427 lines)
- `database.js`: IndexedDB wrapper (82 lines)
- `data-io.js`: Import/export logic (286 lines)
- Clean separation of concerns enables independent module testing

### 3. Client-Side Only Architecture
- All data stored in browser's IndexedDB
- Service worker enables offline-first experience
- Zero server dependency ensures privacy
- Users have complete control over their financial data

### 4. Promise-Based Async Operations
```javascript
// IndexedDB operations wrapped in Promises (database.js)
const result = await db.getTransactions(accountId);
// Consistent async/await pattern throughout
```

### 5. Modal-Based UI Pattern
- Each major operation (add transaction, import CSV, account management) uses dedicated modal
- Modals in index.html (`#addModal`, `#importModal`, etc.)
- Click outside or close button dismisses
- Prevents context switching and confusion

### 6. Inline Transaction Editing
- Users click table cells to edit directly
- Changes persist immediately to IndexedDB
- Running balance recalculates on-the-fly
- No separate "edit mode" needed

## Data Storage Details

### IndexedDB (`checkbookDB_v3`)

**Object Stores**:
```
accounts {
  id: auto-incrementing primary key
  name: string (account name)
  created: timestamp
}

transactions {
  id: auto-incrementing primary key
  accountId: foreign key to accounts
  date: date string (YYYY-MM-DD)
  code: string (DC, ATM, AD, AP, BP, T, I)
  description: string
  deposit: number (positive values only)
  withdrawal: number (positive values only)
  reconciled: boolean
  created: timestamp
}
```

**Indexes**:
- `accountId_date`: Composite index on `[accountId, date]` for efficient filtering

### LocalStorage

Stores UI state across sessions:
```javascript
localStorage.setItem('checkbook_lastAccountId', id);
localStorage.setItem('checkbook_filters', JSON.stringify(filters));
```

## CSV Import/Export

### Supported Import Formats (4 types)

The app auto-detects CSV format by examining the header row:

```
Format 1: Account,Date,Pending?,Description,Category,Check,Credit,Debit
Format 2: Date,Description,Original Description,Category,Amount,Status
Format 3: Account Number,Post Date,Check,Description,Debit,Credit
Format 4: "Date","Code","Description","Deposit","Withdrawal","Reconciled"  (Export format)
```

**Detection Logic** (data-io.js, lines 157-215):
- Each format has a header signature
- Function `parseCSV()` loops through parsers until one succeeds
- Falls back to user selection if detection fails

### CSV Export

```javascript
// Exported transactions in Format 4 (Checkbook format)
"Date","Code","Description","Deposit","Withdrawal","Reconciled"
"2025-10-16","DC","Gas Station",0.00,45.50,"false"
```

### Sync Mode

Merges CSV transactions with existing data without overwriting:
```javascript
// Only adds transactions that don't already exist
// Matching: same date, amount, and description
// Prevents duplicates during multi-device sync
```

## File Structure Reference

| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | 169 | HTML entry point, form structure, modal definitions |
| `script.js` | 427 | Main controller, event handlers, UI rendering, state management |
| `database.js` | 82 | IndexedDB CRUD operations, schema initialization |
| `data-io.js` | 286+ | JSON backup/restore, CSV parsing, CSV export, sync mode |
| `style.css` | 203 | Complete responsive styling, mobile-first design |
| `service-worker.js` | 25 | Offline caching (cache-first strategy), PWA features |
| `manifest.json` | 13 | PWA configuration, app icons, display settings |

## Important Configuration Points

### Service Worker Version (force cache refresh)
```javascript
// service-worker.js line 1
const CACHE_NAME = 'checkbook-cache-v19';  // Increment to force update
```

### Database Configuration
```javascript
// database.js
const DB_NAME = 'checkbookDB_v3';
const DB_VERSION = 1;
```

### PWA Configuration
```json
// manifest.json
"display": "standalone",      // Fullscreen app appearance
"start_url": ".",
"theme_color": "#3498db",     // Blue theme
"background_color": "#ffffff"
```

### Transaction Codes
```
DC  → Debit Card
ATM → Teller Withdrawal
AD  → Auto Deposit
AP  → Auto Payment
BP  → Bill Pay
T   → Transfer
I   → Interest
```

## Common Development Tasks

### Add a New Feature

1. **UI Changes**: Edit `index.html` (add form fields, buttons, modals)
2. **Styling**: Add CSS to `style.css`
3. **Logic**: Add handler to `script.js`
4. **Storage**: If persisting data, update `database.js`
5. **Refresh browser** and test

### Modify CSV Import Format Support

Edit `data-io.js`:
- Add new format signature to parser list (line 157-215)
- Create corresponding parser function (e.g., `parseFormat5()`)
- Format must detect from header row

### Fix a Bug

1. Identify the file (use git diff to see recent changes)
2. Edit file directly
3. Test in browser with DevTools
4. For IndexedDB issues: inspect in DevTools → Application tab
5. Commit with descriptive message

### Test Offline Functionality

```
1. Open DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox
4. Reload page (Ctrl+R)
5. App should still work with cached data
```

### Debug IndexedDB Issues

```
1. DevTools → Application → IndexedDB → checkbookDB_v3
2. Inspect accounts and transactions object stores
3. Check if data persisted correctly
4. Clear if needed: DevTools → Application → Clear site data
```

## Important Notes

### Browser Support
- Requires IndexedDB support (all modern browsers)
- Requires Service Worker support for PWA features
- Requires ES6 module support (`<script type="module">`)
- HTTPS required in production for Service Workers (localhost OK)

### Performance Considerations
- IndexedDB queries use `accountId_date` index for efficiency
- Filtering done in JavaScript after database retrieval
- Suitable for typical personal use (thousands of transactions)
- Consider purging old reconciled transactions if database grows large

### Testing Strategy
- Manual testing only (no automated tests)
- Test across different browsers and devices
- Verify offline mode works correctly
- Test CSV import with real bank files
- Validate data integrity after import/export

### Deployment

No build step needed:
```bash
# Simply copy all files to web server
cp -r * /var/www/html/checkbook/

# Ensure HTTPS enabled (required for Service Workers in production)
# Service worker will cache everything on first load
```

### Security & Privacy
- All data stays in browser (IndexedDB)
- No server communication
- No external API calls
- User controls all data export
- Service worker caches locally only
- Safe to use on any device

## Recent Development

**Latest commit** (October 16, 2025):
- Branch: `main` (clean working directory)
- Recent activity: CSV import bug fixes, CSV export/sync feature added, UI polish

**Known issues**: None (todo.txt is empty as of Sep 28)

**Git status**: All changes committed, clean working tree

## Quick Debugging Tips

### "Transactions not showing"
1. Check current account selected
2. Verify IndexedDB has data: DevTools → Application → IndexedDB
3. Check filters aren't hiding data: click Filter → Reset

### "Service worker not working"
1. Must use `http://localhost` or `https://` (not `file://`)
2. Check service worker registration: DevTools → Application → Service Workers
3. Increment cache version if assets changed

### "CSV import failing"
1. Check CSV has correct header row (one of 4 formats)
2. Verify date format: YYYY-MM-DD
3. Check amounts are numbers (no currency symbols)
4. Try Format 4 (Checkbook export format) for testing

### "IndexedDB errors"
1. Clear browser data: DevTools → Application → Clear site data
2. Refresh page
3. App will reinitialize database
4. Re-import data if needed

---

**Last Updated**: October 16, 2025
