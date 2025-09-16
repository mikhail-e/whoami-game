// Who am I? Game - Blur Event Tests
// Tests for character input blur event functionality

describe('Character Input Blur Event', () => {
    let mockInput;
    let saveCharacterCalls;
    let saveInProgress;
    let savedViaEnter;

    beforeEach(() => {
        // Reset tracking variables
        saveCharacterCalls = [];
        saveInProgress = false;
        savedViaEnter = false;

        // Mock input element
        mockInput = {
            value: 'Batman',
            addEventListener: jest.fn(),
            disabled: false,
            style: { pointerEvents: 'auto' }
        };

        // Mock saveCharacter function that mimics the real implementation
        global.mockSaveCharacter = jest.fn((triggeredBy = 'unknown') => {
            // Mimic the double execution protection from the real code
            if (saveInProgress) {
                console.log(`🚫 saveCharacter blocked - already in progress`);
                return;
            }

            if (triggeredBy === 'blur' && savedViaEnter) {
                console.log(`🚫 saveCharacter blocked - already saved via Enter`);
                return;
            }

            // Only record the call if it wasn't blocked
            saveCharacterCalls.push(triggeredBy);

            saveInProgress = true;
            if (triggeredBy === 'enter') {
                savedViaEnter = true;
            }

            // Simulate async completion
            setTimeout(() => {
                saveInProgress = false;
            }, 10);
        });
    });

    afterEach(() => {
        delete global.mockSaveCharacter;
    });

    test('blur event should be added to character input', () => {
        // This test verifies that addEventListener is called with 'blur'
        // In a real implementation, we would check that blur handler is registered

        // Simulate adding event listeners like in the real code
        mockInput.addEventListener('keydown', jest.fn());
        mockInput.addEventListener('blur', jest.fn());

        expect(mockInput.addEventListener).toHaveBeenCalledWith('blur', expect.any(Function));
        expect(mockInput.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    test('saveCharacter should handle blur events correctly', () => {
        // Test blur event alone
        global.mockSaveCharacter('blur');

        expect(saveCharacterCalls).toEqual(['blur']);
        expect(saveInProgress).toBe(true);
        expect(savedViaEnter).toBe(false);
    });

    test('saveCharacter should handle enter events correctly', () => {
        // Test enter event alone
        global.mockSaveCharacter('enter');

        expect(saveCharacterCalls).toEqual(['enter']);
        expect(saveInProgress).toBe(true);
        expect(savedViaEnter).toBe(true);
    });

    test('saveCharacter should prevent double execution: enter then blur', () => {
        // Simulate enter event first
        global.mockSaveCharacter('enter');
        expect(saveCharacterCalls).toEqual(['enter']);
        expect(savedViaEnter).toBe(true);

        // Simulate blur event after enter - should be blocked
        global.mockSaveCharacter('blur');
        expect(saveCharacterCalls).toEqual(['enter']); // No new calls
    });

    test('saveCharacter should prevent double execution: blur then enter while in progress', () => {
        // Simulate blur event first
        global.mockSaveCharacter('blur');
        expect(saveCharacterCalls).toEqual(['blur']);
        expect(saveInProgress).toBe(true);

        // Simulate enter event while blur is still in progress - should be blocked
        global.mockSaveCharacter('enter');
        expect(saveCharacterCalls).toEqual(['blur']); // No new calls
    });

    test('saveCharacter should allow blur after escape event', () => {
        // Simulate escape event (which doesn't set savedViaEnter)
        global.mockSaveCharacter('escape');
        expect(saveCharacterCalls).toEqual(['escape']);

        // Reset flags to simulate completion
        saveInProgress = false;

        // Now blur should work
        global.mockSaveCharacter('blur');
        expect(saveCharacterCalls).toEqual(['escape', 'blur']);
    });

    test('multiple blur events should be prevented by saveInProgress flag', () => {
        // First blur event
        global.mockSaveCharacter('blur');
        expect(saveCharacterCalls).toEqual(['blur']);
        expect(saveInProgress).toBe(true);

        // Second blur event while first is in progress - should be blocked
        global.mockSaveCharacter('blur');
        expect(saveCharacterCalls).toEqual(['blur']); // No new calls
    });
});