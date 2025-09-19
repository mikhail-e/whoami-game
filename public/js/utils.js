// Shared Utilities - Common patterns used across the game

// Helper function for safe i18n text retrieval with fallback
function getText(key, fallback, placeholders = {}) {
    if (typeof i18n !== 'undefined' && i18n) {
        return i18n.getText(key, placeholders);
    }
    return fallback;
}

// Show error message with Bootstrap alert
function showError(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.game-card'));
}

// Show info message with Bootstrap alert
function showInfo(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-info alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.game-card'));
}

// Show notification (used in game room)
function showNotification(message, type = 'info', duration = 4000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'info'} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 1055; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(notification);

    // Auto-dismiss after duration
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, duration);
}

// Storage helpers
const Storage = {
    // Get item with JSON parsing and error handling
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Failed to parse localStorage item "${key}":`, error);
            return defaultValue;
        }
    },

    // Set item with JSON stringification
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Failed to save to localStorage "${key}":`, error);
            return false;
        }
    },

    // Remove item
    remove(key) {
        localStorage.removeItem(key);
    },

    // Session storage helpers
    session: {
        get(key, defaultValue = null) {
            try {
                const item = sessionStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.warn(`Failed to parse sessionStorage item "${key}":`, error);
                return defaultValue;
            }
        },

        set(key, value) {
            try {
                sessionStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error(`Failed to save to sessionStorage "${key}":`, error);
                return false;
            }
        },

        remove(key) {
            sessionStorage.removeItem(key);
        }
    }
};

// Common error handling
function handleApiError(error, context = '') {
    console.error(`API Error ${context}:`, error);
    const message = getText('connectionError', `Connection error: ${error.message}. Please check your internet connection.`);
    alert(message);
}

// Common success patterns
function redirectToGameRoom(gameId) {
    window.location.href = `/game/${gameId}`;
}

// Button state helpers
function setButtonLoading(button, loadingText) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
}

function resetButtonState(button) {
    button.disabled = false;
    if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
    }
}

// Room code validation
function isValidRoomCode(code) {
    return code && /^[A-Z0-9]{6}$/.test(code.trim());
}

// Player ID System - Shared unique player ID generation
function generatePlayerId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Get or create unique player ID for this browser (ONE per browser)
function getUniquePlayerId() {
    let playerId = localStorage.getItem('playerId');
    if (!playerId) {
        playerId = generatePlayerId();
        localStorage.setItem('playerId', playerId);
        console.log(`🆔 Generated new unique player ID:`, playerId);
    } else {
        console.log(`🆔 Using existing player ID:`, playerId);
    }
    return playerId;
}

// Initialize player ID immediately when this script loads
const PLAYER_ID = getUniquePlayerId();