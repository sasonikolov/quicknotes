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
	// add line number and file to message
	$message .= " in ".$exception->getFile()." on line ".$exception->getLine().".";
	echo json_encode(['status' => 'error', 'message' => $message, 'data' => print_r($_REQUEST, true)]);
	exit;
});

// set response headers
header('Content-Type: application/json; charset=utf-8');

// helpers

function check_secret_key($login, $secret) {
	$login = strtolower(trim($login));	
	$secret = trim($secret);
	//
	$valid_key = date("Ym"); // replace with your actual secret key
	//$valid_key = "123"; // for testing purposes	
	return $secret == $valid_key && $login == 'saso';
}

function getLogin() {
	return isset($_REQUEST['login']) ? $_REQUEST['login'] : '';
}
function checkLogin() {
	$login = getLogin();
	$secret = isset($_REQUEST['secret']) ? $_REQUEST['secret'] : '';
	if (!check_secret_key($login, $secret)) {
		echo json_encode(['success' => false, 'login_error'=>true, 'message' => 'Invalid secret key.']);
		exit;
	}
}

function getNotesFolder() {
	return __DIR__ . '/../notes';
}
function checkAndGetNotesFolder() {
	$notes_dir = __DIR__;
	if (!is_writable($notes_dir)) {
		throw new Exception('Notes directory is not writable: '.$notes_dir);
	}
	$path = getNotesFolder();
	if (!file_exists($path)) {
		mkdir($path, 0775, true);
		// add .htaccess file to prevent direct access
		$htaccess_content = "Options -Indexes\nServerSignature Off\n<Files \"*\">\n  Require all denied\n</Files>\n";
		file_put_contents($path . '/.htaccess', $htaccess_content);
	}
	if (!is_writable($path)) {
		throw new Exception('Notes directory is not writable: '.$path);
	}
	return $path;
}

function loadNotes() {
	$login = getLogin();
	$path = checkAndGetNotesFolder();
	$notes_file = $path . '/notes_' . md5($login) . '.json';
	$notes = [];
	if (file_exists($notes_file)) {
		$notes_json = file_get_contents($notes_file);
		$notes = json_decode($notes_json, true);
		if (!is_array($notes)) {
			$notes = [];
		}
	}
	return $notes;
}
function saveNotes($notes) {
	$login = getLogin();
	$path = checkAndGetNotesFolder();
	$notes_file = $path . '/notes_' . md5($login) . '.json';
	file_put_contents($notes_file, json_encode($notes, JSON_PRETTY_PRINT));
	return $notes_file;
}

// ------------ check which api call was made
if (!isset($_REQUEST['action'])) {
	echo json_encode(['success' => false, 'message' => 'No action specified.']);
	exit;
}

if (!isset($_REQUEST['secret']) || !isset($_REQUEST['login'])) {
	echo json_encode(['success' => false, 'message' => 'No login specified.']);
	exit;
}

checkLogin(); // wird immer gemacht.

// - check_login to check if api is reachable and secret key is valid
if (isset($_REQUEST['action']) && $_REQUEST['action'] === 'check_login') {	
	echo json_encode(['success' => true, 'message' => 'Login successful.']);
	exit;
}

if (!isset($_REQUEST['data'])) {
	echo json_encode(['success' => false, 'message' => 'No data specified.']);
	exit;
}

// - get notes
if (isset($_REQUEST['action']) && $_REQUEST['action'] === 'get_notes') {		
	$path = checkAndGetNotesFolder();
	$notes = loadNotes();

	echo json_encode(['success' => true, 'notes' => $notes]);
	exit;
}	

// - add note
if (isset($_REQUEST['action']) && $_REQUEST['action'] === 'add_note') {		
	// get note data from request json data
	$data = json_decode($_REQUEST['data'], true);
	$title = isset($data['title']) ? trim($data['title']) : '';
	$content = isset($data['content']) ? trim($data['content']) : '';
	if ($title === '' || $content === '') {
		echo json_encode(['success' => false, 'message' => 'Title and content are required.']);
		exit;
	}
	
	// load notes from file
	$notes = loadNotes();

	// create new note
	$note = [
		'id' => uniqid(),
		'title' => $title,
		'content' => $content,
		'created_at' => date('c'),
		'updated_at' => date('c')
	];
	
	// add note to notes array
	$notes[] = $note;
	
	// save notes to file
	saveNotes($notes);
	
	echo json_encode(['success' => true, 'message' => 'Note added successfully.', 'note' => $note]);
	exit;
}
// - update note
if (isset($_REQUEST['action']) && $_REQUEST['action'] === 'update_note') {		
	// get note data from request json data
	$data = json_decode($_REQUEST['data'], true);
	$note_id = isset($data['id']) ? trim($data['id']) : '';
	$title = isset($data['title']) ? trim($data['title']) : '';
	$content = isset($data['content']) ? trim($data['content']) : '';
	if ($note_id === '' || $title === '' || $content === '') {
		echo json_encode(['success' => false, 'message' => 'Note ID, title and content are required.']);
		exit;
	}
	
	// load notes from file
	$notes = loadNotes();

	// find and update note
	$found = false;
	foreach ($notes as &$note) {
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
	
	// save notes to file
	saveNotes($notes);
	
	echo json_encode(['success' => true, 'message' => 'Note updated successfully.']);
	exit;
}

// - delete note
if (isset($_REQUEST['action']) && $_REQUEST['action'] === 'delete_note') {		
	// get note id from request json data
	$data = json_decode($_REQUEST['data'], true);
	$note_id = isset($data['id']) ? trim($data['id']) : '';
	if ($note_id === '') {
		echo json_encode(['success' => false, 'message' => 'Note ID is required.']);
		exit;
	}
	
	// load notes from file
	$notes = loadNotes();

	// find and delete note
	$found = false;
	foreach ($notes as $index => $note) {
		if ($note['id'] === $note_id) {
			unset($notes[$index]);
			$found = true;
			break;
		}
	}
	if (!$found) {
		echo json_encode(['success' => false, 'message' => 'Note not found.']);
		exit;
	}
	
	// reindex array
	$notes = array_values($notes);
	
	// save notes to file
	saveNotes($notes);
	
	echo json_encode(['success' => true, 'message' => 'Note deleted successfully.']);
	exit;
}

// default response
echo json_encode(['success' => false, 'message' => 'Invalid API call for action: "'.strip_tags($_REQUEST['action']).'".']);
exit;
?>