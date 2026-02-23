document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const wipeDataBtn = document.getElementById('wipeDataBtn');

    // Profile fields
    const examName = document.getElementById('examName');
    const profileName = document.getElementById('profileName');
    const profileSubject = document.getElementById('profileSubject');
    const profilePicUrl = document.getElementById('profilePicUrl');
    const saveProfileBtn = document.getElementById('saveProfileBtn');

    // Load current states from Chrome storage
    chrome.storage.sync.get(['ntaModeEnabled', 'ntaDarkMode'], (result) => {
        themeToggle.checked = result.ntaModeEnabled || false;
        darkModeToggle.checked = result.ntaDarkMode || false;
    });

    chrome.storage.local.get(['ntaExamName', 'ntaProfileName', 'ntaProfileSubject', 'ntaProfilePic'], (res) => {
        examName.value = res.ntaExamName || 'JEE';
        if (res.ntaProfileName) profileName.value = res.ntaProfileName;
        if (res.ntaProfileSubject) profileSubject.value = res.ntaProfileSubject;
        if (res.ntaProfilePic) profilePicUrl.value = res.ntaProfilePic;
    });

    // Listeners for switches
    themeToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ ntaModeEnabled: themeToggle.checked });
    });

    darkModeToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ ntaDarkMode: darkModeToggle.checked });
    });

    // Save Profile Logic
    saveProfileBtn.addEventListener('click', () => {
        const data = {
            ntaExamName: examName.value || 'JEE',
            ntaProfileName: profileName.value,
            ntaProfileSubject: profileSubject.value,
            ntaProfilePic: profilePicUrl.value
        };

        chrome.storage.local.set(data, () => {
            saveProfileBtn.innerText = 'Saved Successfully!';
            saveProfileBtn.style.background = '#5cb85c';

            setTimeout(() => {
                saveProfileBtn.innerText = 'Save Profile Data';
                saveProfileBtn.style.background = '#2c72b2';
            }, 2000);

            // Notify content script to update live
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "updateProfile" });
                }
            });
        });
    });

    // Send a message to the active tab to wipe the data silently
    wipeDataBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "wipeData" });
            }
        });
    });
});