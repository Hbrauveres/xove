# API

The API lives in its own repo: every endpoint, who may call it, what it takes and returns, is in [`xove-api`'s docs/api.md](https://github.com/Hbrauveres/xove-api/blob/main/docs/api.md).

This web app calls it through `web/src/api/` (the HTTP client and its types), always under `/api` on the same origin, with the session cookie and, on state-changing requests, the CSRF token (cookie `XSRF-TOKEN`, header `X-XSRF-TOKEN`). Errors follow RFC 9457 (problem details); the web app shows their `detail` field.
