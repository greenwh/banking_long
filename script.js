// script.js

import * as db from './database.js';
import * as io from './data-io.js';

// --- APPLICATION STATE ---
let currentAccountId = null;
let transactions = []; // Holds transactions for the CURRENT account only
let filters = JSON.parse(localStorage.getItem('checkbook_filters')) || {
    startDate: '', endDate: '', description: '', reconciled: 'all', amount: '', sortOrder: 'oldest'
};

// --- DOM ELEMENT CACHING ---
const modals = {
    account: document.getElementById('account-modal'),
    add: document.getElementById('add-transaction-modal'),
    filter: document.getElementById('filter-modal')
};
const transactionBody = document.getElementById('transaction-body');
const accountSelect = document.getElementById('account-select');
const accountNameHeader = document.getElementById('account-name-header');

// --- EVENT HANDLERS (Setup) ---
function setupEventListeners() {
    // Modal Open Buttons
    document.getElementById('account-btn').addEventListener('click', () => { modals.account.style.display = 'block'; });
    document.getElementById('add-btn').addEventListener('click', () => {
        document.getElementById('add-transaction-form').reset();
        document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
        modals.add.style.display = 'block';
    });
    document.getElementById('filter-btn').addEventListener('click', () => {
        document.getElementById('filter-start-date').value = filters.startDate;
        // ... (rest of filter modal setup)
        modals.filter.style.display = 'block';
    });

    // Modal Close Buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', e => e.target.closest('.modal').style.display = 'none');
    });
    window.addEventListener('click', e => {
        if (e.target.classList.contains('modal')) e.target.style.display = 'none';
    });

    // Account Modal Actions
    document.getElementById('create-account-btn').addEventListener('click', handleCreateAccount);
    document.getElementById('delete-account-btn').addEventListener('click', handleDeleteAccount);
    accountSelect.addEventListener('change', handleSwitchAccount);

    // Add & Filter Modal Actions
    document.getElementById('add-transaction-form').addEventListener('submit', handleAddTransaction);
    document.getElementById('filter-form').addEventListener('submit', handleFilter);
    document.getElementById('clear-filter-btn').addEventListener('click', handleClearFilter);

    // Top Bar I/O Actions (Now calling the io module)
    document.getElementById('purge-btn').addEventListener('click', handlePurge);
    document.getElementById('save-btn').addEventListener('click', io.handleJsonExport);
    document.getElementById('load-btn').addEventListener('click', () => document.getElementById('json-import').click());
    
    // File Input Handlers (Now calling the io module)
    document.getElementById('json-import').addEventListener('change', async (e) => {
        if (!e.target.files.length) return;
        const success = await io.handleJsonImport(e.target.files[0]).catch(console.error);
        if (success) {
            localStorage.removeItem('checkbook_lastAccountId');
            await loadApp();
        }
        e.target.value = ''; // Reset input
    });
    document.getElementById('csv-import').addEventListener('change', async (e) => {
        if (!e.target.files.length) return;
        if (!currentAccountId) {
            alert("Please select an account before importing.");
            e.target.value = '';
            return;
        }
        const success = await io.handleCsvImport(e.target.files[0], currentAccountId, transactions).catch(console.error);
        if (success) {
            await loadTransactionsForCurrentAccount();
        }
        e.target.value = ''; // Reset input
    });
}

// --- All other functions remain here ---
// (loadApp, loadAccounts, render, handleCreateAccount, handlePurge, etc.)
// They are unchanged from the previous complete version.

// Example of an unchanged function:
async function handlePurge() {
    const dateStr = prompt("Purge reconciled transactions BEFORE which date? (YYYY-MM-DD)");
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        if(dateStr !== null) alert("Invalid date format.");
        return;
    }
    const purgeDate = new Date(dateStr);
    const txsToPurge = transactions.filter(tx => tx.reconciled && new Date(tx.date) < purgeDate);

    if (txsToPurge.length > 0 && confirm(`This will permanently delete ${txsToPurge.length} reconciled transactions. Continue?`)) {
        for (const tx of txsToPurge) {
            await db.dbDelete('transactions', tx.id);
        }
        await loadTransactionsForCurrentAccount();
    } else {
        alert("No matching reconciled transactions found to purge.");
    }
}


// --- INITIALIZE THE APP ---
// This now starts the entire application flow.
db.initDB().then(loadApp).catch(console.error);