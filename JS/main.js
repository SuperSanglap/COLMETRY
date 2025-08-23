document.getElementById('btnPause').addEventListener('click', () => {
    if (window.togglePause) window.togglePause();
});
document.getElementById('btnRestart').addEventListener('click', () => {
    if (window.restart) window.restart();
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
    if (!musicOn) {
        bgm.play().catch(() => { });
        musicOn = true;
        document.getElementById('btnMusic').textContent = 'Music:On';
    } else {
        bgm.pause();
        musicOn = false;
        document.getElementById('btnMusic').textContent = 'Music';
    }
});