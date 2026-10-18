// =============================================================================
// Yap-to-Tale — Modern Audio Social Platform Application Logic
// Reddit-Style Social Architecture · Name-Changing Modal · Leftward Flowcharts
// =============================================================================

"use strict";

// =============================================================================
// Constants & State Management
// =============================================================================

const ANONYMOUS_HANDLES = [
    "Girly", "Baddie", "007Bond", "NeonViper", "CyberWizard",
    "PixelBard", "ShadowWalker", "EchoQueen", "NightOwl", "RogueScholar",
    "StarlightYap", "MidnightPoet", "TechnoMage", "ChaosGremlin", "VibeMaster",
    "AuraCrafter", "CosmicDrifter", "NovaScribe", "SilentRune", "QuantumYap"
];

const GENRE_LABELS = {
    "epic": "Epic Narrative",
    "fantasy": "High Fantasy",
    "horror": "Psychological Horror",
    "science-fiction": "Sci-Fi Odyssey",
    "romance": "Poetic Romance",
    "mystery": "Noir Mystery",
    "thriller": "High-Stakes Thriller",
    "comedy": "Witty Comedy",
};

const MAX_CHAR_LENGTH = 5000;
const CHAR_WARNING_THRESHOLD = 0.9;

const state = {
    currentTab: "home",
    sessionId: "",
    userHandle: "",
    feedSort: "new",
    feedGenre: "all",
    upvotedPosts: new Set(),
    activeAudioPlayer: null,
    postsCache: new Map(),
};

// =============================================================================
// Safe DOM Elements Registry Helper
// =============================================================================

const elements = {
    // Navigation & Tabs
    get tabBtnHome() { return document.getElementById("tab-btn-home"); },
    get tabBtnSocial() { return document.getElementById("tab-btn-social"); },
    get viewHome() { return document.getElementById("view-home"); },
    get viewSocial() { return document.getElementById("view-social"); },
    get navFeedCount() { return document.getElementById("nav-feed-count"); },

    // Identity
    get identityChip() { return document.getElementById("identity-chip"); },
    get headerAvatar() { return document.getElementById("header-avatar"); },
    get headerHandle() { return document.getElementById("header-handle"); },
    get openIdentityModalBtn() { return document.getElementById("open-identity-modal-btn"); },
    get quickRerollBtn() { return document.getElementById("quick-reroll-btn"); },
    get creationHandleText() { return document.getElementById("creation-handle-text"); },
    get publishingHandleBadge() { return document.getElementById("publishing-handle-badge"); },
    get badgeEditHandleBtn() { return document.getElementById("badge-edit-handle-btn"); },

    // Creation Suite
    get yapInput() { return document.getElementById("yap-input"); },
    get charCounter() { return document.getElementById("char-counter"); },
    get storyGenre() { return document.getElementById("story-genre"); },
    get voicePreference() { return document.getElementById("voice-preference"); },
    get publishToFeedCheck() { return document.getElementById("publish-to-feed-check"); },
    get transformBtn() { return document.getElementById("transform-btn"); },
    get errorSection() { return document.getElementById("error-section"); },
    get errorMessage() { return document.getElementById("error-message"); },

    // Results Card
    get resultsSection() { return document.getElementById("results-section"); },
    get resultTitle() { return document.getElementById("result-title"); },
    get resultGenreBadge() { return document.getElementById("result-genre-badge"); },
    get resultHandleBadge() { return document.getElementById("result-handle-badge"); },
    get epicText() { return document.getElementById("epic-text"); },
    get audioPlayer() { return document.getElementById("audio-player"); },
    get bgMusicPlayer() { return document.getElementById("bg-music-player"); },
    get sfxPlayer() { return document.getElementById("sfx-player"); },
    get recordId() { return document.getElementById("record-id"); },
    get viewInSocialBtn() { return document.getElementById("view-in-social-btn"); },
    get copyStoryBtn() { return document.getElementById("copy-story-btn"); },

    // Recent Panel ("My Yaps")
    get myYapsFeed() { return document.getElementById("my-yaps-feed"); },
    get myYapsCountBadge() { return document.getElementById("my-yaps-count-badge"); },
    get refreshMyYapsBtn() { return document.getElementById("refresh-my-yaps-btn"); },

    // Social Feed
    get socialPostsContainer() { return document.getElementById("social-posts-container"); },
    get sortNewBtn() { return document.getElementById("sort-new-btn"); },
    get sortTopBtn() { return document.getElementById("sort-top-btn"); },
    get genreFiltersContainer() { return document.getElementById("genre-filters-container"); },
    get refreshFeedBtn() { return document.getElementById("refresh-feed-btn"); },

    // Anonymous Name-Changing Modal
    get identityModal() { return document.getElementById("identity-modal"); },
    get modalCloseBtn() { return document.getElementById("modal-close-btn"); },
    get modalPreviewAvatar() { return document.getElementById("modal-preview-avatar"); },
    get modalPreviewHandle() { return document.getElementById("modal-preview-handle"); },
    get customHandleInput() { return document.getElementById("custom-handle-input"); },
    get handleChipsGrid() { return document.getElementById("handle-chips-grid"); },
    get modalRandomBtn() { return document.getElementById("modal-random-btn"); },
    get modalSaveBtn() { return document.getElementById("modal-save-btn"); },

    // Toasts
    get toastNotification() { return document.getElementById("toast-notification"); },
    get toastText() { return document.getElementById("toast-text"); },
};

// =============================================================================
// API Helper & Synchronized Session Headers
// =============================================================================

function getApiHeaders(extraHeaders = {}) {
    const activeHandle = state.userHandle || localStorage.getItem("yap_handle") || sessionStorage.getItem("yap_handle") || "Girly";
    const activeSession = state.sessionId || localStorage.getItem("yap_session_id") || sessionStorage.getItem("yap_session_id") || "";
    return {
        "X-Session-ID": activeSession,
        "X-User-Handle": activeHandle,
        "X-Anonymous-Handle": activeHandle,
        "X-Anonymous-Id": activeSession,
        "X-Author-Alias": activeHandle,
        ...extraHeaders,
    };
}

async function apiFetch(url, options = {}) {
    const mergedHeaders = getApiHeaders(options.headers || {});
    return fetch(url, {
        ...options,
        headers: mergedHeaders,
    });
}

window.getApiHeaders = getApiHeaders;
window.apiFetch = apiFetch;

// =============================================================================
// Identity & Session Initialization
// =============================================================================

function initSessionAndIdentity() {
    // 1. Session ID persistence across localStorage & sessionStorage
    let storedSession = localStorage.getItem("yap_session_id") || sessionStorage.getItem("yap_session_id");
    if (!storedSession) {
        storedSession = "sess-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now();
    }
    localStorage.setItem("yap_session_id", storedSession);
    sessionStorage.setItem("yap_session_id", storedSession);
    state.sessionId = storedSession;

    // 2. Anonymous handle persistence across localStorage & sessionStorage
    let storedHandle = localStorage.getItem("yap_handle") || sessionStorage.getItem("yap_handle");
    if (!storedHandle) {
        storedHandle = ANONYMOUS_HANDLES[Math.floor(Math.random() * ANONYMOUS_HANDLES.length)];
    }
    updateUserHandle(storedHandle);

    // 3. Upvoted posts memory
    try {
        const storedVotes = JSON.parse(localStorage.getItem("yap_upvoted_posts") || "[]");
        state.upvotedPosts = new Set(storedVotes);
    } catch (e) {
        state.upvotedPosts = new Set();
    }
}

function updateUserHandle(handle) {
    const cleanHandle = String(handle || "").trim().replace(/^u\//, "") || "Anonymous";
    state.userHandle = cleanHandle;
    localStorage.setItem("yap_handle", cleanHandle);
    sessionStorage.setItem("yap_handle", cleanHandle);

    const avatarColor = generateAvatarColor(cleanHandle);
    const initial = cleanHandle.charAt(0).toUpperCase();

    // Update Header Elements
    if (elements.headerHandle) {
        elements.headerHandle.textContent = `u/${cleanHandle}`;
    }
    if (elements.headerAvatar) {
        elements.headerAvatar.textContent = initial;
        elements.headerAvatar.style.background = avatarColor;
    }
    if (elements.identityChip) {
        elements.identityChip.setAttribute("aria-label", `Current identity u/${cleanHandle}, click to change handle`);
    }

    // Update Creation Suite
    if (elements.creationHandleText) {
        elements.creationHandleText.textContent = `u/${cleanHandle}`;
    }

    // Update Result Badge if displayed
    if (elements.resultHandleBadge) {
        elements.resultHandleBadge.textContent = `u/${cleanHandle}`;
    }

    // Update Modal
    if (elements.modalPreviewHandle) {
        elements.modalPreviewHandle.textContent = `u/${cleanHandle}`;
    }
    if (elements.modalPreviewAvatar) {
        elements.modalPreviewAvatar.textContent = initial;
        elements.modalPreviewAvatar.style.background = avatarColor;
    }
    if (elements.customHandleInput) {
        elements.customHandleInput.value = cleanHandle;
    }

    // Update any active flowchart composer headers
    document.querySelectorAll(".composer-active-handle").forEach(el => {
        el.textContent = `u/${cleanHandle}`;
    });

    // Notify document listeners of session state change
    document.dispatchEvent(new CustomEvent("yap:identityChanged", {
        detail: { handle: cleanHandle, sessionId: state.sessionId }
    }));
}

window.updateUserHandle = updateUserHandle;

function generateAvatarColor(text) {
    const palette = [
        "linear-gradient(135deg, #6366f1, #8b5cf6)",
        "linear-gradient(135deg, #a855f7, #d946ef)",
        "linear-gradient(135deg, #06b6d4, #3b82f6)",
        "linear-gradient(135deg, #10b981, #059669)",
        "linear-gradient(135deg, #f59e0b, #ea580c)",
        "linear-gradient(135deg, #ec4899, #f43f5e)",
        "linear-gradient(135deg, #8b5cf6, #ec4899)",
        "linear-gradient(135deg, #14b8a6, #06b6d4)"
    ];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % palette.length;
    return palette[idx];
}

function formatRelativeTime(isoString) {
    if (!isoString) return "recently";
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return "recently";
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return "just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        return date.toLocaleDateString();
    } catch {
        return "recently";
    }
}

let toastTimeout = null;
function showToast(message) {
    const toast = elements.toastNotification;
    const textEl = elements.toastText;
    if (!toast || !textEl) return;

    textEl.textContent = message;
    toast.removeAttribute("hidden");
    toast.style.display = "block";

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.style.display = "none";
        toast.setAttribute("hidden", "");
    }, 3200);
}
window.showToast = showToast;

// =============================================================================
// Tab Navigation: Home Tab vs Social Tab
// =============================================================================

function switchTab(tab) {
    state.currentTab = tab;
    const isHome = tab === "home";

    if (elements.tabBtnHome) {
        elements.tabBtnHome.classList.toggle("active", isHome);
        elements.tabBtnHome.setAttribute("aria-selected", isHome);
    }
    if (elements.tabBtnSocial) {
        elements.tabBtnSocial.classList.toggle("active", !isHome);
        elements.tabBtnSocial.setAttribute("aria-selected", !isHome);
    }

    if (elements.viewHome) {
        elements.viewHome.classList.toggle("active", isHome);
        elements.viewHome.hidden = !isHome;
    }

    if (elements.viewSocial) {
        elements.viewSocial.classList.toggle("active", !isHome);
        elements.viewSocial.hidden = isHome;
    }

    window.location.hash = tab;

    if (!isHome) {
        loadSocialFeed();
    } else {
        loadMyYaps();
    }
}
window.switchTab = switchTab;

// =============================================================================
// Creation Suite Logic (Transform API)
// =============================================================================

function updateCharCounter() {
    if (!elements.yapInput || !elements.charCounter) return;
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

function setTransformLoading(isLoading) {
    if (!elements.transformBtn) return;
    elements.transformBtn.disabled = isLoading;
    const defaultContent = elements.transformBtn.querySelector(".btn-default-content");
    const loadingContent = elements.transformBtn.querySelector(".btn-loading-content");

    if (defaultContent) defaultContent.hidden = isLoading;
    if (loadingContent) loadingContent.hidden = !isLoading;

    if (isLoading && elements.errorSection) {
        elements.errorSection.hidden = true;
    }
}

function showError(message) {
    if (elements.errorMessage) elements.errorMessage.textContent = message;
    if (elements.errorSection) {
        elements.errorSection.hidden = false;
        elements.errorSection.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (elements.resultsSection) elements.resultsSection.hidden = true;
}

async function handleTransform() {
    const inputText = elements.yapInput ? elements.yapInput.value.trim() : "";

    if (!inputText) {
        showError("Please enter your daily yap before generating a story.");
        if (elements.yapInput) elements.yapInput.focus();
        return;
    }

    if (inputText.length > MAX_CHAR_LENGTH) {
        showError(`Your text exceeds the ${MAX_CHAR_LENGTH} character limit.`);
        return;
    }

    setTransformLoading(true);

    const payload = {
        text: inputText,
        genre: elements.storyGenre ? elements.storyGenre.value : "epic",
        voice: elements.voicePreference ? elements.voicePreference.value : "Matthew",
        is_public: elements.publishToFeedCheck ? elements.publishToFeedCheck.checked : true,
        handle: state.userHandle,
        session_id: state.sessionId,
    };

    try {
        const res = await apiFetch("/api/transform", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server returned ${res.status}`);
        }

        const data = await res.json();
        displayGenerationResults(data);

        // Clear textarea & refresh history
        if (elements.yapInput) elements.yapInput.value = "";
        updateCharCounter();
        loadMyYaps();
        updateFeedBadgeCount();
        showToast("Audio Tale generated successfully!");
    } catch (err) {
        console.error("Transformation failed:", err);
        showError("Unable to reach the server. Please check connection and try again.");
    } finally {
        setTransformLoading(false);
    }
}

function displayGenerationResults(data) {
    if (!elements.resultsSection) return;

    if (elements.epicText) elements.epicText.textContent = data.epic_text;

    // Direct S3 Audio stream
    const audioUrl = data.stream_url || data.audio_url;
    if (elements.audioPlayer) {
        elements.audioPlayer.src = audioUrl;
        elements.audioPlayer.load();
    }

    // Ambience
    if (elements.bgMusicPlayer && data.bg_music_url) {
        elements.bgMusicPlayer.src = data.bg_music_url;
        elements.bgMusicPlayer.volume = 0.2;
        elements.bgMusicPlayer.load();
    }
    if (elements.sfxPlayer && data.sfx_url) {
        elements.sfxPlayer.src = data.sfx_url;
        elements.sfxPlayer.volume = 0.4;
        elements.sfxPlayer.load();
    }

    if (elements.recordId) elements.recordId.textContent = data.id;

    const genre = data.genre || "epic";
    if (elements.resultGenreBadge) {
        elements.resultGenreBadge.textContent = GENRE_LABELS[genre] || genre;
    }
    if (elements.resultHandleBadge) {
        elements.resultHandleBadge.textContent = `u/${data.handle || state.userHandle}`;
    }

    if (elements.resultTitle) {
        elements.resultTitle.textContent = `${genre.charAt(0).toUpperCase() + genre.slice(1)} Narrative`;
    }

    if (elements.viewInSocialBtn) {
        elements.viewInSocialBtn.onclick = () => {
            switchTab("social");
            setTimeout(() => {
                const card = document.getElementById(`post-${data.id}`);
                if (card) {
                    card.scrollIntoView({ behavior: "smooth", block: "center" });
                    card.style.borderColor = "var(--border-focus)";
                }
            }, 500);
        };
    }

    if (elements.copyStoryBtn) {
        elements.copyStoryBtn.onclick = () => {
            navigator.clipboard.writeText(data.epic_text).then(() => {
                showToast("Narrative copied to clipboard!");
            });
        };
    }

    elements.resultsSection.hidden = false;
    if (elements.errorSection) elements.errorSection.hidden = true;
    elements.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// =============================================================================
// Recent Activity Panel ("My Yaps")
// =============================================================================

async function loadMyYaps() {
    if (!elements.myYapsFeed) return;
    try {
        const url = `/api/my-yaps?session_id=${encodeURIComponent(state.sessionId)}&handle=${encodeURIComponent(state.userHandle)}`;
        const res = await apiFetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const posts = data.posts || [];
        renderMyYapsFeed(posts);

        if (elements.myYapsCountBadge) {
            elements.myYapsCountBadge.textContent = posts.length;
        }
    } catch (err) {
        console.warn("Failed to load My Yaps:", err);
        elements.myYapsFeed.innerHTML = `
            <div class="empty-state">
                <p class="empty-desc">Could not load recent yaps. Try refreshing.</p>
            </div>
        `;
    }
}

function renderMyYapsFeed(posts) {
    if (!elements.myYapsFeed) return;
    if (!posts || posts.length === 0) {
        elements.myYapsFeed.innerHTML = `
            <div class="flowchart-empty-state">
                <span class="flowchart-empty-icon">🎙️</span>
                <p>No audio tales created yet.</p>
                <p style="font-size:0.75rem; color:var(--text-dim)">Generate your first story using the Creation Suite on the left!</p>
            </div>
        `;
        return;
    }

    elements.myYapsFeed.innerHTML = posts.map(post => {
        const audioSrc = post.stream_url || post.audio_url;
        const authorInitial = (post.handle || "A").charAt(0).toUpperCase();
        const avatarColor = generateAvatarColor(post.handle || "Anonymous");
        const genreBadge = GENRE_LABELS[post.genre] || post.genre || "Epic";

        return `
            <article class="yap-card" id="my-yap-${post.id}">
                <div class="yap-card-header">
                    <div class="yap-card-author">
                        <div class="yap-card-avatar" style="background: ${avatarColor}">${authorInitial}</div>
                        <span class="yap-card-handle">u/${escapeHtml(post.handle || state.userHandle)}</span>
                        <span class="yap-card-time">· ${formatRelativeTime(post.created_at)}</span>
                    </div>
                    <span class="genre-tag">${genreBadge}</span>
                </div>

                <p class="yap-card-narrative">${escapeHtml(post.epic_text)}</p>

                <div class="yap-card-audio">
                    <audio class="s3-audio-player" playsinline controls preload="none" src="${audioSrc}"></audio>
                </div>

                <div class="yap-card-footer">
                    <span>${post.upvotes || 0} upvotes · ${(post.comments || []).length} comments</span>
                    <button class="btn btn-secondary btn-sm" onclick="jumpToDiscussion('${post.id}')" type="button">
                        Explore Flowchart 🌿
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

window.jumpToDiscussion = function(postId) {
    switchTab("social");
    setTimeout(() => {
        const card = document.getElementById(`post-${postId}`);
        if (card) {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            const toggleBtn = document.getElementById(`flowchart-toggle-${postId}`);
            if (toggleBtn && !toggleBtn.classList.contains("expanded")) {
                toggleBtn.click();
            }
            card.style.borderColor = "var(--border-focus)";
        }
    }, 450);
};

// =============================================================================
// Dedicated Public Community Social Feed & Modular Audio Cards
// =============================================================================

async function loadSocialFeed() {
    if (!elements.socialPostsContainer) return;

    elements.socialPostsContainer.innerHTML = `
        <div class="flowchart-empty-state">
            <span class="spinner" aria-hidden="true"></span>
            <p>Loading community audio stories…</p>
        </div>
    `;

    try {
        const url = `/api/feed?sort=${state.feedSort}&genre=${state.feedGenre}`;
        const res = await apiFetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const posts = data.posts || [];
        state.postsCache.clear();
        posts.forEach(p => state.postsCache.set(p.id, p));

        renderSocialFeed(posts);

        if (elements.navFeedCount) {
            elements.navFeedCount.textContent = posts.length;
        }
    } catch (err) {
        console.error("Failed to load community feed:", err);
        elements.socialPostsContainer.innerHTML = `
            <div class="flowchart-empty-state">
                <span class="flowchart-empty-icon">⚠️</span>
                <p>Could not connect to the community feed.</p>
                <button class="btn btn-secondary btn-sm" onclick="loadSocialFeed()">Retry</button>
            </div>
        `;
    }
}

async function updateFeedBadgeCount() {
    try {
        const res = await apiFetch("/api/feed?sort=new&genre=all");
        if (res.ok) {
            const data = await res.json();
            if (elements.navFeedCount) {
                elements.navFeedCount.textContent = (data.posts || []).length;
            }
        }
    } catch (e) {}
}

function renderSocialFeed(posts) {
    if (!elements.socialPostsContainer) return;

    if (!posts || posts.length === 0) {
        elements.socialPostsContainer.innerHTML = `
            <div class="flowchart-empty-state">
                <span class="flowchart-empty-icon">🪐</span>
                <h3>No Stories Found</h3>
                <p>No public audio tales in this category. Be the first to publish a yap!</p>
            </div>
        `;
        return;
    }

    elements.socialPostsContainer.innerHTML = posts.map(post => {
        const audioSrc = post.stream_url || post.audio_url;
        const isUpvoted = state.upvotedPosts.has(post.id);
        const upvoteCount = post.upvotes || 0;
        const authorInitial = (post.handle || "A").charAt(0).toUpperCase();
        const avatarColor = generateAvatarColor(post.handle || "Anonymous");
        const genreBadge = GENRE_LABELS[post.genre] || post.genre || "Epic";
        const commentsCount = (post.comments || []).length;

        return `
            <article class="community-audio-card" id="post-${post.id}">
                <!-- Left Upvote Column -->
                <div class="upvote-column">
                    <button 
                        class="upvote-btn ${isUpvoted ? "voted" : ""}" 
                        onclick="handleUpvote('${post.id}')"
                        title="Upvote story"
                        aria-label="Upvote story"
                        type="button"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="18 15 12 9 6 15"></polyline>
                        </svg>
                    </button>
                    <span class="upvote-count" id="upvotes-${post.id}">${upvoteCount}</span>
                </div>

                <!-- Post Main Content -->
                <div class="post-main">
                    <!-- Post Header -->
                    <div class="post-header">
                        <div class="post-meta-left">
                            <div class="post-avatar" style="background: ${avatarColor}">${authorInitial}</div>
                            <span class="post-handle">u/${escapeHtml(post.handle || "Anonymous")}</span>
                            <span class="post-time">· ${formatRelativeTime(post.created_at)}</span>
                        </div>
                        <div class="post-meta-right">
                            <span class="genre-tag genre-${escapeHtml(post.genre || 'epic')}">${genreBadge}</span>
                        </div>
                    </div>

                    <!-- Story Narrative Text -->
                    <p class="post-narrative">${escapeHtml(post.epic_text)}</p>

                    <!-- Raw Yap Accordion (if provided) -->
                    ${post.original_text ? `
                    <details class="raw-yap-details">
                        <summary class="raw-yap-summary">📄 View Raw Daily Yap</summary>
                        <p class="raw-yap-text">${escapeHtml(post.original_text)}</p>
                    </details>
                    ` : ""}

                    <!-- Direct S3 Audio Streaming Player -->
                    <div class="post-audio-wrapper">
                        <span class="post-audio-badge">
                            <span class="audio-pulse"></span>
                            S3 Audio Stream
                        </span>
                        <audio class="post-audio-player s3-audio-player" playsinline controls preload="none" src="${audioSrc}"></audio>
                    </div>

                    <!-- Post Action Bar -->
                    <div class="post-actions-bar">
                        <button class="action-btn" onclick="copyAudioLink('${audioSrc}')" type="button" title="Copy S3 media link">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                            Copy S3 Audio Link
                        </button>
                        <button class="action-btn" onclick="sharePost('${post.id}')" type="button" title="Share story">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="18" cy="5" r="3"></circle>
                                <circle cx="6" cy="12" r="3"></circle>
                                <circle cx="18" cy="19" r="3"></circle>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </svg>
                            Share Tale
                        </button>
                    </div>

                    <!-- Dropdown Toggle Button for Leftward Flowchart Expansion -->
                    <button 
                        class="flowchart-dropdown-toggle" 
                        id="flowchart-toggle-${post.id}" 
                        onclick="toggleFlowchart('${post.id}')" 
                        type="button" 
                        aria-expanded="false"
                        aria-controls="flowchart-panel-${post.id}"
                    >
                        <div class="flowchart-toggle-left">
                            <span class="flowchart-toggle-glyph">🌿</span>
                            <span>Discussion Flowchart</span>
                            <span class="flowchart-node-badge" id="flowchart-count-badge-${post.id}">${commentsCount} nodes</span>
                        </div>
                        <svg class="flowchart-toggle-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>

                    <!-- Interactive Leftward Flowchart Dropdown Panel -->
                    <div class="flowchart-panel" id="flowchart-panel-${post.id}" hidden>
                        <!-- Loaded dynamically via renderFlowchart -->
                    </div>

                </div>
            </article>
        `;
    }).join("");
}

// =============================================================================
// Leftward Flowchart Comments Expansion & Interaction
// =============================================================================

window.toggleFlowchart = async function(postId) {
    const panel = document.getElementById(`flowchart-panel-${postId}`);
    const toggleBtn = document.getElementById(`flowchart-toggle-${postId}`);
    if (!panel || !toggleBtn) return;

    const isHidden = panel.hidden;
    if (isHidden) {
        panel.removeAttribute("hidden");
        panel.style.display = "block";
        toggleBtn.classList.add("expanded");
        toggleBtn.setAttribute("aria-expanded", "true");

        // Load latest discussion comments & render flowchart
        panel.innerHTML = `
            <div class="flowchart-empty-state">
                <span class="spinner" aria-hidden="true"></span>
                <p>Generating discussion flowchart branches…</p>
            </div>
        `;

        try {
            const res = await apiFetch(`/api/posts/${postId}/comments`);
            const data = await res.json();
            const post = state.postsCache.get(postId) || {};
            renderFlowchart(postId, data.comments || [], post);
        } catch (e) {
            console.warn("Failed to fetch comments for flowchart:", e);
            panel.innerHTML = `<p class="error-text">Failed to load flowchart nodes.</p>`;
        }
    } else {
        panel.style.display = "none";
        panel.setAttribute("hidden", "");
        toggleBtn.classList.remove("expanded");
        toggleBtn.setAttribute("aria-expanded", "false");
    }
};

function renderFlowchart(postId, comments, post) {
    const panel = document.getElementById(`flowchart-panel-${postId}`);
    if (!panel) return;

    const postAuthor = post.handle || "Anonymous";
    const postSnippet = (post.epic_text || "Original Story Narrative").substring(0, 90) + "…";
    const nodeCount = comments.length;

    // Partition comments into levels expanding to the left:
    // Level 1: Primary discussion nodes
    // Level 2: Secondary / nested reply branches
    const level1Comments = comments.filter((_, idx) => idx % 2 === 0);
    const level2Comments = comments.filter((_, idx) => idx % 2 === 1);

    panel.innerHTML = `
        <!-- Flowchart Header Bar -->
        <div class="flowchart-header-bar">
            <div class="flowchart-title-area">
                <h4 class="flowchart-title">🌿 Discussion Flowchart</h4>
                <span class="flowchart-direction-hint">◀ Flow branches expand towards the left</span>
            </div>
            <span class="tab-badge-count">${nodeCount} Active Discussion Nodes</span>
        </div>

        <!-- Flowchart Interactive Node Composer -->
        <div class="flowchart-composer">
            <div class="composer-identity-row">
                <span class="composer-handle-chip">
                    Planting node as: <strong class="composer-active-handle">u/${escapeHtml(state.userHandle)}</strong>
                </span>
                <div class="composer-controls">
                    <label for="node-type-${postId}" class="visually-hidden" style="display:none">Node Type</label>
                    <select id="node-type-${postId}" class="node-type-select">
                        <option value="reaction">💬 Reaction Node</option>
                        <option value="theory">💡 Plot Theory</option>
                        <option value="take">🔥 Hot Take</option>
                        <option value="praise">✨ Story Praise</option>
                    </select>
                </div>
            </div>
            <div class="composer-input-wrapper">
                <textarea 
                    id="flowchart-input-${postId}" 
                    class="flowchart-textarea" 
                    placeholder="Attach an anonymous thought, reaction, or theory to this story flowchart..."
                    rows="2"
                    maxlength="1000"
                ></textarea>
                <button class="btn btn-primary btn-sm" onclick="submitFlowchartNode('${postId}')" type="button">
                    Plant Node ◀
                </button>
            </div>
        </div>

        <!-- Flowchart Scroll Viewport (Expands towards the Left via row-reverse) -->
        <div class="flowchart-scroll-viewport">
            <div class="flowchart-canvas" id="flowchart-canvas-${postId}">

                <!-- Far Right: Root Story Node (Level 0 Origin) -->
                <div class="flowchart-level-col">
                    <div class="flowchart-root-node">
                        <span class="root-node-tag">Broadcast Origin (Root Level)</span>
                        <h5 class="root-node-title">u/${escapeHtml(postAuthor)}'s Tale</h5>
                        <p style="font-size: 0.8125rem; color: #cbd5e1; line-height: 1.5; margin-bottom: 0.5rem;">
                            "${escapeHtml(postSnippet)}"
                        </p>
                        <div class="root-node-meta">
                            <span>Genre: ${escapeHtml(post.genre || 'Epic')}</span>
                            <span>·</span>
                            <span>${nodeCount} Branches</span>
                        </div>
                    </div>
                </div>

                <!-- Center-Left: Primary Reaction Branches (Level 1) -->
                <div class="flowchart-level-col" id="flowchart-level-1-${postId}">
                    ${level1Comments.length > 0 ? level1Comments.map((c, i) => renderNodeCard(c, i * 2 + 1, postId)).join("") : `
                        <div class="flowchart-empty-state" style="padding:1rem;">
                            <span style="font-size:1.5rem;">🌱</span>
                            <p style="font-size:0.8rem; color:var(--text-dim);">No reaction nodes yet. Plant the first node!</p>
                        </div>
                    `}
                </div>

                <!-- Far Left: Secondary Branch Extensions (Level 2) -->
                ${level2Comments.length > 0 ? `
                <div class="flowchart-level-col" id="flowchart-level-2-${postId}">
                    ${level2Comments.map((c, i) => renderNodeCard(c, i * 2 + 2, postId)).join("")}
                </div>
                ` : ""}

            </div>
        </div>
    `;
}

function renderNodeCard(comment, index, postId) {
    const initial = (comment.handle || "A").charAt(0).toUpperCase();
    const avatarColor = generateAvatarColor(comment.handle || "Anonymous");
    const nodeType = comment.node_type || (index % 4 === 0 ? "theory" : index % 3 === 0 ? "take" : "reaction");
    
    const catLabels = {
        reaction: { class: "cat-reaction", text: "💬 Reaction" },
        theory:   { class: "cat-theory",   text: "💡 Theory" },
        take:     { class: "cat-take",     text: "🔥 Hot Take" },
        praise:   { class: "cat-praise",   text: "✨ Praise" },
    };
    const cat = catLabels[nodeType] || catLabels.reaction;

    return `
        <div class="flowchart-node-card" id="node-${comment.id || index}">
            <div class="flowchart-node-header">
                <span class="node-badge-id">#NODE-${String(index).padStart(2, "0")}</span>
                <span class="node-category-pill ${cat.class}">${cat.text}</span>
            </div>

            <div class="flowchart-node-author">
                <div class="node-author-avatar" style="background: ${avatarColor}">${initial}</div>
                <span class="node-author-handle">u/${escapeHtml(comment.handle || "Anonymous")}</span>
                <span class="node-time">· ${formatRelativeTime(comment.created_at)}</span>
            </div>

            <p class="flowchart-node-text">${escapeHtml(comment.text)}</p>

            <div class="flowchart-node-footer">
                <button class="node-reply-btn" onclick="quoteNodeInComposer('${postId}', 'u/${escapeHtml(comment.handle || "Anonymous")}')" type="button">
                    ◀ Branch Reply
                </button>
                <span style="font-size:0.7rem; color:var(--text-dim)">Tree Level ${index % 2 === 0 ? "2 (Outer)" : "1 (Direct)"}</span>
            </div>
        </div>
    `;
}

window.quoteNodeInComposer = function(postId, authorHandle) {
    const input = document.getElementById(`flowchart-input-${postId}`);
    if (input) {
        input.value = `@${authorHandle} `;
        input.focus();
    }
};

window.submitFlowchartNode = async function(postId) {
    const input = document.getElementById(`flowchart-input-${postId}`);
    const typeSelect = document.getElementById(`node-type-${postId}`);
    if (!input) return;

    const text = input.value.trim();
    if (!text) {
        showToast("Please enter text before planting a flowchart node.");
        input.focus();
        return;
    }

    const nodeType = typeSelect ? typeSelect.value : "reaction";

    try {
        const res = await apiFetch(`/api/posts/${postId}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: text,
                handle: state.userHandle,
                node_type: nodeType,
            }),
        });

        if (!res.ok) {
            showToast("Failed to plant node in flowchart.");
            return;
        }

        const data = await res.json();
        input.value = "";
        showToast("Flowchart node planted anonymously!");

        // Update node counts
        const countBadge = document.getElementById(`flowchart-count-badge-${postId}`);
        if (countBadge) countBadge.textContent = `${data.comments_count} nodes`;

        // Refresh flowchart
        const commentsRes = await apiFetch(`/api/posts/${postId}/comments`);
        const commentsData = await commentsRes.json();
        const post = state.postsCache.get(postId) || {};
        renderFlowchart(postId, commentsData.comments || [], post);
    } catch (err) {
        console.error("Submit node failed:", err);
        showToast("Network error. Please try again.");
    }
};

// =============================================================================
// Feed Upvoting & Utility Actions
// =============================================================================

window.handleUpvote = async function(postId) {
    const isAlreadyVoted = state.upvotedPosts.has(postId);
    if (isAlreadyVoted) {
        showToast("You already upvoted this tale!");
        return;
    }

    const btn = document.querySelector(`#post-${postId} .upvote-btn`);
    const counter = document.getElementById(`upvotes-${postId}`);
    if (btn) btn.classList.add("voted");

    let currentVal = parseInt(counter ? counter.textContent : "0", 10) || 0;
    if (counter) counter.textContent = currentVal + 1;

    state.upvotedPosts.add(postId);
    localStorage.setItem("yap_upvoted_posts", JSON.stringify(Array.from(state.upvotedPosts)));

    try {
        const res = await apiFetch(`/api/posts/${postId}/upvote`, { method: "POST" });
        if (res.ok) {
            const data = await res.json();
            if (data.upvotes && counter) counter.textContent = data.upvotes;
        }
    } catch (err) {
        console.warn("Upvote sync error:", err);
    }
};

window.copyAudioLink = function(audioSrc) {
    const fullUrl = audioSrc.startsWith("http") ? audioSrc : window.location.origin + audioSrc;
    navigator.clipboard.writeText(fullUrl).then(() => {
        showToast("Direct S3 Audio Link copied to clipboard!");
    });
};

window.sharePost = function(postId) {
    const postUrl = `${window.location.origin}/#social`;
    navigator.clipboard.writeText(postUrl).then(() => {
        showToast("Story link copied to clipboard!");
    });
};

// Single Active Audio Player Coordinator
document.addEventListener("play", function(event) {
    if (event.target && event.target.tagName === "AUDIO") {
        const currentAudio = event.target;
        if (currentAudio === elements.bgMusicPlayer || currentAudio === elements.sfxPlayer) {
            return;
        }
        document.querySelectorAll("audio").forEach(a => {
            if (a !== currentAudio && a !== elements.bgMusicPlayer && a !== elements.sfxPlayer) {
                a.pause();
            }
        });
    }
}, true);

// =============================================================================
// Anonymous Name-Changing Modal Popup Logic & Event Triggers
// =============================================================================

function renderSuggestedHandleChips() {
    const container = elements.handleChipsGrid;
    if (!container) return;

    container.innerHTML = ANONYMOUS_HANDLES.map(h => `
        <button 
            class="handle-chip-btn ${h === state.userHandle ? 'active' : ''}" 
            type="button" 
            onclick="selectSuggestedHandle('${h}')"
        >
            u/${h}
        </button>
    `).join("");
}

function openIdentityModal() {
    const modal = elements.identityModal;
    if (!modal) return;

    modal.removeAttribute("hidden");
    modal.classList.add("active");
    modal.dataset.active = "true";
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");

    if (elements.customHandleInput) {
        elements.customHandleInput.value = state.userHandle;
    }
    if (elements.modalPreviewHandle) {
        elements.modalPreviewHandle.textContent = `u/${state.userHandle}`;
    }
    if (elements.modalPreviewAvatar) {
        elements.modalPreviewAvatar.textContent = state.userHandle.charAt(0).toUpperCase();
        elements.modalPreviewAvatar.style.background = generateAvatarColor(state.userHandle);
    }

    renderSuggestedHandleChips();

    setTimeout(() => {
        if (elements.customHandleInput) {
            elements.customHandleInput.focus();
            elements.customHandleInput.select();
        }
    }, 60);

    document.body.style.overflow = "hidden";
}

function closeIdentityModal() {
    const modal = elements.identityModal;
    if (!modal) return;

    modal.classList.remove("active");
    modal.dataset.active = "false";
    modal.style.display = "none";
    modal.setAttribute("hidden", "");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function toggleIdentityModal() {
    const modal = elements.identityModal;
    if (!modal) return;
    const isVisible = !modal.hasAttribute("hidden") && modal.style.display === "flex";
    if (isVisible) {
        closeIdentityModal();
    } else {
        openIdentityModal();
    }
}

window.openIdentityModal = openIdentityModal;
window.closeIdentityModal = closeIdentityModal;
window.toggleIdentityModal = toggleIdentityModal;

window.selectSuggestedHandle = function(handle) {
    if (elements.customHandleInput) {
        elements.customHandleInput.value = handle;
    }
    if (elements.modalPreviewHandle) {
        elements.modalPreviewHandle.textContent = `u/${handle}`;
    }
    if (elements.modalPreviewAvatar) {
        elements.modalPreviewAvatar.textContent = handle.charAt(0).toUpperCase();
        elements.modalPreviewAvatar.style.background = generateAvatarColor(handle);
    }

    if (elements.handleChipsGrid) {
        const chips = elements.handleChipsGrid.querySelectorAll(".handle-chip-btn");
        chips.forEach(btn => {
            btn.classList.toggle("active", btn.textContent.trim() === `u/${handle}`);
        });
    }
};

// =============================================================================
// DOM Event Listeners Setup
// =============================================================================

function setupEventListeners() {
    // Navigation Tabs
    if (elements.tabBtnHome) {
        elements.tabBtnHome.addEventListener("click", () => switchTab("home"));
    }
    if (elements.tabBtnSocial) {
        elements.tabBtnSocial.addEventListener("click", () => switchTab("social"));
    }

    // Creation Suite
    if (elements.yapInput) {
        elements.yapInput.addEventListener("input", updateCharCounter);
        elements.yapInput.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleTransform();
            }
        });
    }
    if (elements.transformBtn) {
        elements.transformBtn.addEventListener("click", handleTransform);
    }

    // Refresh Buttons
    if (elements.refreshMyYapsBtn) {
        elements.refreshMyYapsBtn.addEventListener("click", loadMyYaps);
    }
    if (elements.refreshFeedBtn) {
        elements.refreshFeedBtn.addEventListener("click", loadSocialFeed);
    }

    // Sort Feed Buttons
    if (elements.sortNewBtn) {
        elements.sortNewBtn.addEventListener("click", () => {
            elements.sortNewBtn.classList.add("active");
            if (elements.sortTopBtn) elements.sortTopBtn.classList.remove("active");
            state.feedSort = "new";
            loadSocialFeed();
        });
    }
    if (elements.sortTopBtn) {
        elements.sortTopBtn.addEventListener("click", () => {
            elements.sortTopBtn.classList.add("active");
            if (elements.sortNewBtn) elements.sortNewBtn.classList.remove("active");
            state.feedSort = "top";
            loadSocialFeed();
        });
    }

    // Genre Filters
    if (elements.genreFiltersContainer) {
        elements.genreFiltersContainer.addEventListener("click", (e) => {
            const pill = e.target.closest(".genre-filter-pill");
            if (pill) {
                elements.genreFiltersContainer.querySelectorAll(".genre-filter-pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                state.feedGenre = pill.dataset.genre || "all";
                loadSocialFeed();
            }
        });
    }

    // Identity Modal Triggers
    if (elements.identityChip) {
        elements.identityChip.addEventListener("click", (e) => {
            if (e.target.closest("#quick-reroll-btn")) return;
            openIdentityModal();
        });
        elements.identityChip.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openIdentityModal();
            }
        });
    }

    if (elements.openIdentityModalBtn) {
        elements.openIdentityModalBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openIdentityModal();
        });
    }

    if (elements.publishingHandleBadge) {
        elements.publishingHandleBadge.addEventListener("click", openIdentityModal);
    }
    if (elements.badgeEditHandleBtn) {
        elements.badgeEditHandleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openIdentityModal();
        });
    }

    // Quick Reroll Dice Button
    if (elements.quickRerollBtn) {
        elements.quickRerollBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const currentIdx = ANONYMOUS_HANDLES.indexOf(state.userHandle);
            const available = ANONYMOUS_HANDLES.filter((_, i) => i !== currentIdx);
            const pick = available[Math.floor(Math.random() * available.length)];
            updateUserHandle(pick);
            showToast(`Rerolled identity to u/${pick}`);
            loadMyYaps();
        });
    }

    // Modal Internal Controls
    if (elements.modalCloseBtn) {
        elements.modalCloseBtn.addEventListener("click", closeIdentityModal);
    }

    if (elements.identityModal) {
        elements.identityModal.addEventListener("click", (e) => {
            if (e.target === elements.identityModal) {
                closeIdentityModal();
            }
        });
    }

    if (elements.modalRandomBtn) {
        elements.modalRandomBtn.addEventListener("click", () => {
            const pick = ANONYMOUS_HANDLES[Math.floor(Math.random() * ANONYMOUS_HANDLES.length)];
            selectSuggestedHandle(pick);
        });
    }

    if (elements.modalSaveBtn) {
        elements.modalSaveBtn.addEventListener("click", () => {
            const newHandle = (elements.customHandleInput ? elements.customHandleInput.value : "").trim().replace(/^u\//, "");
            if (!newHandle) {
                showToast("Handle cannot be blank.");
                return;
            }
            updateUserHandle(newHandle);
            closeIdentityModal();
            showToast(`Broadcast identity updated: u/${newHandle}`);
            loadMyYaps();
        });
    }

    if (elements.customHandleInput) {
        elements.customHandleInput.addEventListener("input", (e) => {
            const val = e.target.value.trim().replace(/^u\//, "") || "Anonymous";
            if (elements.modalPreviewHandle) {
                elements.modalPreviewHandle.textContent = `u/${val}`;
            }
            if (elements.modalPreviewAvatar) {
                elements.modalPreviewAvatar.textContent = val.charAt(0).toUpperCase();
                elements.modalPreviewAvatar.style.background = generateAvatarColor(val);
            }
        });

        elements.customHandleInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                if (elements.modalSaveBtn) elements.modalSaveBtn.click();
            }
        });
    }

    // Delegated click listener for any session edit actions across views
    document.addEventListener("click", (e) => {
        const trigger = e.target.closest("[data-action='change-handle'], [data-action='edit-identity'], [data-trigger='identity-modal'], .trigger-identity-modal, .btn-edit-handle, .badge-edit-btn, .identity-edit-btn");
        if (trigger && !trigger.closest("#quick-reroll-btn") && !trigger.closest(".modal-card")) {
            e.preventDefault();
            openIdentityModal();
        }
    });

    // Escape Key to close modal
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && elements.identityModal && !elements.identityModal.hasAttribute("hidden") && elements.identityModal.style.display === "flex") {
            closeIdentityModal();
        }
    });
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Initialize on Load
document.addEventListener("DOMContentLoaded", () => {
    initSessionAndIdentity();
    setupEventListeners();
    updateCharCounter();

    if (window.location.hash === "#social") {
        switchTab("social");
    } else {
        switchTab("home");
    }

    updateFeedBadgeCount();
});
