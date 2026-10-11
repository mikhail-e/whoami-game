// Who am I? Game - Localization Tests

// Mock DOM elements for testing
class MockElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.textContent = '';
        this.innerHTML = '';
        this.attributes = {};
        this.dataset = {};
        this.classList = {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn()
        };
        this.style = {};
    }
    
    setAttribute(name, value) {
        this.attributes[name] = value;
    }
    
    getAttribute(name) {
        return this.attributes[name];
    }
    
    hasAttribute(name) {
        return name in this.attributes;
    }
    
    insertAdjacentHTML(position, html) {
        this.innerHTML += html;
    }
    
    addEventListener() {}
}

// Mock DOM
const mockDOM = {
    elements: new Map(),
    createElement: jest.fn((tagName) => new MockElement(tagName)),
    querySelectorAll: jest.fn((selector) => {
        const results = [];
        mockDOM.elements.forEach((element, key) => {
            if (selector === '[data-i18n]' && element.hasAttribute('data-i18n')) {
                results.push(element);
            } else if (selector === '[data-i18n-placeholder]' && element.hasAttribute('data-i18n-placeholder')) {
                results.push(element);
            } else if (selector === '[data-i18n-title]' && element.hasAttribute('data-i18n-title')) {
                results.push(element);
            } else if (selector === '.lang-btn') {
                results.push(element);
            } else if (selector === '.container' && key === 'container') {
                results.push(element);
            }
        });
        return results;
    }),
    querySelector: jest.fn((selector) => {
        if (selector === 'title') return mockDOM.elements.get('title');
        if (selector === '.container') return mockDOM.elements.get('container');
        return null;
    }),
    addEventListener: jest.fn()
};

// Mock localStorage
const mockLocalStorage = {
    data: {},
    getItem: jest.fn((key) => mockLocalStorage.data[key] || null),
    setItem: jest.fn((key, value) => {
        mockLocalStorage.data[key] = value;
    }),
    clear: jest.fn(() => {
        mockLocalStorage.data = {};
    })
};

// Mock navigator
const mockNavigator = {
    language: 'en-US',
    userLanguage: 'en-US'
};

// Set up global mocks
global.document = mockDOM;
global.localStorage = mockLocalStorage;
global.navigator = mockNavigator;

describe('Localization System', () => {
    let translations, Localization;
    let mockElements;
    
    beforeAll(() => {
        // Load translations directly (simplified for testing)
        translations = {
            en: {
                title: "🎭 Who am I?",
                subtitle: "Play the classic guessing game with friends and family!",
                startGame: "Start Game",
                restartGame: "Restart Game",
                needPlayers: "Need at least 2 players to start",
                assignCharacters: "Assign characters to all players before starting!",
                readyToPlay: "Ready to play!",
                gameInProgress: "Game in progress - Click your mystery sticker to reveal!",
                enterName: "Enter your name",
                assignCharacter: "Assign character",
                connectionError: "Connection error. Please try again.",
                roomNotFound: "Room not found",
                failedJoinGame: "Failed to join game",
                joinCreateGame: "Join or Create a Game",
                yourName: "Your Name",
                chooseAvatar: "Choose Your Avatar",
                roomCode: "Room Code",
                joinGame: "Join Game",
                createNewGame: "Create New Game",
                howToPlay: "How to Play",
                rule1: "Each player gets a character assigned by other players",
                rule2: "Ask yes/no questions to guess your character",
                rule3: "Other players answer your questions",
                rule4: "First to guess their character wins!",
                players: "Players",
                playerRevealedNotification: "🎭 {playerName} revealed their character: \"{character}\"",
                language: "Language",
                english: "English",
                russian: "Русский"
            },
            ru: {
                title: "🎭 Кто я?",
                subtitle: "Играйте в классическую игру-угадайку с друзьями и семьёй!",
                startGame: "Начать игру",
                restartGame: "Перезапустить",
                needPlayers: "Нужно минимум 2 игрока для начала",
                assignCharacters: "Назначьте персонажей всем игрокам перед началом!",
                readyToPlay: "Готово к игре!",
                gameInProgress: "Игра идёт - Кликните на свой загадочный стикер для раскрытия!",
                enterName: "Введите ваше имя",
                assignCharacter: "Назначить персонажа",
                connectionError: "Ошибка соединения. Попробуйте ещё раз.",
                roomNotFound: "Комната не найдена",
                failedJoinGame: "Не удалось присоединиться к игре",
                joinCreateGame: "Присоединиться или создать игру",
                yourName: "Ваше имя",
                chooseAvatar: "Выберите аватар",
                roomCode: "Код комнаты",
                joinGame: "Войти в игру",
                createNewGame: "Создать новую игру",
                howToPlay: "Как играть",
                rule1: "Каждому игроку другие игроки назначают персонажа",
                rule2: "Задавайте вопросы да/нет, чтобы угадать своего персонажа",
                rule3: "Другие игроки отвечают на ваши вопросы",
                rule4: "Первый, кто угадает своего персонажа, побеждает!",
                players: "Игроки",
                playerRevealedNotification: "🎭 {playerName} раскрыл своего персонажа: \"{character}\"",
                language: "Язык",
                english: "English",
                russian: "Русский"
            }
        };
        
        // Simple Localization class for testing
        Localization = class {
            constructor() {
                this.currentLanguage = this.detectLanguage();
            }
            
            detectLanguage() {
                const savedLang = mockLocalStorage.getItem('whoami-language');
                if (savedLang && translations[savedLang]) {
                    return savedLang;
                }
                
                const browserLang = mockNavigator.language || mockNavigator.userLanguage || 'en';
                const langCode = browserLang.toLowerCase().substring(0, 2);
                return translations[langCode] ? langCode : 'en';
            }
            
            setLanguage(lang) {
                if (!translations[lang]) return;
                this.currentLanguage = lang;
                mockLocalStorage.setItem('whoami-language', lang);
                this.updateTexts();
            }
            
            getText(key, placeholders = {}) {
                let text = translations[this.currentLanguage][key] || translations['en'][key] || key;

                // Replace placeholders in the format {placeholder}
                for (const [placeholder, value] of Object.entries(placeholders)) {
                    text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
                }

                return text;
            }
            
            updateTexts() {
                const elements = mockDOM.querySelectorAll('[data-i18n]');
                elements.forEach(element => {
                    const key = element.getAttribute('data-i18n');
                    element.textContent = this.getText(key);
                });
                
                const placeholders = mockDOM.querySelectorAll('[data-i18n-placeholder]');
                placeholders.forEach(element => {
                    const key = element.getAttribute('data-i18n-placeholder');
                    element.placeholder = this.getText(key);
                });
                
                const titles = mockDOM.querySelectorAll('[data-i18n-title]');
                titles.forEach(element => {
                    const key = element.getAttribute('data-i18n-title');
                    element.title = this.getText(key);
                });
            }
            
            createLanguageSwitcher() {
                const container = mockDOM.querySelector('.container');
                if (container) {
                    container.insertAdjacentHTML('beforeend', `
                        <div class="language-switcher">
                            <button data-lang="en">English</button>
                            <button data-lang="ru">Русский</button>
                        </div>
                    `);
                }
            }
        };
    });
    
    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        mockLocalStorage.clear();
        mockDOM.elements.clear();
        
        // Set up common mock elements
        mockElements = {
            title: new MockElement('title'),
            container: new MockElement('div'),
            textElement: new MockElement('span'),
            placeholderElement: new MockElement('input'),
            titleElement: new MockElement('button')
        };
        
        // Set up attributes
        mockElements.textElement.setAttribute('data-i18n', 'title');
        mockElements.placeholderElement.setAttribute('data-i18n-placeholder', 'enterName');
        mockElements.titleElement.setAttribute('data-i18n-title', 'assignCharacter');
        
        // Add to DOM
        mockDOM.elements.set('title', mockElements.title);
        mockDOM.elements.set('container', mockElements.container);
        mockDOM.elements.set('text1', mockElements.textElement);
        mockDOM.elements.set('placeholder1', mockElements.placeholderElement);
        mockDOM.elements.set('title1', mockElements.titleElement);
        
        // Reset navigator language
        mockNavigator.language = 'en-US';
    });
    
    describe('Translation Data Structure', () => {
        test('contains English and Russian translations', () => {
            expect(translations).toHaveProperty('en');
            expect(translations).toHaveProperty('ru');
        });
        
        test('English translations contain all required keys', () => {
            const englishKeys = Object.keys(translations.en);
            
            // Core keys that should exist
            const requiredKeys = [
                'title', 'subtitle', 'joinCreateGame', 'yourName', 'enterName',
                'chooseAvatar', 'roomCode', 'joinGame', 'createNewGame',
                'howToPlay', 'rule1', 'rule2', 'rule3', 'rule4',
                'needPlayers', 'assignCharacters', 'readyToPlay', 'gameInProgress',
                'startGame', 'restartGame', 'players', 'playerRevealedNotification',
                'language', 'english', 'russian'
            ];
            
            requiredKeys.forEach(key => {
                expect(englishKeys).toContain(key);
                expect(translations.en[key]).toBeTruthy();
            });
        });
        
        test('Russian translations have same keys as English', () => {
            const englishKeys = Object.keys(translations.en);
            const russianKeys = Object.keys(translations.ru);
            
            expect(russianKeys.length).toBe(englishKeys.length);
            englishKeys.forEach(key => {
                expect(russianKeys).toContain(key);
                expect(translations.ru[key]).toBeTruthy();
            });
        });
        
        test('translations contain proper Russian text', () => {
            expect(translations.ru.title).toBe('🎭 Кто я?');
            expect(translations.ru.startGame).toBe('Начать игру');
            expect(translations.ru.restartGame).toBe('Перезапустить');
            expect(translations.ru.needPlayers).toContain('минимум 2 игрока');
        });
    });
    
    describe('Language Detection', () => {
        test('defaults to English for English browser', () => {
            mockNavigator.language = 'en-US';
            const i18n = new Localization();
            expect(i18n.currentLanguage).toBe('en');
        });
        
        test('detects Russian from browser language', () => {
            mockNavigator.language = 'ru-RU';
            const i18n = new Localization();
            expect(i18n.currentLanguage).toBe('ru');
        });
        
        test('detects Russian from short language code', () => {
            mockNavigator.language = 'ru';
            const i18n = new Localization();
            expect(i18n.currentLanguage).toBe('ru');
        });
        
        test('falls back to English for unsupported language', () => {
            mockNavigator.language = 'fr-FR';
            const i18n = new Localization();
            expect(i18n.currentLanguage).toBe('en');
        });
        
        test('uses saved language preference over browser detection', () => {
            mockNavigator.language = 'en-US';
            mockLocalStorage.setItem('whoami-language', 'ru');
            
            const i18n = new Localization();
            expect(i18n.currentLanguage).toBe('ru');
        });
        
        test('ignores invalid saved language preference', () => {
            mockNavigator.language = 'en-US';
            mockLocalStorage.setItem('whoami-language', 'invalid');
            
            const i18n = new Localization();
            expect(i18n.currentLanguage).toBe('en');
        });
    });
    
    describe('Text Translation', () => {
        let i18n;
        
        beforeEach(() => {
            i18n = new Localization();
        });
        
        test('returns correct English text', () => {
            i18n.currentLanguage = 'en';
            expect(i18n.getText('title')).toBe('🎭 Who am I?');
            expect(i18n.getText('startGame')).toBe('Start Game');
            expect(i18n.getText('needPlayers')).toBe('Need at least 2 players to start');
        });
        
        test('returns correct Russian text', () => {
            i18n.currentLanguage = 'ru';
            expect(i18n.getText('title')).toBe('🎭 Кто я?');
            expect(i18n.getText('startGame')).toBe('Начать игру');
            expect(i18n.getText('needPlayers')).toContain('минимум 2 игрока');
        });
        
        test('falls back to English for missing Russian keys', () => {
            i18n.currentLanguage = 'ru';
            // Temporarily remove a key from Russian
            const original = translations.ru.title;
            delete translations.ru.title;
            
            expect(i18n.getText('title')).toBe('🎭 Who am I?');
            
            // Restore the key
            translations.ru.title = original;
        });
        
        test('returns key name for completely missing keys', () => {
            expect(i18n.getText('nonexistentKey')).toBe('nonexistentKey');
        });
    });
    
    describe('Language Switching', () => {
        let i18n;
        
        beforeEach(() => {
            i18n = new Localization();
        });
        
        test('switches to Russian successfully', () => {
            i18n.setLanguage('ru');
            expect(i18n.currentLanguage).toBe('ru');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('whoami-language', 'ru');
        });
        
        test('switches to English successfully', () => {
            i18n.setLanguage('en');
            expect(i18n.currentLanguage).toBe('en');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('whoami-language', 'en');
        });
        
        test('ignores invalid language codes', () => {
            const originalLang = i18n.currentLanguage;
            i18n.setLanguage('invalid');
            expect(i18n.currentLanguage).toBe(originalLang);
        });
        
        test('updates text after language change', () => {
            // Set initial language to English
            i18n.currentLanguage = 'en';
            i18n.updateTexts();
            expect(mockElements.textElement.textContent).toBe('🎭 Who am I?');
            
            // Switch to Russian
            i18n.setLanguage('ru');
            expect(mockElements.textElement.textContent).toBe('🎭 Кто я?');
        });
    });
    
    describe('DOM Updates', () => {
        let i18n;
        
        beforeEach(() => {
            i18n = new Localization();
        });
        
        test('updates elements with data-i18n attribute', () => {
            i18n.currentLanguage = 'en';
            i18n.updateTexts();
            
            expect(mockElements.textElement.textContent).toBe('🎭 Who am I?');
        });
        
        test('updates placeholder attributes', () => {
            i18n.currentLanguage = 'en';
            i18n.updateTexts();
            
            expect(mockElements.placeholderElement.placeholder).toBe('Enter your name');
        });
        
        test('updates title attributes', () => {
            i18n.currentLanguage = 'en';
            i18n.updateTexts();
            
            expect(mockElements.titleElement.title).toBe('Assign character');
        });
        
        test('updates elements in Russian', () => {
            i18n.currentLanguage = 'ru';
            i18n.updateTexts();
            
            expect(mockElements.textElement.textContent).toBe('🎭 Кто я?');
            expect(mockElements.placeholderElement.placeholder).toBe('Введите ваше имя');
            expect(mockElements.titleElement.title).toBe('Назначить персонажа');
        });
    });
    
    describe('Language Switcher UI', () => {
        let i18n;
        
        beforeEach(() => {
            i18n = new Localization();
        });
        
        test('creates language switcher HTML', () => {
            i18n.createLanguageSwitcher();
            
            expect(mockElements.container.innerHTML).toContain('language-switcher');
            expect(mockElements.container.innerHTML).toContain('English');
            expect(mockElements.container.innerHTML).toContain('Русский');
        });
        
        test('creates buttons with correct data attributes', () => {
            i18n.createLanguageSwitcher();
            
            expect(mockElements.container.innerHTML).toContain('data-lang="en"');
            expect(mockElements.container.innerHTML).toContain('data-lang="ru"');
        });
    });
    
    describe('Integration Scenarios', () => {
        test('complete language detection and switching flow', () => {
            // Simulate Russian browser
            mockNavigator.language = 'ru-RU';
            
            const i18n = new Localization();
            
            // Should start with Russian
            expect(i18n.currentLanguage).toBe('ru');
            expect(i18n.getText('title')).toBe('🎭 Кто я?');
            
            // Switch to English
            i18n.setLanguage('en');
            expect(i18n.currentLanguage).toBe('en');
            expect(i18n.getText('title')).toBe('🎭 Who am I?');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('whoami-language', 'en');
            
            // Switch back to Russian
            i18n.setLanguage('ru');
            expect(i18n.currentLanguage).toBe('ru');
            expect(i18n.getText('title')).toBe('🎭 Кто я?');
        });
        
        test('persistence works across sessions', () => {
            // First session: user switches to Russian
            mockNavigator.language = 'en-US';
            let i18n = new Localization();
            expect(i18n.currentLanguage).toBe('en');
            
            i18n.setLanguage('ru');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('whoami-language', 'ru');
            
            // Second session: should remember Russian
            i18n = new Localization();
            expect(i18n.currentLanguage).toBe('ru');
        });
        
        test('error messages work in both languages', () => {
            const i18n = new Localization();
            
            // English error messages
            i18n.currentLanguage = 'en';
            expect(i18n.getText('connectionError')).toBe('Connection error. Please try again.');
            expect(i18n.getText('roomNotFound')).toBe('Room not found');
            expect(i18n.getText('failedJoinGame')).toBe('Failed to join game');
            
            // Russian error messages
            i18n.currentLanguage = 'ru';
            expect(i18n.getText('connectionError')).toBe('Ошибка соединения. Попробуйте ещё раз.');
            expect(i18n.getText('roomNotFound')).toBe('Комната не найдена');
            expect(i18n.getText('failedJoinGame')).toBe('Не удалось присоединиться к игре');
        });
    });

    describe('Placeholder Support for Reveal Notifications', () => {
        test('supports placeholders in English reveal notifications', () => {
            const i18n = new Localization();
            i18n.currentLanguage = 'en';

            const result = i18n.getText('playerRevealedNotification', {
                playerName: 'Alice',
                character: 'Batman'
            });

            expect(result).toBe('🎭 Alice revealed their character: "Batman"');
        });

        test('supports placeholders in Russian reveal notifications', () => {
            const i18n = new Localization();
            i18n.currentLanguage = 'ru';

            const result = i18n.getText('playerRevealedNotification', {
                playerName: 'Алиса',
                character: 'Бэтмен'
            });

            expect(result).toBe('🎭 Алиса раскрыл своего персонажа: "Бэтмен"');
        });

        test('handles multiple placeholders correctly', () => {
            const i18n = new Localization();
            i18n.currentLanguage = 'en';

            const result = i18n.getText('playerRevealedNotification', {
                playerName: 'Bob',
                character: 'Superman'
            });

            expect(result).toBe('🎭 Bob revealed their character: "Superman"');
        });

        test('works without placeholders for backward compatibility', () => {
            const i18n = new Localization();
            i18n.currentLanguage = 'en';

            const result = i18n.getText('title');
            expect(result).toBe('🎭 Who am I?');
        });

        test('handles missing placeholders gracefully', () => {
            const i18n = new Localization();
            i18n.currentLanguage = 'en';

            const result = i18n.getText('playerRevealedNotification', {
                playerName: 'Charlie'
                // Missing character placeholder
            });

            expect(result).toBe('🎭 Charlie revealed their character: "{character}"');
        });
    });
});