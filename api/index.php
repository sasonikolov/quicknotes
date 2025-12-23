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

function getDefaultUserStructure($login) {
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

function migrateUserData($data, $login) {
	// Ensure base structure exists
	$default = getDefaultUserStructure($login);

	if (!isset($data['user']) || !is_array($data['user'])) {
		$data['user'] = $default['user'];
	}
	if (!isset($data['notes']) || !is_array($data['notes'])) {
		$data['notes'] = [];
	}

	// Migrate/repair user properties
	foreach ($default['user'] as $key => $defaultValue) {
		if (!array_key_exists($key, $data['user'])) {
			$data['user'][$key] = $defaultValue;
		}
	}

	// Ensure login is set correctly
	if (empty($data['user']['login'])) {
		$data['user']['login'] = strtolower(trim($login));
	}

	return $data;
}

function loadUserData($login) {
	$file = getUserFilePath($login);
	if (file_exists($file)) {
		$data = json_decode(file_get_contents($file), true);
		if (is_array($data)) {
			// Auto-repair/migrate the data structure
			$data = migrateUserData($data, $login);
			// Save repaired data back
			saveUserData($login, $data);
			return $data;
		}
	}
	return null;
}

function createNewUser($login) {
	return getDefaultUserStructure($login);
}

function saveUserData($login, $data) {
	$file = getUserFilePath($login);
	file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
	return $file;
}

function generateRecoveryCode() {
	return strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 8));
}

function validatePassword($password) {
	$config = getConfig();
	$errors = [];

	if (strlen($password) < $config['min_password_length']) {
		$errors[] = 'at least ' . $config['min_password_length'] . ' characters';
	}

	if (!empty($config['password_require_uppercase']) && !preg_match('/[A-Z]/', $password)) {
		$errors[] = 'one uppercase letter';
	}

	if (!empty($config['password_require_lowercase']) && !preg_match('/[a-z]/', $password)) {
		$errors[] = 'one lowercase letter';
	}

	if (!empty($config['password_require_number']) && !preg_match('/[0-9]/', $password)) {
		$errors[] = 'one number';
	}

	if (!empty($errors)) {
		return 'Password must contain: ' . implode(', ', $errors) . '.';
	}

	return null; // Valid
}

function generateGlobalCode() {
	$config = getConfig();
	$pattern = $config['global_code_pattern'];
	$replacements = [
		'{YYYY}' => date('Y'),
		'{YY}' => date('y'),
		'{MM}' => date('m'),
		'{DD}' => date('d')
	];
	return str_replace(array_keys($replacements), array_values($replacements), $pattern);
}

function getClientIP() {
	$headers = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];
	foreach ($headers as $header) {
		if (!empty($_SERVER[$header])) {
			$ip = $_SERVER[$header];
			// Handle comma-separated IPs (X-Forwarded-For)
			if (strpos($ip, ',') !== false) {
				$ip = trim(explode(',', $ip)[0]);
			}
			if (filter_var($ip, FILTER_VALIDATE_IP)) {
				return $ip;
			}
		}
	}
	return 'unknown';
}

// ============ IP Firewall Functions ============

function ipMatchesCIDR($ip, $cidr) {
	if (strpos($cidr, '/') === false) {
		return $ip === $cidr;
	}
	list($subnet, $mask) = explode('/', $cidr);
	$mask = (int)$mask;

	// Handle IPv6
	if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
		if (!filter_var($subnet, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
			return false;
		}
		$ipBin = inet_pton($ip);
		$subnetBin = inet_pton($subnet);
		$maskBin = str_repeat('f', $mask / 4) . str_repeat('0', 32 - $mask / 4);
		$maskBin = pack('H*', $maskBin);
		return ($ipBin & $maskBin) === ($subnetBin & $maskBin);
	}

	// IPv4
	$ipLong = ip2long($ip);
	$subnetLong = ip2long($subnet);
	$maskLong = -1 << (32 - $mask);
	return ($ipLong & $maskLong) === ($subnetLong & $maskLong);
}

function ipMatchesWildcard($ip, $pattern) {
	$regex = str_replace(['.', '*'], ['\\.', '\\d+'], $pattern);
	return preg_match('/^' . $regex . '$/', $ip) === 1;
}

function ipMatchesPattern($ip, $pattern) {
	// Exact match
	if ($ip === $pattern) {
		return true;
	}
	// CIDR match
	if (strpos($pattern, '/') !== false) {
		return ipMatchesCIDR($ip, $pattern);
	}
	// Wildcard match
	if (strpos($pattern, '*') !== false) {
		return ipMatchesWildcard($ip, $pattern);
	}
	return false;
}

function checkIPFirewall() {
	$config = getConfig();
	$mode = $config['ip_firewall_mode'] ?? 'disabled';

	if ($mode === 'disabled') {
		return true;
	}

	$ip = getClientIP();
	if ($ip === 'unknown') {
		return $mode !== 'whitelist'; // Block unknown IPs in whitelist mode
	}

	if ($mode === 'blacklist') {
		$blacklist = $config['ip_blacklist'] ?? [];
		foreach ($blacklist as $pattern) {
			if (ipMatchesPattern($ip, $pattern)) {
				return false; // IP is blacklisted
			}
		}
		return true; // Not in blacklist, allow
	}

	if ($mode === 'whitelist') {
		$whitelist = $config['ip_whitelist'] ?? [];
		foreach ($whitelist as $pattern) {
			if (ipMatchesPattern($ip, $pattern)) {
				return true; // IP is whitelisted
			}
		}
		return false; // Not in whitelist, block
	}

	return true;
}

// ============ Brute Force Protection ============

function getBruteForceFile() {
	return __DIR__ . '/../notes/.brute_force_log.json';
}

function loadBruteForceData() {
	$file = getBruteForceFile();
	if (file_exists($file)) {
		$data = json_decode(file_get_contents($file), true);
		if (is_array($data)) {
			return $data;
		}
	}
	return [];
}

function saveBruteForceData($data) {
	$file = getBruteForceFile();
	file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}

function cleanupBruteForceData(&$data, $window) {
	$now = time();
	foreach ($data as $ip => $info) {
		// Remove entries older than the window
		if (isset($info['attempts'])) {
			$data[$ip]['attempts'] = array_filter($info['attempts'], function($timestamp) use ($now, $window) {
				return ($now - $timestamp) < $window;
			});
		}
		// Remove lockouts that have expired
		if (isset($info['lockout_until']) && $info['lockout_until'] < $now) {
			unset($data[$ip]['lockout_until']);
		}
		// Remove empty entries
		if (empty($data[$ip]['attempts']) && !isset($data[$ip]['lockout_until'])) {
			unset($data[$ip]);
		}
	}
}

function checkBruteForce() {
	$config = getConfig();
	if (empty($config['brute_force_protection'])) {
		return ['allowed' => true, 'delay' => 0];
	}

	$ip = getClientIP();
	$data = loadBruteForceData();
	$window = $config['brute_force_window'] ?? 900;

	// Cleanup old data
	cleanupBruteForceData($data, $window);
	saveBruteForceData($data);

	// Check if IP is locked out
	if (isset($data[$ip]['lockout_until']) && $data[$ip]['lockout_until'] > time()) {
		$remaining = $data[$ip]['lockout_until'] - time();
		return ['allowed' => false, 'lockout' => true, 'remaining' => $remaining];
	}

	// Count recent attempts
	$attempts = count($data[$ip]['attempts'] ?? []);
	$maxAttempts = $config['brute_force_max_attempts'] ?? 5;

	if ($attempts < $maxAttempts) {
		return ['allowed' => true, 'delay' => 0];
	}

	// Calculate delay (doubles with each attempt over max)
	$baseDelay = $config['brute_force_delay'] ?? 2;
	$maxDelay = $config['brute_force_max_delay'] ?? 30;
	$extraAttempts = $attempts - $maxAttempts;
	$delay = min($baseDelay * pow(2, $extraAttempts), $maxDelay);

	return ['allowed' => true, 'delay' => $delay, 'attempts' => $attempts];
}

function recordFailedAttempt() {
	$config = getConfig();
	if (empty($config['brute_force_protection'])) {
		return;
	}

	$ip = getClientIP();
	$data = loadBruteForceData();
	$window = $config['brute_force_window'] ?? 900;

	// Cleanup old data
	cleanupBruteForceData($data, $window);

	// Record attempt
	if (!isset($data[$ip])) {
		$data[$ip] = ['attempts' => []];
	}
	$data[$ip]['attempts'][] = time();

	// Check for lockout
	$lockoutAttempts = $config['brute_force_lockout_attempts'] ?? 20;
	if ($lockoutAttempts > 0 && count($data[$ip]['attempts']) >= $lockoutAttempts) {
		$lockoutDuration = $config['brute_force_lockout_duration'] ?? 3600;
		$data[$ip]['lockout_until'] = time() + $lockoutDuration;
	}

	saveBruteForceData($data);
}

function clearFailedAttempts() {
	$config = getConfig();
	if (empty($config['brute_force_protection'])) {
		return;
	}

	$ip = getClientIP();
	$data = loadBruteForceData();

	if (isset($data[$ip])) {
		unset($data[$ip]);
		saveBruteForceData($data);
	}
}

function getRequestOrigin() {
	// Check Origin header first, then Referer
	if (!empty($_SERVER['HTTP_ORIGIN'])) {
		return parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST);
	}
	if (!empty($_SERVER['HTTP_REFERER'])) {
		return parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST);
	}
	return null;
}

function matchDomain($domain, $pattern) {
	// Exact match
	if ($domain === $pattern) {
		return true;
	}
	// Wildcard match (*.example.com)
	if (strpos($pattern, '*.') === 0) {
		$suffix = substr($pattern, 2);
		return $domain === $suffix || substr($domain, -strlen($suffix) - 1) === '.' . $suffix;
	}
	return false;
}

function verifyApiKey() {
	$config = getConfig();

	// If API key not required, allow access
	if (empty($config['require_api_key'])) {
		return true;
	}

	// Check if request is from same origin (browser app)
	$origin = getRequestOrigin();
	$serverHost = $_SERVER['HTTP_HOST'] ?? '';
	if ($origin && $origin === $serverHost) {
		return true; // Same-origin request, no API key needed
	}

	// Get API key from header or parameter
	$apiKey = $_SERVER['HTTP_X_API_KEY'] ?? $_REQUEST['api_key'] ?? '';

	if (empty($apiKey)) {
		return false;
	}

	// Check if key exists and is enabled
	$keys = $config['api_keys'] ?? [];
	if (!isset($keys[$apiKey]) || empty($keys[$apiKey]['enabled'])) {
		return false;
	}

	$keyConfig = $keys[$apiKey];

	// Check domain restrictions if any
	if (!empty($keyConfig['domains']) && is_array($keyConfig['domains'])) {
		if (!$origin) {
			return false; // Domain restriction but no origin
		}
		foreach ($keyConfig['domains'] as $allowedDomain) {
			if (matchDomain($origin, $allowedDomain)) {
				return true;
			}
		}
		return false; // No domain matched
	}

	return true; // Key valid, no domain restrictions
}

function verifyGlobalCode($code) {
	$config = getConfig();
	if (!$config['require_global_code']) {
		return true;
	}
	$validCode = generateGlobalCode();
	return $code === $validCode;
}

function getLogin() {
	return isset($_REQUEST['login']) ? strtolower(trim($_REQUEST['login'])) : '';
}

// ============ API Routing ============

// ============ IP Firewall Check (First!) ============
if (!checkIPFirewall()) {
	http_response_code(403);
	echo json_encode(['success' => false, 'message' => 'Access denied.', 'firewall' => true]);
	exit;
}

// ============ Brute Force Check ============
$bruteForceStatus = checkBruteForce();
if (!$bruteForceStatus['allowed']) {
	http_response_code(429);
	$remaining = $bruteForceStatus['remaining'] ?? 0;
	echo json_encode([
		'success' => false,
		'message' => 'Too many failed attempts. Try again in ' . ceil($remaining / 60) . ' minutes.',
		'lockout' => true,
		'retry_after' => $remaining
	]);
	exit;
}
// Apply delay if needed
if (!empty($bruteForceStatus['delay'])) {
	sleep($bruteForceStatus['delay']);
}

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

// Check blocked usernames
if (!empty($login) && !empty($config['blocked_usernames']) && in_array($login, $config['blocked_usernames'])) {
	echo json_encode(['success' => false, 'message' => 'This username is reserved.']);
	exit;
}

// ============ API Key Verification ============
// Verify API key for external access (if required)
if (!verifyApiKey()) {
	echo json_encode(['success' => false, 'message' => 'Invalid or missing API key.', 'api_key_error' => true]);
	exit;
}

// --- get_config: Get public config values ---
if ($action === 'get_config') {
	echo json_encode([
		'success' => true,
		'config' => [
			'enable_pwa' => $config['enable_pwa'] ?? true,
			'enable_offline_mode' => $config['enable_offline_mode'] ?? true,
			'require_global_code' => $config['require_global_code'] ?? true,
			'store_ip' => $config['store_ip'] ?? false
		]
	]);
	exit;
}

// --- check_user: Check if user exists and has password ---
if ($action === 'check_user') {
	if (empty($login)) {
		echo json_encode(['success' => false, 'message' => 'Login required.']);
		exit;
	}

	$userData = loadUserData($login);
	echo json_encode([
		'success' => true,
		'user_exists' => ($userData !== null),
		'has_password' => ($userData !== null && $userData['user']['password_hash'] !== null),
		'require_global_code' => $config['require_global_code']
	]);
	exit;
}

// ============ Actions requiring global code ============

$globalCode = isset($_REQUEST['global_code']) ? trim($_REQUEST['global_code']) : '';

if ($config['require_global_code'] && !verifyGlobalCode($globalCode)) {
	echo json_encode(['success' => false, 'message' => 'Invalid access code.', 'code_error' => true]);
	exit;
}

// --- set_password: Set password for new user ---
if ($action === 'set_password') {
	if (empty($login)) {
		echo json_encode(['success' => false, 'message' => 'Login required.']);
		exit;
	}

	$password = isset($_REQUEST['secret']) ? trim($_REQUEST['secret']) : '';

	$passwordError = validatePassword($password);
	if ($passwordError) {
		echo json_encode(['success' => false, 'message' => $passwordError]);
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

	$passwordError = validatePassword($newPassword);
	if ($passwordError) {
		echo json_encode(['success' => false, 'message' => $passwordError]);
		exit;
	}

	$userData = loadUserData($login);
	if ($userData === null || $userData['user']['recovery_code'] === null) {
		recordFailedAttempt();
		echo json_encode(['success' => false, 'message' => 'Invalid recovery code.']);
		exit;
	}

	if (!password_verify($recoveryCode, $userData['user']['recovery_code'])) {
		recordFailedAttempt();
		echo json_encode(['success' => false, 'message' => 'Invalid recovery code.']);
		exit;
	}

	// Recovery code verified - clear failed attempts
	clearFailedAttempts();

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

// ============ Protected Actions (require global code + personal password) ============

$password = isset($_REQUEST['secret']) ? trim($_REQUEST['secret']) : '';

if (empty($login) || empty($password)) {
	echo json_encode(['success' => false, 'login_error' => true, 'message' => 'Login and password required.']);
	exit;
}

// Verify personal password
$userData = loadUserData($login);
if ($userData === null || $userData['user']['password_hash'] === null) {
	echo json_encode(['success' => false, 'login_error' => true, 'message' => 'Please set a password first.']);
	exit;
}
if (!password_verify($password, $userData['user']['password_hash'])) {
	recordFailedAttempt();
	echo json_encode(['success' => false, 'login_error' => true, 'message' => 'Invalid password.']);
	exit;
}

// Password verified successfully - clear failed attempts
clearFailedAttempts();

// --- check_login ---
if ($action === 'check_login') {
	echo json_encode(['success' => true, 'message' => 'Login successful.']);
	exit;
}

// --- change_password ---
if ($action === 'change_password') {
	$newPassword = isset($_REQUEST['new_password']) ? trim($_REQUEST['new_password']) : '';

	if (empty($newPassword)) {
		echo json_encode(['success' => false, 'message' => 'New password required.']);
		exit;
	}

	$passwordError = validatePassword($newPassword);
	if ($passwordError) {
		echo json_encode(['success' => false, 'message' => $passwordError]);
		exit;
	}

	// Generate new recovery code
	$newRecoveryCode = generateRecoveryCode();

	$userData['user']['password_hash'] = password_hash($newPassword, PASSWORD_DEFAULT);
	$userData['user']['recovery_code'] = password_hash($newRecoveryCode, PASSWORD_DEFAULT);
	saveUserData($login, $userData);

	echo json_encode([
		'success' => true,
		'message' => 'Password changed successfully!',
		'recovery_code' => $newRecoveryCode
	]);
	exit;
}

if (!isset($_REQUEST['data'])) {
	echo json_encode(['success' => false, 'message' => 'No data specified.']);
	exit;
}

// --- get_notes ---
if ($action === 'get_notes') {
	echo json_encode(['success' => true, 'notes' => $userData['notes'] ?? []]);
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

	// Store IP if enabled
	if (!empty($config['store_ip'])) {
		$note['created_ip'] = getClientIP();
		$note['updated_ip'] = $note['created_ip'];
	}

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

	$found = false;
	foreach ($userData['notes'] as &$note) {
		if ($note['id'] === $note_id) {
			$note['title'] = $title;
			$note['content'] = $content;
			$note['updated_at'] = date('c');
			// Store IP if enabled
			if (!empty($config['store_ip'])) {
				$note['updated_ip'] = getClientIP();
			}
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
