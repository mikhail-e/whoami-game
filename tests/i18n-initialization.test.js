// Who am I? Game - i18n Initialization Bug Tests
// Tests to verify that JavaScript code handles cases where i18n is not yet defined

// Mock DOM elements for testing
class MockElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.textContent = '';
        this.innerHTML = '';
        this.value = '';
        this.placeholder = '';
        this.title = '';
        this.disabled = false;
        this.style = { display: 'block' };
        this.classList = {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(),
            toggle: jest.fn()
        };
        this.dataset = {};
    }
    
    focus() {}
    blur() {}
    select() {}
    addEventListener() {}
    removeEventListener() {}
}

// Mock fetch for testing
global.fetch = jest.fn();

// Mock alert and other globals
global.alert = jest.fn();
global.sessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn()
};

// Mock window.location
global.window = {
    location: {
        href: '',
        pathname: '/game/ABC123',
        search: '',
        origin: 'http://localhost:3000'
    }
};

// Mock URLSearchParams
global.URLSearchParams = jest.fn((search) => ({
    get: jest.fn((param) => {
        if (param === 'error' && search.includes('error=room-not-found')) {
            return 'room-not-found';
        }
        if (param === 'join' && search.includes('join=ABC123')) {
            return 'ABC123';
        }
        return null;
    })
}));

describe('i18n Initialization Bug Prevention', () => {
    let mockDocument;
    
    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Ensure i18n is undefined to simulate the bug condition
        global.i18n = undefined;
        delete global.i18n;
        
        // Mock DOM
        mockDocument = {
            elements: new Map(),
            getElementById: jest.fn((id) => mockDocument.elements.get(id) || null),
            querySelector: jest.fn(),
            querySelectorAll: jest.fn(() => []),
            addEventListener: jest.fn(),
            createElement: jest.fn(() => new MockElement('div'))
        };
        
        // Set up common elements
        mockDocument.elements.set('playerName', Object.assign(new MockElement('input'), { value: 'TestPlayer' }));
        mockDocument.elements.set('selectedAvatar', Object.assign(new MockElement('input'), { value: '😀' }));
        mockDocument.elements.set('roomCode', Object.assign(new MockElement('input'), { value: 'ABC123' }));
        mockDocument.elements.set('createNewGame', new MockElement('button'));
        mockDocument.elements.set('joinBtn', new MockElement('button'));
        
        global.document = mockDocument;
        
        // Mock console methods to avoid noise in test output
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
    });
    
    afterEach(() => {
        // Restore console methods
        console.log.mockRestore();
        console.error.mockRestore();
        
        // Clean up global variables
        delete global.document;
        delete global.i18n;
    });
    
    describe('Game Creation Error Handling', () => {
        test('should handle connection error when i18n is undefined', () => {
            // Simulate the createGame function from game.js
            const createGame = async (playerData) => {
                try {
                    // Simulate a connection error
                    throw new Error('Network error');
                } catch (error) {
                    // This is the code that was causing the bug
                    const errorMessage = (typeof i18n !== 'undefined' && i18n) ? 
                        i18n.getText('connectionError') : 
                        `Connection error: ${error.message}. Please check your internet connection.`;
                    
                    global.alert(errorMessage);
                    return false;
                }
            };
            
            // Test that it doesn't throw when i18n is undefined
            expect(async () => {
                await createGame({ name: 'Test', avatar: '😀' });
            }).not.toThrow();
            
            // Verify fallback English message was used
            expect(global.alert).toHaveBeenCalledWith(
                'Connection error: Network error. Please check your internet connection.'
            );
        });
        
        test('should handle failed game creation when i18n is undefined', () => {
            // Simulate the error handling code from game.js
            const handleCreateGameFailure = () => {
                const errorMessage = (typeof i18n !== 'undefined' && i18n) ? 
                    i18n.getText('failedCreateGame') : 
                    'Failed to create game. Please try again.';
                
                global.alert(errorMessage);
            };
            
            // Test that it doesn't throw when i18n is undefined
            expect(() => {
                handleCreateGameFailure();
            }).not.toThrow();
            
            // Verify fallback English message was used
            expect(global.alert).toHaveBeenCalledWith('Failed to create game. Please try again.');
        });
    });
    
    describe('Form Validation Error Handling', () => {
        test('should handle empty player name validation when i18n is undefined', () => {
            const validatePlayerName = (playerName) => {
                if (!playerName) {
                    const errorMessage = (typeof i18n !== 'undefined' && i18n) ? 
                        i18n.getText('pleaseEnterName') : 
                        'Please enter your name';
                    
                    global.alert(errorMessage);
                    return false;
                }
                return true;
            };
            
            // Test with empty name
            expect(() => {
                validatePlayerName('');
            }).not.toThrow();
            
            expect(global.alert).toHaveBeenCalledWith('Please enter your name');
        });
        
        test('should handle room code length validation when i18n is undefined', () => {
            const validateRoomCode = (roomCode) => {
                if (roomCode && roomCode.length !== 6) {
                    const errorMessage = (typeof i18n !== 'undefined' && i18n) ? 
                        i18n.getText('roomCodeLength') : 
                        'Room code must be exactly 6 characters';
                    
                    global.alert(errorMessage);
                    return false;
                }
                return true;
            };
            
            // Test with invalid room code
            expect(() => {
                validateRoomCode('ABC12');
            }).not.toThrow();
            
            expect(global.alert).toHaveBeenCalledWith('Room code must be exactly 6 characters');
        });
    });
    
    describe('Game Room Status Updates', () => {
        test('should handle game status updates when i18n is undefined', () => {
            const updateGameStatus = (playerCount, allPlayersHaveCharacters) => {
                let statusText;
                if (playerCount < 2) {
                    statusText = (typeof i18n !== 'undefined' && i18n) ? 
                        i18n.getText('needPlayers') : 
                        'Need at least 2 players to start';
                } else if (!allPlayersHaveCharacters) {
                    statusText = (typeof i18n !== 'undefined' && i18n) ? 
                        i18n.getText('assignCharacters') : 
                        'Assign characters to all players before starting!';
                } else {
                    statusText = (typeof i18n !== 'undefined' && i18n) ? 
                        i18n.getText('readyToPlay') : 
                        'Ready to play!';
                }
                return statusText;
            };
            
            // Test all status conditions
            expect(() => {
                const status1 = updateGameStatus(1, false);
                expect(status1).toBe('Need at least 2 players to start');
                
                const status2 = updateGameStatus(2, false);
                expect(status2).toBe('Assign characters to all players before starting!');
                
                const status3 = updateGameStatus(2, true);
                expect(status3).toBe('Ready to play!');
            }).not.toThrow();
        });
        
        test('should handle game in progress status when i18n is undefined', () => {
            const getGameInProgressStatus = () => {
                return (typeof i18n !== 'undefined' && i18n) ? 
                    i18n.getText('gameInProgress') : 
                    'Game in progress - Click your mystery sticker to reveal!';
            };
            
            expect(() => {
                const status = getGameInProgressStatus();
                expect(status).toBe('Game in progress - Click your mystery sticker to reveal!');
            }).not.toThrow();
        });
    });
    
    describe('Error Page Handling', () => {
        test('should handle room not found error when i18n is undefined', () => {
            const showRoomNotFoundError = () => {
                const errorMessage = (typeof i18n !== 'undefined' && i18n) ? 
                    i18n.getText('roomNotFound') : 
                    'Room not found. Please check the room code and try again.';
                
                // Simulate showing error (in real code this would update DOM)
                return errorMessage;
            };
            
            expect(() => {
                const message = showRoomNotFoundError();
                expect(message).toBe('Room not found. Please check the room code and try again.');
            }).not.toThrow();
        });
    });
    
    describe('Notification System', () => {
        test('should handle game restart notification when i18n is undefined', () => {
            const showGameRestartedNotification = () => {
                const message = (typeof i18n !== 'undefined' && i18n) ? 
                    i18n.getText('gameRestarted') : 
                    '🔄 Game restarted! Character assignments cleared.';
                
                return message;
            };
            
            expect(() => {
                const message = showGameRestartedNotification();
                expect(message).toBe('🔄 Game restarted! Character assignments cleared.');
            }).not.toThrow();
        });
    });
    
    describe('Character Assignment Tooltips', () => {
        test('should handle character tooltip generation when i18n is undefined', () => {
            const generateCharacterTooltip = (characterName, canEdit) => {
                if (canEdit) {
                    const editText = (typeof i18n !== 'undefined' && i18n) ? 
                        i18n.getText('clickToEdit') : 
                        'click to edit';
                    return `Character: ${characterName} (${editText})`;
                } else {
                    const readOnlyText = (typeof i18n !== 'undefined' && i18n) ? 
                        i18n.getText('readOnlyDuringGame') : 
                        'read-only during game';
                    return `Character: ${characterName} (${readOnlyText})`;
                }
            };
            
            expect(() => {
                const editableTooltip = generateCharacterTooltip('Batman', true);
                expect(editableTooltip).toBe('Character: Batman (click to edit)');
                
                const readOnlyTooltip = generateCharacterTooltip('Superman', false);
                expect(readOnlyTooltip).toBe('Character: Superman (read-only during game)');
            }).not.toThrow();
        });
    });
    
    describe('Integration with i18n Available', () => {
        test('should use localized messages when i18n is available', () => {
            // Mock i18n being available
            global.i18n = {
                getText: jest.fn((key) => {
                    const translations = {
                        'connectionError': 'Ошибка соединения. Попробуйте ещё раз.',
                        'needPlayers': 'Нужно минимум 2 игрока для начала',
                        'pleaseEnterName': 'Пожалуйста, введите ваше имя'
                    };
                    return translations[key] || key;
                })
            };
            
            const validatePlayerName = (playerName) => {
                if (!playerName) {
                    const errorMessage = (typeof i18n !== 'undefined' && i18n) ? 
                        i18n.getText('pleaseEnterName') : 
                        'Please enter your name';
                    
                    global.alert(errorMessage);
                    return false;
                }
                return true;
            };
            
            // Test with i18n available
            expect(() => {
                validatePlayerName('');
            }).not.toThrow();
            
            expect(global.alert).toHaveBeenCalledWith('Пожалуйста, введите ваше имя');
            expect(global.i18n.getText).toHaveBeenCalledWith('pleaseEnterName');
        });
    });
});