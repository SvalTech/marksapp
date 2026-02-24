// NTA Mock Interface Injector

// --- STATE MANAGEMENT ---
let questionSequence = JSON.parse(sessionStorage.getItem('nta_seq')) || [];
let questionStates = JSON.parse(sessionStorage.getItem('nta_states')) || {};
let currentUrl = normalizeUrl(window.location.href);

// Accessibility & UI States
let isDarkMode = false;
let currentFontScale = 1;
let isCursorTrailEnabled = false;
let currentCursorSize = 'normal';
let isMagnifierActive = false;
let isNumpadHiddenByUser = false;

function saveState() {
    sessionStorage.setItem('nta_seq', JSON.stringify(questionSequence));
    sessionStorage.setItem('nta_states', JSON.stringify(questionStates));

    chrome.storage.sync.set({
        ntaDarkMode: isDarkMode,
        ntaFontScale: currentFontScale,
        ntaCursorTrail: isCursorTrailEnabled,
        ntaCursorSize: currentCursorSize
    });
}

function normalizeUrl(url) {
    return url.split('?')[0].replace(/\/$/, "");
}

function isQuestionPage() {
    return document.querySelector('.question-options, .question-body, button[role="radio"], div[role="radio"]') !== null;
}

function isOptionSelected() {
    if (document.querySelector('input[type="radio"]:checked')) return true;
    if (document.querySelector('[aria-checked="true"]')) return true;
    if (document.querySelector('.bg-blue-500, .bg-blue-600, .border-blue-500, [class*="selected"], [data-selected="true"]')) return true;

    const textInputs = document.querySelectorAll('#__next input[type="text"], #__next input[type="number"]');
    for (let input of textInputs) {
        if (input.value && input.value.trim() !== '') {
            return true;
        }
    }
    return false;
}

function syncQuestionList() {
    const currentNUrl = normalizeUrl(window.location.href);
    let listChanged = false;

    if (questionSequence.length === 0 && isQuestionPage()) {
        questionSequence.push(currentNUrl);
        questionStates[currentNUrl] = 'not-answered';
        listChanged = true;
    }

    const links = Array.from(document.querySelectorAll('a[href]')).filter(link => {
        const text = (link.innerText || '').trim();
        const href = link.getAttribute('href') || '';
        const isNumericLink = /^\d+$/.test(text);
        const isKnownPath = /\/(question|marks-selected|custom-test|test|bookmark)\//i.test(href);
        return (isNumericLink || isKnownPath) && href.length > 10;
    });

    links.forEach(link => {
        const nUrl = normalizeUrl(link.href);
        if (!questionSequence.includes(nUrl)) {
            questionSequence.push(nUrl);
            questionStates[nUrl] = 'not-visited';
            listChanged = true;
        }
    });

    if (isQuestionPage() && !questionSequence.includes(currentNUrl)) {
        questionSequence.push(currentNUrl);
        listChanged = true;
    }

    if (isQuestionPage() && (!questionStates[currentNUrl] || questionStates[currentNUrl] === 'not-visited')) {
        questionStates[currentNUrl] = 'not-answered';
        listChanged = true;
    }

    currentUrl = currentNUrl;
    if (listChanged) saveState();
    return listChanged;
}

function renderPalette() {
    const paletteContainer = document.querySelector('.nta-palette-grid');
    if (!paletteContainer) return;

    paletteContainer.innerHTML = '';
    let counts = { 'answered': 0, 'not-answered': 0, 'not-visited': 0, 'marked': 0 };

    if (questionSequence.length > 0) {
        questionSequence.forEach((url, index) => {
            const qNum = index + 1;
            const badge = document.createElement('div');
            let state = questionStates[url] || 'not-visited';
            if (state === 'ans-marked') state = 'marked';

            if (counts[state] !== undefined) counts[state]++;

            badge.className = `nta-badge badge-${state}`;
            badge.innerText = qNum;

            if (url === currentUrl) badge.classList.add('badge-active');

            badge.onclick = (e) => {
                e.preventDefault();
                const linkPath = new URL(url).pathname;
                const nativeLink = document.querySelector(`a[href*="${linkPath}"]`);
                if (nativeLink) {
                    nativeLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                } else {
                    window.location.href = url;
                }
            };
            paletteContainer.appendChild(badge);
        });
    }

    Object.keys(counts).forEach(key => {
        const countSpan = document.getElementById(`leg-${key}`);
        if (countSpan) countSpan.innerText = counts[key];
        const badgeDiv = document.querySelector(`.legend-item .badge-${key}`);
        if (badgeDiv) badgeDiv.innerText = counts[key];
    });
}

function scrollToTop() {
    const container = document.getElementById('__next');
    if (container) container.scrollTo({ top: 0, behavior: 'instant' });
}

function safeReactClick(el) {
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
    return true;
}

function clickNativeButton(keywords) {
    const elements = Array.from(document.querySelectorAll('button, div[role="button"], a, .cursor-pointer'));
    for (let el of elements) {
        const text = (el.innerText || el.textContent || '').toLowerCase().trim();
        if (text && keywords.some(kw => text === kw || text.includes(kw))) {
            safeReactClick(el);
            scrollToTop();
            return true;
        }
    }
    return false;
}

function showCustomAlert(msg) {
    const alertBox = document.getElementById('nta-custom-alert');
    const msgBox = document.getElementById('nta-alert-msg');
    if (alertBox && msgBox) {
        msgBox.innerText = msg;
        alertBox.classList.add('open');
    } else {
        alert(msg);
    }
}

function handleSaveAndNext() {
    if (isQuestionPage()) {
        if (questionStates[currentUrl] !== 'answered' || isOptionSelected()) {
            questionStates[currentUrl] = isOptionSelected() ? 'answered' : 'not-answered';
        }
        saveState();
    }
    renderPalette();
    if (!clickNativeButton(['save & next', 'next >', 'next'])) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }));
        scrollToTop();
    }
}

function handleReviewAndNext() {
    if (isQuestionPage()) {
        questionStates[currentUrl] = 'marked';
        saveState();
    }
    renderPalette();
    if (!clickNativeButton(['save & next', 'next >', 'next'])) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }));
        scrollToTop();
    }
}

function handleClearResponse() {
    const selectedNative = document.querySelector('input[type="radio"]:checked, [aria-checked="true"], .bg-blue-500, .bg-blue-600, .border-blue-500, [class*="selected"], [data-selected="true"]');
    if (selectedNative) safeReactClick(selectedNative);

    const textInputs = document.querySelectorAll('#__next input[type="text"], #__next input[type="number"]');
    for (let input of textInputs) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (isQuestionPage()) {
        questionStates[currentUrl] = 'not-answered';
        saveState();
    }
    renderPalette();
    clickNativeButton(['clear response', 'clear']);
}

function handlePrevious() {
    if (!clickNativeButton(['< prev', 'previous', 'back', 'prev'])) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', keyCode: 37, bubbles: true }));
        scrollToTop();
    }
}

function handleSubmit() {
    if (isQuestionPage()) {
        if (!isOptionSelected()) {
            showCustomAlert("Please select an option or enter a value before submitting.");
            return;
        }
        questionStates[currentUrl] = 'answered';
        saveState();
        renderPalette();
    }
    clickNativeButton(['show solution', 'submit', 'submit test', 'check answer', 'check']);
}

function handleTopBack() {
    // Just turn off the NTA Mode interface
    chrome.storage.sync.set({ ntaModeEnabled: false });
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

function toggleSidebar() {
    document.body.classList.toggle('nta-sidebar-collapsed');
}

function checkAndInjectNumpad() {
    if (!document.body.classList.contains('nta-mode')) return;
    const numInput = document.querySelector('#__next input[type="number"], #__next input[type="text"]');
    const numpad = document.getElementById('nta-virtual-numpad');
    const showBtn = document.getElementById('nta-show-numpad-btn');

    if (numInput && isQuestionPage()) {
        window.activeNtaInput = numInput;
        if (isNumpadHiddenByUser) {
            if (numpad) numpad.style.display = 'none';
            if (showBtn) showBtn.style.display = 'flex';
        } else {
            if (numpad) numpad.style.display = 'flex';
            if (showBtn) showBtn.style.display = 'none';
        }
    } else {
        window.activeNtaInput = null;
        if (numpad) numpad.style.display = 'none';
        if (showBtn) showBtn.style.display = 'none';
    }
}

function hideNumpad() {
    isNumpadHiddenByUser = true;
    checkAndInjectNumpad();
}

function showNumpad() {
    isNumpadHiddenByUser = false;
    checkAndInjectNumpad();
}

function handleNumpadClick(key) {
    const input = window.activeNtaInput;
    if (!input) return;

    let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    let currentValue = String(input.value || "");
    let newValue;

    if (key === 'BACKSPACE') {
        newValue = currentValue.slice(0, -1);
    } else if (key === 'CLEAR') {
        newValue = '';
    } else if (key === '.') {
        if (!currentValue.includes('.')) newValue = currentValue + '.';
        else newValue = currentValue;
    } else {
        newValue = currentValue + key;
    }

    nativeInputValueSetter.call(input, newValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}


function toggleMagnifier() {
    isMagnifierActive = !isMagnifierActive;
    const btn = document.getElementById('nta-btn-magnifier');
    const lensContent = document.getElementById('nta-magnifier-content');
    const mainContent = document.getElementById('__next');

    if (isMagnifierActive) {
        document.body.classList.add('nta-magnifier-active');
        if (btn) btn.classList.add('active');
        if (!document.body.classList.contains('nta-sidebar-collapsed')) {
            toggleSidebar();
        }

        if (mainContent && lensContent) {
            lensContent.innerHTML = mainContent.innerHTML;
            lensContent.style.width = mainContent.offsetWidth + 'px';
            lensContent.style.height = mainContent.offsetHeight + 'px';
            lensContent.style.transform = "scale(1.5)";
        }
    } else {
        document.body.classList.remove('nta-magnifier-active');
        if (btn) btn.classList.remove('active');
        if (lensContent) lensContent.innerHTML = '';
        if (document.body.classList.contains('nta-sidebar-collapsed')) {
            toggleSidebar();
        }
    }
}

let isDraggingLens = false;
let lensOffsetX, lensOffsetY;
function initLensDrag() {
    const lens = document.getElementById('nta-magnifier-lens');
    const lensContent = document.getElementById('nta-magnifier-content');
    if (!lens) return;

    lens.addEventListener('mousedown', (e) => {
        isDraggingLens = true;
        lensOffsetX = e.clientX - lens.getBoundingClientRect().left;
        lensOffsetY = e.clientY - lens.getBoundingClientRect().top;
        lens.style.cursor = 'grabbing';
    });
    window.addEventListener('mouseup', () => {
        isDraggingLens = false;
        if (lens) lens.style.cursor = 'grab';
    });
    window.addEventListener('mousemove', (e) => {
        if (!isMagnifierActive) return;
        if (isDraggingLens) {
            lens.style.left = `${e.clientX - lensOffsetX}px`;
            lens.style.top = `${e.clientY - lensOffsetY}px`;
        }
        if (lensContent) {
            const rect = lens.getBoundingClientRect();
            const ZOOM_LEVEL = 1.5;
            const shiftX = -rect.left * ZOOM_LEVEL;
            const shiftY = -rect.top * ZOOM_LEVEL;
            lensContent.style.transform = `scale(${ZOOM_LEVEL}) translate(${shiftX / ZOOM_LEVEL}px, ${shiftY / ZOOM_LEVEL}px)`;
        }
    });
}

function toggleAccessibilityMenu() {
    const menu = document.getElementById('nta-accessibility-menu');
    if (menu) menu.classList.toggle('open');
}

function applyFontScale(scale) {
    currentFontScale = scale;
    document.documentElement.style.setProperty('--nta-font-scale', currentFontScale);
    document.querySelectorAll('.acc-btn-group .btn-font-s, .acc-btn-group .btn-font-m, .acc-btn-group .btn-font-l').forEach(btn => btn.classList.remove('active'));
    if (scale === 1) document.querySelector('.btn-font-s')?.classList.add('active');
    else if (scale === 1.25) document.querySelector('.btn-font-m')?.classList.add('active');
    else if (scale === 1.5) document.querySelector('.btn-font-l')?.classList.add('active');
    saveState();
}

function applyCursorSize(size) {
    currentCursorSize = size;
    document.body.classList.remove('nta-cursor-medium', 'nta-cursor-large');
    if (size === 'medium') document.body.classList.add('nta-cursor-medium');
    if (size === 'large') document.body.classList.add('nta-cursor-large');
    document.querySelectorAll('.acc-btn-group .btn-cursor-s, .acc-btn-group .btn-cursor-m, .acc-btn-group .btn-cursor-l').forEach(btn => btn.classList.remove('active'));
    if (size === 'normal') document.querySelector('.btn-cursor-s')?.classList.add('active');
    else if (size === 'medium') document.querySelector('.btn-cursor-m')?.classList.add('active');
    else if (size === 'large') document.querySelector('.btn-cursor-l')?.classList.add('active');
    saveState();
}

function toggleCursorTrail(enable) {
    isCursorTrailEnabled = enable;
    const checkbox = document.getElementById('acc-toggle-trail');
    if (checkbox) checkbox.checked = enable;
    saveState();
}

function toggleDarkMode(enable) {
    isDarkMode = enable;
    const checkbox = document.getElementById('acc-toggle-dark');
    if (checkbox) checkbox.checked = enable;
    applyThemeData();
    saveState();
}

document.addEventListener('mousemove', (e) => {
    if (!isCursorTrailEnabled || !document.body.classList.contains('nta-mode')) return;
    if (Math.random() > 0.4) return;
    const dot = document.createElement('div');
    dot.className = 'nta-cursor-trail-dot';
    dot.style.left = `${e.clientX}px`;
    dot.style.top = `${e.clientY}px`;
    document.body.appendChild(dot);
    setTimeout(() => { dot.remove(); }, 800);
});

function loadProfileData() {
    chrome.storage.local.get(['ntaExamName', 'ntaProfileName', 'ntaProfileSubject', 'ntaProfilePic'], (res) => {
        const examEl = document.getElementById('nta-exam-name-display');
        const nameEl = document.getElementById('nta-profile-name');
        const imgEl = document.getElementById('nta-profile-img');
        if (examEl) examEl.innerText = res.ntaExamName || 'JEE Main';
        if (nameEl) nameEl.innerText = res.ntaProfileName || 'Candidate Name';
        if (imgEl && res.ntaProfilePic) imgEl.src = res.ntaProfilePic;
    });
}

// --- THIS IS THE CORRECT MODAL DETECTION LOGIC ---
let modalCheckTimeout;
function updateModalVisibility() {
    const hasHiddenOverflow = document.body.style.overflow === 'hidden';
    const portal = document.getElementById('model-portal');
    const hasPortalModal = portal && portal.children.length > 0;
    let hasMarksSidebar = false;

    const fixedElements = document.querySelectorAll('#__next .fixed');
    for (let el of fixedElements) {
        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex, 10) || 0;
        if (zIndex > 200 && style.display !== 'none' && !el.classList.contains('translate-x-full') && !el.classList.contains('translate-y-full')) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 50) {
                hasMarksSidebar = true;
                break;
            }
        }
    }

    if (hasPortalModal || hasHiddenOverflow || hasMarksSidebar) {
        document.body.classList.add('nta-ui-hidden');
    } else {
        document.body.classList.remove('nta-ui-hidden');
    }
}


const uiStateObserver = new MutationObserver(() => {
    clearTimeout(modalCheckTimeout);
    modalCheckTimeout = setTimeout(() => { updateModalVisibility(); checkAndInjectNumpad(); }, 50);
});

document.addEventListener('click', (e) => {
    const menu = document.getElementById('nta-accessibility-menu');
    const btn = document.getElementById('nta-btn-accessibility');
    if (menu && menu.classList.contains('open') && !menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.remove('open');
    }

    // Turn off interface when "Add to notebook" is clicked
    let clickedEl = e.target.closest('button, div[role="button"], a, .cursor-pointer, li');
    if (clickedEl && (clickedEl.innerText || clickedEl.textContent || '').toLowerCase().includes('bookmark')) {
        chrome.storage.sync.set({ ntaModeEnabled: false });
    }

    if (e.target.closest('#__next')) {
        setTimeout(() => { syncQuestionList(); renderPalette(); }, 200);
        setTimeout(() => { updateModalVisibility(); checkAndInjectNumpad(); }, 50);
    }
}, true);

document.addEventListener('keydown', (e) => {
    if (!document.body.classList.contains('nta-mode')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (!e.isTrusted) return;
    const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
    const key = e.key.toLowerCase();
    if (keyMap[key] !== undefined) {
        const optionCards = document.querySelectorAll('.question-options__option');
        if (optionCards[keyMap[key]]) {
            safeReactClick(optionCards[keyMap[key]]);
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveAndNext();
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSaveAndNext();
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
    }
});

let scrollIntentNext = 0;
let scrollIntentPrev = 0;
let scrollNavigationCooldown = false;
let scrollIntentTimeout;
const SCROLL_THRESHOLD = 900;

window.addEventListener('wheel', (e) => {
    if (!document.body.classList.contains('nta-mode')) return;
    const scrollContainer = document.getElementById('__next');
    if (!scrollContainer) return;
    const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight <= 5;
    const isAtTop = scrollContainer.scrollTop <= 5;
    clearTimeout(scrollIntentTimeout);
    if (isAtBottom && e.deltaY > 0) {
        scrollIntentNext += e.deltaY;
        if (scrollIntentNext > SCROLL_THRESHOLD && !scrollNavigationCooldown) {
            scrollNavigationCooldown = true;
            scrollIntentNext = 0;
            handleSaveAndNext();
            setTimeout(() => { scrollNavigationCooldown = false; }, 1500);
        }
    } else {
        scrollIntentNext = 0;
    }
    if (isAtTop && e.deltaY < 0) {
        scrollIntentPrev += Math.abs(e.deltaY);
        if (scrollIntentPrev > SCROLL_THRESHOLD && !scrollNavigationCooldown) {
            scrollNavigationCooldown = true;
            scrollIntentPrev = 0;
            handlePrevious();
            setTimeout(() => { scrollNavigationCooldown = false; }, 1500);
        }
    } else {
        scrollIntentPrev = 0;
    }
    scrollIntentTimeout = setTimeout(() => {
        scrollIntentNext = 0;
        scrollIntentPrev = 0;
    }, 400);
}, { passive: true });


// --- DOM INJECTION ---
function injectNTADOM() {
    if (document.getElementById('nta-mock-header')) return;

    const alertModal = document.createElement('div');
    alertModal.id = 'nta-custom-alert';
    alertModal.innerHTML = `<div class="nta-alert-box"><div id="nta-alert-msg" class="nta-alert-msg"></div><button id="nta-alert-ok" class="nta-alert-btn">OK</button></div>`;
    document.body.appendChild(alertModal);
    document.getElementById('nta-alert-ok').addEventListener('click', () => { document.getElementById('nta-custom-alert').classList.remove('open'); });

    const header = document.createElement('div');
    header.id = 'nta-mock-header';
    header.innerHTML = `<div class="nta-header-left"><img src="https://web.getmarks.app/images/question-view/MarksLogoLarge.png" alt="Marks Logo" style="height: 32px; margin-right: 10px;"><div class="nta-exam-title" id="nta-exam-name-display">JEE Main</div></div><div class="nta-header-right"><button id="nta-btn-accessibility" title="Open Accessibility Menu"><span style="font-size:16px;">♿</span> Accessibility</button><button id="nta-btn-magnifier" title="Screen Magnifier"><span style="font-size:16px;">🔍</span> Screen Magnifier</button><button class="nta-back-btn" id="nta-btn-toggle-sidebar" title="Toggle Sidebar">></button><button class="nta-back-btn" id="nta-btn-top-back" title="Exit Interface" style="margin-left: 15px;"><span style="color:black; font-weight:bold; font-size:20px;">✕</span></button></div><div id="nta-accessibility-menu"><div class="acc-title">Accessibility Adjustments</div><div class="acc-grid"><div class="acc-card"><div class="acc-card-title">Switch to<br>Dark Mode</div><label class="acc-toggle-wrapper"><input type="checkbox" id="acc-toggle-dark"><span class="acc-slider"></span><span class="toggle-icon icon-sun">☀</span><span class="toggle-icon icon-moon">☾</span></label></div><div class="acc-card"><div class="acc-card-title">Select<br>Font Size</div><div class="acc-btn-group"><button class="acc-select-btn btn-font-s" data-scale="1">A</button><button class="acc-select-btn btn-font-m" data-scale="1.25">A</button><button class="acc-select-btn btn-font-l" data-scale="1.5">A</button></div></div><div class="acc-card"><div class="acc-card-title">Enable<br>Cursor Trail</div><label class="acc-toggle-wrapper"><input type="checkbox" id="acc-toggle-trail"><span class="acc-slider"></span></label></div><div class="acc-card"><div class="acc-card-title">Choose<br>Cursor Size</div><div class="acc-btn-group"><button class="acc-select-btn btn-cursor-s" data-size="normal"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2l12 11.2-5.8.5 5.1 5.4-2.5 2.4-5.1-5.4-3.2 3.1z"/></svg></button><button class="acc-select-btn btn-cursor-m" data-size="medium"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2l12 11.2-5.8.5 5.1 5.4-2.5 2.4-5.1-5.4-3.2 3.1z"/></svg></button><button class="acc-select-btn btn-cursor-l" data-size="large"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2l12 11.2-5.8.5 5.1 5.4-2.5 2.4-5.1-5.4-3.2 3.1z"/></svg></button></div></div></div></div>`;
    document.body.appendChild(header);

    const numpad = document.createElement('div');
    numpad.id = 'nta-virtual-numpad';
    numpad.innerHTML = `<div id="nta-virtual-numpad-header" style="display:flex; justify-content:space-between; align-items:center; padding: 0 5px;"><span>Virtual Numeric Keypad</span><button id="nta-hide-numpad-btn" title="Hide Keypad" style="background:none; border:none; cursor:pointer; font-weight:bold; font-size:16px;">▼</button></div><div class="nta-numpad-grid"><button class="nta-key">1</button><button class="nta-key">2</button><button class="nta-key">3</button><button class="nta-key">4</button><button class="nta-key">5</button><button class="nta-key">6</button><button class="nta-key">7</button><button class="nta-key">8</button><button class="nta-key">9</button><button class="nta-key">.</button><button class="nta-key">0</button><button class="nta-key key-backspace">⌫</button><button class="nta-key key-clear" data-action="CLEAR">Clear</button></div>`;
    document.body.appendChild(numpad);

    const showNumpadBtn = document.createElement('button');
    showNumpadBtn.id = 'nta-show-numpad-btn';
    showNumpadBtn.innerText = "Show Keypad";
    document.body.appendChild(showNumpadBtn);

    const lens = document.createElement('div');
    lens.id = 'nta-magnifier-lens';
    lens.innerHTML = `<div id="nta-magnifier-content"></div>`;
    document.body.appendChild(lens);

    const sidebar = document.createElement('div');
    sidebar.id = 'nta-sidebar';
    sidebar.innerHTML = `<div class="nta-sidebar-top"><div class="nta-profile"><img id="nta-profile-img" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDMi4yMiAyIDIgMi4yMiAyIDEyczkuNzggMTAgMTAgMTAgMTAtOS43OCAxMC0xMFMyMS43OCAyIDEyIDJ6bTAgMTdjLTMuMzEgMC02LTEuODctNi00LjUgMC0yLjQ5IDIuMTMtNC41IDUuMTQtNC41aDEuNzJDMTUuODcgMTAgMTggMTIuMDEgMTggMTQuNWMwIDIuNjMtMi42OSA0LjUtNiA0LjV6bTAtMTBhMyAzIDAgMSAxIDAtNiAzIDMgMCAwIDEgMCA2eiIvPjwvc3ZnPg==" /><div class="nta-profile-details"><span class="nta-candidate-label">Candidate Name:</span><strong id="nta-profile-name">Student</strong></div></div></div><div class="nta-legend-box"><div class="nta-legend-row"><div class="legend-item"><div class="nta-badge badge-not-visited">0</div> Not Visited</div><div class="legend-item"><div class="nta-badge badge-not-answered">0</div> Not Answered</div></div><div class="nta-legend-row"><div class="legend-item"><div class="nta-badge badge-answered">0</div> Answered</div><div class="legend-item"><div class="nta-badge badge-marked">0</div> Marked</div></div></div><div class="nta-palette-header">Question Palette</div><div class="nta-palette-container"><div class="nta-palette-grid"></div></div><div class="nta-sidebar-actions"><div style="font-size:11px; text-align:center; color:#666; margin-bottom:5px;">made by sval.tech</div><div class="nta-side-btn-row"><button class="nta-reset-btn" id="nta-btn-reset-data">Start New Session</button><button class="nta-reset-btn" id="nta-btn-fullscreen">Full Screen</button></div></div>`;
    document.body.appendChild(sidebar);

    const footer = document.createElement('div');
    footer.id = 'nta-footer';
    footer.innerHTML = `<div class="nta-footer-left"><button class="nta-action-btn" id="nta-btn-clear">Clear Response</button><button class="nta-action-btn" id="nta-btn-review">Mark for Review & Next</button></div><div class="nta-footer-right"><button class="nta-action-btn btn-blue" id="nta-btn-prev">Back</button><button class="nta-action-btn btn-green" id="nta-btn-next">Save & Next</button><button class="nta-action-btn btn-submit" id="nta-btn-submit">Submit</button></div>`;
    document.body.appendChild(footer);

    document.getElementById('nta-btn-next').addEventListener('click', handleSaveAndNext);
    document.getElementById('nta-btn-review').addEventListener('click', handleReviewAndNext);
    document.getElementById('nta-btn-prev').addEventListener('click', handlePrevious);
    document.getElementById('nta-btn-clear').addEventListener('click', handleClearResponse);
    document.getElementById('nta-btn-submit').addEventListener('click', handleSubmit);
    document.getElementById('nta-btn-top-back').addEventListener('click', handleTopBack);
    document.getElementById('nta-btn-fullscreen').addEventListener('click', toggleFullScreen);
    document.getElementById('nta-btn-toggle-sidebar').addEventListener('click', toggleSidebar);
    document.getElementById('nta-btn-accessibility').addEventListener('click', toggleAccessibilityMenu);
    document.getElementById('nta-btn-magnifier').addEventListener('click', toggleMagnifier);
    document.getElementById('nta-hide-numpad-btn').addEventListener('click', hideNumpad);
    document.getElementById('nta-show-numpad-btn').addEventListener('click', showNumpad);
    document.getElementById('acc-toggle-dark').addEventListener('change', (e) => toggleDarkMode(e.target.checked));
    document.getElementById('acc-toggle-trail').addEventListener('change', (e) => toggleCursorTrail(e.target.checked));
    document.querySelectorAll('.nta-key').forEach(keyBtn => keyBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); const action = keyBtn.getAttribute('data-action'); if (action) { handleNumpadClick(action); } else { handleNumpadClick(keyBtn.innerText); } }));
    document.querySelector('.btn-font-s').addEventListener('click', () => applyFontScale(1));
    document.querySelector('.btn-font-m').addEventListener('click', () => applyFontScale(1.25));
    document.querySelector('.btn-font-l').addEventListener('click', () => applyFontScale(1.5));
    document.querySelector('.btn-cursor-s').addEventListener('click', () => applyCursorSize('normal'));
    document.querySelector('.btn-cursor-m').addEventListener('click', () => applyCursorSize('medium'));
    document.querySelector('.btn-cursor-l').addEventListener('click', () => applyCursorSize('large'));
    document.getElementById('nta-btn-reset-data').addEventListener('click', () => { if (confirm('Are you sure you want to clear all mock test data?')) { sessionStorage.removeItem('nta_seq'); sessionStorage.removeItem('nta_states'); window.location.reload(); } });

    if (isDarkMode) document.getElementById('acc-toggle-dark').checked = true;
    if (isCursorTrailEnabled) document.getElementById('acc-toggle-trail').checked = true;
    applyFontScale(currentFontScale);
    applyCursorSize(currentCursorSize);

    initLensDrag();
    syncQuestionList();
    renderPalette();
    loadProfileData();
    checkAndInjectNumpad();
    document.documentElement.style.setProperty('--nta-font-scale', currentFontScale);
}

function removeNTADOM() {
    const elements = ['nta-mock-header', 'nta-sidebar', 'nta-footer', 'nta-virtual-numpad', 'nta-magnifier-lens', 'nta-custom-alert', 'nta-show-numpad-btn'];
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
}

function applyThemeData() {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
        document.body.classList.add('nta-dark-theme');
    } else {
        document.body.classList.remove('nta-dark-theme');
    }
}

function enableNTAMode() {
    document.body.classList.add('nta-mode');
    applyThemeData();
    injectNTADOM();

    uiStateObserver.observe(document.body, { childList: true, attributes: true, attributeFilter: ['style'] });
    const portal = document.getElementById('model-portal');
    if (portal) uiStateObserver.observe(portal, { childList: true, subtree: true });
}

function disableNTAMode() {
    document.body.classList.remove('nta-mode');
    document.body.classList.remove('nta-dark-theme');
    document.body.classList.remove('nta-ui-hidden');
    document.body.classList.remove('nta-sidebar-collapsed');
    document.body.classList.remove('nta-cursor-medium', 'nta-cursor-large');
    document.body.classList.remove('nta-numpad-active');
    document.body.classList.remove('nta-magnifier-active');
    document.body.classList.remove('nta-modal-open');
    removeNTADOM();
    uiStateObserver.disconnect();
    if (document.fullscreenElement) document.exitFullscreen();
}

// --- FLOATING LAUNCHER ---
function injectFloatingLauncher() {
    if (document.getElementById('nta-floating-launcher')) return;

    const launcher = document.createElement('div');
    launcher.id = 'nta-floating-launcher';
    launcher.innerHTML = `NTA`;
    launcher.title = "Launch NTA Mock Interface";

    chrome.storage.sync.get(['ntaModeEnabled'], (res) => {
        launcher.style.display = res.ntaModeEnabled ? 'none' : 'flex';
    });

    document.body.appendChild(launcher);

    launcher.addEventListener('click', () => {
        chrome.storage.sync.set({ ntaModeEnabled: true });
    });
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'wipeData') {
        sessionStorage.removeItem('nta_seq');
        sessionStorage.removeItem('nta_states');
        window.location.reload();
    }
    if (message.action === 'updateProfile') {
        loadProfileData();
    }
});

chrome.storage.sync.get(['ntaModeEnabled', 'ntaDarkMode', 'ntaFontScale', 'ntaCursorTrail', 'ntaCursorSize'], (result) => {
    if (result.ntaDarkMode !== undefined) isDarkMode = result.ntaDarkMode;
    if (result.ntaFontScale) currentFontScale = result.ntaFontScale;
    if (result.ntaCursorTrail) isCursorTrailEnabled = result.ntaCursorTrail;
    if (result.ntaCursorSize) currentCursorSize = result.ntaCursorSize;

    injectFloatingLauncher();

    if (result.ntaModeEnabled) {
        enableNTAMode();
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.ntaDarkMode) {
        isDarkMode = changes.ntaDarkMode.newValue;
        applyThemeData();
        const toggle = document.getElementById('acc-toggle-dark');
        if (toggle) toggle.checked = isDarkMode;
    }
    if (changes.ntaModeEnabled) {
        const launcher = document.getElementById('nta-floating-launcher');
        if (changes.ntaModeEnabled.newValue) {
            enableNTAMode();
            if (launcher) launcher.style.display = 'none';
        } else {
            disableNTAMode();
            if (launcher) launcher.style.display = 'flex';
        }
    }
});

let lastObservedUrl = location.href;
const observer = new MutationObserver(() => {
    chrome.storage.sync.get(['ntaModeEnabled'], (result) => {
        if (result.ntaModeEnabled) {
            applyThemeData();
            if (!document.getElementById('nta-sidebar') && !document.body.classList.contains('nta-ui-hidden')) {
                injectNTADOM();
            }
            if (location.href !== lastObservedUrl) {
                lastObservedUrl = location.href;
                syncQuestionList();
                renderPalette();
            }
        } else {
            // Keep the floating launcher alive on page navigations when interface is off
            if (!document.getElementById('nta-floating-launcher')) {
                injectFloatingLauncher();
            }
        }
    });
});

observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme', 'class'] });