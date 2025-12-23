# Quick Notes

A simple, modern note-taking web app with a clean UI, dark mode, and secure user authentication.

![PHP](https://img.shields.io/badge/PHP-Backend-777BB4?logo=php&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Frontend-F7DF1E?logo=javascript&logoColor=black)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?logo=bootstrap&logoColor=white)

## Features

- **User Accounts** - Each user has their own password-protected notes
- **Recovery Codes** - Forgot your password? Use your recovery code to reset it
- **Dark Mode** - Toggle between light and dark themes
- **Mobile-Friendly** - Responsive design with accordion-style note viewer
- **Secure Logout** - Clears all credentials from memory
- **No Database Required** - Notes stored as JSON files

## Setup

1. Deploy to a PHP-enabled web server (Apache/nginx)
2. Ensure the `notes/` directory is writable by the web server
3. Configure `api/config.php` (see Configuration below)

## Configuration

Edit `api/config.php` to customize:

```php
return [
    // 'individual' = each user has their own password
    // 'global' = all users share the same password pattern
    'password_mode' => 'individual',

    // Global password pattern (only for 'global' mode)
    // Placeholders: {YYYY}, {YY}, {MM}, {DD}
    'global_password_pattern' => '#secret_{YYYY}{MM}',

    // Minimum password length
    'min_password_length' => 6,

    // Restrict usernames (empty = allow any)
    'allowed_usernames' => [],
];
```

## Admin CLI

Manage users from the command line:

```bash
# List all users
php api/admin-cli.php list

# Reset a user's password (clears password, generates new recovery code)
php api/admin-cli.php reset <username>

# Delete a user and all their notes
php api/admin-cli.php delete <username>
```

**Example: Reset forgotten password**
```bash
$ php api/admin-cli.php reset saso

Password reset for user: saso
New recovery code: A1B2C3D4

The user will be prompted to create a new password on next login.
Give them this recovery code if they need to recover their account.
```

## Security

- Passwords are hashed with `password_hash()` (bcrypt)
- Recovery codes are also stored hashed
- `config.php` and `admin-cli.php` are protected from web access via `.htaccess`
- User data files in `notes/` are protected from direct download

## Project Structure

```
quick-notes/
├── index.html          # Main app (HTML + CSS)
├── main.js             # Frontend logic
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
| `check_user` | Check if user exists | No |
| `set_password` | Create account with password | No |
| `recover_password` | Reset password with recovery code | No |
| `check_login` | Verify credentials | Yes |
| `get_notes` | Get all notes | Yes |
| `add_note` | Create note | Yes |
| `update_note` | Update note | Yes |
| `delete_note` | Delete note | Yes |

## License

MIT
