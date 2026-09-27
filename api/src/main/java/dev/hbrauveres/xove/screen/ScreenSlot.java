package dev.hbrauveres.xove.screen;

import java.time.Clock;
import java.util.Objects;
import java.util.Optional;

/**
 * The single screen slot. Plain Java: no Spring, no HTTP, no database.
 *
 * Rules:
 * - anyone can take the slot, even if someone else holds it (takeover);
 * - taking it again while already holding it changes nothing;
 * - only the holder can release it; releasing an empty slot is a no-op;
 * - LiveKit reports free it only when they're about the connection or track
 *   being shared; without stored ids, any report about the holder counts.
 *
 * State lives in memory, so an API restart empties the slot. That's fine
 * until LiveKit becomes the source of truth.
 */
public class ScreenSlot {

    private final Clock clock;
    private ScreenHolder holder;
    private SharingConnection connection;

    public ScreenSlot(Clock clock) {
        this.clock = clock;
    }

    public synchronized Optional<ScreenHolder> current() {
        return Optional.ofNullable(holder);
    }

    public ScreenHolder take(Long userId, String name, String avatarUrl) {
        return take(userId, name, avatarUrl, null);
    }

    /** @param connection where the share comes from; null when the browser didn't say */
    public synchronized ScreenHolder take(Long userId, String name, String avatarUrl, SharingConnection connection) {
        Objects.requireNonNull(userId, "userId");
        this.connection = connection;
        if (holder != null && holder.userId().equals(userId)) {
            return holder;
        }
        holder = new ScreenHolder(userId, name, avatarUrl, clock.instant());
        return holder;
    }

    public synchronized void release(Long userId) {
        if (holder == null) {
            return;
        }
        if (!holder.userId().equals(userId)) {
            throw new NotTheHolderException();
        }
        empty();
    }

    /**
     * LiveKit says one of this person's connections left the room.
     *
     * @return true if that freed the slot
     */
    public synchronized boolean connectionLeft(Long userId, String participantSid) {
        if (!isHolder(userId)) {
            return false;
        }
        String sharing = connection == null ? null : connection.participantSid();
        if (sharing != null && !sharing.equals(participantSid)) {
            return false;
        }
        empty();
        return true;
    }

    /**
     * LiveKit says this person stopped publishing a screen share track.
     *
     * @return true if that freed the slot
     */
    public synchronized boolean screenUnpublished(Long userId, String participantSid, String trackSid) {
        if (!isHolder(userId)) {
            return false;
        }
        if (connection != null) {
            if (connection.trackSid() != null) {
                if (!connection.trackSid().equals(trackSid)) {
                    return false;
                }
            } else if (connection.participantSid() != null && !connection.participantSid().equals(participantSid)) {
                return false;
            }
        }
        empty();
        return true;
    }

    private boolean isHolder(Long userId) {
        return holder != null && holder.userId().equals(userId);
    }

    private void empty() {
        holder = null;
        connection = null;
    }

    /** Empties the slot. Only for tests, which share one slot across a Spring context. */
    synchronized void clear() {
        empty();
    }
}
