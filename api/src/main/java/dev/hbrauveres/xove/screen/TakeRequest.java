package dev.hbrauveres.xove.screen;

/**
 * The body of "take the screen": where the share comes from (required), and what
 * it's sent with (optional: 1080p Smooth when missing).
 */
record TakeRequest(String participantSid, String trackSid, String quality, String mode) {

    SharingConnection connection() {
        return new SharingConnection(participantSid, trackSid);
    }

    /** Null when the body names no settings. */
    StreamSettings settings() {
        return quality == null && mode == null ? null : new StreamSettings(quality, mode);
    }
}
