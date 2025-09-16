// Who am I? Game Room - Frontend JavaScript

let socket;
let currentGame = null;
let currentPlayer = null;
let selectedPlayerForAssignment = null;
let revealModal = null;
let restartModal = null;

// Color palette for character stickers
const stickerColors = ['red', 'blue', 'purple', 'orange', 'green', 'pink', 'indigo'];

// Function to get consistent color for a player based on their ID
function getStickerColor(playerId) {
    if (!playerId) return 'red';
    
    // Create a simple hash from the player ID
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
        hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Use the hash to pick a color consistently
    const colorIndex = Math.abs(hash) % stickerColors.length;
    return stickerColors[colorIndex];
}

document.addEventListener('DOMContentLoaded', function() {
    // Get room code from URL
    const urlPath = window.location.pathname;
    const roomCode = urlPath.split('/').pop();
    
    if (!roomCode || roomCode.length !== 6) {
        alert('Invalid room code');
        window.location.href = '/';
        return;
    }

    // Get player data from session storage
    const playerDataStr = sessionStorage.getItem('playerData');
    if (!playerDataStr) {
        // If no player data, redirect to landing page with room code pre-filled
        window.location.href = `/?join=${roomCode}`;
        return;
    }

    currentPlayer = JSON.parse(playerDataStr);
    console.log('Loaded player data from session storage:', currentPlayer);
    
    // Initialize the game room
    initializeGameRoom(roomCode);
    
    // Initialize Socket.IO
    initializeSocket(roomCode);
    
    // Set up event listeners
    setupEventListeners();
});

function initializeGameRoom(roomCode) {
    // Set room code in header
    document.getElementById('roomCode').textContent = roomCode;
    
    // Set share link
    const shareLink = `${window.location.origin}/game/${roomCode}`;
    document.getElementById('shareLink').value = shareLink;
}

function initializeSocket(roomCode) {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        console.log('🔧 About to set up all Socket.IO event handlers...');

        // First join the game via API, then join the socket room
        joinGameRoom(roomCode).then(() => {
            // Join the socket room after successful API join
            socket.emit('join-room', roomCode);
        }).catch((error) => {
            console.error('Failed to join game via API:', error);
        });
    });
    
    socket.on('game-state', (game) => {
        console.log('Received game state:', game);
        currentGame = game;
        updateGameDisplay();
    });
    
    socket.on('player-joined', (data) => {
        console.log('Player joined:', data);
        if (currentGame) {
            currentGame.players = data.players;
            updateGameDisplay();
        }
    });
    
    socket.on('player-reconnected', (data) => {
        console.log('Player reconnected:', data);
        if (currentGame) {
            currentGame.players = data.players;
            updateGameDisplay();
        }
    });
    
    socket.on('player-left', (data) => {
        console.log('Player left:', data);
        if (currentGame) {
            currentGame.players = data.players;
            updateGameDisplay();
        }
    });
    
    // Real-time updates removed - keeping it simple

    // Handle final character confirmation
    console.log('🔧 Setting up character-finalized event handler...');
    socket.on('character-finalized', (data) => {
        console.log('📨 RECEIVED character-finalized event:', data);
        const { playerId, character } = data;

        // Update local game state
        if (currentGame && currentGame.characters) {
            currentGame.characters[playerId] = {
                character: character,
                assignedBy: 'unknown',
                assignedAt: new Date()
            };
            console.log('✅ Updated local character data');

            // Simple rebuild - no edit preservation, no complex logic
            updatePlayersList();
        }
    });
    
    socket.on('game-started', (data) => {
        console.log('Game started:', data);
        if (currentGame) {
            currentGame.state = 'started';
            updateGameDisplay();
        }
    });
    
    socket.on('character-revealed', (data) => {
        console.log('Character revealed:', data);
        if (currentGame) {
            currentGame.revealedPlayers = data.revealedPlayers;
            updateGameDisplay();
        }
    });
    
    socket.on('game-restarted', (data) => {
        console.log('Game restarted! Returning to setup phase.');
        if (currentGame) {
            currentGame.state = 'waiting';
            currentGame.revealedPlayers = data.revealedPlayers || [];
            currentGame.characters = data.characters || {}; // Clear all character assignments
            updateGameDisplay();
            
            // Show a success message
            showNotification((typeof i18n !== 'undefined' && i18n) ? i18n.getText('gameRestarted') : '🔄 Game restarted! Character assignments cleared.', 'success');
        }
    });

    // Handle reveal notification
    socket.on('player-revealed-notification', (data) => {
        console.log('Player revealed notification:', data);

        // Show notification to all players
        const playerName = data.playerName;
        const character = data.character;

        let message;
        if (typeof i18n !== 'undefined' && i18n) {
            message = i18n.getText('playerRevealedNotification', { playerName, character });
        } else {
            message = `🎭 ${playerName} revealed their character: "${character}"`;
        }

        showNotification(message, 'warning');
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
        alert(error);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
}

async function joinGameRoom(roomCode) {
    try {
        console.log('Attempting to join game:', roomCode, 'with player:', currentPlayer);
        
        const requestBody = {
            gameId: roomCode,
            playerName: currentPlayer.name,
            avatar: currentPlayer.avatar
        };

        // Only include playerId if it exists (for reconnection)
        if (currentPlayer.id) {
            requestBody.playerId = currentPlayer.id;
        }
        console.log('Sending request body:', requestBody);
        
        const response = await fetch('/api/join-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('Error response body:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Join game result:', result);
        
        if (result.success) {
            console.log('Successfully joined game');
            currentGame = result.game;
            // Update currentPlayer with the server-assigned player data
            currentPlayer = result.player;
            
            // Save updated player data (with ID) to session storage
            const playerData = {
                name: currentPlayer.name,
                avatar: currentPlayer.avatar,
                roomCode: currentGame.id,
                id: currentPlayer.id
            };
            sessionStorage.setItem('playerData', JSON.stringify(playerData));
            
            updateGameDisplay();
        } else {
            console.error('Join game failed:', result.error);
            alert(result.error || 'Failed to join game');
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Error joining game:', error);
        alert(`Connection error: ${error.message}. Please try again.`);
        window.location.href = '/';
    }
}

function updateGameDisplay() {
    if (!currentGame) return;
    
    // Update player count
    const playerCountEl = document.getElementById('playerCount');
    if (playerCountEl) playerCountEl.textContent = currentGame.players.length;
    
    // Show/hide elements based on game state
    const shareCard = document.querySelector('.game-card.mb-3'); // Target the share room card specifically
    const roomCodeBadge = document.querySelector('.badge.bg-light');
    const assignmentInstructions = document.getElementById('assignmentInstructions');
    const gameState = currentGame.state || 'waiting';
    
    if (gameState === 'started') {
        // Hide room sharing functionality and assignment instructions when game has started
        if (shareCard) shareCard.style.display = 'none';
        if (roomCodeBadge) roomCodeBadge.style.display = 'none';
        if (assignmentInstructions) assignmentInstructions.style.display = 'none';
        
        // Update status and buttons (both desktop and mobile)
        const gameStatus = document.getElementById('gameStatus');
        const gameStatusMobile = document.getElementById('gameStatusMobile');
        const startButton = document.getElementById('startGame');
        const startButtonMobile = document.getElementById('startGameMobile');
        const restartButton = document.getElementById('restartGame');
        const restartButtonMobile = document.getElementById('restartGameMobile');
        
        const statusText = (typeof i18n !== 'undefined' && i18n) ? i18n.getText('gameInProgress') : 'Game in progress - Click your mystery sticker to reveal!';
        if (gameStatus) gameStatus.textContent = statusText;
        if (gameStatusMobile) gameStatusMobile.textContent = statusText;
        
        if (startButton) startButton.style.display = 'none';
        if (startButtonMobile) startButtonMobile.style.display = 'none';
        if (restartButton) restartButton.style.display = 'inline-block';
        if (restartButtonMobile) restartButtonMobile.style.display = 'inline-block';
    } else {
        // Show room sharing functionality and assignment instructions when waiting
        if (shareCard) shareCard.style.display = 'block';
        if (roomCodeBadge) roomCodeBadge.style.display = 'inline-block';
        if (assignmentInstructions) assignmentInstructions.style.display = 'block';
        
        // Update game status and buttons (both desktop and mobile)
        const statusEl = document.getElementById('gameStatus');
        const statusElMobile = document.getElementById('gameStatusMobile');
        const startButton = document.getElementById('startGame');
        const startButtonMobile = document.getElementById('startGameMobile');
        const restartButton = document.getElementById('restartGame');
        const restartButtonMobile = document.getElementById('restartGameMobile');
        
        // Check if all players have characters assigned
        const allPlayersHaveCharacters = currentGame.players.length >= 2 && 
            currentGame.players.every(player => {
                const characterData = currentGame.characters && currentGame.characters[player.id];
                return characterData && characterData.character && characterData.character.trim() !== '';
            });
        
        let statusText;
        if (currentGame.players.length < 2) {
            statusText = (typeof i18n !== 'undefined' && i18n) ? i18n.getText('needPlayers') : 'Need at least 2 players to start';
        } else if (!allPlayersHaveCharacters) {
            statusText = (typeof i18n !== 'undefined' && i18n) ? i18n.getText('assignCharacters') : 'Assign characters to all players before starting!';
        } else {
            statusText = (typeof i18n !== 'undefined' && i18n) ? i18n.getText('readyToPlay') : 'Ready to play!';
        }
        
        if (statusEl) statusEl.textContent = statusText;
        if (statusElMobile) statusElMobile.textContent = statusText;
        
        if (startButton) {
            startButton.disabled = !allPlayersHaveCharacters;
            startButton.style.display = 'inline-block';
        }
        if (startButtonMobile) {
            startButtonMobile.disabled = !allPlayersHaveCharacters;
            startButtonMobile.style.display = 'inline-block';
        }
        
        if (restartButton) restartButton.style.display = 'none';
        if (restartButtonMobile) restartButtonMobile.style.display = 'none';
    }
    
    // Update players list
    updatePlayersList();
}

function updatePlayersList() {
    console.log('🎨 Simple updatePlayersList called');
    const playerListEl = document.getElementById('playerList');

    if (!currentGame || !currentGame.players) {
        playerListEl.innerHTML = '<p class="text-muted">No players yet</p>';
        return;
    }

    // CRITICAL: Check for active editing - prevent rebuilds that lose user input
    const activeInputs = playerListEl.querySelectorAll('.character-input');
    if (activeInputs.length > 0) {
        console.log('🚫 Skipping rebuild - user is actively editing');
        return;
    }

    // Simple approach: complete rebuild only when safe
    playerListEl.innerHTML = '';

    // Simple player rendering
    currentGame.players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.dataset.playerId = player.id;

        const characterData = currentGame.characters && currentGame.characters[player.id];
        const isCurrentPlayer = player.id === currentPlayer.id;
        const isRevealed = currentGame.revealedPlayers && currentGame.revealedPlayers.includes(player.id);
        const gameState = currentGame.state || 'waiting';

        // Add visual classes
        if (isCurrentPlayer) playerCard.classList.add('cannot-assign');
        if (isRevealed) playerCard.classList.add('bg-warning', 'bg-opacity-25');

        // Basic player info
        playerCard.innerHTML = `
            <div class="player-avatar">${player.avatar}</div>
            <div class="player-name">${player.name}</div>
            ${isCurrentPlayer ? '<small class="text-primary">You</small>' : ''}
        `;

        // Add character sticker, mystery sticker, or add button
        if (characterData && isCurrentPlayer && !isRevealed) {
            // Current player with character - show mystery sticker
            const mysterySticker = document.createElement('div');
            mysterySticker.className = 'character-sticker mystery-character';
            mysterySticker.textContent = '❓';
            if (gameState === 'started') {
                mysterySticker.title = 'Your character - click to reveal!';
                mysterySticker.style.cursor = 'pointer';
                mysterySticker.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showRevealModal();
                });
            } else {
                mysterySticker.title = 'Your character is hidden from you!';
            }
            playerCard.appendChild(mysterySticker);

        } else if (characterData && isRevealed) {
            // Revealed character - show actual character
            const revealedSticker = document.createElement('div');
            const stickerColor = getStickerColor(player.id);
            revealedSticker.className = `character-sticker color-${stickerColor} revealed`;
            revealedSticker.textContent = characterData.character;
            revealedSticker.title = isCurrentPlayer ? 'Your revealed character' : 'Character revealed by player';
            playerCard.appendChild(revealedSticker);

        } else if (characterData && !isCurrentPlayer) {
            // Other player with character - show editable sticker
            const characterSticker = document.createElement('div');
            const stickerColor = getStickerColor(player.id);
            characterSticker.className = `character-sticker color-${stickerColor}`;
            characterSticker.dataset.playerId = player.id;
            characterSticker.textContent = characterData.character;
            characterSticker.title = gameState === 'started' ?
                `Character: ${characterData.character} (read-only during game)` :
                `Character: ${characterData.character} (click to edit)`;

            if (gameState === 'waiting') {
                characterSticker.style.cursor = 'pointer';
                characterSticker.addEventListener('click', (e) => {
                    e.stopPropagation();
                    editCharacter(player.id, characterData.character, characterSticker);
                });
            }
            playerCard.appendChild(characterSticker);

        } else if (!isCurrentPlayer) {
            // No character for other player - show add button
            const addButton = document.createElement('div');
            addButton.className = 'add-character-btn';
            addButton.innerHTML = '+';
            addButton.title = 'Assign character';
            addButton.addEventListener('click', (e) => {
                e.stopPropagation();
                addCharacter(player.id, addButton);
            });
            playerCard.appendChild(addButton);

        } else {
            // Current player with no character - show placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'character-placeholder';
            placeholder.innerHTML = '❓';
            placeholder.title = 'Someone needs to assign you a character!';
            playerCard.appendChild(placeholder);
        }

        playerListEl.appendChild(playerCard);
    });
}

// Function to add a new character - now uses streaming like editCharacter
function addCharacter(playerId, buttonElement) {
    console.log(`🎯 addCharacter called for player ${playerId} (using streaming)`);

    // Replace the + button with an input field
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.className = 'character-input';
    inputElement.maxLength = 30;

    // Create a wrapper that looks like a sticker with player's color
    const stickerWrapper = document.createElement('div');
    const stickerColor = getStickerColor(playerId);
    stickerWrapper.className = `character-sticker color-${stickerColor} editing`;
    stickerWrapper.appendChild(inputElement);

    // Replace the button with the input
    buttonElement.parentNode.replaceChild(stickerWrapper, buttonElement);

    // Focus and select the input
    inputElement.focus();

    // Initial character stream when edit starts
    console.log(`🔔 SENDING initial character-stream for new character (player ${playerId})`);
    socket.emit('character-stream', {
        gameId: currentGame.id,
        playerId: playerId,
        character: inputElement.value.trim()
    });

    // No real-time streaming - Keep it simple

    // Prevent double execution
    let saveInProgress = false;
    let savedViaEnter = false;

    // Handle saving
    const saveCharacter = (triggeredBy = 'unknown') => {
        if (saveInProgress) {
            console.log(`🚫 saveCharacter blocked - already in progress`);
            return;
        }

        // If saved via Enter, ignore subsequent blur events
        if (triggeredBy === 'blur' && savedViaEnter) {
            console.log(`🚫 saveCharacter blocked - already saved via Enter`);
            return;
        }

        saveInProgress = true;
        if (triggeredBy === 'enter') {
            savedViaEnter = true;
        }

        // Immediately disable the input to prevent further submissions
        inputElement.disabled = true;
        inputElement.style.pointerEvents = 'none';

        const character = inputElement.value.trim();
        console.log(`🔧 saveCharacter called: playerId=${playerId}, newCharacter="${character}", triggeredBy=${triggeredBy}`);

        // Send final character assignment
        const assignData = {
            gameId: currentGame.id,
            playerId: playerId,
            character: character,
            assignedBy: currentPlayer.id
        };
        console.log(`🔧 Sending assign-character:`, assignData);
        socket.emit('assign-character', assignData);

        if (character) {
            // Character saved - clean up edit state
            stickerWrapper.classList.remove('editing');
            stickerWrapper.innerHTML = '';
            stickerWrapper.textContent = character;
            console.log(`✅ New character finalized and edit cleaned up`);
        } else {
            // Cancel - restore the + button
            const newAddButton = document.createElement('div');
            newAddButton.className = 'add-character-btn';
            newAddButton.innerHTML = '+';
            newAddButton.title = 'Assign character';
            newAddButton.addEventListener('click', (e) => {
                e.stopPropagation();
                addCharacter(playerId, newAddButton);
            });

            stickerWrapper.parentNode.replaceChild(newAddButton, stickerWrapper);
            console.log(`❌ Character creation cancelled - restored + button`);
        }
    };
    
    // Save only on Enter - no blur event to avoid double firing
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            saveCharacter('enter');
        }
    });
    
    // Cancel on Escape
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            inputElement.value = '';
            inputElement.blur();
        }
    });
}

// Function to edit an existing character
function editCharacter(playerId, currentCharacter, stickerElement, editState = null) {
    console.log(`🎯 editCharacter called for player ${playerId} with character "${currentCharacter}"`);

    // Create input field
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.className = 'character-input';
    inputElement.value = editState ? editState.value : currentCharacter;
    inputElement.maxLength = 30;

    // Replace the text content with input
    const originalText = stickerElement.textContent;
    const originalClasses = stickerElement.className;
    stickerElement.textContent = '';
    stickerElement.appendChild(inputElement);
    stickerElement.classList.add('editing');

    // Track when this edit started (for smart preservation)
    stickerElement.dataset.editStartTime = Date.now().toString();

    // Mobile-specific: delay focus to avoid virtual keyboard issues
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const focusInput = () => {
        inputElement.focus();
        if (editState) {
            // Restore cursor position and preserve original timestamp
            inputElement.setSelectionRange(editState.cursorPosition, editState.cursorPosition);
            if (editState.editStartTime) {
                stickerElement.dataset.editStartTime = editState.editStartTime;
            }
        } else {
            // Select all text for new edits
            inputElement.select();
        }
    };

    if (isMobile) {
        // On mobile, delay focus slightly to avoid keyboard interference
        setTimeout(focusInput, 100);
    } else {
        focusInput();
    }

    // Initial character stream when edit starts
    console.log(`🔔 SENDING initial character-stream for player ${playerId}`);
    socket.emit('character-stream', {
        gameId: currentGame.id,
        playerId: playerId,
        character: inputElement.value.trim()
    });

    // No real-time streaming - Keep it simple

    // Prevent double execution
    let saveInProgress = false;
    let savedViaEnter = false;

    // Handle saving
    const saveCharacter = (triggeredBy = 'unknown') => {
        if (saveInProgress) {
            console.log(`🚫 saveCharacter blocked - already in progress`);
            return;
        }

        // If saved via Enter, ignore subsequent blur events
        if (triggeredBy === 'blur' && savedViaEnter) {
            console.log(`🚫 saveCharacter blocked - already saved via Enter`);
            return;
        }

        saveInProgress = true;
        if (triggeredBy === 'enter') {
            savedViaEnter = true;
        }

        // Immediately disable the input to prevent further submissions
        inputElement.disabled = true;
        inputElement.style.pointerEvents = 'none';

        const character = inputElement.value.trim();
        console.log(`🔧 saveCharacter called: playerId=${playerId}, newCharacter="${character}", triggeredBy=${triggeredBy}`);

        // Send final character assignment
        const assignData = {
            gameId: currentGame.id,
            playerId: playerId,
            character: character,
            assignedBy: currentPlayer.id
        };
        console.log(`🔧 Sending assign-character:`, assignData);
        socket.emit('assign-character', assignData);

        // Clean up edit state
        stickerElement.classList.remove('editing');
        stickerElement.innerHTML = '';
        if (character) {
            stickerElement.textContent = character;
        } else {
            stickerElement.textContent = '+';
        }

        console.log(`✅ Character finalized and edit cleaned up`);
    };
    
    // Save only on Enter - no blur event to avoid double firing
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            saveCharacter('enter');
        }
    });
    
    // Mobile-specific: No blur handler, Enter key only to avoid double submissions

    // Cancel on Escape
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            // Cancel editing - restore original character or hide input
            inputElement.value = '';
            saveCharacter('escape');
        }
    });
}

// Update only a specific character sticker (no DOM rebuild)
function setupEventListeners() {
    // Copy link button
    document.getElementById('copyLink').addEventListener('click', () => {
        const shareLink = document.getElementById('shareLink');
        shareLink.select();
        document.execCommand('copy');
        
        const btn = document.getElementById('copyLink');
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
    
    // Start game button (desktop)
    document.getElementById('startGame').addEventListener('click', () => {
        if (!currentGame || !currentPlayer) return;
        
        socket.emit('start-game', {
            gameId: currentGame.id,
            playerId: currentPlayer.id
        });
    });
    
    // Start game button (mobile)
    document.getElementById('startGameMobile').addEventListener('click', () => {
        if (!currentGame || !currentPlayer) return;
        
        socket.emit('start-game', {
            gameId: currentGame.id,
            playerId: currentPlayer.id
        });
    });
    
    // Initialize reveal modal
    revealModal = new bootstrap.Modal(document.getElementById('revealModal'));
    
    // Confirm reveal button in modal
    document.getElementById('confirmReveal').addEventListener('click', () => {
        if (!currentGame || !currentPlayer) return;
        
        socket.emit('reveal-character', {
            gameId: currentGame.id,
            playerId: currentPlayer.id
        });
        
        revealModal.hide();
    });
    
    // Initialize restart modal first
    const restartModalElement = document.getElementById('restartModal');
    if (restartModalElement) {
        restartModal = new bootstrap.Modal(restartModalElement);
    }
    
    // Restart game button (desktop)
    const restartButton = document.getElementById('restartGame');
    if (restartButton) {
        restartButton.addEventListener('click', () => {
            console.log('Restart game button clicked');
            if (restartModal) {
                console.log('Showing restart modal');
                restartModal.show();
            } else {
                console.error('Restart modal not initialized');
            }
        });
    }
    
    // Restart game button (mobile)
    const restartButtonMobile = document.getElementById('restartGameMobile');
    if (restartButtonMobile) {
        restartButtonMobile.addEventListener('click', () => {
            console.log('Restart game button clicked (mobile)');
            if (restartModal) {
                console.log('Showing restart modal');
                restartModal.show();
            } else {
                console.error('Restart modal not initialized');
            }
        });
    }
    
    // Confirm restart button in modal
    const confirmRestartButton = document.getElementById('confirmRestart');
    if (confirmRestartButton) {
        confirmRestartButton.addEventListener('click', () => {
            console.log('Confirm restart clicked');
            console.log('Current game:', currentGame);
            console.log('Current player:', currentPlayer);
            
            if (!currentGame || !currentPlayer) {
                console.error('Missing game or player data');
                return;
            }
            
            socket.emit('restart-game', {
                gameId: currentGame.id,
                playerId: currentPlayer.id
            });
            
            restartModal.hide();
        });
    }
}

// Function to show the reveal modal
function showRevealModal() {
    if (revealModal) {
        revealModal.show();
    }
}

// Function to show notification messages
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 4000);
}