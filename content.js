// NTA Mock Interface Injector

// --- STATE MANAGEMENT ---
let questionSequence = JSON.parse(sessionStorage.getItem('nta_seq')) || [];
let questionStates = JSON.parse(sessionStorage.getItem('nta_states')) || {};
let currentUrl = normalizeUrl(window.location.href);
let isDarkMode = false;
let currentFontScale = 1;

function saveState() {
    sessionStorage.setItem('nta_seq', JSON.stringify(questionSequence));
    sessionStorage.setItem('nta_states', JSON.stringify(questionStates));
}

function normalizeUrl(url) {
    return url.split('?')[0].replace(/\/$/, "");
}

function isOptionSelected() {
    if (document.querySelector('input[type="radio"]:checked')) return true;
    if (document.querySelector('[aria-checked="true"]')) return true;
    if (document.querySelector('.bg-blue-500, .bg-blue-600, .border-blue-500, [class*="selected"], [data-selected="true"]')) return true;
    return false;
}

function syncQuestionList() {
    const currentNUrl = normalizeUrl(window.location.href);
    let listChanged = false;

    const links = Array.from(document.querySelectorAll('a[href*="/question/"]'));
    links.forEach(link => {
        const nUrl = normalizeUrl(link.href);
        if (!questionSequence.includes(nUrl)) {
            questionSequence.push(nUrl);
            questionStates[nUrl] = 'not-visited';
            listChanged = true;
        }
    });

    if (!questionSequence.includes(currentNUrl) && currentNUrl.includes('/question/')) {
        questionSequence.push(currentNUrl);
        listChanged = true;
    }

    if (currentNUrl.includes('/question/') && (!questionStates[currentNUrl] || questionStates[currentNUrl] === 'not-visited')) {
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

    let counts = { 'answered': 0, 'not-answered': 0, 'not-visited': 0, 'marked': 0, 'ans-marked': 0 };

    if (questionSequence.length > 0) {
        questionSequence.forEach((url, index) => {
            const qNum = index + 1;
            const badge = document.createElement('div');

            const state = questionStates[url] || 'not-visited';
            if (counts[state] !== undefined) counts[state]++;

            badge.className = `nta-badge badge-${state}`;
            if (url === currentUrl) badge.classList.add('badge-active');

            badge.innerText = qNum;
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
        const el = document.getElementById(`leg-${key}`);
        if (el) el.innerText = counts[key];
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

function handleSaveAndNext() {
    if (currentUrl.includes('/question/')) {
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
    if (currentUrl.includes('/question/')) {
        questionStates[currentUrl] = isOptionSelected() ? 'ans-marked' : 'marked';
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

    if (currentUrl.includes('/question/')) {
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
    if (currentUrl.includes('/question/')) {
        questionStates[currentUrl] = 'answered';
        saveState();
        renderPalette();
    }
    clickNativeButton(['show solution', 'submit', 'submit test', 'check answer', 'check']);
}

function handleTopBack() {
    chrome.storage.sync.set({ ntaModeEnabled: false }, () => {
        const backSvg = document.querySelector('.lucide-arrow-left');
        let clicked = false;
        if (backSvg) {
            const wrapper = backSvg.closest('div.cursor-pointer, div') || backSvg;
            clicked = safeReactClick(wrapper);
        }
        if (!clicked) window.history.back();
    });
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

function adjustFontSize(delta) {
    if (delta === 0) {
        currentFontScale = 1;
    } else {
        currentFontScale = Math.max(0.8, Math.min(currentFontScale + delta, 1.5));
    }
    document.documentElement.style.setProperty('--nta-font-scale', currentFontScale);
}

function loadProfileData() {
    chrome.storage.local.get(['ntaExamName', 'ntaProfileName', 'ntaProfileSubject', 'ntaProfilePic'], (res) => {
        const examEl = document.getElementById('nta-exam-name-display');
        const nameEl = document.getElementById('nta-profile-name');
        const subEl = document.getElementById('nta-profile-subject');
        const imgEl = document.getElementById('nta-profile-img');

        if (examEl) examEl.innerText = res.ntaExamName || 'JEE';
        if (nameEl) nameEl.innerText = res.ntaProfileName || 'Student';
        if (subEl) subEl.innerHTML = `Subject: ${res.ntaProfileSubject || 'Physics, Chem, Math'}<br/>Language: English`;
        if (imgEl && res.ntaProfilePic) imgEl.src = res.ntaProfilePic;
    });
}

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
    modalCheckTimeout = setTimeout(() => { updateModalVisibility(); }, 50);
});

document.addEventListener('click', (e) => {
    if (e.target.closest('#__next')) {
        setTimeout(() => { syncQuestionList(); renderPalette(); }, 200);
        setTimeout(() => { updateModalVisibility(); }, 50);
    }
}, true);

// --- NEW CAPABILITIES: KEYBOARD SHORTCUTS & AUTO SCROLL ---

document.addEventListener('keydown', (e) => {
    if (!document.body.classList.contains('nta-mode')) return;

    // Ignore keystrokes if the user is typing in a text field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Ignore simulated keystrokes (prevents infinite loops from our own fallback dispatches)
    if (!e.isTrusted) return;

    // Options mapping: 1, 2, 3, 4 OR a, b, c, d
    const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
    const key = e.key.toLowerCase();

    if (keyMap[key] !== undefined) {
        // Find options container cards directly
        const optionCards = document.querySelectorAll('.question-options__option');
        if (optionCards[keyMap[key]]) {
            safeReactClick(optionCards[keyMap[key]]);
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSaveAndNext();
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
    }
});

let scrollNextCooldown = false;
window.addEventListener('wheel', (e) => {
    if (!document.body.classList.contains('nta-mode')) return;
    const scrollContainer = document.getElementById('__next');
    if (!scrollContainer) return;

    // Determine if user is at the absolute bottom of the question container
    const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight <= 2;

    // If they are at the bottom and they try scrolling down further
    if (isAtBottom && e.deltaY > 0 && !scrollNextCooldown) {
        scrollNextCooldown = true;
        handleSaveAndNext();
        // Cooldown prevents skipping 2 questions on a fast scroll wheel spin
        setTimeout(() => { scrollNextCooldown = false; }, 1200);
    }
}, { passive: true });


// --- DOM INJECTION ---

function injectNTADOM() {
    if (document.getElementById('nta-mock-header')) return;

    const header = document.createElement('div');
    header.id = 'nta-mock-header';
    header.innerHTML = `
    <div class="nta-header-left">
      <button class="nta-back-btn" id="nta-btn-top-back" title="Go Back">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>
      </button>
      <div style="display:flex; align-items:center; gap: 8px;">
        <span style="color: #ffd700; font-weight: 900; letter-spacing: 0.5px;">MARKS</span>
        <span id="nta-exam-name-display">JEE</span>
      </div>
    </div>

    <div class="nta-header-center">
        <button class="nta-font-btn" id="nta-font-dec" title="Decrease Font">A-</button>
        <button class="nta-font-btn" id="nta-font-reset" title="Reset Font">A</button>
        <button class="nta-font-btn" id="nta-font-inc" title="Increase Font">A+</button>
    </div>

    <div class="nta-header-right">
      <button class="nta-reset-btn" id="nta-btn-fullscreen" title="Toggle Fullscreen" style="background:#4a5568;">
        ⛶ Fullscreen
      </button>
      <button class="nta-reset-btn" id="nta-btn-reset-data" title="Wipe Data & Reload">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Wipe Data
      </button>
      <div class="nta-branding">Engineered by <a href="https://sval.tech" target="_blank">sval.tech</a></div>
    </div>
  `;
    document.body.appendChild(header);

    const sidebar = document.createElement('div');
    sidebar.id = 'nta-sidebar';
    sidebar.innerHTML = `
    <div class="nta-profile">
      <img id="nta-profile-img" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDMi4yMiAyIDIgMi4yMiAyIDEyczkuNzggMTAgMTAgMTAgMTAtOS43OCAxMC0xMFMyMS43OCAyIDEyIDJ6bTAgMTdjLTMuMzEgMC02LTEuODctNi00LjUgMC0yLjQ5IDIuMTMtNC41IDUuMTQtNC41aDEuNzJDMTUuODcgMTAgMTggMTIuMDEgMTggMTQuNWMwIDIuNjMtMi42OSA0LjUtNiA0LjV6bTAtMTBhMyAzIDAgMSAxIDAtNiAzIDMgMCAwIDEgMCA2eiIvPjwvc3ZnPg==" />
      <div class="nta-profile-details">
        <strong id="nta-profile-name">Student</strong>
        <span id="nta-profile-subject">Subject: Physics, Chem, Math<br/>Language: English</span>
      </div>
    </div>
    <div class="nta-legend-box">
      <div class="nta-legend-grid">
        <div class="legend-item"><div class="nta-badge badge-answered" id="leg-answered">0</div> Answered</div>
        <div class="legend-item"><div class="nta-badge badge-not-answered" id="leg-not-answered">0</div> Not Answered</div>
        <div class="legend-item"><div class="nta-badge badge-not-visited" id="leg-not-visited">0</div> Not Visited</div>
        <div class="legend-item"><div class="nta-badge badge-marked" id="leg-marked">0</div> Marked for Review</div>
      </div>
      <div class="legend-item" style="margin-top: 8px;">
        <div class="nta-badge badge-ans-marked" id="leg-ans-marked">0</div> Answered & Marked for Review
      </div>
    </div>
    <div class="nta-palette-header">Question Palette</div>
    <div class="nta-palette-grid"></div>
  `;
    document.body.appendChild(sidebar);

    syncQuestionList();
    renderPalette();
    loadProfileData();
    document.documentElement.style.setProperty('--nta-font-scale', currentFontScale);

    const footer = document.createElement('div');
    footer.id = 'nta-footer';
    footer.innerHTML = `
    <div class="nta-btn-group">
      <button class="nta-action-btn" id="nta-btn-review">Mark for Review & Next</button>
      <button class="nta-action-btn" id="nta-btn-clear">Clear Response</button>
      <button class="nta-action-btn" id="nta-btn-prev">Back</button>
    </div>
    <div class="nta-btn-group">
      <button class="nta-action-btn btn-blue" id="nta-btn-submit">Submit</button>
      <button class="nta-action-btn btn-green" id="nta-btn-next">Save & Next</button>
    </div>
  `;
    document.body.appendChild(footer);

    // Event Listeners
    document.getElementById('nta-btn-next').addEventListener('click', handleSaveAndNext);
    document.getElementById('nta-btn-review').addEventListener('click', handleReviewAndNext);
    document.getElementById('nta-btn-prev').addEventListener('click', handlePrevious);
    document.getElementById('nta-btn-clear').addEventListener('click', handleClearResponse);
    document.getElementById('nta-btn-submit').addEventListener('click', handleSubmit);
    document.getElementById('nta-btn-top-back').addEventListener('click', handleTopBack);
    document.getElementById('nta-btn-fullscreen').addEventListener('click', toggleFullScreen);

    // Font Adjusters
    document.getElementById('nta-font-dec').addEventListener('click', () => adjustFontSize(-0.1));
    document.getElementById('nta-font-reset').addEventListener('click', () => adjustFontSize(0));
    document.getElementById('nta-font-inc').addEventListener('click', () => adjustFontSize(0.1));

    document.getElementById('nta-btn-reset-data').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all mock test data?')) {
            sessionStorage.removeItem('nta_seq');
            sessionStorage.removeItem('nta_states');
            window.location.reload();
        }
    });
}

function removeNTADOM() {
    const elements = ['nta-mock-header', 'nta-sidebar', 'nta-footer'];
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
    removeNTADOM();
    uiStateObserver.disconnect();
    if (document.fullscreenElement) document.exitFullscreen();
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

chrome.storage.sync.get(['ntaModeEnabled', 'ntaDarkMode'], (result) => {
    isDarkMode = result.ntaDarkMode || false;
    if (result.ntaModeEnabled) enableNTAMode();
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.ntaDarkMode) {
        isDarkMode = changes.ntaDarkMode.newValue;
        applyThemeData();
    }
    if (changes.ntaModeEnabled) {
        if (changes.ntaModeEnabled.newValue) {
            enableNTAMode();
        } else {
            disableNTAMode();
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
        }
    });
});

observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme', 'class'] });