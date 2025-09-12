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
        showError('Room not found. Please check the room code and try again.');
    }
    
    if (joinRoomCode && roomCodeInput) {
        roomCodeInput.value = joinRoomCode.toUpperCase();
        roomCodeInput.style.backgroundColor = '#fff3cd';
        roomCodeInput.focus();
        
        // Update the form text to indicate joining
        const formLabel = document.querySelector('label[for="roomCode"]');
        if (formLabel) {
            formLabel.textContent = 'Room Code (joining game)';
        }
        
        // Show helpful message
        showInfo(`Ready to join room ${joinRoomCode.toUpperCase()}. Just enter your name and avatar!`);
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

    // Auto-uppercase room code input
    if (roomCodeInput) {
        roomCodeInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    // Create new game button
    if (createNewGameBtn) {
        createNewGameBtn.addEventListener('click', function() {
            const playerName = document.getElementById('playerName').value.trim();
            const selectedAvatar = selectedAvatarInput.value;
            
            if (!playerName) {
                alert('Please enter your name first');
                document.getElementById('playerName').focus();
                return;
            }

            // Visual feedback
            createNewGameBtn.disabled = true;
            createNewGameBtn.textContent = 'Creating...';
            
            // Clear room code and create new game
            roomCodeInput.value = '';
            
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
                alert('Please enter your name');
                return;
            }

            // If room code provided, validate it
            if (roomCode && roomCode.length !== 6) {
                alert('Room code must be exactly 6 characters');
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
            const response = await fetch('/api/create-game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Redirect to game room with the new code
                sessionStorage.setItem('playerData', JSON.stringify(playerData));
                window.location.href = `/game/${result.gameId}`;
            } else {
                alert('Failed to create game. Please try again.');
                resetCreateButton();
            }
        } catch (error) {
            alert('Connection error. Please check your internet connection.');
            resetCreateButton();
        }
    }
    
    // Function to reset create button state
    function resetCreateButton() {
        const createBtn = document.getElementById('createNewGame');
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.textContent = 'Create New Game';
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
                alert(result.error || 'Failed to join game');
            }
        } catch (error) {
            alert('Connection error. Please check your internet connection.');
        }
    }
});

// Utility function to generate random game ID
function generateGameId() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
}