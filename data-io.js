// data-io.js

import * as db from './database.js';

/**
 * Exports all accounts and transactions to a JSON file.
 */
export async function handleJsonExport() {
    if (!confirm("This will export ALL accounts and transactions. Continue?")) return;
    try {
        const allAccounts = await db.dbGetAll('accounts');
        const allTransactions = await db.dbGetAll('transactions');
        const data = { accounts: allAccounts, transactions: allTransactions };
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `checkbook_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("JSON Export Error:", error);
        alert("Failed to export data.");
    }
}

/**
 * Imports a JSON file, replacing all existing data.
 * @param {File} file The JSON file to import.
 * @returns {Promise<boolean>} A promise that resolves to true if successful.
 */
export function handleJsonImport(file) {
    return new Promise((resolve, reject) => {
        if (!confirm("WARNING: This will replace ALL current data. This cannot be undone. Are you sure?")) {
            return reject(new Error("Import cancelled by user."));
        }
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!data.accounts || !data.transactions) throw new Error("Invalid file format");
                await db.dbClear('transactions');
                await db.dbClear('accounts');
                for (const account of data.accounts) { delete account.id; await db.dbAdd('accounts', account); }
                for (const tx of data.transactions) { delete tx.id; await db.dbAdd('transactions', tx); }
                alert("Import successful! Reloading application.");
                resolve(true);
            } catch (error) {
                alert('Error processing file: ' + error.message);
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsText(file);
    });
}

/**
 * Imports a CSV file, attempts to reconcile with existing transactions, and adds new ones.
 * @param {File} file The CSV file to import.
 * @param {number} currentAccountId The ID of the account to import into.
 * @param {Array<Object>} existingTxs The existing transactions for the current account.
 * @returns {Promise<boolean>} A promise that resolves to true if successful.
 */
export function handleCsvImport(file, currentAccountId, existingTxs) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const parsedTxs = parseCsv(event.target.result, currentAccountId);
                if (parsedTxs.length === 0) throw new Error("No valid transactions found in the file.");

                const { toUpdate, toAdd } = reconcileTransactions(parsedTxs, existingTxs);

                if (confirm(`Reconcile ${toUpdate.length} and add ${toAdd.length} new transactions?`)) {
                    for (const tx of toUpdate) await db.dbPut('transactions', tx);
                    for (const tx of toAdd) await db.dbAdd('transactions', tx);
                    alert(`Reconciliation complete. ${toUpdate.length} updated, ${toAdd.length} added.`);
                    resolve(true);
                } else {
                    reject(new Error("CSV import cancelled by user."));
                }
            } catch (error) {
                alert("CSV Import Error: " + error.message);
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsText(file);
    });
}

/**
 * Parses a raw CSV string into an array of transaction objects.
 * @param {string} csv The raw CSV text content.
 * @param {number} accountId The ID to assign to the new transactions.
 * @returns {Array<Object>}
 */
function parseCsv(csv, accountId) {
    const lines = csv.split(/\r\n|\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    const header = lines.shift().trim();
    const format1Sig = 'Account,Date,Pending?,Description,Category,Check,Credit,Debit';
    const format2Sig = 'Date,Description,Original Description,Category,Amount,Status';
    let format;
    if (header.includes(format1Sig)) format = 'format1';
    else if (header.includes(format2Sig)) format = 'format2';
    else throw new Error("CSV header does not match known bank formats.");

    return lines.map(line => {
        const data = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g).map(d => d.trim().replace(/"/g, ''));
        const tx = { accountId: accountId, reconciled: false, code: 'CSV' };
        if (format === 'format1') {
            tx.date = new Date(data[1]).toISOString().split('T')[0];
            tx.description = data[3];
            tx.deposit = parseFloat(data[6]) || 0;
            tx.withdrawal = parseFloat(data[7]) || 0;
        } else { // format2
            tx.date = new Date(data[0]).toISOString().split('T')[0];
            tx.description = data[1];
            const amount = parseFloat(data[4]);
            tx.deposit = amount > 0 ? amount : 0;
            tx.withdrawal = amount < 0 ? -amount : 0;
        }
        return tx;
    });
}

/**
 * Compares parsed CSV transactions with existing ones to find matches for reconciliation.
 * @param {Array<Object>} parsedTxs Transactions from the CSV file.
 * @param {Array<Object>} existingTxs Unreconciled transactions from the database.
 * @returns {{toUpdate: Array<Object>, toAdd: Array<Object>}}
 */
function reconcileTransactions(parsedTxs, existingTxs) {
    const toUpdate = [];
    const toAdd = [];
    const oneDay = 86400000; // milliseconds in a day

    let availableTxs = existingTxs.filter(tx => !tx.reconciled);

    parsedTxs.forEach(pTx => {
        const pTxDate = new Date(pTx.date).getTime();
        const pTxAmount = pTx.deposit > 0 ? pTx.deposit : -pTx.withdrawal;

        const matchIndex = availableTxs.findIndex(eTx => {
            const eTxDate = new Date(eTx.date).getTime();
            const eTxAmount = (eTx.deposit > 0 ? eTx.deposit : -eTx.withdrawal);
            const dateDiff = Math.abs(pTxDate - eTxDate);
            const amountDiff = Math.abs(pTxAmount - eTxAmount);

            // Match if amounts are identical and date is within +/- 1 day
            return amountDiff < 0.01 && dateDiff <= oneDay;
        });

        if (matchIndex > -1) {
            // Found a match
            const matchedTx = availableTxs[matchIndex];
            matchedTx.reconciled = true; // Mark for update
            toUpdate.push(matchedTx);
            availableTxs.splice(matchIndex, 1); // Remove from pool to prevent double-matching
        } else {
            // No match found, mark for addition
            toAdd.push(pTx);
        }
    });

    return { toUpdate, toAdd };
}