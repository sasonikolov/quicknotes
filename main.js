function QuickNotesApp() {
	let api_url = 'api/';
	let SECRET_USER = '';
	let SECRET_KEY = '';
	let GLOBAL_CODE = '';
	let requireGlobalCode = true;
	let div_app = null;

	this.notes = [];

	// ============ API Helper ============

	function callApi(action, extraParams = {}, callback) {
		showSpinner();

		const params = new URLSearchParams();
		params.append('action', action);
		params.append('login', SECRET_USER);
		params.append('secret', SECRET_KEY);
		params.append('global_code', GLOBAL_CODE);

		// Add extra params
		for (const [key, value] of Object.entries(extraParams)) {
			if (key === 'data') {
				params.append('data', JSON.stringify(value));
			} else {
				params.append(key, value);
			}
		}

		const xhr = new XMLHttpRequest();
		xhr.open('POST', api_url, true);
		xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				hideSpinner();
				try {
					const res = JSON.parse(xhr.responseText);
					if (res.success) {
						callback(res);
					} else if (res.login_error || res.code_error) {
						displayLogin();
					} else {
						alert('Error: ' + res.message);
					}
				} catch (e) {
					console.error('Invalid response:', xhr.responseText);
					alert('Server error. Please try again.');
				}
			}
		};

		xhr.send(params.toString());
	}

	// ============ UI Helpers ============

	function showInformation(message, type = 'info') {
		const infoDiv = document.createElement('div');
		infoDiv.className = `alert alert-${type}`;
		infoDiv.style.position = 'fixed';
		infoDiv.style.top = '10px';
		infoDiv.style.left = '50%';
		infoDiv.style.transform = 'translateX(-50%)';
		infoDiv.style.zIndex = '1000';
		infoDiv.style.minWidth = '300px';
		infoDiv.style.textAlign = 'center';
		infoDiv.innerText = message;
		document.body.appendChild(infoDiv);
		setTimeout(() => infoDiv.remove(), 3000);
	}

	function showModal(title, content, onClose = null) {
		// Remove any existing modal first
		const existingModal = document.getElementById('appModal');
		if (existingModal) {
			existingModal.remove();
		}

		const modalHtml = `
			<div class="modal fade" id="appModal" tabindex="-1" data-bs-backdrop="static">
				<div class="modal-dialog modal-dialog-centered">
					<div class="modal-content">
						<div class="modal-header">
							<h5 class="modal-title">${title}</h5>
						</div>
						<div class="modal-body">${content}</div>
					</div>
				</div>
			</div>
		`;
		document.body.insertAdjacentHTML('beforeend', modalHtml);
		const modalEl = document.getElementById('appModal');
		const modal = new bootstrap.Modal(modalEl);
		modal.show();

		modalEl.addEventListener('hidden.bs.modal', function() {
			this.remove();
			if (onClose) onClose();
		});

		return modal;
	}

	function closeModal(callback = null) {
		const modalEl = document.getElementById('appModal');
		if (modalEl) {
			const modal = bootstrap.Modal.getInstance(modalEl);
			if (modal) {
				if (callback) {
					modalEl.addEventListener('hidden.bs.modal', callback, { once: true });
				}
				modal.hide();
			} else {
				modalEl.remove();
				if (callback) callback();
			}
		} else if (callback) {
			callback();
		}
	}

	function setContent(node, show_buttons = true) {
		div_app.innerHTML = '';
		if (show_buttons) div_app.appendChild(getGlobalButtons());
		div_app.appendChild(node);
	}

	// ============ Auth Functions ============

	function logout() {
		SECRET_USER = '';
		SECRET_KEY = '';
		GLOBAL_CODE = '';
		this.notes = [];
		displayLogin();
	}

	function checkUser(username, globalCode) {
		SECRET_USER = username.toLowerCase().trim();
		GLOBAL_CODE = globalCode || '';

		callApi('check_user', {}, function(res) {
			requireGlobalCode = res.require_global_code;

			if (!res.user_exists || !res.has_password) {
				// New user - show set password modal
				displaySetPasswordModal();
			} else {
				// Existing user - show password field
				displayPasswordInput(true);
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
					<h3 class="mt-2">Quick Notes</h3>
					<p class="text-muted">Enter your credentials to continue</p>
				</div>
				<div class="form-group">
					<label for='login'><i class="bi bi-person me-1"></i>Username</label>
					<input class="form-control" type='text' id='login' name='login' placeholder="Enter your username" autocomplete="username">
				</div>
				<div class="form-group">
					<label for='globalCode'><i class="bi bi-shield-lock me-1"></i>Access Code</label>
					<input class="form-control" type='password' id='globalCode' placeholder="Enter access code" autocomplete="off">
				</div>
				<button id='continueBtn' class="btn btn-primary w-100">
					<i class="bi bi-arrow-right me-2"></i>Continue
				</button>
			</div>
		`;
		setContent(loginDiv, false);

		const loginInput = document.getElementById('login');
		const globalCodeInput = document.getElementById('globalCode');
		const continueBtn = document.getElementById('continueBtn');

		continueBtn.addEventListener('click', () => {
			const login = loginInput.value.trim();
			const globalCode = globalCodeInput.value.trim();
			if (!login) {
				alert('Please enter your username.');
				return;
			}
			if (!globalCode) {
				alert('Please enter the access code.');
				return;
			}
			checkUser(login, globalCode);
		});

		globalCodeInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') continueBtn.click();
		});
	}

	function displayPasswordInput(showForgotLink = true) {
		const loginDiv = document.createElement('div');
		loginDiv.className = 'card login-card';
		loginDiv.innerHTML = `
			<div class="card-body">
				<div class="text-center mb-4">
					<i class="bi bi-shield-lock" style="font-size: 3rem; color: var(--accent);"></i>
					<h3 class="mt-2">Welcome, ${SECRET_USER}</h3>
					<p class="text-muted">Enter your password</p>
				</div>
				<div class="form-group">
					<label for='secret'><i class="bi bi-key me-1"></i>Password</label>
					<input class="form-control" type='password' id='secret' placeholder="Enter your password" autocomplete="current-password">
				</div>
				<button id='signInBtn' class="btn btn-primary w-100 mb-3">
					<i class="bi bi-box-arrow-in-right me-2"></i>Sign In
				</button>
				<div class="d-flex justify-content-between">
					<a href="#" id="backBtn" class="text-muted"><i class="bi bi-arrow-left me-1"></i>Back</a>
					${showForgotLink ? '<a href="#" id="forgotBtn" class="text-muted">Forgot password?</a>' : ''}
				</div>
			</div>
		`;
		setContent(loginDiv, false);

		const secretInput = document.getElementById('secret');
		const signInBtn = document.getElementById('signInBtn');
		const backBtn = document.getElementById('backBtn');
		const forgotBtn = document.getElementById('forgotBtn');

		signInBtn.addEventListener('click', () => {
			const password = secretInput.value;
			if (!password) {
				alert('Please enter your password.');
				return;
			}
			SECRET_KEY = password;
			callApi('check_login', {}, function(res) {
				loadNotes();
			});
		});

		secretInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') signInBtn.click();
		});

		backBtn.addEventListener('click', (e) => {
			e.preventDefault();
			SECRET_USER = '';
			displayLogin();
		});

		if (forgotBtn) {
			forgotBtn.addEventListener('click', (e) => {
				e.preventDefault();
				displayRecoveryModal();
			});
		}

		secretInput.focus();
	}

	function displaySetPasswordModal() {
		const content = `
			<div class="text-center mb-3">
				<i class="bi bi-person-plus" style="font-size: 2.5rem; color: var(--accent);"></i>
				<p class="mt-2">Welcome <strong>${SECRET_USER}</strong>! Create a password to secure your notes.</p>
			</div>
			<div class="form-group">
				<label for="newPassword"><i class="bi bi-key me-1"></i>Password</label>
				<input type="password" class="form-control" id="newPassword" placeholder="Min. 6 characters">
			</div>
			<div class="form-group">
				<label for="confirmPassword"><i class="bi bi-key-fill me-1"></i>Confirm Password</label>
				<input type="password" class="form-control" id="confirmPassword" placeholder="Repeat password">
			</div>
			<button id="setPasswordBtn" class="btn btn-primary w-100">
				<i class="bi bi-check-lg me-2"></i>Create Account
			</button>
			<div class="text-center mt-3">
				<a href="#" id="cancelSetPw" class="text-muted">Cancel</a>
			</div>
		`;

		showModal('Create Your Account', content);

		setTimeout(() => {
			const newPwInput = document.getElementById('newPassword');
			const confirmPwInput = document.getElementById('confirmPassword');
			const setPasswordBtn = document.getElementById('setPasswordBtn');
			const cancelBtn = document.getElementById('cancelSetPw');

			setPasswordBtn.addEventListener('click', () => {
				const newPw = newPwInput.value;
				const confirmPw = confirmPwInput.value;

				if (newPw.length < 6) {
					alert('Password must be at least 6 characters.');
					return;
				}
				if (newPw !== confirmPw) {
					alert('Passwords do not match.');
					return;
				}

				SECRET_KEY = newPw;
				callApi('set_password', {}, function(res) {
					closeModal(() => {
						displayRecoveryCodeModal(res.recovery_code);
					});
				});
			});

			cancelBtn.addEventListener('click', (e) => {
				e.preventDefault();
				closeModal();
				SECRET_USER = '';
				displayLogin();
			});

			newPwInput.focus();
		}, 300);
	}

	function displayRecoveryCodeModal(code) {
		const content = `
			<div class="text-center">
				<i class="bi bi-shield-check" style="font-size: 3rem; color: #10b981;"></i>
				<h5 class="mt-3">Account Created!</h5>
				<p class="text-muted">Save this recovery code. You'll need it if you forget your password.</p>
				<div class="recovery-code-box">
					<code style="font-size: 1.5rem; letter-spacing: 2px; color: var(--accent);">${code}</code>
				</div>
				<p class="text-muted mt-3"><small><i class="bi bi-exclamation-triangle me-1"></i>This code will only be shown once!</small></p>
				<button id="continueAfterRecovery" class="btn btn-primary w-100 mt-3">
					<i class="bi bi-check-lg me-2"></i>I've saved my code
				</button>
			</div>
		`;

		showModal('Recovery Code', content);

		setTimeout(() => {
			document.getElementById('continueAfterRecovery').addEventListener('click', () => {
				closeModal();
				loadNotes();
			});
		}, 300);
	}

	function displayRecoveryModal() {
		const content = `
			<div class="text-center mb-3">
				<i class="bi bi-arrow-counterclockwise" style="font-size: 2.5rem; color: var(--accent);"></i>
				<p class="mt-2">Enter your recovery code to reset your password.</p>
			</div>
			<div class="form-group">
				<label for="recoveryCode"><i class="bi bi-shield me-1"></i>Recovery Code</label>
				<input type="text" class="form-control" id="recoveryCode" placeholder="8-character code" style="text-transform: uppercase; letter-spacing: 2px;">
			</div>
			<div class="form-group">
				<label for="newRecoveryPassword"><i class="bi bi-key me-1"></i>New Password</label>
				<input type="password" class="form-control" id="newRecoveryPassword" placeholder="Min. 6 characters">
			</div>
			<button id="resetPasswordBtn" class="btn btn-primary w-100">
				<i class="bi bi-check-lg me-2"></i>Reset Password
			</button>
			<div class="text-center mt-3">
				<a href="#" id="cancelRecovery" class="text-muted">Cancel</a>
			</div>
		`;

		showModal('Reset Password', content);

		setTimeout(() => {
			const codeInput = document.getElementById('recoveryCode');
			const newPwInput = document.getElementById('newRecoveryPassword');
			const resetBtn = document.getElementById('resetPasswordBtn');
			const cancelBtn = document.getElementById('cancelRecovery');

			resetBtn.addEventListener('click', () => {
				const code = codeInput.value.trim().toUpperCase();
				const newPw = newPwInput.value;

				if (code.length !== 8) {
					alert('Recovery code must be 8 characters.');
					return;
				}
				if (newPw.length < 6) {
					alert('Password must be at least 6 characters.');
					return;
				}

				SECRET_KEY = newPw;
				callApi('recover_password', { recovery_code: code }, function(res) {
					closeModal(() => {
						showInformation('Password reset successfully!', 'success');
						displayRecoveryCodeModal(res.recovery_code);
					});
				});
			});

			cancelBtn.addEventListener('click', (e) => {
				e.preventDefault();
				closeModal();
				displayPasswordInput(true);
			});

			codeInput.focus();
		}, 300);
	}

	// ============ Notes Functions ============

	function loadNotes() {
		callApi('get_notes', { data: {} }, function(data) {
			this.notes = data.notes;
			displayNotes();
		}.bind(this));
	}

	function getGlobalButtons() {
		const div_buttons = document.createElement('div');
		div_buttons.className = 'btn-group';

		const showNotesBtn = document.createElement('button');
		showNotesBtn.className = 'btn btn-primary';
		showNotesBtn.innerHTML = '<i class="bi bi-journal-text me-2"></i>Notes';
		showNotesBtn.addEventListener('click', () => loadNotes());
		div_buttons.appendChild(showNotesBtn);

		const newNoteBtn = document.createElement('button');
		newNoteBtn.className = 'btn btn-success';
		newNoteBtn.innerHTML = '<i class="bi bi-plus-lg me-2"></i>New';
		newNoteBtn.addEventListener('click', () => displayNoteForm());
		div_buttons.appendChild(newNoteBtn);

		const logoutBtn = document.createElement('button');
		logoutBtn.className = 'btn btn-secondary';
		logoutBtn.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i>Logout';
		logoutBtn.addEventListener('click', () => logout());
		div_buttons.appendChild(logoutBtn);

		return div_buttons;
	}

	function displayNotes() {
		const notesDiv = document.createElement('div');

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
						<i class="bi bi-clock me-1"></i>${new Date(note.created_at).toLocaleString()}
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

			noteElement.querySelector(`#view_${note.id}`).addEventListener('click', () => {
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

			noteElement.querySelector(`#edit_${note.id}`).addEventListener('click', () => displayNoteForm(note));

			noteElement.querySelector(`#delete_${note.id}`).addEventListener('click', () => {
				if (confirm('Delete this note?')) {
					callApi('delete_note', { data: { id: note.id } }, () => {
						showInformation('Note deleted!');
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
					<input class="form-control" type='text' id='title' value='${note ? note.title : ''}' placeholder="Enter note title...">
				</div>
				<div class="form-group">
					<label for='content'><i class="bi bi-text-paragraph me-1"></i>Content</label>
					<textarea class="form-control" id='content' rows='10' placeholder="Write your note here...">${note ? note.content : ''}</textarea>
				</div>
				<button id='saveNoteBtn' class="btn btn-primary">
					<i class="bi ${note ? 'bi-check-lg' : 'bi-save'} me-2"></i>${note ? 'Update' : 'Save'} Note
				</button>
			</div>
		`;
		setContent(formDiv);

		document.getElementById('saveNoteBtn').addEventListener('click', () => {
			const title = document.getElementById('title').value;
			const content = document.getElementById('content').value;

			if (!title || !content) {
				alert('Please fill in both title and content.');
				return;
			}

			const noteData = { title, content };
			let action = 'add_note';

			if (note?.id) {
				noteData.id = note.id;
				action = 'update_note';
			}

			callApi(action, { data: noteData }, () => {
				showInformation('Note saved!');
				loadNotes();
			});
		});
	}

	// ============ Init ============

	function init() {
		console.log('QuickNotesApp initialized');
		div_app = document.getElementById('app');
		displayLogin();
	}

	init();
	return this;
}
