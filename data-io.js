// data-io.js

import * as db from './database.js';

// --- JSON IMPORT/EXPORT ---
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

        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const localDateString = `${year}-${month}-${day}`;
        a.download = `checkbook_backup_${localDateString}.json`;

        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("JSON Export Error:", error);
        alert("Failed to export data.");
    }
}

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

                const accountIdMap = new Map();

                for (const account of data.accounts) {
                    const oldId = account.id;
                    delete account.id;
                    const newId = await db.dbAdd('accounts', account);
                    accountIdMap.set(oldId, newId);
                }

                for (const tx of data.transactions) {
                    const oldAccountId = tx.accountId;
                    const newAccountId = accountIdMap.get(oldAccountId);
                    if (newAccountId) {
                        tx.accountId = newAccountId;
                        delete tx.id;
                        await db.dbAdd('transactions', tx);
                    }
                }

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


// --- CSV IMPORT SYSTEM ---
export function processCsvFile(file, currentAccountId, existingTxs) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsedTxs = parseCsv(event.target.result, currentAccountId);
                if (parsedTxs.length === 0) throw new Error("No valid transactions found in the file.");

                const { toUpdate, toAdd } = reconcileTransactions(parsedTxs, existingTxs);
                const summary = `This will reconcile ${toUpdate.length} existing transaction(s) and add ${toAdd.length} new one(s).`;
                
                resolve({ toUpdate, toAdd, summary });

            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsText(file);
    });
}

export async function executeCsvImport(plan, reconcileNew) {
    if (reconcileNew) {
        plan.toAdd.forEach(tx => tx.reconciled = true);
    }
    for (const tx of plan.toUpdate) await db.dbPut('transactions', tx);
    for (const tx of plan.toAdd) await db.dbAdd('transactions', tx);
    
    alert(`Import complete. ${plan.toUpdate.length} updated, ${plan.toAdd.length} added.`);
}

const csvParserProfiles = [{
    name: 'Bank Format 1 (Credit/Debit Columns)',
    header_signature: 'Account,Date,Pending?,Description,Category,Check,Credit,Debit',
    parse: (row, accountId) => {
        const credit = parseFloat(row[6]) || 0;
        const debit = parseFloat(row[7]) || 0;
        return {
            date: new Date(row[1]).toISOString().split('T')[0],
            description: row[3],
            deposit: credit,
            withdrawal: debit,
            accountId, code: '', reconciled: false
        };
    }
}, {
    name: 'Bank Format 2 (Single Amount Column)',
    header_signature: 'Date,Description,Original Description,Category,Amount,Status',
    parse: (row, accountId) => {
        const amount = parseFloat(row[4]);
        return {
            date: new Date(row[0]).toISOString().split('T')[0],
            description: row[1],
            deposit: amount > 0 ? amount : 0,
            withdrawal: amount < 0 ? -amount : 0,
            accountId, code: '', reconciled: false
        };
    }
}];

function parseCsv(csv, accountId) {
    const lines = csv.split(/\r\n|\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    const header = lines.shift().trim();
    const profile = csvParserProfiles.find(p => header.includes(p.header_signature));
    if (!profile) throw new Error("CSV header does not match any known bank format.");

    return lines.map(line => {
        const row = [];
        let currentVal = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    currentVal += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(currentVal.trim());
                currentVal = "";
            } else {
                currentVal += char;
            }
        }
        row.push(currentVal.trim());
        return profile.parse(row, accountId);
    });
}

function reconcileTransactions(parsedTxs, existingTxs) {
    const toUpdate = [];
    const toAdd = [];
    const oneDay = 86400000;
    let availableTxs = existingTxs.filter(tx => !tx.reconciled);

    parsedTxs.forEach(pTx => {
        const pTxDate = new Date(pTx.date).getTime();
        const pTxAmount = pTx.deposit > 0 ? pTx.deposit : -(pTx.withdrawal);

        const matchIndex = availableTxs.findIndex(eTx => {
            const eTxDate = new Date(eTx.date).getTime();
            const eTxAmount = (eTx.deposit > 0 ? eTx.deposit : -(eTx.withdrawal));
            const dateDiff = Math.abs(pTxDate - eTxDate);
            const amountDiff = Math.abs(pTxAmount - eTxAmount);
            return amountDiff < 0.01 && dateDiff <= oneDay;
        });

        if (matchIndex > -1) {
            const matchedTx = availableTxs[matchIndex];
            matchedTx.reconciled = true;
            toUpdate.push(matchedTx);
            availableTxs.splice(matchIndex, 1);
        } else {
            toAdd.push(pTx);
        }
    });

    return { toUpdate, toAdd };
}