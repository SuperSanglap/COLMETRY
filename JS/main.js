// Gameplay menu and audio controls. The game engine itself remains in script.js.
(function () {
    const byId = (id) => document.getElementById(id);
    const menuButton = byId('btnMenu');
    const menu = byId('pauseMenu');
    const menuScrim = byId('menuScrim');
    const resumeButton = byId('menuResume');
    const restartButton = byId('menuRestart');
    const homeButton = byId('menuHome');
    const creditsButton = byId('menuCredits');
    const creditsPanel = byId('menuCreditsPanel');
    const musicButton = byId('menuMusic');
    const musicLabel = byId('menuMusicLabel');
    const musicIcon = byId('iconMusic');
    const bgm = byId('bgm');
    const homeMusicButton = byId('homeMusic');
    const homeMusicIcon = byId('homeMusicIcon');
    const homeSoundButton = byId('homeSound');
    const guideButton = byId('guideBtn');
    const creditsHomeButton = byId('creditsBtn');
    const guideModal = byId('guideModal');
    const creditsModal = byId('creditsModal');
    const homeModals = [guideModal, creditsModal].filter(Boolean);

    window._bgmUserOn = !!window._bgmUserOn;
    window._soundUserOn = window._soundUserOn !== false;

    function applySoundPreference() {
        // This covers the current music track and provides one master preference
        // for any game sound effects added later.
        document.querySelectorAll('audio').forEach((audio) => {
            audio.muted = !window._soundUserOn;
        });
    }

    function syncMusicControl() {
        const isOn = !!window._bgmUserOn;
        if (musicLabel) musicLabel.textContent = `Music: ${isOn ? 'On' : 'Off'}`;
        if (musicIcon) {
            musicIcon.classList.toggle('fa-volume-high', isOn);
            musicIcon.classList.toggle('fa-volume-xmark', !isOn);
            musicIcon.classList.remove('fa-volume-off');
        }
        if (homeMusicButton) {
            homeMusicButton.setAttribute('aria-pressed', String(isOn));
            homeMusicButton.setAttribute('aria-label', `Turn music ${isOn ? 'off' : 'on'}`);
            homeMusicButton.title = `Music ${isOn ? 'on' : 'off'}`;
        }
        if (homeMusicIcon) {
            homeMusicIcon.classList.add('fa-music');
        }
        if (homeSoundButton) {
            homeSoundButton.setAttribute('aria-pressed', String(!!window._soundUserOn));
            homeSoundButton.setAttribute('aria-label', `Turn sound ${window._soundUserOn ? 'off' : 'on'}`);
            homeSoundButton.title = `Sound ${window._soundUserOn ? 'on' : 'off'}`;
        }
    }

    function setHomeModal(modal, isOpen) {
        if (!modal) return;
        modal.hidden = !isOpen;
        if (isOpen) {
            const closeButton = modal.querySelector('[data-home-modal-close]');
            if (closeButton) closeButton.focus();
        }
    }

    function setMenuOpen(isOpen) {
        if (!menu || !menuScrim || !menuButton) return;
        menu.classList.toggle('is-open', isOpen);
        menuScrim.classList.toggle('is-open', isOpen);
        menu.setAttribute('aria-hidden', String(!isOpen));
        menuScrim.setAttribute('aria-hidden', String(!isOpen));
        menuButton.setAttribute('aria-expanded', String(isOpen));
        menuButton.setAttribute('aria-label', isOpen ? 'Game menu open' : 'Open game menu');
    }

    function openGameMenu() {
        if (window.gameOver) return;
        if (!window.paused && typeof window.togglePause === 'function') window.togglePause();
        setMenuOpen(true);
    }

    function closeGameMenu() {
        setMenuOpen(false);
        if (window.paused && !window.gameOver && typeof window.togglePause === 'function') window.togglePause();
    }

    window.syncPlayPauseIcon = function syncPlayPauseIcon() {
        if (menuButton) menuButton.classList.toggle('is-paused', !!window.paused);
        syncMusicControl();
    };

    function toggleMusic() {
        if (!bgm || !bgm.src) return;
        if (window._bgmUserOn) {
            window._bgmUserOn = false;
            try { bgm.pause(); } catch (e) { /* ignored */ }
            syncMusicControl();
            return;
        }

        // Remember the preference while paused; playback resumes with the game.
        if (window.paused) {
            window._bgmUserOn = true;
            syncMusicControl();
            return;
        }

        bgm.play().then(() => {
            window._bgmUserOn = true;
            syncMusicControl();
        }).catch(() => {
            window._bgmUserOn = false;
            syncMusicControl();
        });
    }

    function toggleSound() {
        window._soundUserOn = !window._soundUserOn;
        applySoundPreference();
        syncMusicControl();
    }

    if (bgm) {
        applySoundPreference();
        bgm.addEventListener('play', () => {
            window._bgmUserOn = true;
            syncMusicControl();
        });
    }

    // Keep the existing pause behavior, adding only music and menu-state handling.
    if (typeof window.togglePause === 'function' && !window._togglePauseWrapped) {
        const engineTogglePause = window.togglePause;
        window.togglePause = function () {
            const result = engineTogglePause.apply(this, arguments);
            if (bgm && window._bgmUserOn) {
                if (window.paused) {
                    try { bgm.pause(); } catch (e) { /* ignored */ }
                } else {
                    bgm.play().catch(() => {
                        window._bgmUserOn = false;
                        syncMusicControl();
                    });
                }
            }
            window.syncPlayPauseIcon();
            return result;
        };
        window._togglePauseWrapped = true;
    }

    if (menuButton) menuButton.addEventListener('click', openGameMenu);
    if (resumeButton) resumeButton.addEventListener('click', closeGameMenu);
    if (menuScrim) menuScrim.addEventListener('click', closeGameMenu);
    if (restartButton) restartButton.addEventListener('click', () => {
        setMenuOpen(false);
        if (typeof window.restart === 'function') window.restart();
        window.syncPlayPauseIcon();
    });
    if (homeButton) homeButton.addEventListener('click', () => window.location.reload());
    if (creditsButton) creditsButton.addEventListener('click', () => {
        const willShow = creditsPanel && creditsPanel.hidden;
        if (creditsPanel) creditsPanel.hidden = !willShow;
        creditsButton.setAttribute('aria-expanded', String(!!willShow));
    });
    if (musicButton) musicButton.addEventListener('click', toggleMusic);
    if (homeMusicButton) homeMusicButton.addEventListener('click', toggleMusic);
    if (homeSoundButton) homeSoundButton.addEventListener('click', toggleSound);
    if (guideButton) guideButton.addEventListener('click', () => setHomeModal(guideModal, true));
    if (creditsHomeButton) creditsHomeButton.addEventListener('click', () => setHomeModal(creditsModal, true));
    homeModals.forEach((modal) => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal || event.target.closest('[data-home-modal-close]')) setHomeModal(modal, false);
        });
    });

    const overlayHome = byId('btnOverlayHome');
    if (overlayHome) overlayHome.addEventListener('click', () => window.location.reload());
    const overlayRestart = byId('btnOverlayRestart');
    if (overlayRestart) overlayRestart.addEventListener('click', () => {
        if (typeof window.restart === 'function') window.restart();
        window.syncPlayPauseIcon();
    });

    function isFullscreen() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }

    // Browsers reserve Escape to leave fullscreen. When that happens before the
    // keydown reaches the page, this still pauses the game and shows the menu.
    function pauseAfterFullscreenExit() {
        if (!isFullscreen() && !window._coloroidGameBlocked && !window.gameOver && !window.paused) {
            openGameMenu();
        }
    }

    document.addEventListener('fullscreenchange', pauseAfterFullscreenExit);
    document.addEventListener('webkitfullscreenchange', pauseAfterFullscreenExit);

    document.addEventListener('keydown', (event) => {
        const openHomeModal = homeModals.find((modal) => !modal.hidden);
        if (event.key === 'Escape' && openHomeModal) {
            event.preventDefault();
            setHomeModal(openHomeModal, false);
            return;
        }
        if (event.key !== 'Escape' || event.repeat || window._coloroidGameBlocked || window.gameOver) return;
        event.preventDefault();
        // If the browser allows this event through while fullscreen, always keep
        // the menu open; the subsequent fullscreen exit event becomes a no-op.
        if (isFullscreen()) {
            openGameMenu();
            return;
        }
        if (menu && menu.classList.contains('is-open')) closeGameMenu();
        else openGameMenu();
    });

    syncMusicControl();
}());
