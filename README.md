# Quick Notes

A modern, secure note-taking PWA with multi-language support, offline mode, and flexible authentication.

![PHP](https://img.shields.io/badge/PHP-Backend-777BB4?logo=php&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Frontend-F7DF1E?logo=javascript&logoColor=black)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?logo=bootstrap&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)

## Features

### Core Features
- **User Accounts** - Each user has their own password-protected notes
- **Dual Authentication** - Global access code + personal password
- **Recovery Codes** - Forgot your password? Use your recovery code
- **Dark Mode** - Toggle between light and dark themes
- **Mobile-Friendly** - Responsive design, works great on all devices
- **No Database Required** - Notes stored as JSON files

### Multi-Language Support
Supports 8 languages with automatic browser detection:
- English, Deutsch, Italiano, Francais, Portugues, Japanese, Thai, Chinese

### PWA & Offline Mode
- **Progressive Web App** - Install on mobile/desktop
- **Offline Storage** - Store notes locally in browser
- **Per-Note Storage** - Choose server or local storage for each note
- **Service Worker** - Works offline when installed

### Sorting & Organization
- Sort notes by Name (A-Z, Z-A)
- Sort by Date created (newest/oldest)
- Sort by Last edited (newest/oldest)
- Persistent sort preference

### Security
- **API Key Protection** - Secure external API access
- **Domain Restrictions** - Restrict API keys to specific domains
- **IP Logging** - Optional IP tracking for notes
- **bcrypt Hashing** - Passwords and recovery codes securely hashed

## Setup

1. Deploy to a PHP-enabled web server (Apache/nginx)
2. Ensure the `notes/` directory is writable by the web server
3. Configure `api/config.php` (see Configuration below)

## Configuration

Edit `api/config.php` to customize:

```php
return [
    // PWA Features
    'enable_pwa' => true,              // Enable Service Worker & offline caching
    'enable_offline_mode' => true,     // Allow local browser storage option

    // Authentication
    'require_global_code' => true,     // Require global access code + password
    'global_code_pattern' => '{YYYY}{MM}',  // Pattern: #secret_{DD} = #secret_23

    // Password Rules
    'min_password_length' => 6,
    'password_require_uppercase' => false,
    'password_require_lowercase' => false,
    'password_require_number' => false,

    // User Restrictions
    'allowed_usernames' => [],         // Empty = allow any
    'blocked_usernames' => ['admin', 'root', 'administrator', 'test'],

    // Privacy
    'store_ip' => false,               // Store IP with notes

    // API Security
    'require_api_key' => false,        // Require API key for external access
    'api_keys' => [
        // 'your-api-key' => [
        //     'name' => 'Mobile App',
        //     'domains' => [],           // Empty = no restriction
        //     'enabled' => true
        // ]
    ],
];
```

### Global Code Pattern

The global access code can include date placeholders:
- `{YYYY}` - Year (4 digits): 2025
- `{YY}` - Year (2 digits): 25
- `{MM}` - Month: 01-12
- `{DD}` - Day: 01-31

Example: `#secret_{YYYY}{MM}` becomes `#secret_202512` in December 2025

### API Keys

When `require_api_key` is enabled, external API requests need a valid key:

```php
'api_keys' => [
    'my-secret-key-123' => [
        'name' => 'Mobile App',
        'domains' => [],  // No domain restriction
        'enabled' => true
    ],
    'partner-key-456' => [
        'name' => 'Partner Website',
        'domains' => ['partner.com', '*.partner.com'],  // Restricted to domain
        'enabled' => true
    ]
]
```

API key can be sent via:
- Header: `X-API-Key: your-key`
- Parameter: `?api_key=your-key`

## Admin CLI

Manage users from the command line:

```bash
# List all users
php api/admin-cli.php list

# Reset a user's password
php api/admin-cli.php reset <username>

# Delete a user and all their notes
php api/admin-cli.php delete <username>
```

## Project Structure

```
quick-notes/
├── index.html          # Main app (HTML + CSS)
├── main.js             # Frontend logic
├── lang.js             # Translations (8 languages)
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker
├── icons/              # PWA icons
├── api/
│   ├── index.php       # REST API
│   ├── config.php      # Configuration (protected)
│   ├── admin-cli.php   # Admin CLI tool (protected)
│   └── .htaccess       # Protects config files
└── notes/
    ├── .htaccess       # Protects user data
    └── user_*.json     # User data files
```

## API Endpoints

| Action | Description | Auth Required |
|--------|-------------|---------------|
| `get_config` | Get public config | No |
| `check_user` | Check if user exists | No |
| `set_password` | Create account | Global Code |
| `recover_password` | Reset password | Global Code |
| `check_login` | Verify credentials | Yes |
| `change_password` | Change password | Yes |
| `get_notes` | Get all notes | Yes |
| `add_note` | Create note | Yes |
| `update_note` | Update note | Yes |
| `delete_note` | Delete note | Yes |

**Auth Levels:**
- **No**: No authentication required
- **Global Code**: Requires global access code
- **Yes**: Requires global code + personal password

## License

MIT
