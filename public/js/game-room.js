// Who am I? Game Room - Frontend JavaScript
// Names from utils.js (loaded before this file; see the note at the top of utils.js)
/* global debugLog, MAX_CHARACTER_LENGTH, isCustomAvatar, getText, serverErrorText, showNotification, AppStorage, handleApiError, PLAYER_ID */

let socket;
let currentGame = null;
let currentPlayer = null;
let revealModal = null;
let restartModal = null;
let leaveModal = null;
let leaveFallbackTimer = null;
let leavingGame = false;

// Sticker colors are chosen by the server (stickerColors in game-logic.js):
// a player arrives with player.stickerColor, rendered as the color-<name> class

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
    AppStorage.set(storageKey, gameState);
    debugLog('💾 Game state saved to localStorage:', storageKey);
}

function loadGameStateFromStorage(roomCode) {
    const storageKey = `whoami-game-${roomCode}`;
    const gameState = AppStorage.get(storageKey);

    if (!gameState) {
        debugLog('📭 No saved game state found for room:', roomCode);
        return null;
    }

    try {
        debugLog('📂 Loaded game state from localStorage:', gameState);
        return gameState;
    } catch (error) {
        console.error('❌ Error parsing saved game state:', error);
        return null;
    }
}

function clearGameStateFromStorage(roomCode) {
    const storageKey = `whoami-game-${roomCode}`;
    AppStorage.remove(storageKey);
    debugLog('🗑️ Cleared game state from localStorage:', storageKey);
}

// Clean up local state and return to the landing page after leaving.
// Idempotent: both the server confirmation and the fallback timer call it.
// When the room still exists, the landing page opens with the room code
// prefilled (?join=CODE) so the player can rejoin if they change their mind.
function finishLeavingGame(roomStillExists = true) {
    if (leavingGame) return;
    leavingGame = true;

    if (leaveFallbackTimer) {
        clearTimeout(leaveFallbackTimer);
        leaveFallbackTimer = null;
    }

    const roomCode = currentGame ? currentGame.id : null;
    if (roomCode) clearGameStateFromStorage(roomCode);
    AppStorage.session.remove('playerData');

    window.location.href = (roomStillExists && roomCode) ? `/?join=${roomCode}` : '/';
}

async function recreateRoomFromStorage(roomCode, savedGameState) {
    try {
        debugLog('🔧 Recreating room with saved state...');

        // First, create a new game with the same room code
        const createResponse = await fetch('/api/recreate-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomCode: roomCode,
                gameState: savedGameState
            })
        });

        // A refusal comes with status 400 and the reason in its body: read the
        // body first, so the player gets the server's reason, not the status
        const createResult = await createResponse.json().catch(() => ({}));

        if (createResponse.ok && createResult.success) {
            debugLog('✅ Room recreated successfully, now joining...');

            // Now join the recreated game (with flag to prevent recursion)
            await joinGameRoom(roomCode, true);
        } else {
            throw new Error(createResult.error || `Failed to recreate room: ${createResponse.status}`);
        }

    } catch (error) {
        console.error('❌ Error recreating room:', error);
        alert(`${getText('failedRecoverGame', 'Failed to recover game')}: ${serverErrorText(error.message)}. ${getText('pleaseCreateNewRoom', 'Please create a new room.')}`);
        window.location.href = '/';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Get room code from URL. Codes are upper case; a link typed or passed on
    // in lower case still opens the room (the server reads it the same way)
    const urlPath = window.location.pathname;
    const roomCode = urlPath.split('/').pop().toUpperCase();
    
    if (!roomCode || roomCode.length !== 6) {
        alert(getText('invalidRoomCode', 'Invalid room code'));
        window.location.href = '/';
        return;
    }

    // Get player data from session storage
    const playerData = AppStorage.session.get('playerData');
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

    debugLog('Using global player ID:', PLAYER_ID);
    
    // Initialize the game room
    initializeGameRoom(roomCode);
    
    // Initialize Socket.IO
    initializeSocket(roomCode);
    
    // Set up event listeners
    setupEventListeners();

    // Re-render dynamic text (game status, player cards) when the language changes
    document.addEventListener('languagechanged', () => {
        if (currentGame) updateGameDisplay();
    });
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
        debugLog('Connected to server');
        debugLog('🔧 About to set up all Socket.IO event handlers...');

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
        debugLog('Received game state:', game);
        currentGame = game;
        updateGameDisplay();
    });
    
    socket.on('player-joined', (data) => {
        debugLog('Player joined:', data);
        if (currentGame) {
            currentGame.players = data.players;
            // A returning leaver comes back with their character restored -
            // take the characters/reveals the server sent along
            if (data.characters) currentGame.characters = data.characters;
            if (data.revealedPlayers) currentGame.revealedPlayers = data.revealedPlayers;
            saveGameStateToStorage();
            updateGameDisplay();
        }
    });

    socket.on('player-reconnected', (data) => {
        debugLog('Player reconnected:', data);
        if (currentGame) {
            currentGame.players = data.players;
            if (data.characters) currentGame.characters = data.characters;
            if (data.revealedPlayers) currentGame.revealedPlayers = data.revealedPlayers;
            updateGameDisplay();
        }
    });
    
    socket.on('player-disconnected', (data) => {
        debugLog('Player disconnected:', data);
        if (currentGame && data && data.playerId) {
            const player = currentGame.players.find(p => p.id === data.playerId);
            if (player) {
                player.isConnected = false;
            }
        }
    });

    socket.on('player-left', (data) => {
        debugLog('Player left:', data);
        if (!currentGame || !data) return;

        if (data.playerId === currentPlayer.id) {
            // The server confirmed OUR leave - go home. If the room was
            // deleted (we were the last player), there is nothing to rejoin,
            // so skip the ?join=CODE prefill
            finishLeavingGame(!data.gameDeleted);
            return;
        }

        // Another player left: take the server's authoritative state
        currentGame.players = data.players;
        if (data.characters) currentGame.characters = data.characters;
        if (data.revealedPlayers) currentGame.revealedPlayers = data.revealedPlayers;

        // An open character input would block the rebuild below - and it might
        // even belong to the player who just left
        cancelActiveEdits();
        saveGameStateToStorage();
        updateGameDisplay();

        showNotification(
            getText('playerLeftNotification', `👋 ${data.playerName} left the game`, { playerName: data.playerName }),
            'info'
        );
    });
    
    // Real-time updates removed - keeping it simple

    // Handle final character confirmation
    debugLog('🔧 Setting up character-finalized event handler...');
    socket.on('character-finalized', (data) => {
        debugLog('📨 RECEIVED character-finalized event:', data);
        const { playerId, allCharacters } = data;

        // Update local game state with complete character data
        if (currentGame && allCharacters) {
            currentGame.characters = allCharacters;
            debugLog('✅ Updated all character data from server');

            // Save updated game state to localStorage
            saveGameStateToStorage();

            // SURGICAL FIX: Clean up only the specific input for this finalized character
            // This prevents the safety check from blocking updates for other players
            const playerListEl = document.getElementById('playerList');
            const specificPlayerCard = playerListEl.querySelector(`[data-player-id="${playerId}"]`);
            if (specificPlayerCard) {
                const specificInput = specificPlayerCard.querySelector('.character-input');
                if (specificInput) {
                    debugLog(`🧹 Cleaning up input for finalized character (playerId: ${playerId})`);
                    const stickerWrapper = specificInput.closest('.character-sticker');
                    if (stickerWrapper) {
                        stickerWrapper.remove();
                    }
                }
            }

            // Full display update: rebuilds the players list (safely) and
            // refreshes the status text and Start Game button state
            updateGameDisplay();
        }
    });
    
    socket.on('game-started', (data) => {
        debugLog('Game started:', data);
        if (currentGame) {
            currentGame.state = 'started';
            // Close any character input that is still open - editing is no
            // longer allowed and an open input would block UI updates
            cancelActiveEdits();
            saveGameStateToStorage();
            updateGameDisplay();
        }
    });
    
    socket.on('character-revealed', (data) => {
        debugLog('Character revealed:', data);
        if (currentGame) {
            currentGame.revealedPlayers = data.revealedPlayers;
            saveGameStateToStorage();
            updateGameDisplay();
        }
    });
    
    socket.on('game-restarted', (data) => {
        debugLog('Game restarted! Returning to setup phase.');
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
        debugLog('Player revealed notification:', data);

        // Show notification to all players
        const playerName = data.playerName;
        const character = data.character;

        const message = getText('playerRevealedNotification', `🎭 ${playerName} revealed their character: "${character}"!`, { playerName, character });

        showNotification(message, 'warning');
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
        // Clean up any stuck editing inputs so the UI can keep updating,
        // then rebuild the players list from the last known state
        cancelActiveEdits();
        updatePlayersList();
        alert(serverErrorText(error));
    });
    
    socket.on('disconnect', () => {
        debugLog('Disconnected from server');
    });
}

async function joinGameRoom(roomCode, skipRecreation = false) {
    try {
        debugLog('Attempting to join game:', roomCode, 'with player:', currentPlayer);
        
        const requestBody = {
            gameId: roomCode,
            playerName: currentPlayer.name,
            avatar: currentPlayer.avatar
        };

        // Ensure we always have a player ID
        if (!currentPlayer.id) {
            debugLog('⚠️ Player ID missing, using shared ID...');
            currentPlayer.id = PLAYER_ID;
        }
        requestBody.playerId = currentPlayer.id;
        debugLog('Sending request body:', requestBody);
        
        const response = await fetch('/api/join-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        debugLog('Response status:', response.status);

        const result = await response.json();
        debugLog('Join game result:', result);
        
        if (result.success) {
            debugLog('Successfully joined game');
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
            AppStorage.session.set('playerData', playerData);

            // Save game state to localStorage for recovery
            saveGameStateToStorage();

            updateGameDisplay();
        } else {
            console.error('Join game failed:', result.error);

            // Check if it's a "Game not found" error and try to recreate the room (only on first attempt)
            if (result.error === 'Game not found' && !skipRecreation) {
                debugLog('🔄 Game not found - attempting room recreation...');

                // Validate room code format before recreation attempt
                if (!roomCode || roomCode.length !== 6 || !/^[A-Z0-9]{6}$/.test(roomCode)) {
                    debugLog('❌ Invalid room code format, cannot recreate');
                    alert(getText('invalidRoomCodeFormat', 'Invalid room code format'));
                    window.location.href = '/';
                    return;
                }

                const savedGameState = loadGameStateFromStorage(roomCode);

                if (savedGameState && savedGameState.playerId === currentPlayer.id) {
                    debugLog('🎯 Found matching saved game state, recreating room...');
                    await recreateRoomFromStorage(roomCode, savedGameState);
                    return;
                }
            }

            alert(serverErrorText(result.error) || getText('failedJoinGame', 'Failed to join game'));
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
    const roomTicket = document.querySelector('.room-ticket'); // the room code in the header
    const assignmentInstructions = document.getElementById('assignmentInstructions');
    const gameState = currentGame.state || 'waiting';
    
    if (gameState === 'started') {
        // Hide room sharing functionality and assignment instructions when game has started
        if (shareCard) shareCard.style.display = 'none';
        if (roomTicket) roomTicket.style.display = 'none';
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
        if (roomTicket) roomTicket.style.display = ''; // back to the stylesheet's inline-flex
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

// Characters can be up to MAX_CHARACTER_LENGTH long. Show long ones in a
// smaller font so the sticker does not tower over the player card.
const LONG_CHARACTER_THRESHOLD = 40;

function setStickerText(stickerElement, character) {
    stickerElement.textContent = character;
    stickerElement.classList.toggle('long-text', [...character].length > LONG_CHARACTER_THRESHOLD);
}

// Remove any character inputs that are still open. Needed when the game
// starts or an error occurs while someone is editing - otherwise the open
// input would block updatePlayersList() from ever rebuilding the UI.
function cancelActiveEdits() {
    const playerListEl = document.getElementById('playerList');
    if (!playerListEl) return;

    playerListEl.querySelectorAll('.character-input').forEach(input => {
        const sticker = input.closest('.character-sticker');
        if (sticker) {
            sticker.remove();
        } else {
            input.remove();
        }
    });
}

function updatePlayersList() {
    debugLog('🎨 Simple updatePlayersList called');
    const playerListEl = document.getElementById('playerList');

    if (!currentGame || !currentGame.players) {
        playerListEl.innerHTML = `<p class="text-muted">${getText('noPlayersYet', 'No players yet')}</p>`;
        return;
    }

    // CRITICAL: Check for active editing - prevent rebuilds that lose user input
    const activeInputs = playerListEl.querySelectorAll('.character-input');
    if (activeInputs.length > 0) {
        debugLog('🚫 Skipping rebuild - user is actively editing');
        debugLog('🔍 Active inputs found:', activeInputs.length, 'inputs detected');
        activeInputs.forEach((input, index) => {
            const playerId = input.closest('[data-player-id]')?.dataset.playerId;
            debugLog(`   Input ${index + 1}: playerId=${playerId}, value="${input.value}"`);
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

        // Basic player info - built with textContent so player-controlled
        // values (name, avatar) can never inject HTML (XSS protection)
        const avatarEl = document.createElement('div');
        avatarEl.className = 'player-avatar';
        if (isCustomAvatar(player.avatar)) {
            // Validated data:image/... URL assigned as a property - never innerHTML
            const img = document.createElement('img');
            img.alt = '';
            img.src = player.avatar;
            avatarEl.appendChild(img);
        } else {
            avatarEl.textContent = player.avatar;
        }
        playerCard.appendChild(avatarEl);

        const nameEl = document.createElement('div');
        nameEl.className = 'player-name';
        nameEl.textContent = player.name;
        if (isCurrentPlayer) {
            const youText = getText('you', 'You');
            nameEl.appendChild(document.createTextNode(' ('));
            const youEl = document.createElement('strong');
            youEl.textContent = youText;
            nameEl.appendChild(youEl);
            nameEl.appendChild(document.createTextNode(')'));
        }
        playerCard.appendChild(nameEl);

        // Add character sticker, mystery sticker, or add button
        if (characterData && isCurrentPlayer && !isRevealed) {
            // Current player with character - show mystery sticker
            const mysterySticker = document.createElement('div');
            mysterySticker.className = 'character-sticker mystery';
            mysterySticker.textContent = '🎭';
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
            setStickerText(revealedSticker, characterData.character);
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
            setStickerText(characterSticker, characterData.character);
            characterSticker.title = gameState === 'started' ?
                getText('characterReadOnly', `Character: ${characterData.character} (read-only during game)`, { character: characterData.character }) :
                getText('characterClickToEdit', `Character: ${characterData.character} (click to edit)`, { character: characterData.character });

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
    debugLog(`🎯 addCharacter called for player ${playerId} (using streaming)`);

    // Replace the + button with an input field
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.className = 'character-input';
    inputElement.maxLength = MAX_CHARACTER_LENGTH;

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

    // Prevent double execution
    let saveInProgress = false;
    let savedViaEnter = false;

    // Handle saving
    const saveCharacter = (triggeredBy = 'unknown') => {
        if (saveInProgress) {
            debugLog(`🚫 saveCharacter blocked - already in progress`);
            return;
        }

        // If saved via Enter, ignore subsequent blur events
        if (triggeredBy === 'blur' && savedViaEnter) {
            debugLog(`🚫 saveCharacter blocked - already saved via Enter`);
            return;
        }

        // Characters are locked once the game has started (e.g. a blur event
        // can fire after another player pressed Start Game)
        if (currentGame && currentGame.state !== 'waiting') {
            debugLog(`🚫 saveCharacter blocked - game already started`);
            return;
        }

        saveInProgress = true;
        if (triggeredBy === 'enter') {
            savedViaEnter = true;
        }

        const character = inputElement.value.trim();
        debugLog(`🔧 saveCharacter called: playerId=${playerId}, newCharacter="${character}", triggeredBy=${triggeredBy}`);

        // Send final character assignment
        const assignData = {
            gameId: currentGame.id,
            playerId: playerId,
            character: character,
            assignedBy: currentPlayer.id
        };
        debugLog(`🔧 Sending assign-character:`, assignData);
        socket.emit('assign-character', assignData);

        // Input will be cleaned up when server confirms via character-finalized event

        // Don't update UI immediately - wait for server confirmation via character-finalized event
        // This ensures all players see the update at the same time and prevents desync issues
        debugLog(`⏳ Waiting for server confirmation before updating UI`);

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
    debugLog(`🎯 editCharacter called for player ${playerId} with character "${currentCharacter}"`);

    // Create input field
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.className = 'character-input';
    inputElement.value = editState ? editState.value : currentCharacter;
    inputElement.maxLength = MAX_CHARACTER_LENGTH;

    // Replace the text content with input
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

    // Prevent double execution
    let saveInProgress = false;
    let savedViaEnter = false;

    // Handle saving
    const saveCharacter = (triggeredBy = 'unknown') => {
        if (saveInProgress) {
            debugLog(`🚫 saveCharacter blocked - already in progress`);
            return;
        }

        // If saved via Enter, ignore subsequent blur events
        if (triggeredBy === 'blur' && savedViaEnter) {
            debugLog(`🚫 saveCharacter blocked - already saved via Enter`);
            return;
        }

        // Characters are locked once the game has started (e.g. a blur event
        // can fire after another player pressed Start Game)
        if (currentGame && currentGame.state !== 'waiting') {
            debugLog(`🚫 saveCharacter blocked - game already started`);
            return;
        }

        saveInProgress = true;
        if (triggeredBy === 'enter') {
            savedViaEnter = true;
        }

        const character = inputElement.value.trim();
        debugLog(`🔧 saveCharacter called: playerId=${playerId}, newCharacter="${character}", triggeredBy=${triggeredBy}`);

        // Send final character assignment
        const assignData = {
            gameId: currentGame.id,
            playerId: playerId,
            character: character,
            assignedBy: currentPlayer.id
        };
        debugLog(`🔧 Sending assign-character:`, assignData);
        socket.emit('assign-character', assignData);

        // Input will be cleaned up when server confirms via character-finalized event

        // Don't update UI immediately - wait for server confirmation via character-finalized event
        // This ensures all players see the update at the same time and prevents desync issues
        debugLog(`⏳ Waiting for server confirmation before updating UI`);
    };
    
    // Handle keyboard events (Enter and Escape)
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            saveCharacter('enter');
        } else if (e.key === 'Escape') {
            e.preventDefault();
            // Cancel editing - restore the original character (do NOT clear it)
            inputElement.value = currentCharacter;
            saveCharacter('escape');
        }
    });

    // Save on blur (focus loss) for better UX
    inputElement.addEventListener('blur', () => {
        saveCharacter('blur');
    });
}

// Copy the room link and flash "Copied!" on the button that was pressed
function copyRoomLink(button) {
    const shareLink = document.getElementById('shareLink');
    shareLink.select();
    document.execCommand('copy');

    const originalText = button.textContent;
    button.textContent = getText('copiedSuccess', '✅ Copied!');
    setTimeout(() => {
        button.textContent = originalText;
    }, 2000);
}

// Update only a specific character sticker (no DOM rebuild)
function setupEventListeners() {
    // Copy link button
    document.getElementById('copyLink').addEventListener('click', () => {
        copyRoomLink(document.getElementById('copyLink'));
    });

    // Share button - open the native share sheet, or copy the link as a fallback
    document.getElementById('shareButton').addEventListener('click', async () => {
        const shareBtn = document.getElementById('shareButton');
        const url = document.getElementById('shareLink').value;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: getText('title', '🎭 Who am I?'),
                    text: getText('shareText', 'Join my "Who am I?" game!'),
                    url: url
                });
            } catch (error) {
                // AbortError = the user closed the share sheet - not a failure
                if (error.name !== 'AbortError') {
                    copyRoomLink(shareBtn);
                }
            }
        } else {
            copyRoomLink(shareBtn);
        }
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
        debugLog('Refresh button clicked');
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
            debugLog('Restart game button clicked');
            if (restartModal) {
                debugLog('Showing restart modal');
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
            debugLog('Confirm restart clicked');
            debugLog('Current game:', currentGame);
            debugLog('Current player:', currentPlayer);
            
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

    // Initialize leave modal
    const leaveModalElement = document.getElementById('leaveModal');
    if (leaveModalElement) {
        leaveModal = new bootstrap.Modal(leaveModalElement);
    }

    // Leave game button
    const leaveButton = document.getElementById('leaveGame');
    if (leaveButton) {
        leaveButton.addEventListener('click', () => {
            if (leaveModal) leaveModal.show();
        });
    }

    // Confirm leave button in modal
    const confirmLeaveButton = document.getElementById('confirmLeave');
    if (confirmLeaveButton) {
        confirmLeaveButton.addEventListener('click', () => {
            if (!currentGame || !currentPlayer) return;

            socket.emit('leave-game', {
                gameId: currentGame.id,
                playerId: currentPlayer.id
            });
            leaveModal.hide();

            // Fallback: if the server confirmation never arrives, leave anyway
            leaveFallbackTimer = setTimeout(finishLeavingGame, 2000);
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
