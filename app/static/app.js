// =============================================================================
// Yap-to-Tale — Anonymous Audio Social Platform Application Logic
// Reddit-Style Social Architecture & Two-Column Dashboard
// =============================================================================

"use strict";

// =============================================================================
// State Management & Constants
// =============================================================================

const ANONYMOUS_HANDLES = [
    "Girly", "Baddie", "007Bond", "NeonViper", "CyberWizard",
    "PixelBard", "ShadowWalker", "EchoQueen", "NightOwl", "RogueScholar",
    "StarlightYap", "MidnightPoet", "TechnoMage", "ChaosGremlin", "VibeMaster"
];

const GENRE_LABELS = {
    "epic": "Epic",
    "fantasy": "Fantasy",
    "horror": "Horror",
    "science-fiction": "Sci-Fi",
    "romance": "Romance",
    "mystery": "Mystery",
    "thriller": "Thriller",
    "comedy": "Comedy",
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
};

// =============================================================================
// DOM Elements Registry
// =============================================================================

const elements = {
    // Navigation & Tabs
    tabBtnHome:          document.getElementById("tab-btn-home"),
    tabBtnSocial:        document.getElementById("tab-btn-social"),
    viewHome:            document.getElementById("view-home"),
    viewSocial:          document.getElementById("view-social"),
    navFeedCount:        document.getElementById("nav-feed-count"),

    // Identity
    identityChip:        document.getElementById("identity-chip"),
    headerAvatar:        document.getElementById("header-avatar"),
    headerHandle:        document.getElementById("header-handle"),
    quickRerollBtn:      document.getElementById("quick-reroll-btn"),
    creationHandleText:  document.getElementById("creation-handle-text"),

    // Creation Suite
    yapInput:            document.getElementById("yap-input"),
    charCounter:         document.getElementById("char-counter"),
    storyGenre:          document.getElementById("story-genre"),
    voicePreference:     document.getElementById("voice-preference"),
    publishToFeedCheck:  document.getElementById("publish-to-feed-check"),
    transformBtn:        document.getElementById("transform-btn"),
    errorSection:        document.getElementById("error-section"),
    errorMessage:        document.getElementById("error-message"),

    // Results Card
    resultsSection:      document.getElementById("results-section"),
    resultTitle:         document.getElementById("result-title"),
    resultGenreBadge:    document.getElementById("result-genre-badge"),
    resultHandleBadge:   document.getElementById("result-handle-badge"),
    epicText:            document.getElementById("epic-text"),
    audioPlayer:         document.getElementById("audio-player"),
    bgMusicPlayer:       document.getElementById("bg-music-player"),
    sfxPlayer:           document.getElementById("sfx-player"),
    recordId:            document.getElementById("record-id"),
    viewInSocialBtn:     document.getElementById("view-in-social-btn"),
    copyStoryBtn:        document.getElementById("copy-story-btn"),

    // Recent Panel ("My Yaps")
    myYapsFeed:          document.getElementById("my-yaps-feed"),
    myYapsCountBadge:    document.getElementById("my-yaps-count-badge"),
    refreshMyYapsBtn:    document.getElementById("refresh-my-yaps-btn"),

    // Social Feed
    socialPostsContainer: document.getElementById("social-posts-container"),
    sortNewBtn:          document.getElementById("sort-new-btn"),
    sortTopBtn:          document.getElementById("sort-top-btn"),
    genreFiltersContainer: document.getElementById("genre-filters-container"),
    refreshFeedBtn:      document.getElementById("refresh-feed-btn"),

    // Modal
    identityModal:       document.getElementById("identity-modal"),
    modalCloseBtn:       document.getElementById("modal-close-btn"),
    modalPreviewAvatar:  document.getElementById("modal-preview-avatar"),
    modalPreviewHandle:  document.getElementById("modal-preview-handle"),
    customHandleInput:   document.getElementById("custom-handle-input"),
    handleChipsGrid:     document.getElementById("handle-chips-grid"),
    modalRandomBtn:      document.getElementById("modal-random-btn"),
    modalSaveBtn:        document.getElementById("modal-save-btn"),

    // Toasts
    toastNotification:   document.getElementById("toast-notification"),
    toastText:           document.getElementById("toast-text"),
};

// =============================================================================
// Identity & Session Initialization
// =============================================================================

function initSessionAndIdentity() {
    // 1. Session ID persistence
    let storedSession = localStorage.getItem("yap_session_id");
    if (!storedSession) {
        storedSession = "sess-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now();
        localStorage.setItem("yap_session_id", storedSession);
    }
    state.sessionId = storedSession;

    // 2. Anonymous handle persistence
    let storedHandle = localStorage.getItem("yap_handle");
    if (!storedHandle) {
        storedHandle = ANONYMOUS_HANDLES[Math.floor(Math.random() * ANONYMOUS_HANDLES.length)];
        localStorage.setItem("yap_handle", storedHandle);
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
    const cleanHandle = handle.trim().replace(/^u\//, "") || "Anonymous";
    state.userHandle = cleanHandle;
    localStorage.setItem("yap_handle", cleanHandle);

    // Update Header
    elements.headerHandle.textContent = `u/${cleanHandle}`;
    elements.headerAvatar.textContent = cleanHandle.charAt(0).toUpperCase();
    elements.headerAvatar.style.background = generateAvatarColor(cleanHandle);

    // Update Creation Suite
    if (elements.creationHandleText) {
        elements.creationHandleText.textContent = `u/${cleanHandle}`;
    }

    // Update Modal
    if (elements.modalPreviewHandle) {
        elements.modalPreviewHandle.textContent = `u/${cleanHandle}`;
        elements.modalPreviewAvatar.textContent = cleanHandle.charAt(0).toUpperCase();
        elements.modalPreviewAvatar.style.background = generateAvatarColor(cleanHandle);
        elements.customHandleInput.value = cleanHandle;
    }
}

function generateAvatarColor(text) {
    const palette = [
        "#1e293b", "#334155", "#1f2937", "#374151",
        "#18181b", "#27272a", "#0f172a", "#111827"
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

function showToast(message) {
    elements.toastText.textContent = message;
    elements.toastNotification.hidden = false;
    clearTimeout(elements.toastTimeout);
    elements.toastTimeout = setTimeout(() => {
        elements.toastNotification.hidden = true;
    }, 3200);
}

// =============================================================================
// Tab Switching: Home Tab vs Social Tab
// =============================================================================

function switchTab(tab) {
    state.currentTab = tab;
    const isHome = tab === "home";

    elements.tabBtnHome.classList.toggle("active", isHome);
    elements.tabBtnHome.setAttribute("aria-selected", isHome);
    elements.tabBtnSocial.classList.toggle("active", !isHome);
    elements.tabBtnSocial.setAttribute("aria-selected", !isHome);

    elements.viewHome.classList.toggle("active", isHome);
    elements.viewHome.hidden = !isHome;

    elements.viewSocial.classList.toggle("active", !isHome);
    elements.viewSocial.hidden = isHome;

    window.location.hash = tab;

    if (!isHome) {
        loadSocialFeed();
    } else {
        loadMyYaps();
    }
}

// =============================================================================
// Creation Suite Logic (Transform API)
// =============================================================================

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

function setTransformLoading(isLoading) {
    elements.transformBtn.disabled = isLoading;
    const defaultContent = elements.transformBtn.querySelector(".btn-default-content");
    const loadingContent = elements.transformBtn.querySelector(".btn-loading-content");

    if (defaultContent) defaultContent.hidden = isLoading;
    if (loadingContent) loadingContent.hidden = !isLoading;

    if (isLoading) {
        elements.errorSection.hidden = true;
    }
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorSection.hidden = false;
    elements.resultsSection.hidden = true;
    elements.errorSection.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function handleTransform() {
    const inputText = elements.yapInput.value.trim();

    if (!inputText) {
        showError("Please enter your daily yap before generating a story.");
        elements.yapInput.focus();
        return;
    }

    if (inputText.length > MAX_CHAR_LENGTH) {
        showError(`Your text exceeds the ${MAX_CHAR_LENGTH} character limit.`);
        return;
    }

    setTransformLoading(true);

    const payload = {
        text: inputText,
        genre: elements.storyGenre.value,
        voice: elements.voicePreference.value,
        handle: state.userHandle,
        session_id: state.sessionId,
        is_public: elements.publishToFeedCheck.checked,
    };

    try {
        const response = await fetch("/api/transform", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || `Server error (HTTP ${response.status})`);
            return;
        }

        displayGenerationResults(data);
        showToast("Audio tale created and synchronized with Amazon S3.");

        // Refresh My Yaps panel and Social Feed counts
        loadMyYaps();
        updateFeedBadgeCount();

    } catch (err) {
        console.error("Transformation failed:", err);
        showError("Unable to reach the server. Please check connection and try again.");
    } finally {
        setTransformLoading(false);
    }
}

function displayGenerationResults(data) {
    elements.epicText.textContent = data.epic_text;

    // Use stream URL or presigned URL
    const audioUrl = data.stream_url || data.audio_url;
    elements.audioPlayer.src = audioUrl;
    elements.audioPlayer.load();

    // Background ambience
    if (data.bg_music_url) {
        elements.bgMusicPlayer.src = data.bg_music_url;
        elements.bgMusicPlayer.volume = 0.2;
        elements.bgMusicPlayer.load();
    }
    if (data.sfx_url) {
        elements.sfxPlayer.src = data.sfx_url;
        elements.sfxPlayer.volume = 0.4;
        elements.sfxPlayer.load();
    }

    elements.recordId.textContent = data.id;

    // Tags
    const genre = data.genre || "epic";
    elements.resultGenreBadge.textContent = GENRE_LABELS[genre] || genre;
    elements.resultHandleBadge.textContent = `u/${data.handle || state.userHandle}`;

    if (genre !== "epic") {
        elements.resultTitle.textContent = `${genre.charAt(0).toUpperCase() + genre.slice(1)} Tale`;
    } else {
        elements.resultTitle.textContent = "Your Epic Narrative";
    }

    // Set jump button
    elements.viewInSocialBtn.onclick = () => {
        switchTab("social");
        setTimeout(() => {
            const card = document.getElementById(`post-${data.id}`);
            if (card) {
                card.scrollIntoView({ behavior: "smooth", block: "center" });
                card.style.borderColor = "#ffffff";
            }
        }, 600);
    };

    elements.copyStoryBtn.onclick = () => {
        navigator.clipboard.writeText(data.epic_text).then(() => {
            showToast("Story copied to clipboard!");
        });
    };

    elements.resultsSection.hidden = false;
    elements.errorSection.hidden = true;
    elements.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// =============================================================================
// Pillar 1: Recent Activity Panel ("My Yaps")
// =============================================================================

async function loadMyYaps() {
    try {
        const url = `/api/my-yaps?session_id=${encodeURIComponent(state.sessionId)}&handle=${encodeURIComponent(state.userHandle)}`;
        const res = await fetch(url);
        if (!res.ok) return;

        const data = await res.json();
        const posts = data.posts || [];
        renderMyYaps(posts);
        elements.myYapsCountBadge.textContent = posts.length;
    } catch (err) {
        console.warn("Could not load My Yaps:", err);
    }
}

function renderMyYaps(posts) {
    if (!posts || posts.length === 0) {
        elements.myYapsFeed.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                </div>
                <h3 class="empty-title">No Yaps Yet</h3>
                <p class="empty-desc">Your transformed audio chronicles will appear here for instant replay.</p>
            </div>
        `;
        return;
    }

    elements.myYapsFeed.innerHTML = posts.map(post => {
        const audioSrc = post.stream_url || post.audio_url;
        const genreBadge = GENRE_LABELS[post.genre] || post.genre || "Epic";
        const authorInitial = (post.handle || "A").charAt(0).toUpperCase();
        const avatarColor = generateAvatarColor(post.handle || "Anonymous");

        return `
            <article class="yap-card" id="my-yap-${post.id}">
                <div class="yap-card-header">
                    <div class="yap-card-author">
                        <div class="yap-card-avatar" style="background: ${avatarColor}">${authorInitial}</div>
                        <span class="yap-card-handle">u/${escapeHtml(post.handle || "Anonymous")}</span>
                        <span class="yap-card-time">· ${formatRelativeTime(post.created_at)}</span>
                    </div>
                    <span class="genre-tag">${genreBadge}</span>
                </div>

                <p class="yap-card-text">${escapeHtml(post.epic_text)}</p>

                <div class="yap-card-audio">
                    <audio class="s3-audio-player" playsinline controls preload="none" src="${audioSrc}"></audio>
                </div>

                <div class="yap-card-footer">
                    <div class="yap-card-stats">
                        <span>${post.upvotes || 0} upvotes</span>
                        <span>·</span>
                        <span>${post.comments_count || 0} comments</span>
                    </div>
                    <div class="yap-card-actions">
                        <button class="btn btn-secondary btn-sm" onclick="jumpToDiscussion('${post.id}')" type="button">
                            Discuss
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

// Window function for jumping to social discussion
window.jumpToDiscussion = function(postId) {
    switchTab("social");
    setTimeout(() => {
        const card = document.getElementById(`post-${postId}`);
        if (card) {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            const commentsBtn = card.querySelector(".btn-toggle-discussion");
            if (commentsBtn) commentsBtn.click();
            card.style.borderColor = "#ffffff";
        }
    }, 500);
};

// =============================================================================
// Pillar 2: Dedicated Public Social Feed & Community Forum
// =============================================================================

async function loadSocialFeed() {
    elements.socialPostsContainer.innerHTML = `
        <div class="feed-loading-skeleton">
            <div class="skeleton-line half"></div>
            <div class="skeleton-line full"></div>
            <div class="skeleton-line full"></div>
        </div>
    `;

    try {
        const url = `/api/feed?sort=${state.feedSort}&genre=${state.feedGenre}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const posts = data.posts || [];
        renderSocialFeed(posts);

        elements.navFeedCount.textContent = posts.length;
    } catch (err) {
        console.error("Failed to load community feed:", err);
        elements.socialPostsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <h3 class="empty-title">Could not load feed</h3>
                <p class="empty-desc">Check connection and try again.</p>
                <button class="btn btn-secondary btn-sm" onclick="loadSocialFeed()">Retry</button>
            </div>
        `;
    }
}

async function updateFeedBadgeCount() {
    try {
        const res = await fetch("/api/feed?sort=new&genre=all");
        if (res.ok) {
            const data = await res.json();
            elements.navFeedCount.textContent = (data.posts || []).length;
        }
    } catch (e) {}
}

function renderSocialFeed(posts) {
    if (!posts || posts.length === 0) {
        elements.socialPostsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                </div>
                <h3 class="empty-title">No Stories Found</h3>
                <p class="empty-desc">No public tales in this category. Be the first to publish a yap!</p>
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
            <article class="reddit-post-card" id="post-${post.id}">
                <!-- Left Upvote Column -->
                <div class="upvote-column">
                    <button 
                        class="upvote-btn ${isUpvoted ? "voted" : ""}" 
                        onclick="handleUpvote('${post.id}')"
                        title="Upvote story"
                        aria-label="Upvote story"
                        type="button"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
                            <span class="genre-tag">${genreBadge}</span>
                        </div>
                    </div>

                    <!-- Story Narrative Text -->
                    <p class="post-narrative">${escapeHtml(post.epic_text)}</p>

                    <!-- Raw Yap Accordion (if available) -->
                    ${post.original_text ? `
                    <details class="raw-yap-details">
                        <summary class="raw-yap-summary">Original Daily Yap</summary>
                        <p class="raw-yap-text">${escapeHtml(post.original_text)}</p>
                    </details>
                    ` : ""}

                    <!-- Direct S3 Audio Streaming Player -->
                    <div class="post-audio-wrapper">
                        <span class="post-audio-badge">
                            <span class="audio-pulse"></span>
                            S3 Audio
                        </span>
                        <audio class="post-audio-player s3-audio-player" playsinline controls preload="none" src="${audioSrc}"></audio>
                    </div>

                    <!-- Post Action Bar -->
                    <div class="post-actions-bar">
                        <button class="action-btn btn-toggle-discussion" onclick="toggleDiscussion('${post.id}')" type="button">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <span id="comments-count-${post.id}">${commentsCount}</span> Comments
                        </button>
                        <button class="action-btn" onclick="copyAudioLink('${audioSrc}')" type="button">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                            Copy S3 Audio Link
                        </button>
                        <button class="action-btn" onclick="sharePost('${post.id}')" type="button">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="18" cy="5" r="3"></circle>
                                <circle cx="6" cy="12" r="3"></circle>
                                <circle cx="18" cy="19" r="3"></circle>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </svg>
                            Share Post
                        </button>
                    </div>

                    <!-- Interactive Discussion & Comment Thread -->
                    <div class="discussion-section" id="discussion-${post.id}" hidden>
                        <div class="discussion-header">
                            <span>Discussion Thread</span>
                            <span class="comment-composer-header">Posting as <strong>u/${escapeHtml(state.userHandle)}</strong></span>
                        </div>

                        <!-- Comment Composer -->
                        <div class="comment-composer">
                            <div class="comment-input-row">
                                <textarea 
                                    id="comment-input-${post.id}" 
                                    class="comment-textarea" 
                                    placeholder="What do you think of this tale? Leave an anonymous reaction..."
                                    rows="2"
                                    maxlength="1000"
                                ></textarea>
                                <button class="btn btn-primary btn-post-comment" onclick="submitComment('${post.id}')" type="button">
                                    Comment
                                </button>
                            </div>
                        </div>

                        <!-- Comments Thread List -->
                        <div class="comments-list" id="comments-list-${post.id}">
                            ${renderCommentsList(post.comments || [])}
                        </div>
                    </div>

                </div>
            </article>
        `;
    }).join("");
}

function renderCommentsList(comments) {
    if (!comments || comments.length === 0) {
        return `<p class="no-comments-text">No comments yet. Be the first to yap about this tale!</p>`;
    }

    return comments.map(comment => {
        const initial = (comment.handle || "A").charAt(0).toUpperCase();
        const avatarColor = generateAvatarColor(comment.handle || "Anonymous");

        return `
            <div class="comment-card">
                <div class="comment-header">
                    <div class="comment-avatar" style="background: ${avatarColor}">${initial}</div>
                    <span class="comment-handle">u/${escapeHtml(comment.handle || "Anonymous")}</span>
                    <span class="comment-time">· ${formatRelativeTime(comment.created_at)}</span>
                </div>
                <p class="comment-body">${escapeHtml(comment.text)}</p>
            </div>
        `;
    }).join("");
}

// Window functions for Feed Interactions
window.handleUpvote = async function(postId) {
    const isAlreadyVoted = state.upvotedPosts.has(postId);
    if (isAlreadyVoted) {
        showToast("You already upvoted this tale!");
        return;
    }

    // Optimistic UI update
    const btn = document.querySelector(`#post-${postId} .upvote-btn`);
    const counter = document.getElementById(`upvotes-${postId}`);
    if (btn) btn.classList.add("voted");

    let currentVal = parseInt(counter.textContent || "0", 10);
    counter.textContent = currentVal + 1;
    state.upvotedPosts.add(postId);
    localStorage.setItem("yap_upvoted_posts", JSON.stringify(Array.from(state.upvotedPosts)));

    try {
        const res = await fetch(`/api/posts/${postId}/upvote`, { method: "POST" });
        if (res.ok) {
            const data = await res.json();
            if (data.upvotes) counter.textContent = data.upvotes;
        }
    } catch (err) {
        console.warn("Upvote sync error:", err);
    }
};

window.toggleDiscussion = function(postId) {
    const section = document.getElementById(`discussion-${postId}`);
    if (!section) return;

    const isHidden = section.hidden;
    section.hidden = !isHidden;

    if (!isHidden) return; // closed

    // If opened, fetch fresh comments
    fetch(`/api/posts/${postId}/comments`)
        .then(r => r.json())
        .then(data => {
            const listEl = document.getElementById(`comments-list-${postId}`);
            if (listEl) listEl.innerHTML = renderCommentsList(data.comments || []);
            const countEl = document.getElementById(`comments-count-${postId}`);
            if (countEl) countEl.textContent = (data.comments || []).length;
        })
        .catch(e => console.warn(e));
};

window.submitComment = async function(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input) return;

    const text = input.value.trim();
    if (!text) {
        showToast("Please write a comment before posting.");
        input.focus();
        return;
    }

    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: text,
                handle: state.userHandle,
            }),
        });

        if (!res.ok) {
            showToast("Failed to post comment.");
            return;
        }

        const data = await res.json();
        input.value = "";
        showToast("Comment posted anonymously!");

        // Update comment count
        const countEl = document.getElementById(`comments-count-${postId}`);
        if (countEl) countEl.textContent = data.comments_count;

        // Refresh comments list
        const listEl = document.getElementById(`comments-list-${postId}`);
        if (listEl) {
            const noComments = listEl.querySelector(".no-comments-text");
            if (noComments) noComments.remove();

            const initial = (data.comment.handle || "A").charAt(0).toUpperCase();
            const avatarColor = generateAvatarColor(data.comment.handle || "Anonymous");

            const newCardHtml = `
                <div class="comment-card">
                    <div class="comment-header">
                        <div class="comment-avatar" style="background: ${avatarColor}">${initial}</div>
                        <span class="comment-handle">u/${escapeHtml(data.comment.handle)}</span>
                        <span class="comment-time">· just now</span>
                    </div>
                    <p class="comment-body">${escapeHtml(data.comment.text)}</p>
                </div>
            `;
            listEl.insertAdjacentHTML("beforeend", newCardHtml);
        }
    } catch (err) {
        console.error("Comment submit failed:", err);
        showToast("Network error. Please try again.");
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
        showToast("Post link copied to clipboard!");
    });
};

// =============================================================================
// Pillar 3: Single Active Audio Playback Coordinator
// =============================================================================

document.addEventListener("play", function(event) {
    if (event.target.tagName === "AUDIO") {
        const currentAudio = event.target;
        // Don't pause background music / SFX if they are active with the main player
        if (currentAudio === elements.bgMusicPlayer || currentAudio === elements.sfxPlayer) {
            return;
        }

        // Pause all other standard audio players
        const allAudios = document.querySelectorAll("audio");
        allAudios.forEach(a => {
            if (a !== currentAudio && a !== elements.bgMusicPlayer && a !== elements.sfxPlayer) {
                a.pause();
            }
        });
    }
}, true);

// Universal Audio Error Auto-Recovery for S3 Media Streaming
document.addEventListener("error", function(event) {
    if (event.target && event.target.tagName === "AUDIO") {
        const audioEl = event.target;
        const currentSrc = audioEl.src;
        // If an audio link fails or expires, auto-refresh via /api/posts/<id>/audio-url
        const match = currentSrc.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        if (match && match[1] && !audioEl.dataset.retried) {
            audioEl.dataset.retried = "true";
            fetch(`/api/posts/${match[1]}/audio-url`)
                .then(r => r.json())
                .then(data => {
                    if (data.audio_url || data.stream_url) {
                        audioEl.src = data.stream_url || data.audio_url;
                        audioEl.load();
                    }
                })
                .catch(e => console.warn("Audio retry recovery failed:", e));
        }
    }
}, true);

// Main Result Card Audio Sync
elements.audioPlayer.addEventListener("play", () => {
    if (elements.bgMusicPlayer.src) {
        elements.bgMusicPlayer.play().catch(e => console.warn(e));
    }
    if (elements.sfxPlayer.src && elements.audioPlayer.currentTime < 1) {
        elements.sfxPlayer.play().catch(e => console.warn(e));
    }
});

elements.audioPlayer.addEventListener("pause", () => {
    elements.bgMusicPlayer.pause();
});

elements.audioPlayer.addEventListener("ended", () => {
    elements.bgMusicPlayer.pause();
    elements.bgMusicPlayer.currentTime = 0;
});

// =============================================================================
// Pillar 4: Identity Modal Logic
// =============================================================================

function openIdentityModal() {
    elements.identityModal.hidden = false;
    elements.customHandleInput.value = state.userHandle;
    elements.modalPreviewHandle.textContent = `u/${state.userHandle}`;
    elements.modalPreviewAvatar.textContent = state.userHandle.charAt(0).toUpperCase();
    elements.modalPreviewAvatar.style.background = generateAvatarColor(state.userHandle);

    // Populate suggested chips
    elements.handleChipsGrid.innerHTML = ANONYMOUS_HANDLES.map(h => `
        <button class="handle-chip-btn" type="button" onclick="selectSuggestedHandle('${h}')">
            u/${h}
        </button>
    `).join("");
}

function closeIdentityModal() {
    elements.identityModal.hidden = true;
}

window.selectSuggestedHandle = function(handle) {
    elements.customHandleInput.value = handle;
    elements.modalPreviewHandle.textContent = `u/${handle}`;
    elements.modalPreviewAvatar.textContent = handle.charAt(0).toUpperCase();
    elements.modalPreviewAvatar.style.background = generateAvatarColor(handle);
};

elements.modalRandomBtn.addEventListener("click", () => {
    const randomPick = ANONYMOUS_HANDLES[Math.floor(Math.random() * ANONYMOUS_HANDLES.length)];
    selectSuggestedHandle(randomPick);
});

elements.modalSaveBtn.addEventListener("click", () => {
    const newHandle = elements.customHandleInput.value.trim().replace(/^u\//, "");
    if (!newHandle) {
        showToast("Handle cannot be blank.");
        return;
    }
    updateUserHandle(newHandle);
    closeIdentityModal();
    showToast(`Identity updated: u/${newHandle}`);
    loadMyYaps();
});

elements.quickRerollBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const currentIdx = ANONYMOUS_HANDLES.indexOf(state.userHandle);
    const available = ANONYMOUS_HANDLES.filter((_, i) => i !== currentIdx);
    const pick = available[Math.floor(Math.random() * available.length)];
    updateUserHandle(pick);
    showToast(`Rerolled identity to u/${pick}`);
    loadMyYaps();
});

elements.identityChip.addEventListener("click", openIdentityModal);
elements.modalCloseBtn.addEventListener("click", closeIdentityModal);
elements.identityModal.addEventListener("click", (e) => {
    if (e.target === elements.identityModal) closeIdentityModal();
});

// =============================================================================
// Event Listeners & Bootstrapping
// =============================================================================

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Navigation Tabs
elements.tabBtnHome.addEventListener("click", () => switchTab("home"));
elements.tabBtnSocial.addEventListener("click", () => switchTab("social"));

// Creation Suite
elements.yapInput.addEventListener("input", updateCharCounter);
elements.transformBtn.addEventListener("click", handleTransform);
elements.yapInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleTransform();
    }
});

// Refresh Buttons
elements.refreshMyYapsBtn.addEventListener("click", loadMyYaps);
elements.refreshFeedBtn.addEventListener("click", loadSocialFeed);

// Sort Buttons
elements.sortNewBtn.addEventListener("click", () => {
    elements.sortNewBtn.classList.add("active");
    elements.sortTopBtn.classList.remove("active");
    state.feedSort = "new";
    loadSocialFeed();
});

elements.sortTopBtn.addEventListener("click", () => {
    elements.sortTopBtn.classList.add("active");
    elements.sortNewBtn.classList.remove("active");
    state.feedSort = "top";
    loadSocialFeed();
});

// Genre Filter Buttons
elements.genreFiltersContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("genre-filter-pill")) {
        const pills = elements.genreFiltersContainer.querySelectorAll(".genre-filter-pill");
        pills.forEach(p => p.classList.remove("active"));
        e.target.classList.add("active");
        state.feedGenre = e.target.dataset.genre || "all";
        loadSocialFeed();
    }
});

// Initialize on Load
document.addEventListener("DOMContentLoaded", () => {
    initSessionAndIdentity();
    updateCharCounter();

    // Route check via hash
    if (window.location.hash === "#social") {
        switchTab("social");
    } else {
        switchTab("home");
    }

    updateFeedBadgeCount();
});
