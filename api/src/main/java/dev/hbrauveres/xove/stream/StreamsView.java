package dev.hbrauveres.xove.stream;

import java.time.Instant;
import java.util.List;

/**
 * What the frontend gets: every live stream, oldest first, and how many places are
 * free. LiveKit connection ids stay in the API.
 */
public record StreamsView(List<Item> streams, int free) {

    /** One live stream; {@code mine} when it's the asking person's. */
    public record Item(String kind, Long userId, String name, String avatarUrl, Instant since,
                       StreamSettings settings, boolean mine) {
    }

    static StreamsView of(Streams streams, Long viewerId) {
        List<Item> items = streams.all().stream()
                .map(s -> new Item(s.kind().id(), s.userId(), s.name(), s.avatarUrl(), s.since(), s.settings(),
                        s.userId().equals(viewerId)))
                .toList();
        return new StreamsView(items, streams.free());
    }
}
