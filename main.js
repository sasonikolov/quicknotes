function QuickNotesApp() {
	let api_url = 'api/';
	let SECRET_USER = '';
	let SECRET_KEY = '';
	let GLOBAL_CODE = '';
	let requireGlobalCode = true;
	let div_app = null;
	let STORAGE_MODE = 'server'; // 'server' or 'local'
	const LOCAL_STORAGE_KEY = 'quicknotes_local';
	const LOCAL_WARNING_SHOWN_KEY = 'quicknotes_warning_shown';

	// Config from server
	let APP_CONFIG = {
		enable_pwa: true,
		enable_offline_mode: true,
		require_global_code: true,
		store_ip: false
	};

	// Sort settings
	let currentSort = localStorage.getItem('notes_sort') || 'date_desc';

	this.notes = [];

	function sortNotes(notes, sortType) {
		const sorted = [...notes];
		switch (sortType) {
			case 'name_asc':
				return sorted.sort((a, b) => a.title.localeCompare(b.title));
			case 'name_desc':
				return sorted.sort((a, b) => b.title.localeCompare(a.title));
			case 'date_asc':
				return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
			case 'date_desc':
				return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
			case 'edit_asc':
				return sorted.sort((a, b) => new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at));
			case 'edit_desc':
				return sorted.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
			default:
				return sorted;
		}
	}

	function setSort(sortType) {
		currentSort = sortType;
		localStorage.setItem('notes_sort', sortType);
		displayNotes();
	}

	// ============ LocalStorage Functions ============

	function getLocalNotes() {
		try {
			const data = localStorage.getItem(LOCAL_STORAGE_KEY);
			return data ? JSON.parse(data) : [];
		} catch (e) {
			return [];
		}
	}

	function saveLocalNotes(notes) {
		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
	}

	function localAddNote(title, content) {
		const notes = getLocalNotes();
		const note = {
			id: 'local_' + Date.now(),
			title: title,
			content: content,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};
		notes.push(note);
		saveLocalNotes(notes);
		return note;
	}

	function localUpdateNote(id, title, content) {
		const notes = getLocalNotes();
		const index = notes.findIndex(n => n.id === id);
		if (index !== -1) {
			notes[index].title = title;
			notes[index].content = content;
			notes[index].updated_at = new Date().toISOString();
			saveLocalNotes(notes);
			return true;
		}
		return false;
	}

	function localDeleteNote(id) {
		const notes = getLocalNotes();
		const filtered = notes.filter(n => n.id !== id);
		saveLocalNotes(filtered);
		return filtered.length !== notes.length;
	}

	function startLocalMode() {
		const warningShown = localStorage.getItem(LOCAL_WARNING_SHOWN_KEY);
		if (!warningShown) {
			showLocalWarningModal(() => {
				localStorage.setItem(LOCAL_WARNING_SHOWN_KEY, 'true');
				activateLocalMode();
			});
		} else {
			activateLocalMode();
		}
	}

	function activateLocalMode() {
		STORAGE_MODE = 'local';
		SECRET_USER = 'local';
		this.notes = getLocalNotes();
		displayNotes();
	}

	function showLocalWarningModal(onAccept) {
		const content = `
			<div class="text-center">
				<i class="bi bi-exclamation-triangle" style="font-size: 3rem; color: #f59e0b;"></i>
				<h5 class="mt-3">${t('localStorageWarningTitle')}</h5>
				<p class="text-muted">${t('localStorageWarning')}</p>
				<button id="acceptLocalWarning" class="btn btn-warning w-100 mt-3">
					<i class="bi bi-check-lg me-2"></i>${t('understand')}
				</button>
				<div class="text-center mt-3">
					<a href="#" id="cancelLocalMode" class="text-muted">${t('cancel')}</a>
				</div>
			</div>
		`;

		showModal(t('localStorageWarningTitle'), content);

		setTimeout(() => {
			document.getElementById('acceptLocalWarning').addEventListener('click', () => {
				closeModal();
				if (onAccept) onAccept();
			});
			document.getElementById('cancelLocalMode').addEventListener('click', (e) => {
				e.preventDefault();
				closeModal();
			});
		}, 300);
	}

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
					alert(t('serverError'));
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
					<h3 class="mt-2">${t('appTitle')}</h3>
					<p class="text-muted">${t('enterCredentials')}</p>
				</div>
				<div class="form-group">
					<label for='login'><i class="bi bi-person me-1"></i>${t('username')}</label>
					<input class="form-control" type='text' id='login' name='login' placeholder="${t('enterUsername')}" autocomplete="username">
				</div>
				<div class="form-group">
					<label for='globalCode'><i class="bi bi-shield-lock me-1"></i>${t('accessCode')}</label>
					<input class="form-control" type='password' id='globalCode' placeholder="${t('enterAccessCode')}" autocomplete="off">
				</div>
				<button id='continueBtn' class="btn btn-primary w-100">
					<i class="bi bi-arrow-right me-2"></i>${t('continue')}
				</button>
				${APP_CONFIG.enable_offline_mode ? `
				<div class="text-center mt-3">
					<a href="#" id="offlineModeBtn" class="text-muted">
						<i class="bi bi-cloud-slash me-1"></i>${t('useOffline')}
					</a>
				</div>
				` : ''}
			</div>
		`;
		setContent(loginDiv, false);

		const loginInput = document.getElementById('login');
		const globalCodeInput = document.getElementById('globalCode');
		const continueBtn = document.getElementById('continueBtn');
		const offlineModeBtn = APP_CONFIG.enable_offline_mode ? document.getElementById('offlineModeBtn') : null;

		continueBtn.addEventListener('click', () => {
			const login = loginInput.value.trim();
			const globalCode = globalCodeInput.value.trim();
			if (!login) {
				alert(t('pleaseEnterUsername'));
				return;
			}
			if (!globalCode) {
				alert(t('pleaseEnterAccessCode'));
				return;
			}
			checkUser(login, globalCode);
		});

		globalCodeInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') continueBtn.click();
		});

		if (offlineModeBtn) {
			offlineModeBtn.addEventListener('click', (e) => {
				e.preventDefault();
				startLocalMode();
			});
		}
	}

	function displayPasswordInput(showForgotLink = true) {
		const loginDiv = document.createElement('div');
		loginDiv.className = 'card login-card';
		loginDiv.innerHTML = `
			<div class="card-body">
				<div class="text-center mb-4">
					<i class="bi bi-shield-lock" style="font-size: 3rem; color: var(--accent);"></i>
					<h3 class="mt-2">${t('welcome')}, ${SECRET_USER}</h3>
					<p class="text-muted">${t('enterPassword')}</p>
				</div>
				<div class="form-group">
					<label for='secret'><i class="bi bi-key me-1"></i>${t('password')}</label>
					<input class="form-control" type='password' id='secret' placeholder="${t('enterPassword')}" autocomplete="current-password">
				</div>
				<button id='signInBtn' class="btn btn-primary w-100 mb-3">
					<i class="bi bi-box-arrow-in-right me-2"></i>${t('signIn')}
				</button>
				<div class="d-flex justify-content-between">
					<a href="#" id="backBtn" class="text-muted"><i class="bi bi-arrow-left me-1"></i>${t('back')}</a>
					${showForgotLink ? '<a href="#" id="forgotBtn" class="text-muted">' + t('forgotPassword') + '</a>' : ''}
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
				alert(t('pleaseEnterPassword'));
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
				<p class="mt-2">${t('welcomeNewUser', { user: SECRET_USER })}</p>
			</div>
			<div class="form-group">
				<label for="newPassword"><i class="bi bi-key me-1"></i>${t('password')}</label>
				<input type="password" class="form-control" id="newPassword" placeholder="${t('minChars')}">
			</div>
			<div class="form-group">
				<label for="confirmPassword"><i class="bi bi-key-fill me-1"></i>${t('confirmPassword')}</label>
				<input type="password" class="form-control" id="confirmPassword" placeholder="${t('repeatPassword')}">
			</div>
			<button id="setPasswordBtn" class="btn btn-primary w-100">
				<i class="bi bi-check-lg me-2"></i>${t('createAccountBtn')}
			</button>
			<div class="text-center mt-3">
				<a href="#" id="cancelSetPw" class="text-muted">${t('cancel')}</a>
			</div>
		`;

		showModal(t('createAccount'), content);

		setTimeout(() => {
			const newPwInput = document.getElementById('newPassword');
			const confirmPwInput = document.getElementById('confirmPassword');
			const setPasswordBtn = document.getElementById('setPasswordBtn');
			const cancelBtn = document.getElementById('cancelSetPw');

			setPasswordBtn.addEventListener('click', () => {
				const newPw = newPwInput.value;
				const confirmPw = confirmPwInput.value;

				if (newPw.length < 6) {
					alert(t('passwordTooShort'));
					return;
				}
				if (newPw !== confirmPw) {
					alert(t('passwordsDontMatch'));
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
				<h5 class="mt-3">${t('accountCreated')}</h5>
				<p class="text-muted">${t('saveRecoveryCode')}</p>
				<div class="recovery-code-box">
					<code style="font-size: 1.5rem; letter-spacing: 2px; color: var(--accent);">${code}</code>
				</div>
				<p class="text-muted mt-3"><small><i class="bi bi-exclamation-triangle me-1"></i>${t('codeOnlyOnce')}</small></p>
				<button id="continueAfterRecovery" class="btn btn-primary w-100 mt-3">
					<i class="bi bi-check-lg me-2"></i>${t('savedMyCode')}
				</button>
			</div>
		`;

		showModal(t('recoveryCodeTitle'), content);

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
				<p class="mt-2">${t('enterRecoveryCode')}</p>
			</div>
			<div class="form-group">
				<label for="recoveryCode"><i class="bi bi-shield me-1"></i>${t('recoveryCode')}</label>
				<input type="text" class="form-control" id="recoveryCode" placeholder="${t('charCode')}" style="text-transform: uppercase; letter-spacing: 2px;">
			</div>
			<div class="form-group">
				<label for="newRecoveryPassword"><i class="bi bi-key me-1"></i>${t('newPassword')}</label>
				<input type="password" class="form-control" id="newRecoveryPassword" placeholder="${t('minChars')}">
			</div>
			<button id="resetPasswordBtn" class="btn btn-primary w-100">
				<i class="bi bi-check-lg me-2"></i>${t('resetPasswordBtn')}
			</button>
			<div class="text-center mt-3">
				<a href="#" id="cancelRecovery" class="text-muted">${t('cancel')}</a>
			</div>
		`;

		showModal(t('resetPassword'), content);

		setTimeout(() => {
			const codeInput = document.getElementById('recoveryCode');
			const newPwInput = document.getElementById('newRecoveryPassword');
			const resetBtn = document.getElementById('resetPasswordBtn');
			const cancelBtn = document.getElementById('cancelRecovery');

			resetBtn.addEventListener('click', () => {
				const code = codeInput.value.trim().toUpperCase();
				const newPw = newPwInput.value;

				if (code.length !== 8) {
					alert(t('recoveryCodeLength'));
					return;
				}
				if (newPw.length < 6) {
					alert(t('passwordTooShort'));
					return;
				}

				SECRET_KEY = newPw;
				callApi('recover_password', { recovery_code: code }, function(res) {
					closeModal(() => {
						showInformation(t('passwordResetSuccess'), 'success');
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
		if (STORAGE_MODE === 'local') {
			this.notes = getLocalNotes().map(n => ({ ...n, _isLocal: true }));
			displayNotes();
		} else {
			callApi('get_notes', { data: {} }, function(data) {
				// Combine server notes with local notes
				const serverNotes = (data.notes || []).map(n => ({ ...n, _isLocal: false }));
				const localNotes = getLocalNotes().map(n => ({ ...n, _isLocal: true }));
				this.notes = [...serverNotes, ...localNotes];
				displayNotes();
			}.bind(this));
		}
	}

	function getGlobalButtons() {
		const container = document.createElement('div');

		// Offline badge
		if (STORAGE_MODE === 'local') {
			const badge = document.createElement('div');
			badge.className = 'alert alert-warning py-2 px-3 mb-3 d-flex align-items-center justify-content-between';
			badge.innerHTML = `
				<span><i class="bi bi-cloud-slash me-2"></i>${t('offlineBadge')}</span>
				<a href="#" id="switchToServerBtn" class="text-dark"><small>${t('switchToServer')}</small></a>
			`;
			container.appendChild(badge);
			setTimeout(() => {
				const switchBtn = document.getElementById('switchToServerBtn');
				if (switchBtn) {
					switchBtn.addEventListener('click', (e) => {
						e.preventDefault();
						STORAGE_MODE = 'server';
						displayLogin();
					});
				}
			}, 0);
		}

		const div_buttons = document.createElement('div');
		div_buttons.className = 'btn-group';

		const showNotesBtn = document.createElement('button');
		showNotesBtn.className = 'btn btn-primary';
		showNotesBtn.innerHTML = '<i class="bi bi-journal-text me-2"></i>' + t('notes');
		showNotesBtn.addEventListener('click', () => loadNotes());
		div_buttons.appendChild(showNotesBtn);

		const newNoteBtn = document.createElement('button');
		newNoteBtn.className = 'btn btn-success';
		newNoteBtn.innerHTML = '<i class="bi bi-plus-lg me-2"></i>' + t('new');
		newNoteBtn.addEventListener('click', () => displayNoteForm());
		div_buttons.appendChild(newNoteBtn);

		// Only show password change for server mode
		if (STORAGE_MODE === 'server') {
			const changePassBtn = document.createElement('button');
			changePassBtn.className = 'btn btn-outline-primary';
			changePassBtn.innerHTML = '<i class="bi bi-key me-1"></i>';
			changePassBtn.title = t('changePassword');
			changePassBtn.addEventListener('click', () => displayChangePasswordModal());
			div_buttons.appendChild(changePassBtn);
		}

		const logoutBtn = document.createElement('button');
		logoutBtn.className = 'btn btn-secondary';
		logoutBtn.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i>' + t('logout');
		logoutBtn.addEventListener('click', () => logout());
		div_buttons.appendChild(logoutBtn);

		container.appendChild(div_buttons);
		return container;
	}

	function displayChangePasswordModal() {
		const content = `
			<div class="text-center mb-3">
				<i class="bi bi-key-fill" style="font-size: 2.5rem; color: var(--accent);"></i>
				<p class="mt-2">${t('enterNewPassword')}</p>
			</div>
			<div class="form-group">
				<label for="currentPassword"><i class="bi bi-lock me-1"></i>${t('currentPassword')}</label>
				<input type="password" class="form-control" id="currentPassword" placeholder="${t('yourCurrentPassword')}">
			</div>
			<div class="form-group">
				<label for="newPassword"><i class="bi bi-key me-1"></i>${t('newPassword')}</label>
				<input type="password" class="form-control" id="newPassword" placeholder="${t('minChars')}">
			</div>
			<div class="form-group">
				<label for="confirmNewPassword"><i class="bi bi-key-fill me-1"></i>${t('confirmNewPassword')}</label>
				<input type="password" class="form-control" id="confirmNewPassword" placeholder="${t('repeatNewPassword')}">
			</div>
			<button id="changePasswordBtn" class="btn btn-primary w-100">
				<i class="bi bi-check-lg me-2"></i>${t('changePasswordBtn')}
			</button>
			<div class="text-center mt-3">
				<a href="#" id="cancelChangePass" class="text-muted">${t('cancel')}</a>
			</div>
		`;

		showModal(t('changePassword'), content);

		setTimeout(() => {
			const currentPwInput = document.getElementById('currentPassword');
			const newPwInput = document.getElementById('newPassword');
			const confirmPwInput = document.getElementById('confirmNewPassword');
			const changeBtn = document.getElementById('changePasswordBtn');
			const cancelBtn = document.getElementById('cancelChangePass');

			changeBtn.addEventListener('click', () => {
				const currentPw = currentPwInput.value;
				const newPw = newPwInput.value;
				const confirmPw = confirmPwInput.value;

				if (!currentPw) {
					alert(t('pleaseEnterCurrentPassword'));
					return;
				}
				if (currentPw !== SECRET_KEY) {
					alert(t('currentPasswordIncorrect'));
					return;
				}
				if (newPw === currentPw) {
					alert(t('passwordMustBeDifferent'));
					return;
				}
				if (newPw.length < 6) {
					alert(t('passwordMinLength'));
					return;
				}
				if (newPw !== confirmPw) {
					alert(t('passwordsNoMatch'));
					return;
				}

				callApi('change_password', { new_password: newPw }, function(res) {
					SECRET_KEY = newPw;
					closeModal(() => {
						showInformation(t('passwordChanged'), 'success');
						displayRecoveryCodeModal(res.recovery_code);
					});
				});
			});

			cancelBtn.addEventListener('click', (e) => {
				e.preventDefault();
				closeModal();
			});

			currentPwInput.focus();
		}, 300);
	}

	function displayNotes() {
		const notesDiv = document.createElement('div');

		if (this.notes.length === 0) {
			notesDiv.innerHTML = `
				<div class="empty-state">
					<i class="bi bi-journal-x"></i>
					<h4>${t('noNotesYet')}</h4>
					<p>${t('createFirstNote')}</p>
				</div>
			`;
			setContent(notesDiv);
			return;
		}

		// Sort dropdown
		const sortBar = document.createElement('div');
		sortBar.className = 'd-flex justify-content-end mb-3';
		sortBar.innerHTML = `
			<div class="dropdown">
				<button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" id="sortDropdown" data-bs-toggle="dropdown">
					<i class="bi bi-sort-down me-1"></i>${t('sortBy')}
				</button>
				<ul class="dropdown-menu dropdown-menu-end" aria-labelledby="sortDropdown">
					<li><a class="dropdown-item ${currentSort === 'name_asc' ? 'active' : ''}" href="#" data-sort="name_asc"><i class="bi bi-sort-alpha-down me-2"></i>${t('sortByName')} (A-Z)</a></li>
					<li><a class="dropdown-item ${currentSort === 'name_desc' ? 'active' : ''}" href="#" data-sort="name_desc"><i class="bi bi-sort-alpha-up me-2"></i>${t('sortByName')} (Z-A)</a></li>
					<li><hr class="dropdown-divider"></li>
					<li><a class="dropdown-item ${currentSort === 'date_desc' ? 'active' : ''}" href="#" data-sort="date_desc"><i class="bi bi-calendar-minus me-2"></i>${t('sortByDate')} (↓)</a></li>
					<li><a class="dropdown-item ${currentSort === 'date_asc' ? 'active' : ''}" href="#" data-sort="date_asc"><i class="bi bi-calendar-plus me-2"></i>${t('sortByDate')} (↑)</a></li>
					<li><hr class="dropdown-divider"></li>
					<li><a class="dropdown-item ${currentSort === 'edit_desc' ? 'active' : ''}" href="#" data-sort="edit_desc"><i class="bi bi-pencil me-2"></i>${t('sortByLastEdit')} (↓)</a></li>
					<li><a class="dropdown-item ${currentSort === 'edit_asc' ? 'active' : ''}" href="#" data-sort="edit_asc"><i class="bi bi-pencil me-2"></i>${t('sortByLastEdit')} (↑)</a></li>
				</ul>
			</div>
		`;
		notesDiv.appendChild(sortBar);

		// Add event listeners for sort
		setTimeout(() => {
			sortBar.querySelectorAll('[data-sort]').forEach(el => {
				el.addEventListener('click', (e) => {
					e.preventDefault();
					setSort(el.dataset.sort);
				});
			});
		}, 0);

		// Sort notes
		const sortedNotes = sortNotes(this.notes, currentSort);

		sortedNotes.forEach(note => {
			const noteElement = document.createElement('div');
			noteElement.className = 'card';
			const storageBadge = note._isLocal
				? `<span class="badge bg-warning text-dark ms-auto flex-shrink-0"><i class="bi bi-hdd me-1"></i>${t('storedLocally')}</span>`
				: `<span class="badge bg-primary ms-auto flex-shrink-0"><i class="bi bi-cloud me-1"></i>${t('storedOnServer')}</span>`;

			// Format dates
			const createdAt = new Date(note.created_at);
			const updatedAt = note.updated_at ? new Date(note.updated_at) : null;
			const wasEdited = updatedAt && updatedAt.getTime() !== createdAt.getTime();
			const editedInfo = wasEdited
				? `<div class="small text-muted mt-1"><i class="bi bi-pencil me-1"></i>${t('lastEdited')}: ${updatedAt.toLocaleString()}</div>`
				: '';

			// IP info (only for server notes when IP tracking is enabled)
			let ipInfo = '';
			if (!note._isLocal && APP_CONFIG.store_ip) {
				if (note.created_ip) {
					ipInfo += `<div class="small text-muted mt-1"><i class="bi bi-geo-alt me-1"></i>${t('createdFromIP')}: ${note.created_ip}</div>`;
				}
				if (note.updated_ip && note.updated_ip !== note.created_ip) {
					ipInfo += `<div class="small text-muted"><i class="bi bi-geo-alt me-1"></i>${t('lastEditedFromIP')}: ${note.updated_ip}</div>`;
				}
			}

			noteElement.innerHTML = `
				<div class="card-body">
					<div class="d-flex justify-content-between align-items-start gap-2 mb-2">
						<h5 class="card-title mb-0 text-break" style="flex: 1; min-width: 0;">${note.title}</h5>
						${storageBadge}
					</div>
					<div class="card-subtitle small text-muted">
						<i class="bi bi-clock me-1"></i>${t('created')}: ${createdAt.toLocaleString()}
					</div>
					${editedInfo}
					${ipInfo}
					<div class="note-actions">
						<button class="btn btn-info btn-sm" id="view_${note.id}"><i class="bi bi-chevron-down me-1" id="viewIcon_${note.id}"></i>${t('view')}</button>
						<button class="btn btn-warning btn-sm" id="edit_${note.id}"><i class="bi bi-pencil me-1"></i>${t('edit')}</button>
						<button class="btn btn-danger btn-sm" id="delete_${note.id}"><i class="bi bi-trash me-1"></i>${t('delete')}</button>
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
				if (confirm(t('deleteNote'))) {
					if (STORAGE_MODE === 'local' || note._isLocal) {
						localDeleteNote(note.id);
						showInformation(t('noteDeleted'));
						loadNotes();
					} else {
						callApi('delete_note', { data: { id: note.id } }, () => {
							showInformation(t('noteDeleted'));
							loadNotes();
						});
					}
				}
			});
		});

		setContent(notesDiv);
	}

	function displayNoteForm(note = null) {
		const isCurrentlyLocal = note ? note._isLocal : false;
		const showLocalCheckbox = STORAGE_MODE === 'server'; // Only show in server mode

		const formDiv = document.createElement('div');
		formDiv.className = 'card';
		formDiv.innerHTML = `
			<div class="card-body">
				<h2 class="card-title mb-4">
					<i class="bi ${note ? 'bi-pencil-square' : 'bi-journal-plus'} me-2"></i>
					${note ? t('editNote') : t('newNote')}
				</h2>
				<div class="form-group">
					<label for='title'><i class="bi bi-type me-1"></i>${t('title')}</label>
					<input class="form-control" type='text' id='title' value='${note ? note.title : ''}' placeholder="${t('enterNoteTitle')}">
				</div>
				<div class="form-group">
					<label for='content'><i class="bi bi-text-paragraph me-1"></i>${t('content')}</label>
					<textarea class="form-control" id='content' rows='10' placeholder="${t('writeNoteHere')}">${note ? note.content : ''}</textarea>
				</div>
				${showLocalCheckbox ? `
				<div class="form-check mb-3">
					<input class="form-check-input" type="checkbox" id="storeLocallyCheck" ${isCurrentlyLocal ? 'checked' : ''}>
					<label class="form-check-label" for="storeLocallyCheck">
						<i class="bi bi-hdd me-1"></i>${t('storeLocally')}
					</label>
				</div>
				` : ''}
				<button id='saveNoteBtn' class="btn btn-primary">
					<i class="bi ${note ? 'bi-check-lg' : 'bi-save'} me-2"></i>${note ? t('updateNote') : t('saveNote')}
				</button>
			</div>
		`;
		setContent(formDiv);

		document.getElementById('saveNoteBtn').addEventListener('click', () => {
			const title = document.getElementById('title').value;
			const content = document.getElementById('content').value;
			const storeLocallyCheckbox = document.getElementById('storeLocallyCheck');
			const storeLocally = storeLocallyCheckbox ? storeLocallyCheckbox.checked : (STORAGE_MODE === 'local');

			if (!title || !content) {
				alert(t('fillTitleContent'));
				return;
			}

			if (STORAGE_MODE === 'local' || storeLocally) {
				// Save locally
				if (note?.id && !note._isLocal) {
					// Moving from server to local - delete from server first
					callApi('delete_note', { data: { id: note.id } }, () => {
						localAddNote(title, content);
						showInformation(t('noteSaved'));
						loadNotes();
					});
				} else if (note?.id && note._isLocal) {
					// Update existing local note
					localUpdateNote(note.id, title, content);
					showInformation(t('noteSaved'));
					loadNotes();
				} else {
					// New local note
					localAddNote(title, content);
					showInformation(t('noteSaved'));
					loadNotes();
				}
			} else {
				// Save to server
				if (note?.id && note._isLocal) {
					// Moving from local to server - delete from local first
					localDeleteNote(note.id);
					callApi('add_note', { data: { title, content } }, () => {
						showInformation(t('noteSaved'));
						loadNotes();
					});
				} else {
					// Update or add on server
					const noteData = { title, content };
					let action = 'add_note';
					if (note?.id) {
						noteData.id = note.id;
						action = 'update_note';
					}
					callApi(action, { data: noteData }, () => {
						showInformation(t('noteSaved'));
						loadNotes();
					});
				}
			}
		});
	}

	// ============ Init ============

	function loadConfig(callback) {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', api_url, true);
		xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				try {
					const res = JSON.parse(xhr.responseText);
					if (res.success && res.config) {
						APP_CONFIG = res.config;
					}
				} catch (e) {
					console.log('Config load failed, using defaults');
				}
				callback();
			}
		};
		xhr.send('action=get_config');
	}

	function registerServiceWorker() {
		if (APP_CONFIG.enable_pwa && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('./sw.js')
				.then((reg) => console.log('Service Worker registered:', reg.scope))
				.catch((err) => console.log('Service Worker registration failed:', err));
		}
	}

	function init() {
		console.log('QuickNotesApp initialized');
		div_app = document.getElementById('app');

		loadConfig(() => {
			registerServiceWorker();
			displayLogin();
		});
	}

	init();
	return this;
}
