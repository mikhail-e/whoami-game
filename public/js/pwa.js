// Who am I? Game - PWA Installation and Service Worker Management

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.installButton = null;

        this.init();
    }

    init() {
        // Register service worker
        this.registerServiceWorker();

        // Set up install prompt
        this.setupInstallPrompt();

        // Check if already installed
        this.checkInstallation();

        // Create install button
        this.createInstallButton();
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

    setupInstallPrompt() {
        // Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('💾 Install prompt available');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        // Listen for successful installation
        window.addEventListener('appinstalled', () => {
            console.log('🎉 App installed successfully!');
            this.deferredPrompt = null;
            this.isInstalled = true;
            this.hideInstallButton();
            this.showInstalledMessage();
        });
    }

    checkInstallation() {
        // Check if running in standalone mode (installed)
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
            console.log('📱 App is running in standalone mode');
        }

        // Check if running as PWA on iOS
        if (window.navigator.standalone) {
            this.isInstalled = true;
            console.log('🍎 App is running in iOS standalone mode');
        }
    }

    createInstallButton() {
        // Create install button HTML
        const installButtonHTML = `
            <div id="pwa-install-banner" class="alert alert-info alert-dismissible d-none" role="alert">
                <div class="d-flex align-items-center">
                    <div class="flex-grow-1">
                        <strong>📱 Install App</strong><br>
                        <small>Get the best experience - install "Who am I?" on your device!</small>
                    </div>
                    <div class="ms-3">
                        <button type="button" class="btn btn-primary btn-sm" id="pwa-install-button">
                            Install
                        </button>
                    </div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

        // Add to page
        const container = document.querySelector('.container');
        if (container) {
            container.insertAdjacentHTML('afterbegin', installButtonHTML);

            this.installButton = document.getElementById('pwa-install-button');
            this.installBanner = document.getElementById('pwa-install-banner');

            // Add click handler
            if (this.installButton) {
                this.installButton.addEventListener('click', () => this.showInstallPrompt());
            }
        }
    }

    showInstallButton() {
        if (this.installBanner && !this.isInstalled) {
            this.installBanner.classList.remove('d-none');
        }
    }

    hideInstallButton() {
        if (this.installBanner) {
            this.installBanner.classList.add('d-none');
        }
    }

    async showInstallPrompt() {
        if (!this.deferredPrompt) {
            console.log('⚠️ No install prompt available');
            return;
        }

        try {
            // Show the install prompt
            this.deferredPrompt.prompt();

            // Wait for user response
            const choiceResult = await this.deferredPrompt.userChoice;

            if (choiceResult.outcome === 'accepted') {
                console.log('✅ User accepted the install prompt');
            } else {
                console.log('❌ User dismissed the install prompt');
            }

            this.deferredPrompt = null;
            this.hideInstallButton();

        } catch (error) {
            console.error('❌ Error showing install prompt:', error);
        }
    }

    showInstalledMessage() {
        // Show success message
        const message = document.createElement('div');
        message.className = 'alert alert-success alert-dismissible fade show';
        message.innerHTML = `
            🎉 <strong>Successfully installed!</strong>
            You can now find "Who am I?" on your home screen.
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        const container = document.querySelector('.container');
        if (container) {
            container.insertAdjacentElement('afterbegin', message);

            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (message.parentNode) {
                    message.remove();
                }
            }, 5000);
        }
    }

    // Auto-update checking
    startUpdateChecking(registration) {
        // Check for updates every 30 seconds
        setInterval(() => {
            console.log('🔍 Checking for app updates...');
            registration.update();
        }, 30000);

        // Also check when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('🔍 Page visible, checking for updates...');
                registration.update();
            }
        });
    }

    // Show update available notification
    showUpdateAvailable() {
        console.log('🆕 App update is available!');

        const updateBanner = document.createElement('div');
        updateBanner.className = 'alert alert-warning alert-dismissible fade show';
        updateBanner.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="flex-grow-1">
                    <strong>🆕 Update Available!</strong><br>
                    <small>A new version of the app is ready. Reload to get the latest features.</small>
                </div>
                <div class="ms-3">
                    <button type="button" class="btn btn-warning btn-sm" onclick="window.location.reload()">
                        Update Now
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

    // Public method to manually trigger install
    triggerInstall() {
        this.showInstallPrompt();
    }
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