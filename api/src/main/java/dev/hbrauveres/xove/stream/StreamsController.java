package dev.hbrauveres.xove.stream;

import dev.hbrauveres.xove.auth.CurrentUser;
import dev.hbrauveres.xove.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** The live streams: who shares what, start one, change how it's sent, stop it. Members only. */
@RestController
@RequestMapping("/api/streams")
public class StreamsController {

    static final String UNKNOWN_KIND = "A stream is a screen or a camera.";

    private final Streams streams;
    private final CurrentUser currentUser;

    public StreamsController(Streams streams, CurrentUser currentUser) {
        this.streams = streams;
        this.currentUser = currentUser;
    }

    @GetMapping
    public StreamsView current(@AuthenticationPrincipal OidcUser google) {
        User me = currentUser.member(google);
        return StreamsView.of(streams, me.getId());
    }

    /**
     * The body says what the stream shows, which LiveKit connection and track it comes
     * from (both required), and optionally its quality and mode.
     */
    @PostMapping
    public StreamsView start(@AuthenticationPrincipal OidcUser google,
                             @RequestBody(required = false) StartRequest request) {
        User me = currentUser.member(google);
        if (request == null || !request.connection().isComplete()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Your browser didn't say which video connection is sharing. Reload the page and try again.");
        }
        StreamKind kind = request.streamKind()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, UNKNOWN_KIND));
        StreamSettings settings = request.settingsFor(kind);
        if (!settings.isValidFor(kind)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, StreamSettings.invalidFor(kind));
        }
        streams.start(me.getId(), me.getName(), me.getAvatarUrl(), kind, request.connection(), settings);
        return StreamsView.of(streams, me.getId());
    }

    /** Its person changes what a stream is sent with; everyone sees it on their next poll. */
    @PostMapping("/{kind}/settings")
    public StreamsView settings(@AuthenticationPrincipal OidcUser google, @PathVariable String kind,
                                @RequestBody(required = false) StreamSettings settings) {
        User me = currentUser.member(google);
        StreamKind streamKind = kindOf(kind);
        if (settings == null || !settings.isValidFor(streamKind)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, StreamSettings.invalidFor(streamKind));
        }
        streams.changeSettings(me.getId(), streamKind, settings);
        return StreamsView.of(streams, me.getId());
    }

    @PostMapping("/{kind}/stop")
    public StreamsView stop(@AuthenticationPrincipal OidcUser google, @PathVariable String kind) {
        User me = currentUser.member(google);
        streams.stop(me.getId(), kindOf(kind));
        return StreamsView.of(streams, me.getId());
    }

    private static StreamKind kindOf(String kind) {
        return StreamKind.of(kind)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, UNKNOWN_KIND));
    }

    @ExceptionHandler(StreamsFullException.class)
    ProblemDetail full(StreamsFullException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(NotYourStreamException.class)
    ProblemDetail notYours(NotYourStreamException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    }
}
