# Checkbook PWA

Checkbook PWA is a modern, client-side digital checkbook register application. It operates entirely within your web browser, using local storage to keep your financial data private and secure on your own machine. As a Progressive Web App (PWA), it can be "installed" on your device for a native-app feel and is fully functional offline.

## Features

*   **Complete Privacy**: All data is stored locally in your browser's IndexedDB. Nothing is ever sent to a server.
*   **Account Management**: Create and manage multiple accounts (e.g., Checking, Savings, Credit Card). The app remembers the last account you used.
*   **Intuitive Transaction Register**:
    *   **Inline Editing**: Click on any field of a transaction to edit it instantly.
    *   **Dynamic Balance Calculation**: The running balance is automatically calculated as you add and edit transactions.
    *   **Easy Entry**: Add new transactions through a simple form or directly in the last row of the register.
*   **Powerful Filtering & Sorting**: Quickly find what you're looking for by filtering transactions by date range, description, amount, or reconciled status. Sort by oldest or newest first.
*   **Data Portability**:
    *   **JSON Backup & Restore**: Export all your accounts and transactions into a single JSON file for backup. Restore from this file at any time (note: this will overwrite existing data).
    *   **CSV Import**: Import transactions from your bank. The application can automatically match and reconcile them with existing entries or add them as new ones.
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
2.  **Create an Account**: The first time you use the app, you will be prompted to create an account. Click the "Account" button, enter a name for your new account, and click "Create Account".
3.  **Add Transactions**:
    *   Click the "Add" button to open a modal for entering transaction details.
    *   Alternatively, you can type directly into the empty row at the bottom of the transaction table. A new transaction is saved once you enter a description and an amount.
4.  **Manage Your Register**:
    *   **Filter**: Click the "Filter" button to narrow down the displayed transactions.
    *   **Purge**: Click "Purge" to remove old reconciled transactions.
    *   **Save/Load**: Use "Save" to export your data to a JSON file and "Load" to import it back in.
    *   **CSV Import**: Click the "CSV" button to select a CSV file from your bank to import transactions into the current account.

## CSV Import Formats

The application is designed to parse two common bank CSV formats. The header row of your CSV file must match one of the following signatures:

1.  **Format 1 (Credit/Debit Columns)**
    *   **Header Signature**: `Account,Date,Pending?,Description,Category,Check,Credit,Debit`

2.  **Format 2 (Single Amount Column)**
    *   **Header Signature**: `Date,Description,Original Description,Category,Amount,Status`

3.  **Format 3 (Posted Date with Debit/Credit)**
    *   **Header Signature**: `Account Number,Post Date,Check,Description,Debit,Credit`

If your bank's CSV format is different, you may need to adjust the column headers to match one of the profiles above.

## File Structure
.
├── index.html # The main HTML file and user interface.
├── style.css # All styles for the application.
├── script.js # Core application logic, event handling, and UI rendering.
├── database.js # A helper module for all IndexedDB interactions.
├── data-io.js # Module for handling JSON and CSV import/export logic.
├── manifest.json # PWA configuration file.
└── service-worker.js # Script that enables offline functionality and caching.
