// =============================================================================
// Yap-to-Tale — Frontend Application Logic (app.js)
// =============================================================================
// This script handles:
//   1. User input validation and character counting
//   2. API communication with the /api/transform endpoint
//   3. UI state management (loading, success, error states)
//   4. Dynamic rendering of results (epic text + audio player)
//
// The application communicates with the Flask backend via a single POST
// request and dynamically updates the DOM with the response data.
// =============================================================================

"use strict";

// =============================================================================
// DOM Element References
// =============================================================================
// Cache all DOM elements at initialization to avoid repeated querySelector calls.

const elements = {
    // Input elements
    yapInput:           document.getElementById("yap-input"),
    charCounter:        document.getElementById("char-counter"),
    transformBtn:       document.getElementById("transform-btn"),
    btnDefaultContent:  document.querySelector(".btn-default-content"),
    btnLoadingContent:  document.querySelector(".btn-loading-content"),

    // Error elements
    errorSection:       document.getElementById("error-section"),
    errorMessage:       document.getElementById("error-message"),

    // Results elements
    resultsSection:     document.getElementById("results-section"),
    epicText:           document.getElementById("epic-text"),
    audioPlayer:        document.getElementById("audio-player"),
    recordId:           document.getElementById("record-id"),
};

// =============================================================================
// Constants
// =============================================================================

const MAX_CHAR_LENGTH = 5000;                   // Maximum allowed input length
const CHAR_WARNING_THRESHOLD = 0.9;             // Show warning at 90% of max
const API_ENDPOINT = "/api/transform";          // Backend transformation endpoint

// =============================================================================
// Character Counter — Real-time Input Tracking
// =============================================================================
/**
 * Updates the character counter display below the textarea.
 * Changes color as the user approaches the character limit:
 *   - Default:  muted gray
 *   - Warning:  amber/yellow (>90% of limit)
 *   - At limit: red (100% of limit)
 */
function updateCharCounter() {
    const currentLength = elements.yapInput.value.length;
    const ratio = currentLength / MAX_CHAR_LENGTH;

    // Update the counter text
    elements.charCounter.textContent = `${currentLength} / ${MAX_CHAR_LENGTH}`;

    // Apply visual styling based on proximity to the limit
    elements.charCounter.classList.remove("near-limit", "at-limit");

    if (ratio >= 1) {
        elements.charCounter.classList.add("at-limit");
    } else if (ratio >= CHAR_WARNING_THRESHOLD) {
        elements.charCounter.classList.add("near-limit");
    }
}

// =============================================================================
// UI State Management
// =============================================================================

/**
 * Switches the transform button to the loading state.
 * Disables the button and shows the spinner animation.
 */
function setLoadingState() {
    elements.transformBtn.disabled = true;
    elements.btnDefaultContent.hidden = true;
    elements.btnLoadingContent.hidden = false;

    // Hide any previous results or errors
    elements.errorSection.hidden = true;
    elements.resultsSection.hidden = true;
}

/**
 * Restores the transform button to its default (idle) state.
 * Re-enables the button and hides the spinner.
 */
function setIdleState() {
    elements.transformBtn.disabled = false;
    elements.btnDefaultContent.hidden = false;
    elements.btnLoadingContent.hidden = true;
}

/**
 * Displays an error message to the user.
 * Shows the error card with a shake animation.
 *
 * @param {string} message - The error message to display.
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorSection.hidden = false;
    elements.resultsSection.hidden = true;

    // Re-trigger the shake animation by forcing a DOM reflow
    elements.errorSection.style.animation = "none";
    // Reading offsetHeight forces a reflow, re-triggering the animation
    void elements.errorSection.offsetHeight;
    elements.errorSection.style.animation = "";

    // Scroll the error into view smoothly
    elements.errorSection.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Displays the transformation results (epic text + audio player).
 * Populates the results card with the API response data.
 *
 * @param {Object} data - The API response object.
 * @param {string} data.id - The unique record UUID.
 * @param {string} data.epic_text - The generated epic narrative.
 * @param {string} data.audio_url - The S3 URL of the MP3 audio file.
 */
function showResults(data) {
    // Populate the epic text display
    elements.epicText.textContent = data.epic_text;

    // Set the audio player source to the S3 URL
    elements.audioPlayer.src = data.audio_url;
    elements.audioPlayer.load();    // Force the player to load the new source

    // Display the record ID for reference
    elements.recordId.textContent = data.id;

    // Show the results section and hide errors
    elements.resultsSection.hidden = false;
    elements.errorSection.hidden = true;

    // Scroll the results into view smoothly
    elements.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// =============================================================================
// API Communication
// =============================================================================

/**
 * Sends the user's text to the /api/transform endpoint and handles the
 * response. This function manages the full request lifecycle:
 *   1. Input validation
 *   2. Loading state activation
 *   3. API request via fetch()
 *   4. Response parsing and error handling
 *   5. Results rendering or error display
 *   6. State restoration
 */
async function handleTransform() {
    // ---- Input Validation ----
    const inputText = elements.yapInput.value.trim();

    if (!inputText) {
        showError("Please enter some text about your day before transforming.");
        return;
    }

    if (inputText.length > MAX_CHAR_LENGTH) {
        showError(`Your text exceeds the ${MAX_CHAR_LENGTH} character limit. Please shorten it.`);
        return;
    }

    // ---- Activate Loading State ----
    setLoadingState();

    try {
        // ---- Send POST Request to Backend ----
        const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: inputText }),
        });

        // ---- Parse Response Body ----
        const data = await response.json();

        // ---- Handle HTTP Errors ----
        if (!response.ok) {
            // The backend returns { "error": "message" } on failures
            const errorMsg = data.error || `Server error (HTTP ${response.status})`;
            showError(errorMsg);
            return;
        }

        // ---- Validate Response Structure ----
        if (!data.epic_text || !data.audio_url) {
            showError("Received an incomplete response from the server. Please try again.");
            return;
        }

        // ---- Display Results ----
        showResults(data);

    } catch (error) {
        // ---- Handle Network Errors ----
        // This catches fetch failures (network down, CORS issues, etc.)
        console.error("Transformation request failed:", error);

        if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
            showError("Unable to reach the server. Please check your connection and try again.");
        } else {
            showError("An unexpected error occurred. Please try again later.");
        }
    } finally {
        // ---- Always Restore Idle State ----
        setIdleState();
    }
}

// =============================================================================
// Event Listeners
// =============================================================================

// Character counter — update on every keystroke
elements.yapInput.addEventListener("input", updateCharCounter);

// Transform button — trigger the API call on click
elements.transformBtn.addEventListener("click", handleTransform);

// Keyboard shortcut — Ctrl+Enter / Cmd+Enter to submit
elements.yapInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        handleTransform();
    }
});

// =============================================================================
// Initialization
// =============================================================================

// Initialize the character counter on page load (in case of browser autofill)
updateCharCounter();

// Log application readiness
console.log("🏰 Yap-to-Tale application initialized and ready.");
