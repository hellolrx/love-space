import { LoadingScreen } from '../load/loading.js?v=load-4';

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function splitLetter(text) {
    const blocks = text
        .replace(/\r\n/g, '\n')
        .split(/\n\s*\n+/)
        .map(block => block
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .join('')
        )
        .filter(Boolean);

    const salutation = blocks.shift() || '';
    const signatureLines = blocks.splice(Math.max(blocks.length - 2, 0));

    return { salutation, paragraphs: blocks, signatureLines };
}

function renderLetter(text) {
    const content = document.getElementById('letter-content');
    const { salutation, paragraphs, signatureLines } = splitLetter(text);

    const html = [
        salutation ? `<p class="letter-salutation">${escapeHtml(salutation)}</p>` : '',
        ...paragraphs.map(paragraph => `<p class="letter-paragraph">${escapeHtml(paragraph)}</p>`),
        signatureLines.length
            ? `<p class="letter-signature">${signatureLines.map(escapeHtml).join('<br>')}</p>`
            : ''
    ].join('');

    content.innerHTML = html || '<p class="error">信纸里暂时没有内容。</p>';
}

async function loadLetter() {
    const content = document.getElementById('letter-content');

    try {
        const response = await fetch(`togigi.txt?v=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        renderLetter(await response.text());
    } catch (error) {
        content.innerHTML = '<p class="error">信件读取失败，请通过本地服务打开这个页面。</p>';
        console.error('Failed to load letter:', error);
    }
}

LoadingScreen.withLoading(loadLetter).catch((error) => {
    console.error('Failed to initialize letter:', error);
});
