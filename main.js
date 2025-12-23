function QuickNotesApp() {
	let api_url = 'api/';
	let SECRET_USER = 'will be filled with login';
	let SECRET_KEY = 'will be filled with login';
	let div_app = null;

	this.notes = [];

	// make an API call to load notes
	function callApi(action, data = {}, callback) {
		showSpinner();

		// Normales URL-encoded-Format
		const params = new URLSearchParams();
		params.append('action', action);
		params.append('login', SECRET_USER);
		params.append('secret', SECRET_KEY);
		params.append('data', JSON.stringify(data));

		const xhr = new XMLHttpRequest();
		xhr.open('POST', api_url, true);
		xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				hideSpinner();
				try {
					const res = JSON.parse(xhr.responseText);
					if (res.success) callback(res);
					else if (res.login_error) displayLogin();
					else alert('Failed: ' + res.message);
				} catch (e) {
					console.error('Invalid response:', xhr.responseText);
				}
			}
		};

		xhr.send(params.toString());
	}

	function showInformation(message) {
		//alert(message);
		var infoDiv = document.createElement('div');
		infoDiv.className = 'alert alert-info';
		infoDiv.style.position = 'fixed';
		infoDiv.style.top = '10px';
		infoDiv.style.left = '10px';
		infoDiv.style.zIndex = '1000';
		infoDiv.innerText = message;
		document.body.appendChild(infoDiv);
		setTimeout(function() {
			infoDiv.remove();
		}, 2000);
	}

	function loadNotes() {
		callApi('get_notes', {}, function(data) {
			this.notes = data.notes;
			console.log('Notes loaded:', this.notes);
			displayNotes();
		}.bind(this));
	}

	function checkLogin() {
		callApi('check_login', {}, function(data) {
			loadNotes();
		}.bind(this));
	}

	function setContent(node, show_buttons = true) {
		div_app.innerHTML = '';
		if (show_buttons)
			div_app.appendChild(getGlobalButtons());
		div_app.appendChild(node);
	}

	function logout() {
		// Clear credentials from memory
		SECRET_USER = '';
		SECRET_KEY = '';
		this.notes = [];
		// Show login screen
		displayLogin();
	}

	function getGlobalButtons() {
		// create button group
		var div_buttons = document.createElement('div');
		div_buttons.className = 'btn-group';

		// Show Notes Button
		const showNotesBtn = document.createElement('button');
		showNotesBtn.className = 'btn btn-primary';
		showNotesBtn.innerHTML = '<i class="bi bi-journal-text me-2"></i>Show Notes';
		showNotesBtn.addEventListener('click', function() {
			loadNotes();
		});
		div_buttons.appendChild(showNotesBtn);
		// New Note Button
		const newNoteBtn = document.createElement('button');
		newNoteBtn.className = 'btn btn-success';
		newNoteBtn.innerHTML = '<i class="bi bi-plus-lg me-2"></i>New Note';
		newNoteBtn.addEventListener('click', function() {
			displayNoteForm();
		});
		div_buttons.appendChild(newNoteBtn);
		// Logout Button
		const logoutBtn = document.createElement('button');
		logoutBtn.className = 'btn btn-secondary';
		logoutBtn.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i>Logout';
		logoutBtn.addEventListener('click', function() {
			logout();
		});
		div_buttons.appendChild(logoutBtn);
		return div_buttons;
	}

	function displayNotes() {
		const notesDiv = document.createElement('div');
		notesDiv.innerHTML = '';

		// if no notes, display a message
		if (this.notes.length === 0) {
			notesDiv.innerHTML = `
				<div class="empty-state">
					<i class="bi bi-journal-x"></i>
					<h4>No notes yet</h4>
					<p>Create your first note to get started!</p>
				</div>
			`;
			setContent(notesDiv);
			return;
		}
		this.notes.forEach(note => {
			const noteElement = document.createElement('div');
			noteElement.className = 'card';
			noteElement.innerHTML = `
				<div class="card-body">
					<h5 class="card-title">${note.title}</h5>
					<h6 class="card-subtitle">
						<i class="bi bi-clock me-1"></i>Created: ${new Date(note.created_at).toLocaleString()}
						<span class="ms-3"><i class="bi bi-pencil me-1"></i>Modified: ${new Date(note.updated_at).toLocaleString()}</span>
					</h6>
					<div class="note-actions">
						<button class="btn btn-info btn-sm" id="view_${note.id}"><i class="bi bi-chevron-down me-1" id="viewIcon_${note.id}"></i>View</button>
						<button class="btn btn-warning btn-sm" id="edit_${note.id}"><i class="bi bi-pencil me-1"></i>Edit</button>
						<button class="btn btn-danger btn-sm" id="delete_${note.id}"><i class="bi bi-trash me-1"></i>Delete</button>
					</div>
				</div>
				<div class="note-content-collapse" id="content_${note.id}" style="display: none;">
					<div class="card-body pt-0">
						<pre class="note-content-pre">${note.content}</pre>
					</div>
				</div>
			`;
			notesDiv.appendChild(noteElement);

			// add event listener to view button - toggle collapse
			noteElement.querySelector(`#view_${note.id}`).addEventListener('click', function() {
				const contentDiv = document.getElementById(`content_${note.id}`);
				const icon = document.getElementById(`viewIcon_${note.id}`);
				if (contentDiv.style.display === 'none') {
					contentDiv.style.display = 'block';
					icon.className = 'bi bi-chevron-up me-1';
				} else {
					contentDiv.style.display = 'none';
					icon.className = 'bi bi-chevron-down me-1';
				}
			});

			// add event listener to edit button
			noteElement.querySelector(`#edit_${note.id}`).addEventListener('click', function() {
				displayNoteForm(note);
			});
			// add event listener to delete button
			noteElement.querySelector(`#delete_${note.id}`).addEventListener('click', function() {
				if (confirm('Are you sure you want to delete this note?')) {
					callApi('delete_note', { id: note.id }, function(data) {
						showInformation('Note deleted successfully!');
						loadNotes();
					});
				}
			});
		});
		setContent(notesDiv);
	}

	function displayNoteForm(note = null) {
		const formDiv = document.createElement('div');
		formDiv.className = 'card';
		formDiv.innerHTML = `
			<div class="card-body">
				<h2 class="card-title mb-4">
					<i class="bi ${note ? 'bi-pencil-square' : 'bi-journal-plus'} me-2"></i>
					${note ? 'Edit Note' : 'New Note'}
				</h2>
				<div class="form-group">
					<label for='title'><i class="bi bi-type me-1"></i>Title</label>
					<input class="form-control" type='text' id='title' name='title' value='${note ? note.title : ''}' placeholder="Enter note title...">
				</div>
				<div class="form-group">
					<label for='content'><i class="bi bi-text-paragraph me-1"></i>Content</label>
					<textarea class="form-control" id='content' name='content' rows='10' placeholder="Write your note here...">${note ? note.content : ''}</textarea>
				</div>
				<button id='saveNoteBtn' class="btn btn-primary">
					<i class="bi ${note ? 'bi-check-lg' : 'bi-save'} me-2"></i>${note ? 'Update' : 'Save'} Note
				</button>
			</div>
		`;
		setContent(formDiv);

		document.getElementById('saveNoteBtn').addEventListener('click', function() {
			const title = document.getElementById('title').value;
			const content = document.getElementById('content').value;
			if (title && content) {
				const noteData = { title: title, content: content };
				var action = 'add_note';
				if (note && note.id) {
					noteData.id = note.id;
					action = 'update_note';
				}
				callApi(action, noteData, function(data) {
					showInformation('Note saved successfully!');
					loadNotes();
				});
			} else {
				alert('Please fill in both title and content.');
			}
		});
	}

	function displayLogin() {
		const loginDiv = document.createElement('div');
		loginDiv.className = 'card login-card';
		loginDiv.innerHTML = `
			<div class="card-body">
				<div class="text-center mb-4">
					<i class="bi bi-journal-bookmark-fill" style="font-size: 3rem; color: var(--accent);"></i>
					<h3 class="mt-2">Welcome Back</h3>
					<p class="text-muted">Sign in to access your notes</p>
				</div>
				<div class="form-group">
					<label for='login'><i class="bi bi-person me-1"></i>Login</label>
					<input class="form-control" type='text' id='login' name='login' placeholder="Enter your username">
				</div>
				<div class="form-group">
					<label for='secret'><i class="bi bi-key me-1"></i>Secret Key</label>
					<input class="form-control" type='password' id='secret' name='secret' placeholder='Enter your secret key' autocomplete='off'>
				</div>
				<button id='loadNotesBtn' class="btn btn-primary w-100">
					<i class="bi bi-box-arrow-in-right me-2"></i>Sign In
				</button>
			</div>
		`;
		setContent(loginDiv, false);

		document.getElementById('loadNotesBtn').addEventListener('click', function() {
			const login = document.getElementById('login').value;
			const secret = document.getElementById('secret').value;
			if (login) {
				SECRET_USER = login;
			} else {
				alert('Please enter your login.');
				return;
			}
			if (secret) {
				SECRET_KEY = secret;
				checkLogin();
			} else {
				alert('Please enter your secret.');
			}
		});
	}

	function init() {
		console.log('QuickNotesApp initialized');
		
		// display the login field, will be used to get the notes and is used for authentication
		div_app = document.getElementById('app');	

		displayLogin();
	}

	init();
	return this;
}