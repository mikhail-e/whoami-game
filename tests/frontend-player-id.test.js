// Tests for frontend player ID generation system

// Directly implement the functions from utils.js for testing
function generatePlayerId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// The server accepts a player ID only in UUID format and silently generates
// a fresh one otherwise - a stored ID in any other format would create a NEW
// player on every page load (duplicate players)
const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getUniquePlayerId(mockLocalStorage) {
    let playerId = mockLocalStorage.getItem('playerId');
    if (!playerId || !PLAYER_ID_PATTERN.test(playerId)) {
        playerId = generatePlayerId();
        mockLocalStorage.setItem('playerId', playerId);
        console.log(`🆔 Generated new unique player ID:`, playerId);
    } else {
        console.log(`🆔 Using existing player ID:`, playerId);
    }
    return playerId;
}

describe('Frontend Player ID Generation', () => {
    let mockLocalStorage;
    let originalConsoleLog;

    beforeEach(() => {
        // Mock localStorage
        mockLocalStorage = {
            store: {},
            getItem: jest.fn((key) => mockLocalStorage.store[key] || null),
            setItem: jest.fn((key, value) => {
                mockLocalStorage.store[key] = value.toString();
            }),
            removeItem: jest.fn((key) => {
                delete mockLocalStorage.store[key];
            }),
            clear: jest.fn(() => {
                mockLocalStorage.store = {};
            })
        };

        // Mock console.log
        originalConsoleLog = console.log;
        console.log = jest.fn();
    });

    afterEach(() => {
        // Restore console.log
        console.log = originalConsoleLog;

        // Clear localStorage mock
        mockLocalStorage.clear();
        jest.clearAllMocks();
    });

    describe('generatePlayerId()', () => {

        test('generates valid UUID v4 format', () => {
            const playerId = generatePlayerId();

            // Check UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(playerId).toMatch(uuidRegex);
            expect(typeof playerId).toBe('string');
            expect(playerId.length).toBe(36); // UUID v4 length
        });

        test('generates unique IDs on multiple calls', () => {
            const ids = [];
            const numTests = 100;

            for (let i = 0; i < numTests; i++) {
                ids.push(generatePlayerId());
            }

            // Check all IDs are unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(numTests);
        });

        test('has correct UUID v4 version and variant bits', () => {
            const playerId = generatePlayerId();
            const parts = playerId.split('-');

            // Check version (4th character of 3rd part should be '4')
            expect(parts[2][0]).toBe('4');

            // Check variant (1st character of 4th part should be 8, 9, a, or b)
            const variantChar = parts[3][0].toLowerCase();
            expect(['8', '9', 'a', 'b']).toContain(variantChar);
        });

        test('uses only valid hexadecimal characters', () => {
            const playerId = generatePlayerId();
            const hexOnlyRegex = /^[0-9a-f\-]+$/i;
            expect(playerId).toMatch(hexOnlyRegex);
        });
    });

    describe('getUniquePlayerId()', () => {
        test('generates new player ID when none exists', () => {
            mockLocalStorage.clear();

            const playerId = getUniquePlayerId(mockLocalStorage);

            expect(playerId).toBeDefined();
            expect(typeof playerId).toBe('string');
            expect(playerId.length).toBe(36);
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('playerId', playerId);
            expect(console.log).toHaveBeenCalledWith('🆔 Generated new unique player ID:', playerId);
        });

        test('returns existing player ID when a valid one exists', () => {
            const existingId = '11111111-1111-4111-8111-111111111111';
            mockLocalStorage.store.playerId = existingId;

            const playerId = getUniquePlayerId(mockLocalStorage);

            expect(playerId).toBe(existingId);
            expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith('🆔 Using existing player ID:', existingId);
        });

        test('replaces a stored ID that is not in UUID format', () => {
            // The pre-2025 client stored IDs in a different format. The server
            // rejects them and would create a duplicate player on every join.
            const legacyIds = ['player_1758300000000_abc123', 'existing-player-id-12345', 'not a uuid'];

            for (const legacyId of legacyIds) {
                jest.clearAllMocks();
                mockLocalStorage.store.playerId = legacyId;

                const playerId = getUniquePlayerId(mockLocalStorage);

                expect(playerId).not.toBe(legacyId);
                expect(playerId).toMatch(PLAYER_ID_PATTERN);
                // The regenerated ID is persisted, so the NEXT visit reuses it
                // instead of duplicating the player again
                expect(mockLocalStorage.setItem).toHaveBeenCalledWith('playerId', playerId);
                expect(mockLocalStorage.store.playerId).toBe(playerId);
            }
        });

        test('keeps the regenerated ID stable on later visits', () => {
            mockLocalStorage.store.playerId = 'player_1758300000000_abc123';

            const regeneratedId = getUniquePlayerId(mockLocalStorage);
            const nextVisitId = getUniquePlayerId(mockLocalStorage);

            expect(nextVisitId).toBe(regeneratedId);
        });

        test('returns same ID on multiple calls', () => {
            mockLocalStorage.clear();

            const firstCall = getUniquePlayerId(mockLocalStorage);
            const secondCall = getUniquePlayerId(mockLocalStorage);
            const thirdCall = getUniquePlayerId(mockLocalStorage);

            expect(firstCall).toBe(secondCall);
            expect(secondCall).toBe(thirdCall);
            expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1); // Only called once
        });

        test('persists player ID in localStorage', () => {
            mockLocalStorage.clear();

            const playerId = getUniquePlayerId(mockLocalStorage);

            expect(mockLocalStorage.store.playerId).toBe(playerId);
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('playerId', playerId);
        });

        test('handles empty string in localStorage as no ID', () => {
            mockLocalStorage.store.playerId = '';

            const playerId = getUniquePlayerId(mockLocalStorage);

            // Should generate new ID since empty string is falsy
            expect(playerId).not.toBe('');
            expect(playerId.length).toBe(36);
            expect(mockLocalStorage.setItem).toHaveBeenCalled();
        });

        test('handles null in localStorage as no ID', () => {
            mockLocalStorage.store.playerId = null;

            const playerId = getUniquePlayerId(mockLocalStorage);

            expect(playerId).not.toBeNull();
            expect(playerId.length).toBe(36);
            expect(mockLocalStorage.setItem).toHaveBeenCalled();
        });
    });

    describe('Player ID System Integration', () => {
        test('simulates full browser session lifecycle', () => {
            // Fresh browser - no existing ID
            mockLocalStorage.clear();

            // First page load
            const firstPageId = getUniquePlayerId(mockLocalStorage);
            expect(firstPageId).toBeDefined();
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('playerId', firstPageId);

            // Simulate page refresh - same browser, should get same ID
            jest.clearAllMocks();
            const secondPageId = getUniquePlayerId(mockLocalStorage);

            expect(secondPageId).toBe(firstPageId);
            expect(mockLocalStorage.setItem).not.toHaveBeenCalled(); // No new ID generated
            expect(console.log).toHaveBeenCalledWith('🆔 Using existing player ID:', firstPageId);
        });

        test('different browser sessions get different IDs', () => {
            // Browser 1
            const browser1Storage = {
                store: {},
                getItem: jest.fn((key) => browser1Storage.store[key] || null),
                setItem: jest.fn((key, value) => { browser1Storage.store[key] = value; })
            };

            const browser1Id = getUniquePlayerId(browser1Storage);

            // Browser 2 (different localStorage)
            const browser2Storage = {
                store: {},
                getItem: jest.fn((key) => browser2Storage.store[key] || null),
                setItem: jest.fn((key, value) => { browser2Storage.store[key] = value; })
            };

            const browser2Id = getUniquePlayerId(browser2Storage);

            expect(browser1Id).not.toBe(browser2Id);
            expect(browser1Storage.store.playerId).toBe(browser1Id);
            expect(browser2Storage.store.playerId).toBe(browser2Id);
        });
    });

    describe('Error Handling', () => {
        test('documents error handling behavior when localStorage fails', () => {
            // Mock localStorage that throws errors
            const faultyStorage = {
                getItem: jest.fn(() => {
                    throw new Error('localStorage access denied');
                }),
                setItem: jest.fn(() => {
                    throw new Error('localStorage write denied');
                })
            };

            // Current implementation doesn't handle localStorage errors
            // This test documents the current behavior - it will throw an error
            expect(() => {
                getUniquePlayerId(faultyStorage);
            }).toThrow('localStorage access denied');

            // In a production environment, this would need error handling
            // to gracefully degrade when localStorage is not available
        });

        test('works with minimal localStorage implementation', () => {
            // Test with a minimal but working localStorage
            const minimalStorage = {
                getItem: jest.fn(() => null),
                setItem: jest.fn()
            };

            const playerId = getUniquePlayerId(minimalStorage);

            expect(playerId).toBeDefined();
            expect(playerId.length).toBe(36);
            expect(minimalStorage.setItem).toHaveBeenCalledWith('playerId', playerId);
        });
    });
});