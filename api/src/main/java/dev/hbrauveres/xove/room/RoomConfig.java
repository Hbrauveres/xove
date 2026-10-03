package dev.hbrauveres.xove.room;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** One room for the whole app: Spring creates it once and hands the same one to everyone. */
@Configuration
class RoomConfig {

    /** People in the room at once, sharers included (spec 0060). */
    static final int SEATS = 20;

    @Bean
    RoomSeats roomSeats() {
        return new RoomSeats(SEATS, Clock.systemUTC());
    }
}
