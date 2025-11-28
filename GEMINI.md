# Project Overview
A comprehensive, privacy-first Progressive Web App (PWA) that serves as a digital checkbook register. Built entirely with vanilla JavaScript, HTML5, and CSS3, it operates completely client-side using IndexedDB for local data storage.

## Technical Stack
- **Frontend**: Vanilla JavaScript (ES6 Modules), HTML5, CSS3.
- **Storage**: IndexedDB (`checkbookDB_v3`) + LocalStorage backup.
- **Platform**: PWA (Service Worker, Offline-capable).

## Key Features
- **Multi-Account**: Manage checking, savings, etc.
- **Transaction Management**: Add, edit, filter, sort transactions.
- **Data Portability**: JSON backup/restore.
- **Sync**: CSV Export/Import with "Sync Mode" for multi-device support.
- **Privacy**: Zero server communication.

## Directory Structure
- `index.html`: Entry point.
- `script.js`: Main logic.
- `database.js`: IndexedDB wrapper.
- `data-io.js`: Import/Export logic.
- `service-worker.js`: Offline caching.

## Current Status
- **Stable**: Core features (including multi-device sync) are functional.
- **Version**: 1.0 (Sep 2025)
