// Overlay Home button event
document.getElementById('btnOverlayHome').addEventListener('click', () => {
    window.location.reload();
});
document.getElementById('btnPause').addEventListener('click', () => {
    if (window.togglePause) window.togglePause();
    syncPlayPauseIcon();
});

window.syncPlayPauseIcon = function syncPlayPauseIcon() {
    const faPause = document.getElementById('faPause');
    const faPlay = document.getElementById('faPlay');
    if (window.paused) {
        if (faPause) faPause.style.display = 'none';
        if (faPlay) faPlay.style.display = 'inline-block';
    } else {
        if (faPause) faPause.style.display = 'inline-block';
        if (faPlay) faPlay.style.display = 'none';
    }
};
document.getElementById('btnRetry').addEventListener('click', () => {
    if (window.restart) window.restart();
    // Animate retry icon
    const iconRetry = document.getElementById('iconRetry');
    if (iconRetry) {
        iconRetry.style.transform = 'rotate(-360deg)';
        iconRetry.style.transition = 'transform 0.4s';
        setTimeout(() => {
            iconRetry.style.transform = '';
            iconRetry.style.transition = '';
        }, 400);
    }
});
document.getElementById('btnOverlayRestart').addEventListener('click', () => {
    if (window.restart) window.restart();
});

const bgm = document.getElementById('bgm');
let musicOn = false;
document.getElementById('btnMusic').addEventListener('click', () => {
    if (!bgm.src) {
        alert('No music source set. Add a file URL to the <audio> element src attribute in the code to enable music.');
        return;
    }
    const iconMusic = document.getElementById('iconMusic');
    if (!musicOn) {
        bgm.play().catch(() => { });
        musicOn = true;
        if (iconMusic) iconMusic.textContent = '🔊';
    } else {
        bgm.pause();
        musicOn = false;
        if (iconMusic) iconMusic.textContent = '🔈';
    }
});