<?php
// activate error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// catch errors and exceptions
set_error_handler(function($severity, $message, $file, $line) {
	throw new ErrorException($message, 0, $severity, $file, $line);
});
set_exception_handler(function($exception) {
	http_response_code(500);
	$message = $exception->getMessage();
	$message .= " in ".$exception->getFile()." on line ".$exception->getLine().".";
	echo json_encode(['success' => false, 'message' => $message]);
	exit;
});

// set response headers
header('Content-Type: application/json; charset=utf-8');

// load config
$config = require __DIR__ . '/config.php';

// ============ Helper Functions ============

function getConfig() {
	global $config;
	return $config;
}

function getNotesFolder() {
	return __DIR__ . '/../notes';
}

function checkAndGetNotesFolder() {
	$path = getNotesFolder();
	if (!file_exists($path)) {
		mkdir($path, 0775, true);
		$htaccess_content = "Options -Indexes\nServerSignature Off\n<Files \"*\">\n  Require all denied\n</Files>\n";
		file_put_contents($path . '/.htaccess', $htaccess_content);
	}
	if (!is_writable($path)) {
		throw new Exception('Notes directory is not writable: '.$path);
	}
	return $path;
}

function getUserFilePath($login) {
	$path = checkAndGetNotesFolder();
	return $path . '/user_' . md5(strtolower(trim($login))) . '.json';
}

function loadUserData($login) {
	$file = getUserFilePath($login);
	if (file_exists($file)) {
		$data = json_decode(file_get_contents($file), true);
		if (is_array($data) && isset($data['user']) && isset($data['notes'])) {
			return $data;
		}
	}
	return null;
}

function createNewUser($login) {
	return [
		'user' => [
			'login' => strtolower(trim($login)),
			'password_hash' => null,
			'recovery_code' => null,
			'created_at' => date('c')
		],
		'notes' => []
	];
}

function saveUserData($login, $data) {
	$file = getUserFilePath($login);
	file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
	return $file;
}

function generateRecoveryCode() {
	return strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 8));
}

function generateGlobalPassword() {
	$config = getConfig();
	$pattern = $config['global_password_pattern'];
	$replacements = [
		'{YYYY}' => date('Y'),
		'{YY}' => date('y'),
		'{MM}' => date('m'),
		'{DD}' => date('d')
	];
	return str_replace(array_keys($replacements), array_values($replacements), $pattern);
}

function getLogin() {
	return isset($_REQUEST['login']) ? strtolower(trim($_REQUEST['login'])) : '';
}

// ============ API Routing ============

if (!isset($_REQUEST['action'])) {
	echo json_encode(['success' => false, 'message' => 'No action specified.']);
	exit;
}

$action = $_REQUEST['action'];
$login = getLogin();
$config = getConfig();

// Check allowed usernames
if (!empty($login) && !empty($config['allowed_usernames']) && !in_array($login, $config['allowed_usernames'])) {
	echo json_encode(['success' => false, 'message' => 'Username not allowed.']);
	exit;
}

// --- check_user: Check if user exists and has password ---
if ($action === 'check_user') {
	if (empty($login)) {
		echo json_encode(['success' => false, 'message' => 'Login required.']);
		exit;
	}

	// Global password mode - always require password
	if ($config['password_mode'] === 'global') {
		echo json_encode([
			'success' => true,
			'user_exists' => true,
			'has_password' => true,
			'mode' => 'global'
		]);
		exit;
	}

	// Individual password mode
	$userData = loadUserData($login);
	if ($userData === null) {
		// New user
		echo json_encode([
			'success' => true,
			'user_exists' => false,
			'has_password' => false,
			'mode' => 'individual'
		]);
	} else {
		// Existing user
		echo json_encode([
			'success' => true,
			'user_exists' => true,
			'has_password' => ($userData['user']['password_hash'] !== null),
			'mode' => 'individual'
		]);
	}
	exit;
}

// --- set_password: Set password for new user ---
if ($action === 'set_password') {
	if (empty($login)) {
		echo json_encode(['success' => false, 'message' => 'Login required.']);
		exit;
	}

	$password = isset($_REQUEST['secret']) ? trim($_REQUEST['secret']) : '';

	if (strlen($password) < $config['min_password_length']) {
		echo json_encode([
			'success' => false,
			'message' => 'Password must be at least ' . $config['min_password_length'] . ' characters.'
		]);
		exit;
	}

	$userData = loadUserData($login);
	if ($userData === null) {
		$userData = createNewUser($login);
	}

	if ($userData['user']['password_hash'] !== null) {
		echo json_encode(['success' => false, 'message' => 'User already has a password.']);
		exit;
	}

	// Generate recovery code
	$recoveryCode = generateRecoveryCode();

	$userData['user']['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
	$userData['user']['recovery_code'] = password_hash($recoveryCode, PASSWORD_DEFAULT);
	saveUserData($login, $userData);

	echo json_encode([
		'success' => true,
		'message' => 'Password set successfully!',
		'recovery_code' => $recoveryCode
	]);
	exit;
}

// --- recover_password: Reset password with recovery code ---
if ($action === 'recover_password') {
	if (empty($login)) {
		echo json_encode(['success' => false, 'message' => 'Login required.']);
		exit;
	}

	$recoveryCode = isset($_REQUEST['recovery_code']) ? strtoupper(trim($_REQUEST['recovery_code'])) : '';
	$newPassword = isset($_REQUEST['secret']) ? trim($_REQUEST['secret']) : '';

	if (empty($recoveryCode) || empty($newPassword)) {
		echo json_encode(['success' => false, 'message' => 'Recovery code and new password required.']);
		exit;
	}

	if (strlen($newPassword) < $config['min_password_length']) {
		echo json_encode([
			'success' => false,
			'message' => 'Password must be at least ' . $config['min_password_length'] . ' characters.'
		]);
		exit;
	}

	$userData = loadUserData($login);
	if ($userData === null || $userData['user']['recovery_code'] === null) {
		echo json_encode(['success' => false, 'message' => 'Invalid recovery code.']);
		exit;
	}

	if (!password_verify($recoveryCode, $userData['user']['recovery_code'])) {
		echo json_encode(['success' => false, 'message' => 'Invalid recovery code.']);
		exit;
	}

	// Generate new recovery code
	$newRecoveryCode = generateRecoveryCode();

	$userData['user']['password_hash'] = password_hash($newPassword, PASSWORD_DEFAULT);
	$userData['user']['recovery_code'] = password_hash($newRecoveryCode, PASSWORD_DEFAULT);
	saveUserData($login, $userData);

	echo json_encode([
		'success' => true,
		'message' => 'Password reset successfully!',
		'recovery_code' => $newRecoveryCode
	]);
	exit;
}

// ============ Protected Actions (require password) ============

$password = isset($_REQUEST['secret']) ? trim($_REQUEST['secret']) : '';

if (empty($login) || empty($password)) {
	echo json_encode(['success' => false, 'login_error' => true, 'message' => 'Login and password required.']);
	exit;
}

// Verify password
if ($config['password_mode'] === 'global') {
	$valid_password = generateGlobalPassword();
	if ($password !== $valid_password) {
		echo json_encode(['success' => false, 'login_error' => true, 'message' => 'Invalid password.']);
		exit;
	}
} else {
	$userData = loadUserData($login);
	if ($userData === null || $userData['user']['password_hash'] === null) {
		echo json_encode(['success' => false, 'login_error' => true, 'message' => 'Please set a password first.']);
		exit;
	}
	if (!password_verify($password, $userData['user']['password_hash'])) {
		echo json_encode(['success' => false, 'login_error' => true, 'message' => 'Invalid password.']);
		exit;
	}
}

// --- check_login ---
if ($action === 'check_login') {
	echo json_encode(['success' => true, 'message' => 'Login successful.']);
	exit;
}

if (!isset($_REQUEST['data'])) {
	echo json_encode(['success' => false, 'message' => 'No data specified.']);
	exit;
}

// --- get_notes ---
if ($action === 'get_notes') {
	if ($config['password_mode'] === 'global') {
		// Legacy: use old file format
		$path = checkAndGetNotesFolder();
		$notes_file = $path . '/notes_' . md5($login) . '.json';
		$notes = [];
		if (file_exists($notes_file)) {
			$notes = json_decode(file_get_contents($notes_file), true) ?: [];
		}
		echo json_encode(['success' => true, 'notes' => $notes]);
	} else {
		$userData = loadUserData($login);
		echo json_encode(['success' => true, 'notes' => $userData['notes'] ?? []]);
	}
	exit;
}

// --- add_note ---
if ($action === 'add_note') {
	$data = json_decode($_REQUEST['data'], true);
	$title = isset($data['title']) ? trim($data['title']) : '';
	$content = isset($data['content']) ? trim($data['content']) : '';

	if ($title === '' || $content === '') {
		echo json_encode(['success' => false, 'message' => 'Title and content are required.']);
		exit;
	}

	$note = [
		'id' => uniqid(),
		'title' => $title,
		'content' => $content,
		'created_at' => date('c'),
		'updated_at' => date('c')
	];

	$userData = loadUserData($login);
	$userData['notes'][] = $note;
	saveUserData($login, $userData);

	echo json_encode(['success' => true, 'message' => 'Note added successfully.', 'note' => $note]);
	exit;
}

// --- update_note ---
if ($action === 'update_note') {
	$data = json_decode($_REQUEST['data'], true);
	$note_id = isset($data['id']) ? trim($data['id']) : '';
	$title = isset($data['title']) ? trim($data['title']) : '';
	$content = isset($data['content']) ? trim($data['content']) : '';

	if ($note_id === '' || $title === '' || $content === '') {
		echo json_encode(['success' => false, 'message' => 'Note ID, title and content are required.']);
		exit;
	}

	$userData = loadUserData($login);
	$found = false;

	foreach ($userData['notes'] as &$note) {
		if ($note['id'] === $note_id) {
			$note['title'] = $title;
			$note['content'] = $content;
			$note['updated_at'] = date('c');
			$found = true;
			break;
		}
	}

	if (!$found) {
		echo json_encode(['success' => false, 'message' => 'Note not found.']);
		exit;
	}

	saveUserData($login, $userData);
	echo json_encode(['success' => true, 'message' => 'Note updated successfully.']);
	exit;
}

// --- delete_note ---
if ($action === 'delete_note') {
	$data = json_decode($_REQUEST['data'], true);
	$note_id = isset($data['id']) ? trim($data['id']) : '';

	if ($note_id === '') {
		echo json_encode(['success' => false, 'message' => 'Note ID is required.']);
		exit;
	}

	$userData = loadUserData($login);
	$found = false;

	foreach ($userData['notes'] as $index => $note) {
		if ($note['id'] === $note_id) {
			unset($userData['notes'][$index]);
			$found = true;
			break;
		}
	}

	if (!$found) {
		echo json_encode(['success' => false, 'message' => 'Note not found.']);
		exit;
	}

	$userData['notes'] = array_values($userData['notes']);
	saveUserData($login, $userData);

	echo json_encode(['success' => true, 'message' => 'Note deleted successfully.']);
	exit;
}

// default response
echo json_encode(['success' => false, 'message' => 'Invalid API call for action: "'.strip_tags($action).'".']);
exit;
