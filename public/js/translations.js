// Localization system for Who am I? game

const translations = {
    en: {
        // Main page
        title: "🎭 Who am I?",
        subtitle: "Play the classic guessing game with friends and family!",
        joinCreateGame: "Join or Create a Game",
        yourName: "Your Name",
        enterName: "Enter your name",
        chooseAvatar: "Choose Your Avatar",
        roomCode: "Room Code",
        roomCodePlaceholder: "ABC123",
        roomCodeHelp: "Enter 6-character room code to join existing game",
        joinGame: "Join Game",
        createNewGame: "Create New Game",
        
        // Game rules
        howToPlay: "How to Play",
        rule1: "Each player gets a character assigned by other player",
        rule2: "Ask yes/no questions to guess your character",
        rule3: "Other players answer your questions",
        rule4: "First to guess their character wins!",
        
        // Game room page
        gameRoom: "Game Room",
        players: "Players",
        playerCount: "Player Count",
        shareRoom: "Share Room",
        shareLink: "Share Link",
        copyLink: "Copy Link",
        copied: "✅ Copied!",
        
        // Game states
        needPlayers: "Need at least 2 players to start",
        assignCharacters: "Assign characters to all players before starting!",
        readyToPlay: "Ready to play!",
        gameInProgress: "Game in progress - Click your mystery sticker to reveal!",
        
        // Buttons
        gameControls: "Game Controls",
        startGame: "Start Game",
        restartGame: "Start New Game",
        refresh: "Refresh Page",
        
        // Character assignment
        assignmentInstructions: "Click the + button next to other players to assign them characters",
        assignCharacter: "Assign character",
        characterName: "Character name...",
        you: "You",
        readOnlyDuringGame: "read-only during game",
        assignedByAnother: "assigned by another player",
        yourCharacter: "Your character - click to reveal!",
        yourCharacterHidden: "Your character is hidden from you!",
        yourRevealed: "Your revealed character",
        
        // Modals
        revealTitle: "Reveal Your Character?",
        revealMessage: "Are you sure you want to see who you are? This will end the game for you!",
        cancel: "Cancel",
        revealCharacter: "Reveal Character",
        
        restartTitle: "Restart Game?",
        restartMessage: "This will clear all character assignments and return to setup phase. Are you sure?",
        confirmRestart: "Yes, Restart",
        
        // Notifications
        gameRestarted: "⏮️ Game restarted! Character assignments cleared.",
        
        // Errors
        invalidRoom: "Invalid room code",
        connectionError: "Connection error. Please try again.",
        roomNotFound: "Room not found",
        pleaseEnterName: "Please enter your name first",
        roomCodeLength: "Room code must be exactly 6 characters",
        failedCreateGame: "Failed to create game. Please try again.",
        failedJoinGame: "Failed to join game",
        readyToJoin: "Ready to join room",
        enterNameAvatar: "Just enter your name and avatar!",
        clickToEdit: "click to edit",
        
        // Game room additional
        inviteFriends: "Invite Friends",
        characterAssignment: "Character Assignment",
        clickPlus: "Click the + button",
        clickStickers: "Click character stickers",
        assignInstructions: "on other players to assign them characters.",
        editInstructions: "to edit them.",
        gameInstructions: "Game Instructions",
        step1: "Wait for at least 2 players to join",
        step2: "Each player assigns characters to other players",
        step3: "Click \"Start Game\" when ready",
        step4: "Click your mystery sticker (❓) to reveal your character",
        step5: "Try to guess who you are!",
        
        // Modal content
        revealModalTitle: "🎭 Reveal Your Character",
        revealConfirmText: "Are you sure you want to reveal your character?",
        revealWarning: "⚠️ This action cannot be undone!",
        revealNote: "Once revealed, your character will be visible to all players for the rest of the game.",
        revealButton: "Yes, Reveal My Character",
        
        restartModalTitle: "⏮️ Start New Game",
        restartConfirmText: "Are you sure you want to restart the game?",
        restartWarning: "⚠️ This will:",
        restartAction1: "Reset all revealed characters",
        restartAction2: "Allow players to reassign characters",
        restartAction3: "Enable new players to join again",
        restartAction4: "Return everyone to the setup phase",
        restartNote: "All players will be able to see this action.",
        
        waiting: "Waiting for players to join...",

        // Reveal notifications
        playerRevealedNotification: "🎭 {playerName} revealed their character: \"{character}\"",

        // UI messages
        noPlayersYet: "No players yet",
        yourCharacterClickReveal: "Your character - click to reveal!",
        yourCharacterHidden: "Your character is hidden from you!",
        yourRevealedCharacter: "Your revealed character",
        characterRevealedByPlayer: "Character revealed by player",
        assignCharacter: "Assign character",
        someoneNeedsToAssign: "Someone needs to assign you a character!",
        copiedSuccess: "✅ Copied!",

        // Error messages
        invalidRoomCode: "Invalid room code",
        invalidRoomCodeFormat: "Invalid room code format",
        failedJoinGame: "Failed to join game",
        failedRecoverGame: "Failed to recover game",
        connectionErrorTryAgain: "Please try again.",
        pleaseCreateNewRoom: "Please create a new room.",

        // Language switcher
        language: "Language",
        english: "English",
        russian: "Русский",

        // Dynamic UI updates
        roomCodeJoining: "Room Code (joining game)",
        clearRoomCodeToCreate: "Clear room code to create a new game",
        creating: "Creating...",

        // PWA messages
        updateAvailable: "🆕 Update Available!",
        updateDescription: "A new version of the app is ready. Reload to get the latest features.",
        updateNow: "Update Now"
    },
    
    ru: {
        // Main page
        title: "🎭 Кто я?",
        subtitle: "Играйте в классическую игру-угадайку с друзьями и семьёй!",
        joinCreateGame: "Присоединиться или создать игру",
        yourName: "Ваше имя",
        enterName: "Введите ваше имя",
        chooseAvatar: "Выберите аватар",
        roomCode: "Код комнаты",
        roomCodePlaceholder: "ABC123",
        roomCodeHelp: "Введите 6-символьный код комнаты для присоединения к существующей игре",
        joinGame: "Войти в игру",
        createNewGame: "Создать новую игру",
        
        // Game rules
        howToPlay: "Как играть",
        rule1: "Каждому игроку другие игроки назначают персонажа",
        rule2: "Задавайте вопросы да/нет, чтобы угадать своего персонажа",
        rule3: "Другие игроки отвечают на ваши вопросы",
        rule4: "Первый, кто угадает своего персонажа, побеждает!",
        
        // Game room page
        gameRoom: "Игровая комната",
        players: "Игроки",
        playerCount: "Количество игроков",
        shareRoom: "Поделиться комнатой",
        shareLink: "Ссылка для друзей",
        copyLink: "Скопировать",
        copied: "✅ Скопировано!",
        
        // Game states
        needPlayers: "Нужно минимум 2 игрока для начала",
        assignCharacters: "Назначьте персонажей всем игрокам перед началом!",
        readyToPlay: "Готово к игре!",
        gameInProgress: "Игра идёт - Кликните на свой загадочный стикер для раскрытия!",
        
        // Buttons
        gameControls: "Управление игрой",
        startGame: "Начать игру",
        restartGame: "Начать новую игру",
        refresh: "Обновить страницу",
        
        // Character assignment
        assignmentInstructions: "Нажмите кнопку + рядом с другими игроками, чтобы назначить им персонажей",
        assignCharacter: "Назначить персонажа",
        characterName: "Имя персонажа...",
        you: "Вы",
        readOnlyDuringGame: "только чтение во время игры",
        assignedByAnother: "назначен другим игроком",
        yourCharacter: "Ваш персонаж - нажмите для раскрытия!",
        yourCharacterHidden: "Ваш персонаж скрыт от вас!",
        yourRevealed: "Ваш раскрытый персонаж",
        
        // Modals
        revealTitle: "Раскрыть вашего персонажа?",
        revealMessage: "Вы уверены, что хотите узнать, кто вы? Это завершит игру для вас!",
        cancel: "Отмена",
        revealCharacter: "Раскрыть персонажа",
        
        restartTitle: "Начать новую игру?",
        restartMessage: "Это очистит всех персонажей и завершит текущую игру. Вы уверены?",
        confirmRestart: "Да, перезапустить",
        
        // Notifications
        gameRestarted: "⏮️ Игра перезапущена! Персонажи очищены.",
        
        // Errors
        invalidRoom: "Неверный код комнаты",
        connectionError: "Ошибка соединения. Попробуйте ещё раз.",
        roomNotFound: "Комната не найдена",
        pleaseEnterName: "Пожалуйста, введите ваше имя",
        roomCodeLength: "Код комнаты должен содержать ровно 6 символов",
        failedCreateGame: "Не удалось создать игру. Попробуйте ещё раз.",
        failedJoinGame: "Не удалось присоединиться к игре",
        readyToJoin: "Готов присоединиться к комнате",
        enterNameAvatar: "Просто введите ваше имя и выберите аватар!",
        clickToEdit: "нажмите для редактирования",
        
        // Game room additional
        inviteFriends: "Пригласить друзей",
        characterAssignment: "Назначение персонажей",
        clickPlus: "Нажмите кнопку +",
        clickStickers: "Нажмите на стикеры персонажей",
        assignInstructions: "рядом с другими игроками, чтобы назначить им персонажей.",
        editInstructions: "чтобы их редактировать.",
        gameInstructions: "Инструкции к игре",
        step1: "Дождитесь присоединения минимум 2 игроков",
        step2: "Каждый игрок назначает персонажа другому игроку",
        step3: "Нажмите \"Начать игру\" когда готовы",
        step4: "Нажмите на свой загадочный стикер (❓) чтобы раскрыть персонажа",
        step5: "Попробуйте угадать, кто вы!",
        
        // Modal content
        revealModalTitle: "🎭 Раскрыть вашего персонажа",
        revealConfirmText: "Вы уверены, что хотите раскрыть своего персонажа?",
        revealWarning: "⚠️ Это действие нельзя отменить!",
        revealNote: "После раскрытия ваш персонаж будет виден вам до конца игры.",
        revealButton: "Да, раскрыть моего персонажа",
        
        restartModalTitle: "⏮️ Перезапустить игру",
        restartConfirmText: "Вы уверены, что хотите перезапустить игру?",
        restartWarning: "⚠️ После перезапуска:",
        restartAction1: "Все персонажей будут удалены",
        restartAction2: "Игроки снвоа смогут назначать персонажей",
        restartAction3: "К игре смогут присоединиться новые игроки",
        restartAction4: " ",
        restartNote: "Это действие повлияет на всех игроков",
        
        waiting: "Ожидание присоединения игроков...",

        // Reveal notifications
        playerRevealedNotification: "🎭 {playerName} раскрыл своего персонажа: \"{character}\"",

        // UI messages
        noPlayersYet: "Игроков пока нет",
        yourCharacterClickReveal: "Ваш персонаж - нажмите, чтобы раскрыть!",
        yourCharacterHidden: "Ваш персонаж скрыт от вас!",
        yourRevealedCharacter: "Ваш раскрытый персонаж",
        characterRevealedByPlayer: "Персонаж раскрыт игроком",
        assignCharacter: "Назначить персонажа",
        someoneNeedsToAssign: "Кто-то должен назначить вам персонажа!",
        copiedSuccess: "✅ Скопировано!",

        // Error messages
        invalidRoomCode: "Неверный код комнаты",
        invalidRoomCodeFormat: "Неверный формат кода комнаты",
        failedJoinGame: "Не удалось присоединиться к игре",
        failedRecoverGame: "Не удалось восстановить игру",
        connectionErrorTryAgain: "Попробуйте еще раз.",
        pleaseCreateNewRoom: "Пожалуйста, создайте новую комнату.",

        // Language switcher
        language: "Язык",
        english: "English",
        russian: "Русский",

        // Dynamic UI updates
        roomCodeJoining: "Код комнаты (присоединение к игре)",
        clearRoomCodeToCreate: "Очистите код комнаты для создания новой игры",
        creating: "Создание...",

        // PWA messages
        updateAvailable: "🆕 Доступно обновление!",
        updateDescription: "Новая версия приложения готова. Перезагрузите, чтобы получить последние функции.",
        updateNow: "Обновить сейчас"
    }
};

// Localization system
class Localization {
    constructor() {
        this.currentLanguage = this.detectLanguage();
        this.init();
    }
    
    detectLanguage() {
        // Check for saved language preference first
        const savedLang = localStorage.getItem('whoami-language');
        if (savedLang && translations[savedLang]) {
            return savedLang;
        }
        
        // Auto-detect from browser locale
        const browserLang = navigator.language || navigator.userLanguage || 'en';
        const langCode = browserLang.toLowerCase().substring(0, 2);
        
        // Return supported language or default to English
        return translations[langCode] ? langCode : 'en';
    }
    
    init() {
        this.updateTexts();
        this.createLanguageSwitcher();
    }
    
    setLanguage(lang) {
        if (!translations[lang]) return;
        
        this.currentLanguage = lang;
        localStorage.setItem('whoami-language', lang);
        this.updateTexts();
        this.updateLanguageSwitcher();
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
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.getText(key);
        });
        
        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.getText(key);
        });
        
        // Update titles
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.getText(key);
        });
        
        // Update page title
        const titleElement = document.querySelector('title');
        if (titleElement && titleElement.hasAttribute('data-i18n')) {
            const key = titleElement.getAttribute('data-i18n');
            titleElement.textContent = this.getText(key);
        }
    }
    
    createLanguageSwitcher() {
        // Create single toggle button HTML
        const switcherHTML = `
            <div class="language-switcher mt-3 text-center">
                <button class="btn btn-sm btn-outline-light lang-toggle-btn">
                    <span class="lang-toggle-text"></span>
                </button>
            </div>
        `;
        
        // Find container and add switcher
        const container = document.querySelector('.container');
        if (container) {
            container.insertAdjacentHTML('beforeend', switcherHTML);
            
            // Add click handler to toggle button
            const toggleBtn = container.querySelector('.lang-toggle-btn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    // Switch to opposite language
                    const newLang = this.currentLanguage === 'en' ? 'ru' : 'en';
                    this.setLanguage(newLang);
                });
            }
            
            this.updateLanguageSwitcher();
        }
    }
    
    updateLanguageSwitcher() {
        // Update toggle button text to show opposite language with flag
        const toggleText = document.querySelector('.lang-toggle-text');
        if (toggleText) {
            // If current language is English, show "🇷🇺 Русский" button
            // If current language is Russian, show "🇬🇧 English" button
            if (this.currentLanguage === 'en') {
                toggleText.innerHTML = '🇷🇺 Русский';
            } else {
                toggleText.innerHTML = '🇬🇧 English';
            }
        }
    }
}

// Initialize localization when page loads
let i18n;
document.addEventListener('DOMContentLoaded', () => {
    i18n = new Localization();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { translations, Localization };
}