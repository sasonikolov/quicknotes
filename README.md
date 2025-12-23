# Quick Notes

**Your notes. Your way. Anywhere.**

A powerful, privacy-focused note-taking app that works everywhere - online, offline, or both. No account required for local use, no cloud lock-in, no tracking. Just your notes, beautifully organized.

![PHP](https://img.shields.io/badge/PHP-Backend-777BB4?logo=php&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Frontend-F7DF1E?logo=javascript&logoColor=black)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?logo=bootstrap&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)

---

## Why Quick Notes?

### Work Anywhere - Even Offline
Install as a Progressive Web App on any device. Your notes sync when you're online, but keep working when you're not. Perfect for flights, commutes, or spotty WiFi.

### Your Data, Your Choice
Every single note can be stored exactly where you want:
- **Server Storage** - Sync across all your devices, access from anywhere
- **Local Storage** - Keep sensitive notes private, stored only in your browser
- **Mix & Match** - Some notes on server, some local - you decide per note

### No Vendor Lock-In
- Self-hosted on your own server
- No subscription fees
- No cloud dependency
- Export your data anytime (simple JSON files)

### Privacy First
- No tracking, no analytics, no ads
- Optional IP logging (disabled by default)
- Your notes are encrypted at rest
- Recovery codes instead of email verification

---

## Features

### Hybrid Storage System
The killer feature: **per-note storage selection**. In the edit form, simply check "Store locally" to keep a note in your browser only. Uncheck to sync it to the server. Move notes between storage types anytime.

```
[x] Store locally (browser only)
```

Perfect for:
- Keeping passwords/sensitive data local
- Syncing work notes across devices
- Offline-first workflows

### Smart Organization
- **Sort by Name** - A-Z or Z-A
- **Sort by Date** - Newest or oldest first
- **Sort by Last Edit** - Recently modified on top
- Persistent preferences - your sort choice is remembered

### Multi-Language Interface
Automatic browser language detection with 8 languages:

| Language | Code |
|----------|------|
| English | en |
| Deutsch | de |
| Italiano | it |
| Français | fr |
| Português | pt |
| 日本語 | ja |
| ไทย | th |
| 中文 | zh |

### Beautiful Dark Mode
Easy on the eyes, day or night. Toggle with one click.

### Secure Authentication
Two-layer security:
1. **Global Access Code** - Shared code that changes (e.g., monthly)
2. **Personal Password** - Your private password with recovery code

---

## REST API

Full-featured API for integrations, mobile apps, or automation.

### Endpoints

| Action | Description | Auth |
|--------|-------------|------|
| `get_config` | Get public settings | - |
| `check_user` | Check if user exists | - |
| `set_password` | Create new account | Global |
| `recover_password` | Reset with recovery code | Global |
| `check_login` | Verify credentials | Full |
| `change_password` | Update password | Full |
| `get_notes` | Fetch all notes | Full |
| `add_note` | Create new note | Full |
| `update_note` | Modify existing note | Full |
| `delete_note` | Remove note | Full |

### API Security

Protect your API from unauthorized access:

```php
'require_api_key' => true,
'api_keys' => [
    'mobile-app-key-abc123' => [
        'name' => 'iOS App',
        'domains' => [],  // Allow from anywhere
        'enabled' => true
    ],
    'partner-integration-xyz' => [
        'name' => 'Partner Portal',
        'domains' => ['partner.com', '*.partner.com'],  // Domain locked
        'enabled' => true
    ]
]
```

Send API key via header or parameter:
```bash
# Header method
curl -H "X-API-Key: your-key" https://your-server/api/

# Parameter method
curl "https://your-server/api/?api_key=your-key&action=get_notes"
```

---

## Quick Start

### 1. Deploy
Upload to any PHP-enabled web server (Apache, nginx, etc.)

### 2. Configure
Copy `api/config.example.php` to `api/config.php` and customize:

```php
return [
    // Your secret access code pattern
    'global_code_pattern' => '#myapp_{YYYY}{MM}',  // Changes monthly

    // Storage options
    'enable_pwa' => true,
    'enable_offline_mode' => true,

    // Security
    'require_api_key' => false,  // Enable for external API access
    'store_ip' => false,         // Privacy: don't track IPs
];
```

### 3. Use
Open in browser, create account, start taking notes!

---

## Configuration Reference

### Dynamic Access Codes

The global code can include date placeholders for automatic rotation:

| Placeholder | Output | Example |
|-------------|--------|---------|
| `{YYYY}` | Year (4 digits) | 2025 |
| `{YY}` | Year (2 digits) | 25 |
| `{MM}` | Month | 01-12 |
| `{DD}` | Day | 01-31 |

**Example:** `#secret_{YYYY}{MM}` becomes `#secret_202512` in December 2025

### Password Requirements

```php
'min_password_length' => 6,
'password_require_uppercase' => false,
'password_require_lowercase' => false,
'password_require_number' => false,
```

### User Restrictions

```php
'allowed_usernames' => [],  // Empty = anyone can register
'blocked_usernames' => ['admin', 'root', 'test'],
```

---

## Admin CLI

Manage users from the command line:

```bash
# List all users
php api/admin-cli.php list

# Reset password (user gets new recovery code)
php api/admin-cli.php reset username

# Delete user and all their notes
php api/admin-cli.php delete username
```

---

## Project Structure

```
quick-notes/
├── index.html          # Single-page app
├── main.js             # Application logic
├── lang.js             # i18n translations
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker for offline
├── icons/              # App icons
├── api/
│   ├── index.php       # REST API
│   ├── config.php      # Your configuration
│   └── admin-cli.php   # Admin tools
└── notes/
    └── user_*.json     # User data (auto-created)
```

---

## Tech Stack

- **Frontend:** Vanilla JavaScript, Bootstrap 5.3, Bootstrap Icons
- **Backend:** PHP 7.4+ (no framework, no dependencies)
- **Storage:** JSON files (no database required)
- **PWA:** Service Worker, Web App Manifest

---

## License

MIT - Use it, modify it, sell it. Just don't blame us.

---

**Made with care for people who value simplicity and privacy.**
