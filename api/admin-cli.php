#!/usr/bin/env php
<?php
/**
 * Quick Notes Admin CLI
 *
 * Usage:
 *   php admin-cli.php list                    - List all users
 *   php admin-cli.php reset <username>        - Reset password for user (generates new recovery code)
 *   php admin-cli.php delete <username>       - Delete user and all their notes
 *
 * IMPORTANT: This script can only be run from the command line!
 */

// Block web access
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die('Access denied. This script can only be run from the command line.');
}

// Helper functions
function getNotesFolder() {
    return __DIR__ . '/../notes';
}

function getUserFiles() {
    $path = getNotesFolder();
    if (!is_dir($path)) {
        return [];
    }
    return glob($path . '/user_*.json');
}

function loadUserData($file) {
    if (!file_exists($file)) {
        return null;
    }
    $data = json_decode(file_get_contents($file), true);
    return (is_array($data) && isset($data['user'])) ? $data : null;
}

function saveUserData($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}

function findUserFile($username) {
    $path = getNotesFolder();
    $file = $path . '/user_' . md5(strtolower(trim($username))) . '.json';
    return file_exists($file) ? $file : null;
}

function generateRecoveryCode() {
    return strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 8));
}

// Commands
function listUsers() {
    $files = getUserFiles();

    if (empty($files)) {
        echo "No users found.\n";
        return;
    }

    echo "\n";
    echo str_pad("Username", 20) . str_pad("Notes", 10) . str_pad("Created", 25) . "Has Password\n";
    echo str_repeat("-", 70) . "\n";

    foreach ($files as $file) {
        $data = loadUserData($file);
        if ($data) {
            $username = $data['user']['login'] ?? 'unknown';
            $notesCount = count($data['notes'] ?? []);
            $created = $data['user']['created_at'] ?? 'unknown';
            $hasPassword = !empty($data['user']['password_hash']) ? 'Yes' : 'No';

            echo str_pad($username, 20);
            echo str_pad($notesCount, 10);
            echo str_pad($created, 25);
            echo $hasPassword . "\n";
        }
    }
    echo "\n";
}

function resetPassword($username) {
    $file = findUserFile($username);

    if (!$file) {
        echo "Error: User '$username' not found.\n";
        return false;
    }

    $data = loadUserData($file);
    if (!$data) {
        echo "Error: Could not read user data.\n";
        return false;
    }

    // Generate new recovery code
    $newRecoveryCode = generateRecoveryCode();

    // Clear password and set new recovery code
    $data['user']['password_hash'] = null;
    $data['user']['recovery_code'] = password_hash($newRecoveryCode, PASSWORD_DEFAULT);

    saveUserData($file, $data);

    echo "\n";
    echo "Password reset for user: {$data['user']['login']}\n";
    echo "New recovery code: $newRecoveryCode\n";
    echo "\n";
    echo "The user will be prompted to create a new password on next login.\n";
    echo "Give them this recovery code if they need to recover their account.\n";
    echo "\n";

    return true;
}

function deleteUser($username) {
    $file = findUserFile($username);

    if (!$file) {
        echo "Error: User '$username' not found.\n";
        return false;
    }

    $data = loadUserData($file);
    $notesCount = count($data['notes'] ?? []);

    echo "Are you sure you want to delete user '{$data['user']['login']}' and their $notesCount notes? (yes/no): ";
    $confirm = trim(fgets(STDIN));

    if (strtolower($confirm) !== 'yes') {
        echo "Cancelled.\n";
        return false;
    }

    unlink($file);
    echo "User '{$data['user']['login']}' and all their notes have been deleted.\n";
    return true;
}

// Main
if ($argc < 2) {
    echo "Quick Notes Admin CLI\n\n";
    echo "Usage:\n";
    echo "  php admin-cli.php list              - List all users\n";
    echo "  php admin-cli.php reset <username>  - Reset password for user\n";
    echo "  php admin-cli.php delete <username> - Delete user and notes\n";
    exit(1);
}

$command = $argv[1];

switch ($command) {
    case 'list':
        listUsers();
        break;

    case 'reset':
        if ($argc < 3) {
            echo "Error: Username required.\n";
            echo "Usage: php admin-cli.php reset <username>\n";
            exit(1);
        }
        resetPassword($argv[2]);
        break;

    case 'delete':
        if ($argc < 3) {
            echo "Error: Username required.\n";
            echo "Usage: php admin-cli.php delete <username>\n";
            exit(1);
        }
        deleteUser($argv[2]);
        break;

    default:
        echo "Unknown command: $command\n";
        echo "Run 'php admin-cli.php' for help.\n";
        exit(1);
}
