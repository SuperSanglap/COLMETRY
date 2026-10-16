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

    window._bgmUserOn = !!window._bgmUserOn;

    function syncMusicControl() {
        const isOn = !!window._bgmUserOn;
        if (musicLabel) musicLabel.textContent = `Music: ${isOn ? 'On' : 'Off'}`;
        if (musicIcon) {
            musicIcon.classList.toggle('fa-volume-high', isOn);
            musicIcon.classList.toggle('fa-volume-xmark', !isOn);
            musicIcon.classList.remove('fa-volume-off');
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

    if (bgm) {
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

    const overlayHome = byId('btnOverlayHome');
    if (overlayHome) overlayHome.addEventListener('click', () => window.location.reload());
    const overlayRestart = byId('btnOverlayRestart');
    if (overlayRestart) overlayRestart.addEventListener('click', () => {
        if (typeof window.restart === 'function') window.restart();
        window.syncPlayPauseIcon();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || event.repeat || window._coloroidGameBlocked || window.gameOver) return;
        event.preventDefault();
        if (menu && menu.classList.contains('is-open')) closeGameMenu();
        else openGameMenu();
    });

    syncMusicControl();
}());
