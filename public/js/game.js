// Who am I? Game - Frontend JavaScript

// Avatar selection handling
document.addEventListener('DOMContentLoaded', function() {
    const avatarSelector = document.getElementById('avatarSelector');
    const selectedAvatarInput = document.getElementById('selectedAvatar');
    const playerForm = document.getElementById('playerForm');
    const createNewGameBtn = document.getElementById('createNewGame');
    const roomCodeInput = document.getElementById('roomCode');

    // Check if there's a room code in URL parameters (for direct links)
    const urlParams = new URLSearchParams(window.location.search);
    const joinRoomCode = urlParams.get('join');
    const errorParam = urlParams.get('error');
    
    // Handle errors
    if (errorParam === 'room-not-found') {
        showError((typeof i18n !== 'undefined' && i18n) ? i18n.getText('roomNotFound') : 'Room not found. Please check the room code and try again.');
    }
    
    if (joinRoomCode && roomCodeInput) {
        roomCodeInput.value = joinRoomCode.toUpperCase();
        roomCodeInput.style.backgroundColor = '#fff3cd';
        document.getElementById('playerName').focus();
        
        // Update the form text to indicate joining
        const formLabel = document.querySelector('label[for="roomCode"]');
        if (formLabel) {
            formLabel.textContent = (typeof i18n !== 'undefined' && i18n) ? i18n.getText('roomCodeJoining') : 'Room Code (joining game)';
        }
        
        // Enable Join button since room code is pre-filled
        const joinBtn = document.getElementById('joinBtn');
        if (joinBtn) {
            joinBtn.disabled = false;
            joinBtn.classList.remove('btn-secondary');
            joinBtn.classList.add('btn-primary');
        }
        
        // Show helpful message - will be localized after i18n is loaded
        setTimeout(() => {
            if (typeof i18n !== 'undefined' && i18n) {
                showInfo(`${i18n.getText('readyToJoin')} ${joinRoomCode.toUpperCase()}. ${i18n.getText('enterNameAvatar')}`);
            }
        }, 100);
    }
    
    // Function to show error messages
    function showError(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.game-card'));
    }
    
    // Function to show info messages
    function showInfo(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-info alert-dismissible fade show';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.game-card'));
    }

    // Set first avatar as selected by default
    if (avatarSelector) {
        const firstAvatar = avatarSelector.querySelector('.avatar-option');
        if (firstAvatar) {
            firstAvatar.classList.add('selected');
        }
    }

    // Avatar selection
    if (avatarSelector) {
        avatarSelector.addEventListener('click', function(e) {
            if (e.target.classList.contains('avatar-option')) {
                // Remove selection from all avatars
                document.querySelectorAll('.avatar-option').forEach(avatar => {
                    avatar.classList.remove('selected');
                });
                
                // Add selection to clicked avatar
                e.target.classList.add('selected');
                selectedAvatarInput.value = e.target.dataset.avatar;
            }
        });
    }

    // Auto-uppercase room code input and manage Join button state
    if (roomCodeInput) {
        const joinBtn = document.getElementById('joinBtn');
        
        // Initially update both button states
        if (joinBtn) {
            updateJoinButtonState();
        }
        
        roomCodeInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.toUpperCase();
            updateJoinButtonState();
        });
        
        // Function to update Join button state based on room code
        function updateJoinButtonState() {
            if (joinBtn) {
                const roomCode = roomCodeInput.value.trim();
                const isValidLength = roomCode.length === 6;
                joinBtn.disabled = !isValidLength;
                
                if (isValidLength) {
                    joinBtn.classList.remove('btn-secondary');
                    joinBtn.classList.add('btn-primary');
                } else {
                    joinBtn.classList.remove('btn-primary');
                    joinBtn.classList.add('btn-secondary');
                }
            }
            
            // Update Create New Game button state
            updateCreateButtonState();
        }
        
        // Function to update Create New Game button state based on room code
        function updateCreateButtonState() {
            if (createNewGameBtn) {
                const roomCode = roomCodeInput.value.trim();
                const hasValidRoomCode = roomCode.length === 6;
                
                if (hasValidRoomCode) {
                    createNewGameBtn.disabled = true;
                    createNewGameBtn.classList.add('btn-outline-secondary');
                    createNewGameBtn.classList.remove('btn-outline-primary');
                    createNewGameBtn.title = (typeof i18n !== 'undefined' && i18n) ? i18n.getText('clearRoomCodeToCreate') : 'Clear room code to create a new game';
                } else {
                    createNewGameBtn.disabled = false;
                    createNewGameBtn.classList.remove('btn-outline-secondary');
                    createNewGameBtn.classList.add('btn-outline-primary');
                    createNewGameBtn.title = '';
                }
            }
        }
    }

    // Create new game button
    if (createNewGameBtn) {
        createNewGameBtn.addEventListener('click', function() {
            const playerName = document.getElementById('playerName').value.trim();
            const selectedAvatar = selectedAvatarInput.value;
            
            if (!playerName) {
                alert((typeof i18n !== 'undefined' && i18n) ? i18n.getText('pleaseEnterName') : 'Please enter your name first');
                document.getElementById('playerName').focus();
                return;
            }

            // Clear room code first (this will re-enable the button visually)
            roomCodeInput.value = '';
            updateJoinButtonState(); // This will also update the create button state
            
            // Visual feedback
            createNewGameBtn.disabled = true;
            createNewGameBtn.textContent = (typeof i18n !== 'undefined' && i18n) ? i18n.getText('creating') : 'Creating...';
            
            const playerData = {
                name: playerName,
                avatar: selectedAvatar,
                roomCode: null
            };
            
            createGame(playerData);
        });
    }

    // Form submission
    if (playerForm) {
        playerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const playerName = document.getElementById('playerName').value.trim();
            const selectedAvatar = selectedAvatarInput.value;
            const roomCode = roomCodeInput.value.trim();
            
            if (!playerName) {
                alert((typeof i18n !== 'undefined' && i18n) ? i18n.getText('pleaseEnterName') : 'Please enter your name');
                return;
            }

            // If room code provided, validate it
            if (roomCode && roomCode.length !== 6) {
                alert((typeof i18n !== 'undefined' && i18n) ? i18n.getText('roomCodeLength') : 'Room code must be exactly 6 characters');
                return;
            }

            // Store player data and proceed
            const playerData = {
                name: playerName,
                avatar: selectedAvatar,
                roomCode: roomCode || null
            };

            if (roomCode) {
                // Join existing game
                joinGame(playerData);
            } else {
                // Create new game
                createGame(playerData);
            }
        });
    }

    // Function to create new game
    async function createGame(playerData) {
        try {
            console.log('Creating game with player data:', playerData);
            
            const response = await fetch('/api/create-game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            
            console.log('Create game response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Create game result:', result);
            
            if (result.success) {
                // Update player data with the new room code
                playerData.roomCode = result.gameId;
                console.log('Updated player data:', playerData);
                sessionStorage.setItem('playerData', JSON.stringify(playerData));
                window.location.href = `/game/${result.gameId}`;
            } else {
                console.error('Create game failed:', result);
                alert((typeof i18n !== 'undefined' && i18n) ? i18n.getText('failedCreateGame') : 'Failed to create game. Please try again.');
                resetCreateButton();
            }
        } catch (error) {
            console.error('Error creating game:', error);
            alert((typeof i18n !== 'undefined' && i18n) ? i18n.getText('connectionError') : `Connection error: ${error.message}. Please check your internet connection.`);
            resetCreateButton();
        }
    }
    
    // Function to reset create button state
    function resetCreateButton() {
        const createBtn = document.getElementById('createNewGame');
        const roomInput = document.getElementById('roomCode');
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.textContent = (typeof i18n !== 'undefined' && i18n) ? i18n.getText('createNewGame') : 'Create New Game';
            
            // Also update button states based on current room code
            if (roomInput) {
                const roomCode = roomInput.value.trim();
                const hasValidRoomCode = roomCode.length === 6;
                
                if (hasValidRoomCode) {
                    createBtn.disabled = true;
                    createBtn.classList.add('btn-outline-secondary');
                    createBtn.classList.remove('btn-outline-primary');
                    createBtn.title = (typeof i18n !== 'undefined' && i18n) ? i18n.getText('clearRoomCodeToCreate') : 'Clear room code to create a new game';
                } else {
                    createBtn.classList.remove('btn-outline-secondary');
                    createBtn.classList.add('btn-outline-primary');
                    createBtn.title = '';
                }
            }
        }
    }

    // Function to join existing game
    async function joinGame(playerData) {
        try {
            const response = await fetch('/api/join-game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: playerData.roomCode,
                    playerName: playerData.name,
                    avatar: playerData.avatar
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Store player data and redirect to game room
                sessionStorage.setItem('playerData', JSON.stringify(playerData));
                window.location.href = `/game/${playerData.roomCode}`;
            } else {
                alert(result.error || ((typeof i18n !== 'undefined' && i18n) ? i18n.getText('failedJoinGame') : 'Failed to join game'));
            }
        } catch (error) {
            alert((typeof i18n !== 'undefined' && i18n) ? i18n.getText('connectionError') : 'Connection error. Please check your internet connection.');
        }
    }
});

// Utility function to generate random game ID
function generateGameId() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
}