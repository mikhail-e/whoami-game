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
    
    socket.on('character-assigned', (data) => {
        console.log('Character assigned:', data);
        if (currentGame) {
            // Update local game state
            currentGame.characters = data.characters;
            updateGameDisplay();
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
            showNotification('🔄 Game restarted! Character assignments cleared.', 'success');
        }
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
            avatar: currentPlayer.avatar,
            playerId: currentPlayer.id // Include ID if available
        };
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
    const shareCard = document.querySelector('.game-card');
    const gameState = currentGame.state || 'waiting';
    
    if (gameState === 'started') {
        // Hide join functionality when game has started
        if (shareCard) shareCard.style.display = 'none';
        
        // Update status and buttons
        const gameStatus = document.getElementById('gameStatus');
        const startButton = document.getElementById('startGame');
        const restartButton = document.getElementById('restartGame');
        
        if (gameStatus) gameStatus.textContent = 'Game in progress - Click your mystery sticker to reveal!';
        if (startButton) startButton.style.display = 'none';
        if (restartButton) restartButton.style.display = 'inline-block';
    } else {
        // Show join functionality when waiting
        if (shareCard) shareCard.style.display = 'block';
        
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
        
        if (statusEl) {
            if (currentGame.players.length < 2) {
                statusEl.textContent = 'Need at least 2 players to start';
            } else if (!allPlayersHaveCharacters) {
                statusEl.textContent = 'Assign characters to all players before starting!';
            } else {
                statusEl.textContent = 'Ready to play!';
            }
        }
        
        if (startButton) {
            startButton.disabled = !allPlayersHaveCharacters;
            startButton.style.display = 'inline-block';
        }
        
        if (restartButton) {
            restartButton.style.display = 'none';
        }
    }
    
    // Update players list
    updatePlayersList();
}

function updatePlayersList() {
    const playerListEl = document.getElementById('playerList');
    
    if (!currentGame || !currentGame.players) {
        playerListEl.innerHTML = '<p class="text-muted">No players yet</p>';
        return;
    }
    
    playerListEl.innerHTML = '';
    
    currentGame.players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.dataset.playerId = player.id;
        
        // Check if this player has a character assigned
        const characterData = currentGame.characters && currentGame.characters[player.id];
        const isCurrentPlayer = player.id === currentPlayer.id;
        
        // Add class for players you cannot assign characters to (yourself)
        if (isCurrentPlayer) {
            playerCard.classList.add('cannot-assign');
        }
        
        // Basic player info
        playerCard.innerHTML = `
            <div class="player-avatar">${player.avatar}</div>
            <div class="player-name">${player.name}</div>
            ${isCurrentPlayer ? '<small class="text-primary">You</small>' : ''}
        `;
        
        // Add character sticker or add button
        if (characterData && !isCurrentPlayer) {
            // Character exists and it's NOT the current player - show sticker
            const characterSticker = document.createElement('div');
            const stickerColor = getStickerColor(player.id);
            characterSticker.className = `character-sticker color-${stickerColor}`;
            characterSticker.dataset.playerId = player.id;
            characterSticker.textContent = characterData.character;
            characterSticker.title = `Character: ${characterData.character} (click to edit)`;
            
            // Only allow editing if you assigned this character
            if (characterData.assignedBy === currentPlayer.id) {
                characterSticker.addEventListener('click', (e) => {
                    e.stopPropagation();
                    editCharacter(player.id, characterData.character, characterSticker);
                });
            } else {
                characterSticker.style.cursor = 'default';
                characterSticker.title = `Character: ${characterData.character} (assigned by another player)`;
            }
            
            playerCard.appendChild(characterSticker);
        } else if (characterData && isCurrentPlayer) {
            // Current player has a character
            const gameState = currentGame.state || 'waiting';
            const isRevealed = currentGame.revealedPlayers && currentGame.revealedPlayers.includes(player.id);
            
            if (isRevealed) {
                // Character is revealed - show the actual character
                const revealedSticker = document.createElement('div');
                const stickerColor = getStickerColor(player.id);
                revealedSticker.className = `character-sticker color-${stickerColor} revealed`;
                revealedSticker.textContent = characterData.character;
                revealedSticker.title = 'Your revealed character';
                revealedSticker.style.cursor = 'default';
                
                playerCard.appendChild(revealedSticker);
            } else {
                // Character is hidden - show mystery sticker
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
                    mysterySticker.style.cursor = 'default';
                }
                
                playerCard.appendChild(mysterySticker);
            }
        } else if (!isCurrentPlayer) {
            // No character and not current player - show add button
            const addButton = document.createElement('div');
            addButton.className = 'add-character-btn';
            addButton.innerHTML = '+';
            addButton.title = 'Assign character';
            addButton.addEventListener('click', (e) => {
                e.stopPropagation();
                addCharacter(player.id, addButton);
            });
            
            playerCard.appendChild(addButton);
        }
        
        playerListEl.appendChild(playerCard);
    });
}

// Function to add a new character
function addCharacter(playerId, buttonElement) {
    // Replace the + button with an input field
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.className = 'character-input';
    inputElement.placeholder = 'Character name...';
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
    
    // Handle saving
    const saveCharacter = () => {
        const character = inputElement.value.trim();
        if (character) {
            // Send to server
            socket.emit('assign-character', {
                gameId: currentGame.id,
                playerId: playerId,
                character: character,
                assignedBy: currentPlayer.id
            });
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
        }
    };
    
    // Save on Enter or blur
    inputElement.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveCharacter();
        }
    });
    
    inputElement.addEventListener('blur', saveCharacter);
    
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
function editCharacter(playerId, currentCharacter, stickerElement) {
    // Create input field
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.className = 'character-input';
    inputElement.value = currentCharacter;
    inputElement.maxLength = 30;
    
    // Replace the text content with input
    const originalText = stickerElement.textContent;
    const originalClasses = stickerElement.className;
    stickerElement.textContent = '';
    stickerElement.appendChild(inputElement);
    stickerElement.classList.add('editing');
    
    // Focus and select all text
    inputElement.focus();
    inputElement.select();
    
    // Handle saving
    const saveCharacter = () => {
        const character = inputElement.value.trim();
        if (character && character !== currentCharacter) {
            // Send updated character to server
            socket.emit('assign-character', {
                gameId: currentGame.id,
                playerId: playerId,
                character: character,
                assignedBy: currentPlayer.id
            });
        } else {
            // No change - restore original
            stickerElement.textContent = originalText;
            stickerElement.className = originalClasses;
        }
    };
    
    // Save on Enter or blur
    inputElement.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveCharacter();
        }
    });
    
    inputElement.addEventListener('blur', saveCharacter);
    
    // Cancel on Escape
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            stickerElement.textContent = originalText;
            stickerElement.className = originalClasses;
        }
    });
}

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
    
    // Start game button
    document.getElementById('startGame').addEventListener('click', () => {
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
    
    // Restart game button
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