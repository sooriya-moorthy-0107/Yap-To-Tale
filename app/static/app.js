// =============================================================================
// Yap-to-Tale — Frontend Application Logic
// =============================================================================

"use strict";

const elements = {
    yapInput:           document.getElementById("yap-input"),
    charCounter:        document.getElementById("char-counter"),
    storyGenre:         document.getElementById("story-genre"),
    voicePreference:    document.getElementById("voice-preference"),
    transformBtn:       document.getElementById("transform-btn"),
    errorSection:       document.getElementById("error-section"),
    errorMessage:       document.getElementById("error-message"),
    resultsSection:     document.getElementById("results-section"),
    resultTitle:        document.getElementById("result-title"),
    resultGenreBadge:   document.getElementById("result-genre-badge"),
    epicText:           document.getElementById("epic-text"),
    audioPlayer:        document.getElementById("audio-player"),
    bgMusicPlayer:      document.getElementById("bg-music-player"),
    sfxPlayer:          document.getElementById("sfx-player"),
    recordId:           document.getElementById("record-id"),
    resultAuthorBadge:  document.getElementById("result-author-badge"),
    bgEmojiContainer:   document.getElementById("bg-emoji-container"),
    recentFeedGrid:     document.getElementById("recent-feed-grid"),
    tabCreate:          document.getElementById("tab-create"),
    tabRecent:          document.getElementById("tab-recent"),
    createView:         document.getElementById("create-view"),
    recentView:         document.getElementById("recent-view"),
    myFeedGrid:         document.getElementById("my-feed-grid"),
    loginModal:         document.getElementById("login-modal"),
    loginUsername:      document.getElementById("login-username"),
    loginBtn:           document.getElementById("login-btn"),
    generateAliasBtn:   document.getElementById("generate-alias-btn"),
};

let userAlias = localStorage.getItem("yap_user_alias");

function showLoginModal() {
    const mainContainer = document.querySelector('.app-container');
    if (mainContainer) mainContainer.style.display = 'none';
    if (elements.loginModal) elements.loginModal.hidden = false;
}

if (!userAlias) {
    showLoginModal();
}

if (elements.loginModal) {
    elements.loginBtn.addEventListener("click", () => {
        const val = elements.loginUsername.value.trim();
        if (val) {
            userAlias = val;
            localStorage.setItem("yap_user_alias", userAlias);
            elements.loginModal.hidden = true;
            const mainContainer = document.querySelector('.app-container');
            if (mainContainer) mainContainer.style.display = 'flex';
            loadRecentYaps();
        }
    });
    
    elements.generateAliasBtn.addEventListener("click", () => {
        const adjectives = ["neon", "shadow", "cyber", "sleepy", "vintage", "toxic", "chaotic"];
        const nouns = ["baddie", "girly", "007bond", "gremlin", "wizard", "nomad", "phantom"];
        userAlias = `${adjectives[Math.floor(Math.random() * adjectives.length)]}_${nouns[Math.floor(Math.random() * nouns.length)]}_${Math.floor(Math.random() * 900) + 10}`;
        localStorage.setItem("yap_user_alias", userAlias);
        elements.loginModal.hidden = true;
        const mainContainer = document.querySelector('.app-container');
        if (mainContainer) mainContainer.style.display = 'flex';
        loadRecentYaps();
    });
}

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("yap_user_alias");
        userAlias = null;
        if (elements.loginUsername) elements.loginUsername.value = "";
        showLoginModal();
    });
}

const MAX_CHAR_LENGTH = 5000;
const CHAR_WARNING_THRESHOLD = 0.9;
const API_ENDPOINT = "/api/transform";

const GENRE_LABELS = {
    "fantasy": "Fantasy",
    "horror": "Horror",
    "science-fiction": "Science fiction",
    "romance": "Romance",
    "mystery": "Mystery",
    "thriller": "Thriller",
    "comedy": "Comedy",
};

function getButtonParts(button) {
    return {
        defaultContent: button.querySelector(".btn-default-content"),
        loadingContent: button.querySelector(".btn-loading-content"),
    };
}

function updateCharCounter() {
    const currentLength = elements.yapInput.value.length;
    const ratio = currentLength / MAX_CHAR_LENGTH;

    elements.charCounter.textContent = `${currentLength} / ${MAX_CHAR_LENGTH}`;
    elements.charCounter.classList.remove("near-limit", "at-limit");

    if (ratio >= 1) {
        elements.charCounter.classList.add("at-limit");
    } else if (ratio >= CHAR_WARNING_THRESHOLD) {
        elements.charCounter.classList.add("near-limit");
    }
}

function setLoadingState(activeButton) {
    const buttons = [elements.transformBtn];
    buttons.forEach((btn) => {
        const parts = getButtonParts(btn);
        const isActive = btn === activeButton;
        btn.disabled = true;
        parts.defaultContent.hidden = isActive;
        parts.loadingContent.hidden = !isActive;
    });

    elements.errorSection.hidden = true;
    elements.resultsSection.hidden = true;
}

function setIdleState() {
    [elements.transformBtn].forEach((btn) => {
        btn.disabled = false;
        const parts = getButtonParts(btn);
        parts.defaultContent.hidden = false;
        parts.loadingContent.hidden = true;
    });
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorSection.hidden = false;
    elements.resultsSection.hidden = true;

    elements.errorSection.style.animation = "none";
    void elements.errorSection.offsetHeight;
    elements.errorSection.style.animation = "";

    elements.errorSection.scrollIntoView({ behavior: "smooth", block: "center" });
}

function showResults(data) {
    elements.epicText.textContent = data.epic_text;
    elements.audioPlayer.src = data.audio_url;
    elements.audioPlayer.load();
    
    if (data.bg_music_url) {
        elements.bgMusicPlayer.src = data.bg_music_url;
        elements.bgMusicPlayer.volume = 0.2;
        elements.bgMusicPlayer.load();
    }
    
    if (data.sfx_url) {
        elements.sfxPlayer.src = data.sfx_url;
        elements.sfxPlayer.volume = 0.5;
        elements.sfxPlayer.load();
    }
    
    elements.recordId.textContent = data.id;

    if (data.author_alias && elements.resultAuthorBadge) {
        elements.resultAuthorBadge.textContent = `@${data.author_alias}`;
        elements.resultAuthorBadge.hidden = false;
    } else if (elements.resultAuthorBadge) {
        elements.resultAuthorBadge.hidden = true;
    }

    if (data.genre && data.genre !== "epic") {
        const label = GENRE_LABELS[data.genre] || data.genre;
        elements.resultTitle.textContent = "Your genre story";
        elements.resultGenreBadge.textContent = label;
        elements.resultGenreBadge.hidden = false;
    } else {
        elements.resultTitle.textContent = "Your epic narrative";
        elements.resultGenreBadge.hidden = true;
    }

    elements.resultsSection.hidden = false;
    elements.errorSection.hidden = true;
    elements.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleTransform() {
    const inputText = elements.yapInput.value.trim();

    if (!inputText) {
        showError("Enter your daily log before generating a story.");
        return;
    }

    if (inputText.length > MAX_CHAR_LENGTH) {
        showError(`Your text exceeds the ${MAX_CHAR_LENGTH} character limit.`);
        return;
    }

    const activeButton = elements.transformBtn;
    const body = { 
        text: inputText,
        genre: elements.storyGenre.value,
        voice: elements.voicePreference.value,
        author_alias: userAlias
    };

    setLoadingState(activeButton);

    try {
        const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || `Server error (HTTP ${response.status})`);
            return;
        }

        if (!data.epic_text || !data.audio_url) {
            showError("Incomplete response from the server. Please try again.");
            return;
        }

        showResults(data);
        loadRecentYaps(); // Refresh recent feed with newly generated yap
    } catch (error) {
        console.error("Transformation request failed:", error);
        if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
            showError("Unable to reach the server. Check your connection and try again.");
        } else {
            showError("An unexpected error occurred. Please try again.");
        }
    } finally {
        setIdleState();
    }
}

function updateBackgroundEmojis() {
    const genre = elements.storyGenre.value;
    const voice = elements.voicePreference.value;
    
    let emojis = [];
    switch (genre) {
        case "fantasy": emojis = ["🐉", "✨", "🧚", "🏰", "🦄"]; break;
        case "horror": emojis = ["👻", "🔪", "🩸", "🏚️", "🦇"]; break;
        case "science-fiction": emojis = ["🚀", "👽", "🌌", "🤖", "☄️"]; break;
        case "romance": emojis = ["❤️", "🌹", "💘", "💌", "💋"]; break;
        case "mystery": emojis = ["🕵️", "🔍", "🕰️", "🧩", "👣"]; break;
        case "thriller": emojis = ["⏳", "👁️", "🏃", "🚓", "🔪"]; break;
        case "comedy": emojis = ["😂", "🤡", "🎭", "🍌", "🤣"]; break;
        case "epic": default: emojis = ["⚔️", "🔥", "🛡️", "👑", "⚡"]; break;
    }
    
    if (voice === "Joanna") {
        emojis.push("👩", "🎤", "🎶");
    } else {
        emojis.push("👨", "🎤", "🎶");
    }

    // Generate spans for background
    elements.bgEmojiContainer.innerHTML = "";
    for (let i = 0; i < 15; i++) {
        const span = document.createElement("span");
        span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        elements.bgEmojiContainer.appendChild(span);
    }
}

elements.storyGenre.addEventListener("change", updateBackgroundEmojis);
elements.voicePreference.addEventListener("change", updateBackgroundEmojis);

elements.yapInput.addEventListener("input", updateCharCounter);

elements.transformBtn.addEventListener("click", () => handleTransform());

elements.yapInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        handleTransform();
    }
});

updateCharCounter();
updateBackgroundEmojis();

// Audio synchronization
elements.audioPlayer.addEventListener("play", () => {
    if (elements.bgMusicPlayer.src) {
        elements.bgMusicPlayer.play().catch(e => console.error("BG music play failed:", e));
    }
    if (elements.sfxPlayer.src && elements.audioPlayer.currentTime < 1) {
        elements.sfxPlayer.play().catch(e => console.error("SFX play failed:", e));
    }
});

elements.audioPlayer.addEventListener("pause", () => {
    elements.bgMusicPlayer.pause();
});

elements.audioPlayer.addEventListener("ended", () => {
    elements.bgMusicPlayer.pause();
    elements.bgMusicPlayer.currentTime = 0;
});

async function submitComment(taleId, inputId, listId) {
    const inputEl = document.getElementById(inputId);
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    try {
        const res = await fetch(`/api/tales/${taleId}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ author: userAlias || "anonymous", text })
        });
        const data = await res.json();
        if (data.success) {
            const listEl = document.getElementById(listId);
            const div = document.createElement("div");
            div.className = "comment-item";
            div.innerHTML = `<span class="comment-author">@${data.comment.author}</span> ${data.comment.text}`;
            listEl.appendChild(div);
        }
    } catch (err) {
        console.error(err);
    }
}

async function fetchCommentsHTML(tale) {
    try {
        const res = await fetch(`/api/tales/${tale.id}/comments`);
        const data = await res.json();
        let comments = tale.comments || [];
        if (data.success) comments = data.comments;
        
        let html = `<div id="comments-list-${tale.id}">`;
        comments.forEach(c => {
            html += `<div class="comment-item"><span class="comment-author">@${c.author}</span> ${c.text}</div>`;
        });
        html += `</div>
        <div class="comment-input-row">
            <input type="text" id="comment-input-${tale.id}" class="yap-textarea" placeholder="Add a comment...">
            <button class="btn btn-secondary" onclick="submitComment('${tale.id}', 'comment-input-${tale.id}', 'comments-list-${tale.id}')">Post</button>
        </div>`;
        return html;
    } catch(err) {
        return "";
    }
}

async function renderTaleCard(tale) {
    const commentsHTML = await fetchCommentsHTML(tale);
    return `
        <div class="tale-card">
            <div class="tale-header">
                <span class="author-badge">🎭 @${tale.author_alias}</span>
                <span class="genre-tag">${tale.genre || 'Epic'}</span>
            </div>
            <p class="tale-preview">"${tale.prompt_preview}"</p>
            <audio class="feed-audio-player" controls preload="none" src="${tale.audio_url}" style="border-radius: var(--radius-sm); border: 1px solid var(--color-border); background: var(--color-surface-elevated);"></audio>
            <div class="comments-section">${commentsHTML}</div>
        </div>
    `;
}

async function loadRecentYaps() {
    if (!elements.recentFeedGrid) return;
    elements.recentFeedGrid.innerHTML = '<p class="loader" style="text-align: center; color: var(--color-text-secondary); margin: var(--space-xl) 0;">Loading latest tales...</p>';
    if (elements.myFeedGrid) elements.myFeedGrid.innerHTML = '<p class="loader" style="text-align: center; color: var(--color-text-secondary); margin: var(--space-xl) 0;">Loading your tales...</p>';

    try {
        const [recentRes, myRes] = await Promise.all([
            fetch('/api/tales/recent?limit=20'),
            fetch(`/api/tales/user/${encodeURIComponent(userAlias)}?limit=20`)
        ]);

        const recentData = await recentRes.json();
        const myData = await myRes.json();
        
        let publicTales = [];
        let myTales = [];

        if (recentData.success && recentData.tales) {
            publicTales = recentData.tales; // Do not filter out My Yaps here, so they appear in both
        }
        
        if (myData.success && myData.tales) {
            myTales = myData.tales;
        }

        const publicPromises = publicTales.map(t => renderTaleCard(t));
        const myPromises = myTales.map(t => renderTaleCard(t));
        
        const publicHTML = (await Promise.all(publicPromises)).join('');
        const myHTML = (await Promise.all(myPromises)).join('');

        elements.recentFeedGrid.innerHTML = publicHTML || '<p style="text-align: center; color: var(--color-text-secondary); margin: var(--space-xl) 0;">No public yaps yet.</p>';
        if (elements.myFeedGrid) {
            elements.myFeedGrid.innerHTML = myHTML || '<p style="text-align: center; color: var(--color-text-secondary); margin: var(--space-xl) 0;">You haven\'t created any yaps yet.</p>';
        }

    } catch (err) {
        elements.recentFeedGrid.innerHTML = '<p class="error" style="text-align: center; color: var(--color-error-text); margin: var(--space-xl) 0;">Failed to load feeds.</p>';
        if (elements.myFeedGrid) elements.myFeedGrid.innerHTML = '';
    }
}

if (elements.tabCreate && elements.tabRecent) {
    elements.tabCreate.addEventListener("click", () => {
        elements.tabCreate.classList.add("active");
        elements.tabRecent.classList.remove("active");
        elements.createView.hidden = false;
        elements.recentView.hidden = true;
    });

    elements.tabRecent.addEventListener("click", () => {
        elements.tabRecent.classList.add("active");
        elements.tabCreate.classList.remove("active");
        elements.createView.hidden = true;
        elements.recentView.hidden = false;
        loadRecentYaps(); // Refresh feed on switch
    });
}

// Initial load
document.addEventListener("DOMContentLoaded", () => {
    loadRecentYaps();
});
