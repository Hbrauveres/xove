package dev.hbrauveres.xove.screen;

/**
 * Which LiveKit connection and screen track the holder is sharing from, so a
 * LiveKit report can be matched to the share it's about. Either id can be null
 * (a browser that didn't send it). Never shown to other people.
 *
 * @param participantSid the connection, e.g. "PA_…"
 * @param trackSid       the screen track, e.g. "TR_…"
 */
public record SharingConnection(String participantSid, String trackSid) {
}
