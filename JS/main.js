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
    // Ensure play/pause icon is in sync after restart
    if (typeof syncPlayPauseIcon === 'function') syncPlayPauseIcon();
});
document.getElementById('btnOverlayRestart').addEventListener('click', () => {
    if (window.restart) window.restart();
    if (typeof syncPlayPauseIcon === 'function') syncPlayPauseIcon();
});

const bgm = document.getElementById('bgm');
// Use a single global flag for music preference
window._bgmUserOn = !!window._bgmUserOn;
document.getElementById('btnMusic').addEventListener('click', () => {
    if (!bgm || !bgm.src) {
        alert('No music source set. Add a file URL to the <audio> element src attribute in the code to enable music.');
        return;
    }
    const iconMusic = document.getElementById('iconMusic');
    if (!window._bgmUserOn) {
        bgm.play().then(function(){
            window._bgmUserOn = true;
            if (iconMusic) { iconMusic.classList.remove('fa-volume-xmark','fa-volume-off'); iconMusic.classList.add('fa-volume-high'); }
        }).catch(function(err){
            console.warn('BGM play blocked or failed', err);
            window._bgmUserOn = false;
            if (iconMusic) { iconMusic.classList.remove('fa-volume-high'); iconMusic.classList.add('fa-volume-xmark'); }
        });
    } else {
        try { bgm.pause(); } catch(e){}
        window._bgmUserOn = false;
        if (iconMusic) { iconMusic.classList.remove('fa-volume-high'); iconMusic.classList.add('fa-volume-off'); }
    }
});

// If the engine exposes togglePause later, wrap it so BGM respects pause state
function wrapTogglePause(){
    try{
        if (typeof window.togglePause === 'function' && !window._togglePauseWrapped){
            var orig = window.togglePause;
            window.togglePause = function(){
                var res = orig.apply(this, arguments);
                // If music is user-enabled, pause/resume with the game
                try{
                    if (window._bgmUserOn && bgm) {
                        if (window.paused) {
                            try { bgm.pause(); } catch(e){}
                        } else {
                            bgm.play().then(function(){
                                // no-op, play succeeded
                            }).catch(function(err){
                                console.warn('BGM play blocked or failed in togglePause wrapper', err);
                                window._bgmUserOn = false;
                                var iconMusic = document.getElementById('iconMusic'); if (iconMusic) { iconMusic.classList.remove('fa-volume-high'); iconMusic.classList.add('fa-volume-off'); }
                            });
                        }
                    }
                }catch(e){}
                return res;
            };
            window._togglePauseWrapped = true;
            return true;
        }
    }catch(e){}
    return false;
}
if (!wrapTogglePause()){
    var tpCheck = setInterval(function(){ if (wrapTogglePause()){ clearInterval(tpCheck); } }, 120);
}