// Who am I? Game - PWA Installation and Service Worker Management

class PWAManager {
    constructor() {
        this.init();
    }

    init() {
        // Register service worker
        this.registerServiceWorker();

        // Check if already installed (for logging purposes)
        this.checkInstallation();
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker registered successfully:', registration.scope);

                // Handle updates
                registration.addEventListener('updatefound', () => {
                    console.log('🔄 New service worker version available');
                    const newWorker = registration.installing;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateAvailable();
                        }
                    });
                });

                // Start auto-update checking
                this.startUpdateChecking(registration);

            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
            }
        } else {
            console.log('🚫 Service Worker not supported');
        }
    }

    // Install prompt functionality removed - no longer needed

    checkInstallation() {
        // Check if running in standalone mode (for logging purposes)
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
            console.log('📱 App is running in standalone mode');
        }

        // Check if running as PWA on iOS
        if (window.navigator.standalone) {
            console.log('🍎 App is running in iOS standalone mode');
        }
    }

    // Install banner functionality removed - no longer needed

    // Install-related methods removed - no longer needed

    // Auto-update checking
    startUpdateChecking(registration) {
        // Check for updates every 30 seconds (silently - no console spam)
        setInterval(() => {
            registration.update();
        }, 30000);

        // Also check when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                registration.update();
            }
        });
    }

    // Show update available notification
    showUpdateAvailable() {
        console.log('🆕 App update is available!');

        const updateBanner = document.createElement('div');
        updateBanner.className = 'alert alert-warning alert-dismissible fade show';

        // Get localized text (fallback to English if i18n not available)
        const updateAvailableText = (typeof i18n !== 'undefined' && i18n) ? i18n.getText('updateAvailable') : '🆕 Update Available!';
        const updateDescriptionText = (typeof i18n !== 'undefined' && i18n) ? i18n.getText('updateDescription') : 'A new version of the app is ready. Reload to get the latest features.';
        const updateNowText = (typeof i18n !== 'undefined' && i18n) ? i18n.getText('updateNow') : 'Update Now';

        updateBanner.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="flex-grow-1">
                    <strong>${updateAvailableText}</strong><br>
                    <small>${updateDescriptionText}</small>
                </div>
                <div class="ms-3">
                    <button type="button" class="btn btn-warning btn-sm" onclick="window.location.reload()">
                        ${updateNowText}
                    </button>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        const container = document.querySelector('.container');
        if (container) {
            container.insertAdjacentElement('afterbegin', updateBanner);
        }
    }

    // Force update method
    async forceUpdate() {
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                console.log('🔄 Forcing service worker update...');
                await registration.update();

                // Send message to service worker to skip waiting
                if (registration.waiting) {
                    registration.waiting.postMessage('CHECK_UPDATE');
                }

                // Reload page after a short delay
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (error) {
            console.error('❌ Error forcing update:', error);
        }
    }

    // Install functionality removed - PWA still works, just no banner prompts
}

// Initialize PWA manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.pwaManager = new PWAManager();
});

// Make PWA manager available globally
window.PWAManager = PWAManager;

// Global helper function for force updates (can be called from console)
window.forceAppUpdate = () => {
    if (window.pwaManager) {
        window.pwaManager.forceUpdate();
    } else {
        console.log('PWA Manager not initialized yet');
    }
};