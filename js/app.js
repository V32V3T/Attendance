// Script.js
// Configuration
const MATCH_QR_STRING = "f29cZb7Q6DuaMjYkTLV3nxR9KEqV2XoBslrHcwA8d1tZ5UeqgiWTvjNpLEsQ";
const API_BASE_URL = "/api/log-attendance";

// State variables
let qrScanner = null;
let currentUser = null;
let scanCooldown = false;
let isUserRegistered = false;
let currentLocation = null;
let isAppInitialized = false;
let isCameraActive = false;

let qrReaderElement, userFormCard, userInfoDisplay, statusDisplay;


// ============ STEP 1: START APP & LAUNCH QR SCANNER ============
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    try {
        console.log('   Starting QR Attendance App...');

        // Initialize DOM elements
        console.log('  Initializing DOM elements...');
        initDOMElements();

        console.log('  Disabling form...');
        disableForm();

        // Setup camera toggle button
        console.log('  Setting up camera toggle...');
        setupCameraToggle();

        // Request location permission early
        console.log('  Requesting location permission...');
        await requestLocationPermission();

        // Check if user data exists in temporary storage
        console.log('  Checking for existing user...');
        await checkForExistingUser();

        console.log('  Checking temp user data...');
        checkTempUserData();

        // Setup gallery upload
        console.log('  Setting up gallery upload...');
        setupGalleryUpload();

        // Setup form submission
        console.log('  Setting up form submission...');
        setupFormSubmission();

        // Update status
        console.log('  Updating initial status...');
        updateStatus('Ready - Toggle camera or upload QR image');
        updateScannerStatus('inactive');

        // Check if user is already registered and update UI
        if (currentUser && currentUser.employeeId) {
            console.log('   User found, rendering info and updating status...');
            renderUserInfo(currentUser);
            await updateStatusCard(currentUser.employeeId);
        }

        isAppInitialized = true;
        console.log('   App initialization completed successfully');
    } catch (error) {
        console.error('   Error in initializeApp:', error);
        showMessage('App initialization failed: ' + error.message, 'error');
    }
}

function initDOMElements() {
    try {
        console.log('  Getting DOM elements...');
        qrReaderElement = document.getElementById('qr-reader');
        userFormCard = document.getElementById('form-card');
        userInfoDisplay = document.getElementById('user-info-display');
        statusDisplay = document.getElementById('status-text');

        console.log('DOM Elements found:', {
            qrReader: !!qrReaderElement,
            formCard: !!userFormCard,
            userInfoDisplay: !!userInfoDisplay,
            statusDisplay: !!statusDisplay
        });
    } catch (error) {
        console.error('   Error in initDOMElements:', error);
    }
}

// ============ CAMERA TOGGLE FUNCTIONS ============
function setupCameraToggle() {
    try {
        console.log('  Setting up camera toggle button...');
        const scannerContainer = document.getElementById('qr-scanner-container');

        if (!scannerContainer) {
            console.warn('   Scanner container not found');
            return;
        }

        const toggleButton = document.createElement('button');
        toggleButton.id = 'camera-toggle-btn';
        toggleButton.className = 'w-full mt-4 bg-primary hover:bg-primary-dark text-white font-medium py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-primary focus:ring-offset-2';
        toggleButton.innerHTML = `
            <div class="flex items-center justify-center space-x-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <span>Start Camera</span>
            </div>
        `;
        toggleButton.addEventListener('click', toggleCamera);
        scannerContainer.appendChild(toggleButton);
        console.log('   Camera toggle button created and added');
    } catch (error) {
        console.error('   Error in setupCameraToggle:', error);
    }
}

async function toggleCamera() {
    try {
        console.log('  Toggle camera called, current state:', isCameraActive);
        const toggleBtn = document.getElementById('camera-toggle-btn');

        if (!isCameraActive) {
            console.log('  Starting camera...');
            await startQRScanner();
            if (qrScanner) {
                isCameraActive = true;
                console.log('   Camera started successfully');
                toggleBtn.innerHTML = `
                    <div class="flex items-center justify-center space-x-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10l6 6m0-6l-6 6"></path>
                        </svg>
                        <span>Stop Camera</span>
                    </div>
                `;
                toggleBtn.className = 'w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-red-500 focus:ring-offset-2';
                updateScannerStatus('active');
            } else {
                console.warn('   Camera failed to start');
            }
        } else {
            console.log('  Stopping camera...');
            await stopQRScanner();
            isCameraActive = false;
            console.log('   Camera stopped successfully');
            toggleBtn.innerHTML = `
                <div class="flex items-center justify-center space-x-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <span>Start Camera</span>
                </div>
            `;
            toggleBtn.className = 'w-full mt-4 bg-primary hover:bg-primary-dark text-white font-medium py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-primary focus:ring-offset-2';
            updateScannerStatus('inactive');

            qrReaderElement.innerHTML = `
                <div class="text-center text-gray-500">
                    <svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
                    </svg>
                    <p class="font-medium">Click "Start Camera" to begin scanning</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('   Error in toggleCamera:', error);
        showMessage('Camera toggle failed: ' + error.message, 'error');
    }
}

// ============ GALLERY UPLOAD FUNCTIONS ============
function setupGalleryUpload() {
    try {
        console.log('  Setting up gallery upload...');
        const uploadInput = document.getElementById('qr-image-upload');
        if (uploadInput) {
            uploadInput.addEventListener('change', handleGalleryUpload);
            console.log('   Gallery upload event listener added');
        } else {
            console.warn('   Upload input element not found');
        }
    } catch (error) {
        console.error('   Error in setupGalleryUpload:', error);
    }
}

async function handleGalleryUpload(event) {
    try {
        console.log('  Handling gallery upload...');
        const file = event.target.files[0];
        if (!file) {
            console.log('   No file selected');
            return;
        }

        console.log(' File selected:', file.name, file.type, file.size);

        if (!file.type.startsWith('image/')) {
            console.warn('   Invalid file type:', file.type);
            showMessage('Please select a valid image file.', 'error');
            return;
        }

        updateStatus('Processing uploaded image...');
        updateScannerStatus('processing');

        const reader = new FileReader();
        reader.onload = function (e) {
            console.log('  File loaded, processing image...');
            const img = new Image();
            img.onload = function () {
                try {
                    console.log('  Image loaded, creating canvas...');
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    console.log('  Getting image data for QR detection...');
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, canvas.width, canvas.height);

                    if (code) {
                        console.log('   QR code detected from gallery:', code.data);
                        showMessage('QR code detected from image!', 'success');
                        updateStatus('QR code found in image');
                        handleQRCodeScan(code.data);
                    } else {
                        console.warn('   No QR code found in image');
                        showMessage('No QR code found in the image. Please try another image.', 'error');
                        updateStatus('No QR code found in image');
                        updateScannerStatus('inactive');
                    }
                } catch (error) {
                    console.error('   Error processing image:', error);
                    showMessage('Error processing image. Please try again.', 'error');
                    updateStatus('Error processing image');
                    updateScannerStatus('inactive');
                }
            };

            img.onerror = function () {
                console.error('   Error loading image');
                showMessage('Error loading image. Please try another file.', 'error');
                updateStatus('Error loading image');
                updateScannerStatus('inactive');
            };

            img.src = e.target.result;
        };

        reader.onerror = function () {
            console.error('   Error reading file');
            showMessage('Error reading file. Please try again.', 'error');
            updateStatus('Error reading file');
            updateScannerStatus('inactive');
        };

        reader.readAsDataURL(file);
        event.target.value = '';
    } catch (error) {
        console.error('   Error in handleGalleryUpload:', error);
        showMessage('Gallery upload failed: ' + error.message, 'error');
    }
}

// ============ QR SCANNER FUNCTIONS ============
async function startQRScanner() {
    try {
        console.log('  Starting QR scanner...');

        if (qrScanner) {
            console.log('  Stopping existing scanner...');
            await stopQRScanner();
        }

        if (!qrReaderElement) {
            console.error('   QR reader element not found');
            throw new Error('QR reader element not found');
        }

        qrReaderElement.innerHTML = '';
        console.log('  Creating new Html5Qrcode instance...');
        qrScanner = new Html5Qrcode("qr-reader");

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };

        console.log('  Starting scanner with config:', config);
        await qrScanner.start(
            { facingMode: "environment" },
            config,
            handleQRCodeScan,
            (errorMessage) => {
                console.debug('QR scan debug:', errorMessage);
            }
        );

        console.log('   QR scanner started successfully');
        updateStatus('Camera active - Please scan QR code');
        updateScannerStatus('active');

    } catch (error) {
        console.error('   Error starting QR scanner:', error);
        updateStatus('Camera Error - Please check permissions or try gallery upload');
        updateScannerStatus('error');
        isCameraActive = false;

        const toggleBtn = document.getElementById('camera-toggle-btn');
        if (toggleBtn) {
            console.log('  Resetting toggle button state...');
            toggleBtn.innerHTML = `
                <div class="flex items-center justify-center space-x-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <span>Start Camera</span>
                </div>
            `;
            toggleBtn.className = 'w-full mt-4 bg-primary hover:bg-primary-dark text-white font-medium py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-primary focus:ring-offset-2';
        }
        throw error;
    }
}

async function stopQRScanner() {
    try {
        if (qrScanner) {
            console.log('  Stopping QR scanner...');
            await qrScanner.stop();
            qrScanner = null;
            updateScannerStatus('inactive');
            console.log('   QR scanner stopped successfully');
        }
    } catch (error) {
        console.error('   Error stopping QR scanner:', error);
    }
}

// ============ UNIFIED QR CODE HANDLER ============
async function handleQRCodeScan(qrCode) {
    try {
        console.log('  QR code scanned:', qrCode);

        if (scanCooldown) {
            console.log('   Scan cooldown active, ignoring scan');
            return;
        }

        scanCooldown = true;
        setTimeout(() => {
            scanCooldown = false;
            console.log('   Scan cooldown reset');
        }, 2000);

        console.log('  Checking QR code against expected string...');
        console.log('Expected:', MATCH_QR_STRING);
        console.log('Received:', qrCode);
        console.log('Match:', qrCode === MATCH_QR_STRING);

        if (qrCode === MATCH_QR_STRING) {
            console.log('   Authorized QR code detected!');
            updateStatus('Authorized QR code detected!');
            updateScannerStatus('success');
            showMessage('Authorized QR code detected!', 'success');
            await handleAuthorizedUser();
        } else {
            console.warn('   Invalid QR code scanned');
            updateStatus('Invalid QR code. Please scan the correct QR code.');
            updateScannerStatus('error');
            showMessage('Invalid QR code. Please scan the authorized QR code.', 'error');
        }
    } catch (error) {
        console.error('   Error in handleQRCodeScan:', error);
        showMessage('QR scan processing failed: ' + error.message, 'error');
    }
}

// ============ USER MANAGEMENT FUNCTIONS ============
async function handleAuthorizedUser() {
    try {
        console.log('  Handling authorized user...');
        await stopQRScanner();

        console.log('Current user state:', { currentUser, isUserRegistered });

        if (currentUser && isUserRegistered) {
            console.log('   User already registered, updating status and enabling buttons...');
            await updateStatusCard(currentUser.employeeId);
            enableAttendanceButtons();
        } else {
            console.log('   User not registered, enabling form...');
            enableForm();
            updateStatus('Please fill out the registration form');
        }
    } catch (error) {
        console.error('   Error in handleAuthorizedUser:', error);
        showMessage('User handling failed: ' + error.message, 'error');
    }
}

async function checkForExistingUser() {
    try {
        console.log('  Checking for existing user in localStorage...');
        const savedUser = localStorage.getItem('qr_attendance_user');

        if (savedUser) {
            console.log('    Found saved user data');
            currentUser = JSON.parse(savedUser);
            isUserRegistered = true;
            console.log('   User loaded:', currentUser);
            updateStatus('Welcome back, ' + currentUser.fullName);
        } else {
            console.log('   No saved user found');
        }
    } catch (error) {
        console.error('   Error parsing saved user data:', error);
        localStorage.removeItem('qr_attendance_user');
        currentUser = null;
        isUserRegistered = false;
    }
}

function checkTempUserData() {
    try {
        console.log('  Checking for temp user data...');
        const tempUser = sessionStorage.getItem('temp_user_data');

        if (tempUser) {
            console.log('    Found temp user data');
            const userData = JSON.parse(tempUser);
            populateForm(userData);
            console.log('   Form populated with temp data');
        } else {
            console.log('   No temp user data found');
        }
    } catch (error) {
        console.error('   Error parsing temp user data:', error);
        sessionStorage.removeItem('temp_user_data');
    }
}

function populateForm(userData) {
    try {
        console.log('  Populating form with data:', userData);
        const fullNameInput = document.getElementById('fullName');
        const mobileInput = document.getElementById('mobile');
        const employeeIdInput = document.getElementById('employeeId');
        const departmentInput = document.getElementById('department');

        if (fullNameInput) fullNameInput.value = userData.fullName || '';
        if (mobileInput) mobileInput.value = userData.mobile || '';
        if (employeeIdInput) employeeIdInput.value = userData.employeeId || '';
        if (departmentInput) departmentInput.value = userData.department || '';

        console.log('   Form populated successfully');
    } catch (error) {
        console.error('   Error populating form:', error);
    }
}

// ============ FORM FUNCTIONS ============
function setupFormSubmission() {
    try {
        console.log('  Setting up form submission...');
        const form = document.getElementById('user-form');

        if (form) {
            form.addEventListener('submit', handleFormSubmission);
            console.log('   Form submission listener added');
        } else {
            console.warn('   User form not found');
        }
    } catch (error) {
        console.error('   Error in setupFormSubmission:', error);
    }
}

async function handleFormSubmission(event) {
    try {
        console.log('  Form submission started...');
        event.preventDefault();

        const formData = new FormData(event.target);
        const userData = {
            fullName: formData.get('fullName'),
            mobile: formData.get('mobile'),
            employeeId: formData.get('employeeId'),
            department: formData.get('department')
        };

        console.log('    Form data collected:', userData);

        // Validate form data
        if (!userData.fullName || !userData.mobile || !userData.employeeId || !userData.department) {
            console.warn('   Form validation failed - missing required fields');
            showMessage('Please fill in all required fields.', 'error');
            return;
        }

        // Save to session storage as backup
        console.log('Saving temp user data to session storage...');
        sessionStorage.setItem('temp_user_data', JSON.stringify(userData));

        showLoadingState(true);
        updateStatus('Registering user...');
        console.log('  Making API call for registration...');

        const response = await makeAPICall('register', userData);
        console.log('   API response received:', response);

        if (response.status === 'success') {
            console.log('Registration successful');
            currentUser = userData;
            isUserRegistered = true;
            localStorage.setItem('qr_attendance_user', JSON.stringify(userData));
            sessionStorage.removeItem('temp_user_data');

            showMessage('Registration successful!', 'success');
            updateStatus('Registration completed successfully');

            disableForm();
            renderUserInfo(userData);
            await updateStatusCard(userData.employeeId);
            enableAttendanceButtons();

        } else if (response.status === 'exists') {
            console.log('   User already exists');
            currentUser = userData;
            isUserRegistered = true;
            localStorage.setItem('qr_attendance_user', JSON.stringify(userData));
            sessionStorage.removeItem('temp_user_data');

            showMessage('User already registered. Welcome back!', 'info');
            updateStatus('User already registered');

            disableForm();
            renderUserInfo(userData);
            await updateStatusCard(userData.employeeId);
            enableAttendanceButtons();

        } else {
            console.warn('Registration failed:', response.message);
            showMessage(response.message || 'Registration failed. Please try again.', 'error');
            updateStatus('Registration failed');
        }
    } catch (error) {
        console.error('   Registration error:', error);
        showMessage('Registration failed. Please check your connection and try again.', 'error');
        updateStatus('Registration error');
    } finally {
        showLoadingState(false);
    }
}

function enableForm() {
    try {
        console.log('  Enabling form...');
        const form = document.getElementById('user-form');

        if (!form) {
            console.warn('   Form not found');
            return;
        }

        const inputs = form.querySelectorAll('input, select, button');
        inputs.forEach(input => input.disabled = false);

        if (userFormCard) {
            userFormCard.style.display = 'block';
        }

        updateStatus('Please complete the registration form');
        console.log('   Form enabled successfully');
    } catch (error) {
        console.error('   Error enabling form:', error);
    }
}

function disableForm() {
    try {
        console.log('  Disabling form...');
        const form = document.getElementById('user-form');

        if (!form) {
            console.warn('   Form not found');
            return;
        }

        const inputs = form.querySelectorAll('input, select, button');
        inputs.forEach(input => input.disabled = true);

        if (userFormCard) {
            userFormCard.style.display = 'none';
        }

        console.log('   Form disabled successfully');
    } catch (error) {
        console.error('   Error disabling form:', error);
    }
}

// ============ ATTENDANCE FUNCTIONS ============
function enableAttendanceButtons() {
    try {
        console.log('  Enabling attendance buttons...');
        const checkInBtn = document.getElementById('check-in-btn');
        const checkOutBtn = document.getElementById('check-out-btn');

        if (checkInBtn) {
            checkInBtn.style.display = 'block';
            checkInBtn.addEventListener('click', handleCheckIn);
            console.log('   Check-in button enabled');
        } else {
            console.warn('   Check-in button not found');
        }

        if (checkOutBtn) {
            checkOutBtn.style.display = 'block';
            checkOutBtn.addEventListener('click', handleCheckOut);
            console.log('   Check-out button enabled');
        } else {
            console.warn('   Check-out button not found');
        }
    } catch (error) {
        console.error('   Error enabling attendance buttons:', error);
    }
}

async function handleCheckIn() {
    try {
        console.log('  Check-in process started...');

        if (!currentUser || !currentUser.employeeId) {
            console.warn('   No current user for check-in');
            showMessage('Please register first.', 'error');
            return;
        }

        showLoadingState(true);
        updateStatus('Processing check-in...');

        const requestData = {
            employeeId: currentUser.employeeId,
            location: currentLocation
        };

        console.log('    Check-in request data:', requestData);
        console.log('  Making check-in API call...');

        const response = await makeAPICall('check-in', requestData);
        console.log('   Check-in API response:', response);

        if (response.status === 'success') {
            console.log('   Check-in successful');
            showMessage(`Check-in successful at ${response.time}`, 'success');
            updateStatus(`Checked in at ${response.time}`);
            await updateStatusCard(currentUser.employeeId);
        } else {
            console.warn('   Check-in failed:', response.message);
            showMessage(response.message || 'Check-in failed. Please try again.', 'error');
            updateStatus('Check-in failed');
        }
    } catch (error) {
        console.error('   Check-in error:', error);
        showMessage('Check-in failed. Please check your connection and try again.', 'error');
        updateStatus('Check-in error');
    } finally {
        showLoadingState(false);
    }
}

async function handleCheckOut() {
    try {
        console.log('  Check-out process started...');

        if (!currentUser || !currentUser.employeeId) {
            console.warn('   No current user for check-out');
            showMessage('Please register first.', 'error');
            return;
        }

        showLoadingState(true);
        updateStatus('Processing check-out...');

        const requestData = {
            employeeId: currentUser.employeeId,
            location: currentLocation
        };

        console.log('    Check-out request data:', requestData);
        console.log('  Making check-out API call...');

        const response = await makeAPICall('check-out', requestData);
        console.log('   Check-out API response:', response);

        if (response.status === 'success') {
            console.log('   Check-out successful');
            showMessage(`Check-out successful at ${response.time}`, 'success');
            updateStatus(`Checked out at ${response.time}`);
            await updateStatusCard(currentUser.employeeId);
        } else {
            console.warn('   Check-out failed:', response.message);
            showMessage(response.message || 'Check-out failed. Please try again.', 'error');
            updateStatus('Check-out failed');
        }
    } catch (error) {
        console.error('   Check-out error:', error);
        showMessage('Check-out failed. Please check your connection and try again.', 'error');
        updateStatus('Check-out error');
    } finally {
        showLoadingState(false);
    }
}

async function updateStatusCard(employeeId) {
    try {
        console.log('  Updating status card for employee:', employeeId);
        console.log('  Making status API call...');

        const response = await makeAPICall('status', { employeeId });
        console.log('   Status API response:', response);

        const statusCard = document.getElementById('status-card');
        const statusText = document.getElementById('status-card-text');
        const checkInBtn = document.getElementById('check-in-btn');
        const checkOutBtn = document.getElementById('check-out-btn');

        if (!statusCard || !statusText) {
            console.warn('   Status card elements not found');
            return;
        }

        statusCard.style.display = 'block';

        switch (response.status) {
            case 'not_checked_in':
                console.log('   User not checked in today');
                statusText.textContent = 'Not checked in today';
                statusCard.className = 'status-card status-not-checked-in';
                if (checkInBtn) checkInBtn.disabled = false;
                if (checkOutBtn) checkOutBtn.disabled = true;
                break;

            case 'checked_in':
                console.log('   User checked in at:', response.check_in_time);
                statusText.textContent = `Checked in at ${response.check_in_time}`;
                statusCard.className = 'status-card status-checked-in';
                if (checkInBtn) checkInBtn.disabled = true;
                if (checkOutBtn) checkOutBtn.disabled = false;
                break;

            case 'completed':
                console.log('   User completed attendance - In:', response.check_in_time, 'Out:', response.check_out_time);
                statusText.textContent = `Completed: In at ${response.check_in_time}, Out at ${response.check_out_time}`;
                statusCard.className = 'status-card status-completed';
                if (checkInBtn) checkInBtn.disabled = true;
                if (checkOutBtn) checkOutBtn.disabled = true;
                break;

            default:
                console.warn('   Unknown status:', response.status);
                statusText.textContent = 'Status unknown';
                statusCard.className = 'status-card status-unknown';
                break;
        }

        console.log('   Status card updated successfully');
    } catch (error) {
        console.error('   Error updating status card:', error);
        showMessage('Failed to update status: ' + error.message, 'error');
    }
}

async function makeAPICall(action, data) {
    const payload = { action, ...data };
    try {
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify(payload)
        });
        console.log(typeof (payload));
        console.log("Payload to be sent:", payload);

        // Check if response is ok
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();

        // Check if response is valid JSON
        try {
            return JSON.parse(text);
        } catch (parseError) {
            console.error('Invalid JSON response:', text);
            throw new Error('Server returned invalid JSON response');
        }
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}




// ============ LOCATION FUNCTIONS ============
async function requestLocationPermission() {
    try {
        console.log('  Requesting location permission...');

        if (!navigator.geolocation) {
            console.warn('   Geolocation is not supported by this browser');
            return;
        }

        console.log('  Getting current position...');
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });

        currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };

        console.log('   Location obtained:', currentLocation);
    } catch (error) {
        console.warn('   Location access denied or failed:', error.message);
        currentLocation = null;
    }
}

// ============ UI HELPER FUNCTIONS ============
function renderUserInfo(userData) {
    try {
        console.log('  Rendering user info:', userData);

        if (!userInfoDisplay) {
            console.warn('   User info display element not found');
            return;
        }

        userInfoDisplay.innerHTML = `
            <div class="user-info-card">
                <h3>User Information</h3>
                <p><strong>Name:</strong> ${userData.fullName}</p>
                <p><strong>Mobile:</strong> ${userData.mobile}</p>
                <p><strong>Employee ID:</strong> ${userData.employeeId}</p>
                <p><strong>Department:</strong> ${userData.department}</p>
            </div>
        `;
        userInfoDisplay.style.display = 'block';
        console.log('   User info rendered successfully');
    } catch (error) {
        console.error('   Error rendering user info:', error);
    }
}

function showMessage(message, type = 'info') {
    try {
        console.log('  Showing message:', message, 'Type:', type);

        const messageContainer = document.getElementById('message-container') || createMessageContainer();

        const messageElement = document.createElement('div');
        messageElement.className = `message message-${type}`;
        messageElement.textContent = message;

        messageContainer.appendChild(messageElement);

        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.remove();
                console.log('ℹ Message removed after timeout');
            }
        }, 5000);

        console.log(' Message displayed successfully');
    } catch (error) {
        console.error(' Error showing message:', error);
    }
}

function createMessageContainer() {
    try {
        console.log(' Creating message container...');
        const container = document.createElement('div');
        container.id = 'message-container';
        container.className = 'message-container';
        document.body.appendChild(container);
        console.log(' Message container created');
        return container;
    } catch (error) {
        console.error(' Error creating message container:', error);
        return null;
    }
}

function showLoadingState(show) {
    try {
        console.log(' Setting loading state:', show);
        const loadingElement = document.getElementById('loading-indicator');

        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
            console.log(' Loading state updated');
        } else {
            console.warn(' Loading indicator not found');
        }
    } catch (error) {
        console.error(' Error setting loading state:', error);
    }
}

function updateStatus(message) {
    try {
        console.log(' Updating status:', message);

        if (statusDisplay) {
            statusDisplay.textContent = message;
            console.log(' Status updated in UI');
        } else {
            console.warn(' Status display element not found');
        }

        console.log(' Status:', message);
    } catch (error) {
        console.error(' Error updating status:', error);
    }
}

function updateScannerStatus(status) {
    try {
        console.log(' Updating scanner status:', status);

        const scannerDot = document.getElementById('scanner-dot');
        const scannerText = document.getElementById('scanner-text');

        if (scannerDot && scannerText) {
            scannerDot.className = 'w-2 h-2 rounded-full';

            switch (status) {
                case 'active':
                    scannerDot.classList.add('status-active');
                    scannerText.textContent = 'Active';
                    break;
                case 'inactive':
                    scannerDot.classList.add('status-inactive');
                    scannerText.textContent = 'Inactive';
                    break;
                case 'success':
                    scannerDot.classList.add('status-success');
                    scannerText.textContent = 'Success';
                    break;
                case 'error':
                    scannerDot.classList.add('status-error');
                    scannerText.textContent = 'Error';
                    break;
                case 'processing':
                    scannerDot.classList.add('status-processing');
                    scannerText.textContent = 'Processing';
                    break;
                default:
                    scannerDot.classList.add('status-inactive');
                    scannerText.textContent = 'Inactive';
            }

            console.log(' Scanner status updated successfully');
        } else {
            console.warn(' Scanner status elements not found');
        }
    } catch (error) {
        console.error(' Error updating scanner status:', error);
    }
}

// ============ CLEANUP FUNCTIONS ============
window.addEventListener('beforeunload', async () => {
    try {
        console.log(' Page unloading, cleaning up...');

        if (qrScanner) {
            console.log(' Stopping scanner before page unload...');
            await qrScanner.stop();
            console.log(' Scanner stopped successfully');
        }
    } catch (error) {
        console.error(' Error stopping scanner on page unload:', error);
    }
});

// ============ ERROR HANDLER ============
window.addEventListener('error', (event) => {
    console.error(' Global error caught:', event.error);
    console.error(' Error details:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
    });
});

window.addEventListener('unhandledrejection', (event) => {
    console.error(' Unhandled promise rejection:', event.reason);
    console.error(' Promise:', event.promise);
});

console.log('Script.js loaded successfully with comprehensive error checking');
