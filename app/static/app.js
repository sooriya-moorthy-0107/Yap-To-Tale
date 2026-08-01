// =============================================================================
// Yap-to-Tale — Frontend Application Logic
// =============================================================================

"use strict";

const elements = {
    yapInput:           document.getElementById("yap-input"),
    charCounter:        document.getElementById("char-counter"),
    storyGenre:         document.getElementById("story-genre"),
    transformBtn:       document.getElementById("transform-btn"),
    genreStoryBtn:      document.getElementById("genre-story-btn"),
    errorSection:       document.getElementById("error-section"),
    errorMessage:       document.getElementById("error-message"),
    resultsSection:     document.getElementById("results-section"),
    resultTitle:        document.getElementById("result-title"),
    resultGenreBadge:   document.getElementById("result-genre-badge"),
    epicText:           document.getElementById("epic-text"),
    audioPlayer:        document.getElementById("audio-player"),
    recordId:           document.getElementById("record-id"),
};

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
    const buttons = [elements.transformBtn, elements.genreStoryBtn];
    buttons.forEach((btn) => {
        const parts = getButtonParts(btn);
        const isActive = btn === activeButton;
        btn.disabled = true;
        parts.defaultContent.hidden = isActive;
        parts.loadingContent.hidden = !isActive;
        if (!isActive) {
            parts.defaultContent.hidden = false;
            parts.loadingContent.hidden = true;
        }
    });

    elements.errorSection.hidden = true;
    elements.resultsSection.hidden = true;
}

function setIdleState() {
    [elements.transformBtn, elements.genreStoryBtn].forEach((btn) => {
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

function showResults(data, mode) {
    elements.epicText.textContent = data.epic_text;
    elements.audioPlayer.src = data.audio_url;
    elements.audioPlayer.load();
    elements.recordId.textContent = data.id;

    if (mode === "genre" && data.genre) {
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

async function handleTransform(mode) {
    const inputText = elements.yapInput.value.trim();

    if (!inputText) {
        showError("Enter your daily log before generating a story.");
        return;
    }

    if (inputText.length > MAX_CHAR_LENGTH) {
        showError(`Your text exceeds the ${MAX_CHAR_LENGTH} character limit.`);
        return;
    }

    const activeButton = mode === "genre" ? elements.genreStoryBtn : elements.transformBtn;
    const body = { text: inputText };
    if (mode === "genre") {
        body.genre = elements.storyGenre.value;
    }

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

        showResults(data, mode);
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

elements.yapInput.addEventListener("input", updateCharCounter);

elements.transformBtn.addEventListener("click", () => handleTransform("epic"));
elements.genreStoryBtn.addEventListener("click", () => handleTransform("genre"));

elements.yapInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        handleTransform("epic");
    }
});

updateCharCounter();
