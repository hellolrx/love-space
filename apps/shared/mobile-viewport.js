(function setupLoveSpaceViewport() {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    let baselineHeight = Math.round(viewport?.height || window.innerHeight);

    function hasFocusedEditor() {
        const active = document.activeElement;
        return active instanceof HTMLElement && active.matches('input, textarea, select, [contenteditable="true"]');
    }

    function applyViewportMetrics() {
        frame = 0;

        const height = Math.round(viewport?.height || window.innerHeight);
        const width = Math.round(viewport?.width || window.innerWidth);
        const offsetTop = Math.round(viewport?.offsetTop || 0);
        const offsetLeft = Math.round(viewport?.offsetLeft || 0);
        const layoutHeight = Math.round(window.innerHeight);
        const keyboardHeight = Math.max(0, layoutHeight - height - offsetTop);
        const focusedEditor = hasFocusedEditor();

        if (!focusedEditor) baselineHeight = Math.max(baselineHeight, height);
        const keyboardOpen = focusedEditor && (keyboardHeight > 80 || height < baselineHeight - 80);

        root.style.setProperty('--visual-viewport-height', `${height}px`);
        root.style.setProperty('--visual-viewport-width', `${width}px`);
        root.style.setProperty('--visual-viewport-top', `${offsetTop}px`);
        root.style.setProperty('--visual-viewport-left', `${offsetLeft}px`);
        root.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
        root.classList.toggle('keyboard-open', keyboardOpen);
    }

    function requestUpdate() {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(applyViewportMetrics);
    }

    viewport?.addEventListener('resize', requestUpdate);
    viewport?.addEventListener('scroll', requestUpdate);
    window.addEventListener('resize', requestUpdate);
    window.addEventListener('orientationchange', requestUpdate);
    document.addEventListener('focusin', () => {
        requestUpdate();
        setTimeout(requestUpdate, 80);
        setTimeout(requestUpdate, 260);
    });
    document.addEventListener('focusout', () => {
        setTimeout(requestUpdate, 80);
        setTimeout(requestUpdate, 260);
    });

    applyViewportMetrics();
})();
