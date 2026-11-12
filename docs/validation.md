# Validation record

Verified on 12 November 2026 with Node 26.3.1 and Playwright 1.65.0 using Chromium
158.0.8127.18 in a separate temporary browser profile.

## Completed checks

- A clean `npm ci` completed using the supplied lockfile. The dependency
  audit reported zero known vulnerabilities at the time of installation.
- `npm run check` passed: ESLint, strict TypeScript, Prettier, 51 unit tests and
  the production build.
- `npm run test:browser` passed all 30 tests against the unpacked MV3 extension.
- The build includes the content scripts, settings popup, styles, five manifest
  translations and the original calendar-and-play icon. The 16, 32, 48 and 128 px
  PNGs in `dist` match the selected artwork, and the manifest points the toolbar
  and extension manager to the appropriate sizes. The only API permission is
  storage for appearance preferences.
- A scan of project files found none of the credential values from the supplied
  cURL. Full private attachments are not included in the project.
- The rendered label was visually inspected in a sanitized browser fixture. It
  appears below the author and does not cover the description or follow button.
- The settings panel, top placement and below-frame placement were visually
  inspected. Browser tests assert the position relative to the video, viewport
  bounds, and restoration of the original player size.
- Git is initialized on `main`. Ignore rules cover node_modules, dist, test results
  and local environment files while leaving source and package.json trackable.

## Behavior exercised

Unit tests cover per-story extraction, owner selection, contradictory identities,
multiple videos, malformed tracking, numeric precision, timestamp units, split JSON
frames, anti-XSSI prefixes, multipart framing, exact URL gating, Italian daylight
saving time, bridge validation, cache eviction, expiry and conflicting dates.
They also cover five locale families, regional variants, English fallback,
localized relative weeks/days and plurals, preference validation and migration of
older settings without a border color.

The Zod refactor adds checks for each bridge message variant and verifies that
reinjection creates no second controller, settings subscription or route timer.
Repeated page restoration starts only one subscription and timer. Network parsing
also runs in Chromium under a Content Security Policy that forbids runtime code
generation, without script errors or evaluation-related CSP violations.

Browser tests cover initial inline JSON, fetch response preservation, text and JSON
XHR, SPA entry and exit, delayed DOM, consecutive Reels, duplicate prevention,
malformed bridge data, a previous player without metadata, abandoned XHR objects,
native fetch coercion, late changes to bootstrap scripts, and route changes that
bypass the wrapped history methods. Regression tests first reproduced the stale
player, abandoned-XHR, fetch exception, late-script and fallback-cleanup failures,
then passed after their fixes.

Settings tests cover popup controls, all eight saved values across popup openings, live
updates in a Reel tab, all three placements, optional relative age and restoration
on route exit. Each supported language and an unsupported Portuguese locale are
tested. A separate America/New_York case verifies that the extension uses browser
time instead of forcing Europe/Rome.

Independent review reproduced flickering in bottom mode when a smaller neighboring
Reel was visible: the extension's temporary scale affected its next active-player
selection. A regression failed before the fix and now verifies stable selection,
badge visibility and video dimensions across repeated refreshes. Selection now
measures the player with its original scale before applying bottom placement.
The reviewer's follow-up reproduction confirmed stable placement and correct border
rendering. The local dancer illustration and lower author placement were visually
inspected in the popup screenshot.

AI/visibility checks cover strict same-story AI flags, deferred partial metadata,
conflicting booleans, default-off AI, default-on visibility, persisted pause across
page reloads, native fetch/XHR restoration, retained network-only metadata on
resume and all five localized AI/unavailable labels plus English fallback.
Confirmed absence requires an explicit null for a known matching owner. Browser
tests keep a response stream open and assert no label before completion, then
verify that a late valid date replaces the unavailable message. Unfinished and
array-wrapped streams, truncated JSON, GraphQL errors and HTTP failures never
produce an unavailable label. The positive AI and explicit-null cases use
sanitized synthetic fixtures; the supplied capture contains false AI flags and
valid dates, so it does not prove those positive cases on a live account.

The original GraphQL attachment was parsed locally and produced four distinct
publication records from its 18 envelopes. The server HTML produced two records;
the later rendered body produced six. The observed `h2` author inside the Reel's
dialog informed the DOM fixture and insertion point.

After the Zod refactor, both original HTML attachments were parsed again and
compared with the previous parser. Every extracted record matched, including the
same two and six distinct video IDs. Private attachments remain outside the repository.

## Limits of this validation

The browser tests substitute the Facebook responses and viewer markup. They do
not log into Facebook, use the user's session, or prove compatibility with every
Facebook account experiment. The original DOM's semantic structure was inspected,
but the private snapshot's full Facebook CSS and scripts were not replayed.
Follow the manual checks in the README for the current live Facebook layout.
