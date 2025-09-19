// Who am I? Game Room - Frontend JavaScript


let socket;
let currentGame = null;
let currentPlayer = null;
let selectedPlayerForAssignment = null;
let revealModal = null;
let restartModal = null;

// Color palette for character stickers
const stickerColors = ['red', 'blue', 'purple', 'orange', 'green', 'pink', 'indigo'];

// Removed getStickerColor function - using player.stickerColor directly

// LocalStorage persistence for game state backup and recovery
function saveGameStateToStorage() {
    if (!currentGame || !currentPlayer) return;

    const gameState = {
        roomCode: currentGame.id,
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        playerAvatar: currentPlayer.avatar,
        gameState: currentGame.state,
        players: currentGame.players,
        characters: currentGame.characters,
        revealedPlayers: currentGame.revealedPlayers,
        lastSaved: new Date().toISOString()
    };

    const storageKey = `whoami-game-${currentGame.id}`;
    Storage.set(storageKey, gameState);
    console.log('💾 Game state saved to localStorage:', storageKey);
}

function loadGameStateFromStorage(roomCode) {
    const storageKey = `whoami-game-${roomCode}`;
    const gameState = Storage.get(storageKey);

    if (!gameState) {
        console.log('📭 No saved game state found for room:', roomCode);
        return null;
    }

    try {
        console.log('📂 Loaded game state from localStorage:', gameState);
        return gameState;
    } catch (error) {
        console.error('❌ Error parsing saved game state:', error);
        return null;
    }
}

function clearGameStateFromStorage(roomCode) {
    const storageKey = `whoami-game-${roomCode}`;
    Storage.remove(storageKey);
    console.log('🗑️ Cleared game state from localStorage:', storageKey);
}

async function recreateRoomFromStorage(roomCode, savedGameState) {
    try {
        console.log('🔧 Recreating room with saved state...');

        // First, create a new game with the same room code
        const createResponse = await fetch('/api/recreate-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomCode: roomCode,
                gameState: savedGameState
            })
        });

        if (!createResponse.ok) {
            throw new Error(`Failed to recreate room: ${createResponse.status}`);
        }

        const createResult = await createResponse.json();

        if (createResult.success) {
            console.log('✅ Room recreated successfully, now joining...');

            // Now join the recreated game (with flag to prevent recursion)
            await joinGameRoom(roomCode, true);
        } else {
            throw new Error(createResult.error || 'Failed to recreate room');
        }

    } catch (error) {
        console.error('❌ Error recreating room:', error);
        alert(`${getText('failedRecoverGame', 'Failed to recover game')}: ${error.message}. ${getText('pleaseCreateNewRoom', 'Please create a new room.')}`);
        window.location.href = '/';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Get room code from URL
    const urlPath = window.location.pathname;
    const roomCode = urlPath.split('/').pop();
    
    if (!roomCode || roomCode.length !== 6) {
        alert(getText('invalidRoomCode', 'Invalid room code'));
        window.location.href = '/';
        return;
    }

    // Get player data from session storage
    const playerData = Storage.session.get('playerData');
    if (!playerData) {
        // If no player data, redirect to landing page with room code pre-filled
        window.location.href = `/?join=${roomCode}`;
        return;
    }

    // Always use the global player ID - ignore any ID from sessionStorage
    currentPlayer = {
        id: PLAYER_ID,
        name: playerData.name,
        avatar: playerData.avatar,
        roomCode: playerData.roomCode
    };

    console.log('Using global player ID:', PLAYER_ID);
    
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
            // Join the socket room after successful API join with player ID
            socket.emit('join-room', {
                gameId: roomCode,
                playerId: currentPlayer.id
            });
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
        const { playerId, character, allCharacters } = data;

        // Update local game state with complete character data
        if (currentGame && allCharacters) {
            currentGame.characters = allCharacters;
            console.log('✅ Updated all character data from server');

            // Save updated game state to localStorage
            saveGameStateToStorage();

            // SURGICAL FIX: Clean up only the specific input for this finalized character
            // This prevents the safety check from blocking updates for other players
            const playerListEl = document.getElementById('playerList');
            const specificPlayerCard = playerListEl.querySelector(`[data-player-id="${playerId}"]`);
            if (specificPlayerCard) {
                const specificInput = specificPlayerCard.querySelector('.character-input');
                if (specificInput) {
                    console.log(`🧹 Cleaning up input for finalized character (playerId: ${playerId})`);
                    const stickerWrapper = specificInput.closest('.character-sticker');
                    if (stickerWrapper) {
                        stickerWrapper.remove();
                    }
                }
            }

            // Update player list (safely)
            updatePlayersList();

            // Update Start Game button state after character assignment
            if (currentGame.state === 'waiting') {
                const allPlayersHaveCharacters = currentGame.players.length >= 2 &&
                    currentGame.players.every(player => {
                        const characterData = currentGame.characters && currentGame.characters[player.id];
                        return characterData && characterData.character && characterData.character.trim() !== '';
                    });

                const startButton = document.getElementById('startGame');
                if (startButton) startButton.disabled = !allPlayersHaveCharacters;
            }
        }
    });
    
    socket.on('game-started', (data) => {
        console.log('Game started:', data);
        if (currentGame) {
            currentGame.state = 'started';
            saveGameStateToStorage();
            updateGameDisplay();
        }
    });
    
    socket.on('character-revealed', (data) => {
        console.log('Character revealed:', data);
        if (currentGame) {
            currentGame.revealedPlayers = data.revealedPlayers;
            saveGameStateToStorage();
            updateGameDisplay();
        }
    });
    
    socket.on('game-restarted', (data) => {
        console.log('Game restarted! Returning to setup phase.');
        if (currentGame) {
            currentGame.state = 'waiting';
            currentGame.revealedPlayers = data.revealedPlayers || [];
            currentGame.characters = data.characters || {}; // Clear all character assignments
            saveGameStateToStorage();
            updateGameDisplay();

            // Show a success message
            showNotification(getText('gameRestarted', '⏮️ Game restarted! Character assignments cleared.'), 'success');
        }
    });

    // Handle reveal notification
    socket.on('player-revealed-notification', (data) => {
        console.log('Player revealed notification:', data);

        // Show notification to all players
        const playerName = data.playerName;
        const character = data.character;

        const message = getText('playerRevealedNotification', `🎭 ${playerName} revealed their character: "${character}"!`, { playerName, character });

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

async function joinGameRoom(roomCode, skipRecreation = false) {
    try {
        console.log('Attempting to join game:', roomCode, 'with player:', currentPlayer);
        
        const requestBody = {
            gameId: roomCode,
            playerName: currentPlayer.name,
            avatar: currentPlayer.avatar
        };

        // Ensure we always have a player ID
        if (!currentPlayer.id) {
            console.log('⚠️ Player ID missing, using shared ID...');
            currentPlayer.id = PLAYER_ID;
        }
        requestBody.playerId = currentPlayer.id;
        console.log('Sending request body:', requestBody);
        
        const response = await fetch('/api/join-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Response status:', response.status);

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
            Storage.session.set('playerData', playerData);

            // Save game state to localStorage for recovery
            saveGameStateToStorage();

            updateGameDisplay();
        } else {
            console.error('Join game failed:', result.error);

            // Check if it's a "Game not found" error and try to recreate the room (only on first attempt)
            if (result.error === 'Game not found' && !skipRecreation) {
                console.log('🔄 Game not found - attempting room recreation...');

                // Validate room code format before recreation attempt
                if (!roomCode || roomCode.length !== 6 || !/^[A-Z0-9]{6}$/.test(roomCode)) {
                    console.log('❌ Invalid room code format, cannot recreate');
                    alert(getText('invalidRoomCodeFormat', 'Invalid room code format'));
                    window.location.href = '/';
                    return;
                }

                const savedGameState = loadGameStateFromStorage(roomCode);

                if (savedGameState && savedGameState.playerId === currentPlayer.id) {
                    console.log('🎯 Found matching saved game state, recreating room...');
                    await recreateRoomFromStorage(roomCode, savedGameState);
                    return;
                }
            }

            alert(result.error || getText('failedJoinGame', 'Failed to join game'));
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Error joining game:', error);
        handleApiError(error, 'joining game room');
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
        
        // Update status and buttons
        const gameStatus = document.getElementById('gameStatus');
        const startButton = document.getElementById('startGame');
        const restartButton = document.getElementById('restartGame');

        const statusText = getText('gameInProgress', 'Game in progress - Click your mystery sticker to reveal!');
        if (gameStatus) gameStatus.textContent = statusText;
        
        if (startButton) startButton.style.display = 'none';
        if (restartButton) restartButton.style.display = 'inline-block';
    } else {
        // Show room sharing functionality and assignment instructions when waiting
        if (shareCard) shareCard.style.display = 'block';
        if (roomCodeBadge) roomCodeBadge.style.display = 'inline-block';
        if (assignmentInstructions) assignmentInstructions.style.display = 'block';
        
        // Update game status and buttons
        const statusEl = document.getElementById('gameStatus');
        const startButton = document.getElementById('startGame');
        const restartButton = document.getElementById('restartGame');
        
        // Check if all players have characters assigned
        const allPlayersHaveCharacters = currentGame.players.length >= 2 && 
            currentGame.players.every(player => {
                const characterData = currentGame.characters && currentGame.characters[player.id];
                return characterData && characterData.character && characterData.character.trim() !== '';
            });
        
        let statusText;
        if (currentGame.players.length < 2) {
            statusText = getText('needPlayers', 'Need at least 2 players to start');
        } else if (!allPlayersHaveCharacters) {
            statusText = getText('assignCharacters', 'Assign characters to all players before starting!');
        } else {
            statusText = getText('readyToPlay', 'Ready to play!');
        }
        
        if (statusEl) statusEl.textContent = statusText;

        if (startButton) {
            startButton.disabled = !allPlayersHaveCharacters;
            startButton.style.display = 'inline-block';
        }
        
        if (restartButton) restartButton.style.display = 'none';
    }
    
    // Update players list
    updatePlayersList();
}

function updatePlayersList() {
    console.log('🎨 Simple updatePlayersList called');
    const playerListEl = document.getElementById('playerList');

    if (!currentGame || !currentGame.players) {
        playerListEl.innerHTML = `<p class="text-muted">${getText('noPlayersYet', 'No players yet')}</p>`;
        return;
    }

    // CRITICAL: Check for active editing - prevent rebuilds that lose user input
    const activeInputs = playerListEl.querySelectorAll('.character-input');
    if (activeInputs.length > 0) {
        console.log('🚫 Skipping rebuild - user is actively editing');
        console.log('🔍 Active inputs found:', activeInputs.length, 'inputs detected');
        activeInputs.forEach((input, index) => {
            const playerId = input.closest('[data-player-id]')?.dataset.playerId;
            console.log(`   Input ${index + 1}: playerId=${playerId}, value="${input.value}"`);
        });
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
        const youText = getText('you', 'You');
        playerCard.innerHTML = `
            <div class="player-avatar">${player.avatar}</div>
            <div class="player-name">${player.name}${isCurrentPlayer ? ` (<strong>${youText}</strong>)` : ''}</div>
        `;

        // Add character sticker, mystery sticker, or add button
        if (characterData && isCurrentPlayer && !isRevealed) {
            // Current player with character - show mystery sticker
            const mysterySticker = document.createElement('div');
            const stickerColor = player.stickerColor || 'red';
            mysterySticker.className = `character-sticker color-${stickerColor}`;
            mysterySticker.textContent = '❓';
            if (gameState === 'started') {
                mysterySticker.title = getText('yourCharacterClickReveal', 'Your character - click to reveal!');
                mysterySticker.style.cursor = 'pointer';
                mysterySticker.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showRevealModal();
                });
            } else {
                mysterySticker.title = getText('yourCharacterHidden', 'Your character is hidden from you!');
            }
            playerCard.appendChild(mysterySticker);

        } else if (characterData && isRevealed) {
            // Revealed character - show actual character
            const revealedSticker = document.createElement('div');
            const stickerColor = player.stickerColor || 'red';
            revealedSticker.className = `character-sticker color-${stickerColor} revealed`;
            revealedSticker.textContent = characterData.character;
            revealedSticker.title = isCurrentPlayer ?
                getText('yourRevealedCharacter', 'Your revealed character') :
                getText('characterRevealedByPlayer', 'Character revealed by player');
            playerCard.appendChild(revealedSticker);

        } else if (characterData && !isCurrentPlayer) {
            // Other player with character - show editable sticker
            const characterSticker = document.createElement('div');
            const stickerColor = player.stickerColor || 'red';
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
            addButton.title = getText('assignCharacter', 'Assign character');
            addButton.addEventListener('click', (e) => {
                e.stopPropagation();
                addCharacter(player.id, addButton);
            });
            playerCard.appendChild(addButton);

        }
        // Current player with no character - show nothing (clean look)

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
    const player = currentGame.players.find(p => p.id === playerId);
    const stickerColor = player?.stickerColor || 'red';
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

        // Input will be cleaned up when server confirms via character-finalized event

        // Don't update UI immediately - wait for server confirmation via character-finalized event
        // This ensures all players see the update at the same time and prevents desync issues
        console.log(`⏳ Waiting for server confirmation before updating UI`);

        // Note: Empty characters are now handled by the backend
        // The server will remove the character and trigger a 'character-finalized' event
        // which will update the UI appropriately (show + button for removed characters)
    };
    
    // Save on Enter
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            saveCharacter('enter');
        }
    });

    // Save on blur (focus loss) for better UX
    inputElement.addEventListener('blur', () => {
        saveCharacter('blur');
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

    // Mobile browsers require immediate focus response to user gesture

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

    // Focus immediately on all platforms - delays break mobile gesture chain
    focusInput();

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

        // Input will be cleaned up when server confirms via character-finalized event

        // Don't update UI immediately - wait for server confirmation via character-finalized event
        // This ensures all players see the update at the same time and prevents desync issues
        console.log(`⏳ Waiting for server confirmation before updating UI`);
    };
    
    // Handle keyboard events (Enter and Escape)
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            saveCharacter('enter');
        } else if (e.key === 'Escape') {
            e.preventDefault();
            // Cancel editing - restore original character or hide input
            inputElement.value = '';
            saveCharacter('escape');
        }
    });

    // Save on blur (focus loss) for better UX
    inputElement.addEventListener('blur', () => {
        saveCharacter('blur');
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
        btn.textContent = getText('copiedSuccess', '✅ Copied!');
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

    // Refresh page button
    document.getElementById('refreshPage').addEventListener('click', () => {
        console.log('Refresh button clicked');
        window.location.reload();
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
