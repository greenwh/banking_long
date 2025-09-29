# Checkbook PWA

Checkbook PWA is a modern, client-side digital checkbook register application. It operates entirely within your web browser, using local storage to keep your financial data private and secure on your own machine. As a Progressive Web App (PWA), it can be "installed" on your device for a native-app feel and is fully functional offline.

## Features

*   **Complete Privacy**: All data is stored locally in your browser's IndexedDB. Nothing is ever sent to a server.
*   **Account Management**: Create and manage multiple accounts (e.g., Checking, Savings, Credit Card). The app remembers the last account you used.
*   **Intuitive Transaction Register**:
    *   **Inline Editing**: Click on any field of a transaction to edit it instantly.
    *   **Dynamic Balance Calculation**: The running balance is automatically calculated as you add and edit transactions.
    *   **User-Friendly Entry**: Add new transactions with descriptive dropdowns for common transaction codes.
*   **Powerful Filtering & Sorting**: Quickly find what you're looking for by filtering transactions by date range, description, amount, or reconciled status. Sort by oldest or newest first.
*   **Advanced Data Portability**:
    *   **Full Backup & Restore**: Export all your accounts and transactions into a single JSON file. Restore from this file at any time.
    *   **Bank Reconciliation**: Import transactions from your bank's CSV files to automatically find and reconcile matching entries.
    *   **Multi-Device Sync**: Use the powerful CSV Export/Import "Sync mode" to merge transactions between different devices without overwriting data.
*   **Data Management**: A "Purge" utility allows you to permanently delete old, reconciled transactions to keep your register tidy.
*   **Offline First**: Thanks to a service worker, the application loads instantly and works reliably even without an internet connection.
*   **Installable**: On supported browsers, you can add the application to your home screen or desktop and launch it like a native app.

## Technology Stack

*   **Frontend**: HTML5, CSS3, vanilla JavaScript (ES6 Modules)
*   **Storage**: IndexedDB for robust client-side database storage.
*   **Offline Capability**: Service Workers for caching and offline functionality.
*   **PWA**: A `manifest.json` file allows the app to be installed on a user's device.

## How to Use

1.  **Launch**: Simply open the `index.html` file in a modern web browser (like Chrome, Firefox, Safari, or Edge).
2.  **Create an Account**: The first time you use the app, click the "Account" button, enter a name for your new account, and click "Create Account".
3.  **Add Transactions**:
    *   Click the "Add" button to open a modal for entering transaction details.
    *   Alternatively, type directly into the empty row at the bottom of the transaction table.
4.  **Manage Your Register**:
    *   **Filter**: Click the "Filter" button to narrow down the displayed transactions.
    *   **Purge**: Click "Purge" to remove old reconciled transactions.
    *   **Backup (JSON)**: Use "Save" to export all data to a JSON file and "Load" to import it. **Warning: "Load" overwrites all existing data.**

### How to Sync Between Devices

Use the CSV sync feature to merge transactions from one device to another without overwriting the entire database.

1.  **On Device A (Source)**:
    *   Select the account you want to sync.
    *   Optionally, use the "Filter" to select a specific date range of transactions.
    *   Click the **"Export CSV"** button. A CSV file containing only the transactions in the current view will be downloaded.
2.  **Transfer the File**: Move the exported CSV file to Device B (e.g., via email, cloud drive, or direct transfer).
3.  **On Device B (Destination)**:
    *   Select the matching account.
    *   Click the **"Import CSV"** button and choose the file you just transferred.
    *   In the "CSV Import Options" modal, check the **"Sync mode"** checkbox.
    *   Click "Confirm Import". The app will add any transactions from the file that are missing on Device B and skip any that already exist.

## CSV Import Formats

The application now supports **four** CSV formats. The header row of your CSV file must match one of the following signatures:

1.  **Format 1 (Credit/Debit Columns)**
    *   `Account,Date,Pending?,Description,Category,Check,Credit,Debit`

2.  **Format 2 (Single Amount Column)**
    *   `Date,Description,Original Description,Category,Amount,Status`

3.  **Format 3 (Posted Date with Debit/Credit)**
    *   `Account Number,Post Date,Check,Description,Debit,Credit`

4.  **Checkbook Export Format (Used for Syncing)**
    *   `"Date","Code","Description","Deposit","Withdrawal","Reconciled"`

## File Structure

```
.
├── index.html          # The main HTML file and user interface.
├── style.css           # All styles for the application.
├── script.js           # Core application logic, event handling, and UI rendering.
├── database.js         # A helper module for all IndexedDB interactions.
├── data-io.js          # Module for handling JSON and CSV import/export logic.
├── manifest.json       # PWA configuration file.
└── service-worker.js   # Script that enables offline functionality and caching.
```