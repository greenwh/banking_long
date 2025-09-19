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

// --- CORE APPLICATION FLOW ---
async function loadApp() {
    await loadAccounts();
    const lastAccountId = localStorage.getItem('checkbook_lastAccountId');
    currentAccountId = lastAccountId ? parseInt(lastAccountId) : (accountSelect.options[0] && accountSelect.options[0].value ? parseInt(accountSelect.value) : null);
    
    if (currentAccountId) {
        accountSelect.value = currentAccountId;
        await loadTransactionsForCurrentAccount();
    } else {
        accountNameHeader.textContent = "Create an Account";
        render();
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
    let displayTxs = transactions.filter(tx => {
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
    }).sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() === dateB.getTime()) return 0;
        return filters.sortOrder === 'oldest' ? dateA - dateB : dateB - dateA;
    });

    transactionBody.innerHTML = '';
    let runningBalance = 0;
    displayTxs.forEach(tx => {
        runningBalance += (parseFloat(tx.deposit) || 0) - (parseFloat(tx.withdrawal) || 0);
        transactionBody.appendChild(createTransactionRow(tx, runningBalance));
    });

    if (currentAccountId) {
        transactionBody.appendChild(createTransactionRow(null, runningBalance));
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
    document.getElementById('purge-btn').addEventListener('click', handlePurge);
    document.getElementById('save-btn').addEventListener('click', io.handleJsonExport);
    document.getElementById('load-btn').addEventListener('click', () => document.getElementById('json-import').click());
    document.getElementById('json-import').addEventListener('change', async (e) => {
        if (!e.target.files.length) return;
        try {
            const success = await io.handleJsonImport(e.target.files[0]);
            if (success) {
                localStorage.removeItem('checkbook_lastAccountId');
                await loadApp();
            }
        } catch(err) { console.error(err.message); }
        e.target.value = '';
    });
    document.getElementById('csv-import').addEventListener('change', async (e) => {
        if (!e.target.files.length) return;
        if (!currentAccountId) {
            alert("Please select an account before importing.");
            e.target.value = '';
            return;
        }
        try {
            const success = await io.handleCsvImport(e.target.files[0], currentAccountId, transactions);
            if (success) {
                await loadTransactionsForCurrentAccount();
            }
        } catch(err) { console.error(err.message); }
        e.target.value = '';
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

// **FIX:** Start the application by calling the main function.
main().catch(console.error);