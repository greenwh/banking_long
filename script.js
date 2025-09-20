// script.js

import * as db from './database.js';
import * as io from './data-io.js';

// --- APPLICATION STATE ---
let currentAccountId = null;
let transactions = [];
let filters = JSON.parse(localStorage.getItem('checkbook_filters')) || {
    startDate: '', endDate: '', description: '', reconciled: 'all', amount: '', sortOrder: 'oldest'
};

// --- DOM ELEMENT CACHING ---
const modals = {
    account: document.getElementById('account-modal'),
    add: document.getElementById('add-transaction-modal'),
    filter: document.getElementById('filter-modal'),
    csvOptions: document.getElementById('csv-options-modal'),
    purge: document.getElementById('purge-modal') // Add this line
};
const transactionBody = document.getElementById('transaction-body');
const accountSelect = document.getElementById('account-select');
const accountNameHeader = document.getElementById('account-name-header');
let csvImportPlan = null;

// --- CORE APPLICATION FLOW ---
async function loadApp() {
    await loadAccounts();
    const lastAccountId = localStorage.getItem('checkbook_lastAccountId');

    // Robustly determine the current account ID
    let determinedAccountId = null;
    if (lastAccountId) {
        determinedAccountId = parseInt(lastAccountId);
    } else if (accountSelect.options.length > 0) {
        // **THE FIX**: Directly use the value from the first option,
        // which is more reliable than accountSelect.value on initial load.
        determinedAccountId = parseInt(accountSelect.options[0].value);
    }
    currentAccountId = determinedAccountId;

    if (currentAccountId) {
        accountSelect.value = currentAccountId;
        // Also save this choice back to localStorage for the next page load
        localStorage.setItem('checkbook_lastAccountId', currentAccountId);
        await loadTransactionsForCurrentAccount();
    } else {
        accountNameHeader.textContent = "Create an Account";
        render(); // Render an empty state
    }
    setupEventListeners();
    registerServiceWorker();
}

async function loadAccounts() {
    const accounts = await db.dbGetAll('accounts');
    accountSelect.innerHTML = '';
    if (accounts.length > 0) {
        accounts.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc.id;
            option.textContent = acc.name;
            accountSelect.appendChild(option);
        });
    } else {
        accountSelect.innerHTML = '<option value="">No accounts found</option>';
    }
}

async function loadTransactionsForCurrentAccount() {
    if (!currentAccountId) {
        transactions = [];
        accountNameHeader.textContent = "Select or Create an Account";
        render();
        return;
    }
    const account = await db.dbGet('accounts', currentAccountId);
    if(account) accountNameHeader.textContent = account.name;
    
    const accountTxs = await db.dbGetByIndex('transactions', 'accountId_date', IDBKeyRange.bound([currentAccountId, ''], [currentAccountId, '\uffff']));
    transactions = accountTxs;
    render();
}

// --- UI RENDERING ---
function render() {
    // Step 1: Apply all user filters to get the relevant transactions.
    let filteredTxs = transactions.filter(tx => {
        if (filters.startDate && new Date(tx.date) < new Date(filters.startDate)) return false;
        if (filters.endDate && new Date(tx.date) > new Date(filters.endDate)) return false;
        if (filters.description && !tx.description.toLowerCase().includes(filters.description.toLowerCase())) return false;
        if (filters.reconciled !== 'all') {
            const isReconciled = filters.reconciled === 'reconciled';
            if (tx.reconciled !== isReconciled) return false;
        }
        if (filters.amount) {
            const amount = parseFloat(filters.amount);
            if (parseFloat(tx.withdrawal) !== amount && parseFloat(tx.deposit) !== amount) return false;
        }
        return true;
    });

    // Step 2: Create a chronologically sorted copy to correctly calculate balances.
    let chronoSortedTxs = [...filteredTxs].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Step 3: Calculate and attach the correct running balance to each transaction object.
    let finalBalance = 0;
    chronoSortedTxs.forEach(tx => {
        finalBalance += (parseFloat(tx.deposit) || 0) - (parseFloat(tx.withdrawal) || 0);
        tx.runningBalance = finalBalance; // Attach the calculated balance to the object.
    });

    // Step 4: Now, sort the augmented array for the final display order based on user's choice.
    let displayTxs = chronoSortedTxs.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() === dateB.getTime()) return 0;
        return filters.sortOrder === 'oldest' ? dateA - dateB : dateB - dateA;
    });

    // Step 5: Render the UI with the pre-calculated balances.
    transactionBody.innerHTML = '';
    displayTxs.forEach(tx => {
        // Pass the correct, pre-calculated balance to the rendering function.
        transactionBody.appendChild(createTransactionRow(tx, tx.runningBalance));
    });

    // Add the blank "new transaction" row, using the correct final balance.
    if (currentAccountId) {
        transactionBody.appendChild(createTransactionRow(null, finalBalance));
    }
}

function createTransactionRow(tx, balance) {
    const row = document.createElement('tr');
    const isNewRow = !tx;
    const txData = tx || { id: 'new', code: '', date: new Date().toISOString().split('T')[0], description: '', withdrawal: '', deposit: '', reconciled: false };
    row.dataset.id = txData.id;
    const balanceClass = balance < 0 ? 'class="balance-negative"' : '';
    
    row.innerHTML = `
        <td><input type="text" list="transaction-codes-list" value="${txData.code}" placeholder="Code/Chk #" data-field="code"></td>
        <td><input type="date" value="${txData.date ? txData.date.split('T')[0] : ''}" data-field="date"></td>
        <td><input type="text" value="${txData.description}" placeholder="Description" data-field="description"></td>
        <td><input type="number" step="0.01" value="${txData.withdrawal || ''}" placeholder="0.00" data-field="withdrawal"></td>
        <td><input type="checkbox" ${txData.reconciled ? 'checked' : ''} data-field="reconciled"></td>
        <td><input type="number" step="0.01" value="${txData.deposit || ''}" placeholder="0.00" data-field="deposit"></td>
        <td ${balanceClass}>${isNewRow ? '' : formatCurrency(balance)}</td>
        <td>${!isNewRow ? '<button class="delete-btn">X</button>' : ''}</td>
    `;
    
    row.querySelectorAll('input').forEach(input => input.addEventListener('change', handleInlineEdit));
    if (!isNewRow) {
        row.querySelector('.delete-btn').addEventListener('click', handleDeleteTransaction);
    }
    return row;
}

// --- EVENT HANDLERS ---
function setupEventListeners() {
    document.getElementById('account-btn').addEventListener('click', () => { modals.account.style.display = 'block'; });
    document.getElementById('add-btn').addEventListener('click', () => {
        document.getElementById('add-transaction-form').reset();
        document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
        modals.add.style.display = 'block';
    });
    document.getElementById('filter-btn').addEventListener('click', () => {
        document.getElementById('filter-start-date').value = filters.startDate;
        document.getElementById('filter-end-date').value = filters.endDate;
        document.getElementById('filter-description').value = filters.description;
        document.getElementById('filter-reconciled').value = filters.reconciled;
        document.getElementById('filter-amount').value = filters.amount;
        document.getElementById('sort-order').value = filters.sortOrder;
        modals.filter.style.display = 'block';
    });
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', e => e.target.closest('.modal').style.display = 'none');
    });
    window.addEventListener('click', e => {
        if (e.target.classList.contains('modal')) e.target.style.display = 'none';
    });
    document.getElementById('create-account-btn').addEventListener('click', handleCreateAccount);
    document.getElementById('delete-account-btn').addEventListener('click', handleDeleteAccount);
    accountSelect.addEventListener('change', handleSwitchAccount);
    document.getElementById('add-transaction-form').addEventListener('submit', handleAddTransaction);
    document.getElementById('filter-form').addEventListener('submit', handleFilter);
    document.getElementById('clear-filter-btn').addEventListener('click', handleClearFilter);
    //document.getElementById('purge-btn').addEventListener('click', handlePurge);
    document.getElementById('purge-btn').addEventListener('click', () => {
        document.getElementById('purge-date').value = new Date().toISOString().split('T')[0];
        modals.purge.style.display = 'block';
    });
    
    document.getElementById('purge-form').addEventListener('submit', handlePurge);
    document.querySelector('#purge-modal .cancel-btn').addEventListener('click', () => {
        modals.purge.style.display = 'none';
    });
    
    document.getElementById('save-btn').addEventListener('click', io.handleJsonExport);
    document.getElementById('load-btn').addEventListener('click', () => document.getElementById('json-import').click());
    
    document.getElementById('csv-confirm-import-btn').addEventListener('click', async () => {
        if (!csvImportPlan) return;
        const shouldReconcileNew = document.getElementById('csv-reconcile-new-checkbox').checked;
        await io.executeCsvImport(csvImportPlan, shouldReconcileNew);
        await loadTransactionsForCurrentAccount();
        modals.csvOptions.style.display = 'none';
        csvImportPlan = null;
    });
    document.getElementById('csv-cancel-import-btn').addEventListener('click', () => {
        modals.csvOptions.style.display = 'none';
        csvImportPlan = null;
    });

document.getElementById('json-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const success = await io.handleJsonImport(file);
        if (success) {
            // Clear the last used account ID before reloading
            localStorage.removeItem('checkbook_lastAccountId');
            // A full reload is the most robust way to reset the app's state
            location.reload();
        }
    } catch(err) {
        // This will catch the "Import cancelled by user" error and prevent it from polluting the console
        console.warn(err.message);
    } finally {
        // Clear the file input to allow re-importing the same file if needed
        e.target.value = '';
    }
});

    document.getElementById('csv-import').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!currentAccountId) {
            alert("Please select an account before importing.");
            e.target.value = '';
            return;
        }
        try {
            csvImportPlan = await io.processCsvFile(file, currentAccountId, transactions);
            document.getElementById('csv-summary-text').textContent = csvImportPlan.summary;
            document.getElementById('csv-reconcile-new-checkbox').checked = false;
            modals.csvOptions.style.display = 'block';
        } catch(err) {
            alert(`CSV Processing Error: ${err.message}`);
        } finally {
            e.target.value = '';
        }
    });
}

async function handleInlineEdit(e) {
    const input = e.target;
    const row = input.closest('tr');
    if (!row) return;

    const id = row.dataset.id;
    if (id === 'new') {
        const inputs = row.querySelectorAll('input[data-field]');
        const newTxData = { accountId: currentAccountId, reconciled: false };
        let hasAmount = false;
        inputs.forEach(inp => {
            const field = inp.dataset.field;
            const value = inp.type === 'checkbox' ? inp.checked : inp.value;
            newTxData[field] = value;
            if ((field === 'withdrawal' || field === 'deposit') && parseFloat(value) > 0) hasAmount = true;
        });
        if (newTxData.description && hasAmount) {
            await db.dbAdd('transactions', newTxData);
            await loadTransactionsForCurrentAccount();
        }
    } else {
        const tx = await db.dbGet('transactions', parseInt(id));
        if (tx) {
            tx[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.value;
            await db.dbPut('transactions', tx);
            await loadTransactionsForCurrentAccount();
        }
    }
}
    
async function handleDeleteTransaction(e) {
    const id = parseInt(e.target.closest('tr').dataset.id);
    if (confirm('Are you sure you want to delete this transaction?')) {
        await db.dbDelete('transactions', id);
        await loadTransactionsForCurrentAccount();
    }
}

async function handleCreateAccount() {
    const newName = document.getElementById('new-account-name').value.trim();
    if (newName) {
        const newId = await db.dbAdd('accounts', { name: newName });
        await loadAccounts();
        accountSelect.value = newId;
        document.getElementById('new-account-name').value = '';
        await handleSwitchAccount();
        modals.account.style.display = 'none';
    } else {
        alert('Please enter an account name.');
    }
}

async function handleDeleteAccount() {
    if (!currentAccountId) { alert("No account selected to delete."); return; }
    if (confirm(`DELETE THIS ACCOUNT AND ALL ITS TRANSACTIONS? THIS CANNOT BE UNDONE.`)) {
        await db.dbDelete('accounts', currentAccountId);
        const txsToDelete = await db.dbGetByIndex('transactions', 'accountId_date', IDBKeyRange.bound([currentAccountId, ''], [currentAccountId, '\uffff']));
        for (const tx of txsToDelete) {
            await db.dbDelete('transactions', tx.id);
        }
        localStorage.removeItem('checkbook_lastAccountId');
        currentAccountId = null;
        await loadApp();
        modals.account.style.display = 'none';
    }
}
    
async function handleSwitchAccount() {
    currentAccountId = parseInt(accountSelect.value);
    if (isNaN(currentAccountId)) currentAccountId = null;
    localStorage.setItem('checkbook_lastAccountId', currentAccountId);
    await loadTransactionsForCurrentAccount();
}
    
async function handleAddTransaction(e) {
    e.preventDefault();
    const form = e.target;
    const newTx = {
        accountId: currentAccountId,
        code: form.elements['transaction-code'].value,
        date: form.elements['transaction-date'].value,
        description: form.elements['transaction-description'].value,
        withdrawal: form.elements['transaction-withdrawal'].value || 0,
        deposit: form.elements['transaction-deposit'].value || 0,
        reconciled: false
    };
    await db.dbAdd('transactions', newTx);
    await loadTransactionsForCurrentAccount();
    form.reset();
    modals.add.style.display = 'none';
}
    
function handleFilter(e) {
    e.preventDefault();
    filters.startDate = document.getElementById('filter-start-date').value;
    filters.endDate = document.getElementById('filter-end-date').value;
    filters.description = document.getElementById('filter-description').value;
    filters.reconciled = document.getElementById('filter-reconciled').value;
    filters.amount = document.getElementById('filter-amount').value;
    filters.sortOrder = document.getElementById('sort-order').value;
    localStorage.setItem('checkbook_filters', JSON.stringify(filters));
    render();
    modals.filter.style.display = 'none';
}

function handleClearFilter() {
    filters = { startDate: '', endDate: '', description: '', reconciled: 'all', amount: '', sortOrder: 'oldest' };
    localStorage.removeItem('checkbook_filters');
    document.getElementById('filter-form').reset();
    render();
    modals.filter.style.display = 'none';
}
    
async function handlePurge(e) {
    e.preventDefault(); // Prevent form from reloading page
    const dateStr = document.getElementById('purge-date').value;
    if (!dateStr) {
        alert("Please select a date.");
        return;
    }

    // The input type="date" value is already in YYYY-MM-DD format.
    const purgeDate = new Date(dateStr);
    
    // We add one day to the date so that "before 09-20" includes all transactions on 09-20.
    purgeDate.setDate(purgeDate.getDate() + 1); 

    const txsToPurge = transactions.filter(tx => tx.reconciled && new Date(tx.date) < purgeDate);

    if (txsToPurge.length > 0) {
        if (confirm(`This will permanently delete ${txsToPurge.length} reconciled transaction(s). Continue?`)) {
            for (const tx of txsToPurge) {
                await db.dbDelete('transactions', tx.id);
            }
            await loadTransactionsForCurrentAccount();
            modals.purge.style.display = 'none';
        }
    } else {
        alert("No reconciled transactions were found on or before the selected date.");
    }
}    
// --- PWA, SYNC & UTILITIES ---
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('Service Worker registered.'))
            .catch(err => console.error('Service Worker registration failed:', err));
    }
}
async function syncToLocalStorage() {
    try {
        const allAccounts = await db.dbGetAll('accounts');
        const allTransactions = await db.dbGetAll('transactions');
        localStorage.setItem('checkbook_backup', JSON.stringify({ accounts: allAccounts, transactions: allTransactions }));
    } catch (error) { console.error("Failed to back up to LocalStorage:", error); }
}

async function syncFromLocalStorage() {
    const count = await db.dbCount('accounts');
    if (count === 0) {
        const backupJson = localStorage.getItem('checkbook_backup');
        if (backupJson) {
            console.log("Restoring from LocalStorage backup.");
            const backup = JSON.parse(backupJson);
            if (backup.accounts && backup.transactions) {
                 for (const account of backup.accounts) { delete account.id; await db.dbAdd('accounts', account); }
                 for (const tx of backup.transactions) { delete tx.id; await db.dbAdd('transactions', tx); }
            }
        }
    }
}
    
function formatCurrency(num) { 
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num); 
}

// --- MAIN INITIALIZATION FUNCTION ---
async function main() {
    await db.initDB();
    await loadApp();
}

main().catch(console.error);