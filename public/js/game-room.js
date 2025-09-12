// Who am I? Game Room - Frontend JavaScript

let socket;
let currentGame = null;
let currentPlayer = null;
let selectedPlayerForAssignment = null;

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
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
}

async function joinGameRoom(roomCode) {
    try {
        const response = await fetch('/api/join-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameId: roomCode,
                playerName: currentPlayer.name,
                avatar: currentPlayer.avatar
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Successfully joined game');
            currentGame = result.game;
            // Update currentPlayer with the server-assigned player data
            currentPlayer = result.player;
            updateGameDisplay();
        } else {
            alert(result.error || 'Failed to join game');
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Error joining game:', error);
        alert('Connection error. Please try again.');
        window.location.href = '/';
    }
}

function updateGameDisplay() {
    if (!currentGame) return;
    
    // Update player count
    document.getElementById('playerCount').textContent = currentGame.players.length;
    
    // Update game status
    const statusEl = document.getElementById('gameStatus');
    if (currentGame.players.length < 2) {
        statusEl.textContent = 'Need at least 2 players to start';
        document.getElementById('startGame').disabled = true;
    } else {
        statusEl.textContent = 'Ready to play!';
        document.getElementById('startGame').disabled = false;
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
            // Current player has a character but can't see it - show mystery sticker
            const mysterySticker = document.createElement('div');
            mysterySticker.className = 'character-sticker mystery-character';
            mysterySticker.textContent = '❓';
            mysterySticker.title = 'Your character is hidden from you!';
            mysterySticker.style.cursor = 'default';
            
            playerCard.appendChild(mysterySticker);
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
    
    
    // Start game button (placeholder for now)
    document.getElementById('startGame').addEventListener('click', () => {
        alert('Game starting feature coming soon!');
    });
}