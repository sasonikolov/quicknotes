# Quick Notes

A simple, modern note-taking web app with a clean UI and dark mode support.

![Quick Notes](https://img.shields.io/badge/PHP-Backend-777BB4?logo=php&logoColor=white)
![Quick Notes](https://img.shields.io/badge/JavaScript-Frontend-F7DF1E?logo=javascript&logoColor=black)
![Quick Notes](https://img.shields.io/badge/Bootstrap-5.3-7952B3?logo=bootstrap&logoColor=white)

## Features

- **Create, Edit, Delete Notes** - Full CRUD functionality
- **Dark Mode** - Toggle between light and dark themes (saved in browser)
- **Mobile-Friendly** - Accordion-style note viewer, responsive design
- **Secure Logout** - Clears all credentials from memory, no traces left
- **No Database Required** - Notes stored as JSON files on server

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Vanilla JavaScript, Bootstrap 5.3, Bootstrap Icons |
| Backend | PHP |
| Storage | JSON files (per user) |

## Setup

1. Deploy to a PHP-enabled web server (Apache/nginx)
2. Ensure the `notes/` directory is writable by the web server
3. Open `index.html` in your browser

## Project Structure

```
notes/
├── index.html      # Main app (HTML + CSS)
├── main.js         # Frontend logic (QuickNotesApp)
├── api/
│   └── index.php   # REST-like API
└── notes/
    ├── .htaccess   # Protects note files from direct access
    └── *.json      # User note files (auto-generated)
```

## API Endpoints

All requests are POST to `api/` with parameters: `action`, `login`, `secret`, `data`

| Action | Description |
|--------|-------------|
| `check_login` | Validate credentials |
| `get_notes` | Get all notes for user |
| `add_note` | Create new note |
| `update_note` | Update existing note |
| `delete_note` | Delete note by ID |

## License

MIT
