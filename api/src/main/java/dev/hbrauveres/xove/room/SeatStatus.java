package dev.hbrauveres.xove.room;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/**
 * Where someone stands with the room (spec 0060):
 * - "in": they have a seat;
 * - "waiting": they're in the queue, at {@code place} (1 is next);
 * - "offered": a seat is held for them until {@code until}; they confirm or cancel.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SeatStatus(String status, Integer place, Instant until) {

    public static SeatStatus in() {
        return new SeatStatus("in", null, null);
    }

    public static SeatStatus waiting(int place) {
        return new SeatStatus("waiting", place, null);
    }

    public static SeatStatus offered(Instant until) {
        return new SeatStatus("offered", null, until);
    }
}
