# Facebook Reel date

A Chrome/Chromium Manifest V3 extension that displays the exact publication date
of the active Facebook Reel, with configurable placement and appearance.

For Chrome Web Store publication materials, see the [store kit](store/README.md).
The [privacy policy](store/privacy-policy.md) explains the local handling of Reel
metadata and display preferences.

Dates use the browser's preferred locale and system timezone, retain seconds, and
omit timezone abbreviations. The entire interface supports Italian, English,
Spanish, German and French, with English as the fallback for unsupported languages.
Regional variants such as `en-GB`, `en-US`, `es-MX` and `fr-CA` are preserved.

The feature activates only on `https://www.facebook.com/reel/<numeric-id>`, with an
optional trailing slash or query string. It does not display anything on the feed,
profiles, `/watch`, `/reels`, the mobile website or other domains.

## Load in Chrome

The downloadable ZIP includes a built `dist` folder. From a Git checkout, build it using
Node **24.15 or newer in the 24 LTS line, or Node 26+**, then run:

```sh
npm ci
npm run build
```

1. Open `chrome://extensions` in Chrome or Chromium.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this project's **dist** folder, which contains
   `manifest.json`. Do not select `src` or the project root.
4. Reload any Facebook tabs that were already open.
5. Open a Reel at `https://www.facebook.com/reel/<id>` and wait for its author and
   metadata to load. The date appears below the author when both are available.

Click the extension in Chrome's toolbar or Extensions menu to open its settings.
Pin it to the toolbar for quicker access. To update after a code change, build
again and click the extension's reload button in `chrome://extensions`. Opening
settings reconnects the date display in Reel tabs that stayed open during the
extension reload. Reload Facebook to apply changes to the page-world network
observer or recover metadata fetched while the extension was unavailable. To
uninstall, use **Remove** on that page.

The calendar-and-play icon appears in the toolbar and extension manager. Its
editable source is `icons/source.svg`; Chrome loads the matching PNG sizes from
`icons/icon-16.png`, `icon-32.png`, `icon-48.png` and the padded
`icons/store-icon-128.png`. The design is original and does not contain Facebook's
logo or the isolated "f" mark.

## Diagnose a missing date box

On a Reel, open Chrome DevTools and filter the **Console** for
`[Facebook Reel Date]`. If the box remains absent for five seconds, the extension
logs the reason once per Reel and reason. Normal loading does not produce a warning.
The logs contain reason codes, not GraphQL response bodies or Reel URLs.

- `metadata_missing`: no publication metadata matched the active Reel. Reload the
  Reel to capture requests made before the extension started. Some Reels do not
  provide usable metadata.
- `target_missing`: the extension could not identify one visible player and its
  creator heading. Facebook's layout may have changed.
- `stale_player` or `reel_mismatch`: navigation is showing a player associated with
  another Reel. Check whether the warning disappears once the next Reel loads.
- `placement_failed`: the selected position did not fit the visible player. Try
  another position or a larger browser window.
- `render_failed`, `response_inspection_failed`, or `xhr_inspection_failed`: an
  unexpected rendering or GraphQL inspection error occurred. Reload the tab and
  keep the reason code if you report the issue.

The settings popup explains when the active tab is outside a supported
`www.facebook.com/reel/<numeric-id>` page. Settings remain editable there.

## Settings

The **Display** section groups all three checkboxes:

- **Show date** is on by default. Turning it off hides the whole label, including
  relative age and the AI badge, and stops GraphQL observation and DOM scanning.
  Preferences and the current Reel's bounded in-memory metadata survive a pause.
  Turning it back on restores the label without another Facebook request when its
  metadata is still cached. Leaving the Reel route or unloading the page clears
  that metadata. Data first loaded while paused may require a page reload.
- **Show time elapsed** adds the optional relative-age line and defaults to off.
- **Show AI badge** defaults to off. It displays a localized badge only for an
  explicit `ai_generated_detected_info.was_detected_as_ai_generated === true`
  on the same identified story. It reports Facebook's signal, not an independent
  AI analysis. Missing/false/unknown signals produce no badge. Conflicting explicit
  AI flags suppress it until the cache clears or expires.

Click a position directly in the Reel mockup:

- **Top center:** inside the video frame, centered horizontally.
- **Below the Reel:** outside the bottom edge of the video frame, centered. When
  needed, the extension temporarily scales the active Reel down uniformly to keep
  the label visible. It restores the original scale on position change or exit.
- **Below the author:** the default placement, immediately after the author heading.

Choose text color, text size from 10 to 24 px, background color and border color. Optionally
enable a second line with the elapsed time, such as "1 week ago" or "1 settimana
fa". This line updates once per minute while the Reel is visible.

The mockup shows a local illustration of a dancer, with the author near the bottom
of the frame. It uses the same label renderer as the real Reel, at a smaller scale.
Preferences save automatically and update open Reel tabs without reloading. Opening
settings also reconnects the date display in Reel tabs whose content script was
left behind by an extension reload; live tabs keep their existing metadata and are
not reinjected. Only
appearance preferences persist locally. Reel IDs and publication metadata
remain in memory. The default is below the author, white 12 px text on a dark
background and a subtle gray border, with relative age off. Preferences use
`chrome.storage.local`, shared across the popup and Reel tabs and retained after
browser restarts. They are not stored in Facebook's own `localStorage` or synced
to an account. Existing preferences remain valid when a new option is added.

While the date is loading or unknown, the extension displays nothing. It shows
the localized **Creation date unavailable** message only when a known matching
owner's publication context explicitly contains `publish_time: null`. Omitted
fields, invalid values, request failures and waiting timers never imply absence.
For network responses it also waits for successful completion and any declared
stream final marker. Incomplete nested envelopes, truncated JSON and GraphQL
errors cannot confirm absence. Complete bootstrap JSON can provide the same
explicit evidence. A later valid date replaces the message automatically.
Relative age is hidden without a date, while a confirmed AI badge may accompany
the unavailable message. Ambiguous owner/video identity hides the whole label.

## Development

| Command                | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `npm run build`        | Type-check and bundle into `dist`                        |
| `npm run dev`          | Watch TypeScript and popup CSS                           |
| `npm run lint`         | ESLint and strict TypeScript checks                      |
| `npm run format`       | Format source, tests and docs with Prettier              |
| `npm run format:check` | Check formatting without changing files                  |
| `npm test`             | Run extraction, locale, settings and cache tests         |
| `npm run test:browser` | Build and test the actual unpacked extension in Chromium |
| `npm run check`        | Run lint, formatting, unit tests and build               |

Install the test browser once with `npx playwright install chromium`. Browser tests
use a separate temporary profile and intercept all network requests. They do not
log into Facebook or use your browser profile. Changes to `manifest.json`,
`popup.html` or `_locales` require a full `npm run build`, including while
`npm run dev` is running.

The runtime dependencies are date-fns and Zod, bundled locally with their MIT
licenses in `dist/DATE_FNS_LICENSE.txt` and `dist/ZOD_LICENSE.txt`. date-fns's
`intlFormat` and `intlFormatDistance` helpers format exact dates and relative age
using the browser's locale data. Zod validates Facebook metadata, bridge messages
and saved preferences, with TypeScript types inferred from the schemas. Its JIT
compiler is disabled to respect Manifest V3's restriction on runtime code
generation. No code, fonts or assets are downloaded at runtime. The extension has
no backend, analytics or frontend framework.
The `minimatch` override pins the patched version used by the lint tooling.

The local Git repository starts on `main`. `.gitignore` excludes installed packages,
build output, test results, coverage, caches, logs, local environment files and
editor swap files. An `.env.example` may be tracked if one is ever needed.

## Where the date comes from

The supplied GraphQL response contains 18 JSON envelopes, including streamed and
deferred fragments for four different Reel stories. The relevant property is a
JSON string, so it needs its own `JSON.parse`:

```text
story.tracking
  -> page_insights[ownerId].post_context.publish_time
```

The observed story structure identifies the video through
`attachments[].media.id`, `attachments[].media.shareable_url`, and, in deferred
fragments, `video.id` and `url`. Explicit `video_id` is also supported. The parser
associates these fields only within the same story. It does not use an arbitrary
`id`, a timestamp from a sibling, a comment, `creation_time`, or HTTP timing data.

When available, `media.owner.id` selects the corresponding insight entry. Ambiguous
owners, contradictory video IDs, multiple attached videos, invalid timestamps and
conflicting dates are discarded. Video IDs remain strings to avoid numeric
precision loss. The example `1792070163` is `2026-10-15T13:16:03Z`, or 15:16:03 in
Rome on that date.

The cURL identifies `FBUnifiedVideoContainerQuery` at `/api/graphql/`. It was
inspected without execution. Its cookies, tokens and request payload are not
included in the project and are never replayed by the extension.

## How Manifest V3 observation works

Chrome's `webRequest` events expose request details and response metadata, but do
not provide a response-body reader. `declarativeNetRequest` also cannot extract a
field from a GraphQL body. This is a Chrome API limitation, not a claim that all
web-request observation disappeared in MV3.
See the [Chrome webRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest)
and [declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest).

The extension uses two static content scripts at `document_start`:

- `main.js`, in the page's `MAIN` world, watches navigation. On a Reel URL it
  observes the page's own `fetch` and `XMLHttpRequest` calls to the same-origin
  `/api/graphql/` endpoint. Fetch responses are cloned and read incrementally;
  Facebook receives the original response and promise. XHR responses are observed
  without changing requests or their bodies.
- `content.js`, in the `ISOLATED` world, validates the small data bridge, reads
  initial metadata from `script[type="application/json"]`, and manages the date.
  `ReelDateController` owns the settings, cache, view, observer and timers. Its
  `start()` method replaces any previous instance when a stale tab is reinjected.
  Page hiding suspends its work; restoration starts one settings subscription and
  one route timer. It never evaluates page scripts or reads React's private properties.

Static `world: "MAIN"` requires Chrome 111+. MAIN code shares the page's JavaScript
environment, so the page can interfere with it. See
[manifest content scripts](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
and [content-script isolation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).

### URL scope and permissions

Both manifest entries match **only `https://www.facebook.com/*`**, in the top
frame. This broader bootstrap is needed to notice a SPA transition from the feed
to a Reel: Chrome does not rerun static document-start scripts just because
`history.pushState` changes the path.

Outside `/reel/<id>`, there is only a small route watcher. It does not inspect
GraphQL bodies, scan page metadata or observe the DOM. Fetch/XHR hooks are removed
when leaving the Reel route, the date is removed, and cached records are cleared.
History hooks and a 500 ms URL check handle SPA entry, exit and back/forward
navigation. The poll also catches changes made through a replaced history method.
The bootstrap also watches local display preferences. MAIN waits for the isolated
script to load them before observing responses, so a saved disabled preference
does not briefly activate interception at page startup.

The **`storage`** permission lets the popup and isolated content script save
appearance preferences with `chrome.storage.local`; changes propagate through
`storage.onChanged`. The **`scripting`** permission and a host permission limited to
`https://www.facebook.com/*` let the popup reconnect already-open Reel tabs after
an extension reload. On opening settings, it pings each Reel tab and reinjects the
two scripts only if no current content script responds. This also needs
`chrome.tabs.query` and `chrome.tabs.sendMessage`, but not the broad `tabs` API
permission. See the [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage),
[scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting),
and [tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs).

There are no background workers, `web_accessible_resources`, `debugger`,
`webRequest`, cookies, broad `tabs`, clipboard or notification permissions. Site
access remains limited to `www.facebook.com`; the page-world bridge cannot change
preferences or invoke storage operations.

### Bridge and resource limits

The MAIN script sends only a video ID and optional validated publication time,
confirmed-absence flag and AI boolean through
`window.postMessage`, with an exact target origin and a versioned channel.
The isolated script checks `event.source` and `event.origin`, then uses a Zod
discriminated union to validate the channel and each message's payload. Record
validation bounds the array before parsing its items and checks ID syntax,
timestamp units and strict boolean fields. Values become `textContent`,
never HTML. A readiness message includes a boolean to pause/resume observation;
it cannot change stored settings, call privileged extension APIs or relay requests.

**This is validation, not authentication against Facebook itself.** Code running
on the same page can spoof messages, alter displayed text or replace the hooks.
A shared nonce would not make page-world data trustworthy. The extension is a
convenience display of Facebook metadata, not independent proof of publication.

Caches are memory-only, limited to 200 records with a 30-minute expiry. Each message
contains at most 64 records. JSON frames are limited to 2 MiB of text, parsing to
30,000 object visits and 80 levels, fetch responses to 8 MiB, and concurrent fetch
readers to four. XHR observation is also bounded. Readers are cancelled on route
exit, with a 15-second observation deadline and at most 16 active XHR listeners.
Observers are disconnected, and event listeners/timers are cleaned up or
suspended during page hiding. No browsing history is persisted or transmitted.

## DOM evidence and insertion

The first supplied HTML is server bootstrap markup. It contains metadata but no
rendered video or heading. The later body snapshot contains the actual viewer:

```text
div[role="dialog"]
  div[role="main"]
    active video container
      video
      author row
        div
          h2
            ... a[href] with the author's name
          <the extension inserts its date here>
    another preloaded video container
```

`src/view.ts` uses that observed structure without Facebook's generated CSS
classes or translated labels. It prefers videos inside the visible dialog, chooses
the clearly dominant visible video, then looks for one nearby author heading with
a same-origin profile link. In author mode it inserts a single `span` directly
after that heading, inside its existing parent. Top and bottom modes position the
label relative to the visible video's bounding rectangle. A small shadow tree
isolates the label's styling. Temporary scale changes in bottom mode are restored
without overwriting a newer inline scale written by Facebook.

Hidden or similarly prominent competing videos, multiple headings, conflicting
Reel links or an unchanged old player during a route transition suppress the date.
The implementation supports a reused video element once its media/author identity
changes. Mutation observation and viewport checks handle delayed content and
React replacing the heading. Missing information produces no invented date or
extra UI. Confirmed absence is displayed only under the explicit conditions above.

### Verify on your current Facebook layout

1. Open the Reel and inspect its author in **Elements**. Confirm that the author is
   in an `h2` or semantic heading near the visible `video` inside the viewer.
2. After the label appears, this read-only console query should return exactly one
   element: `document.querySelectorAll('[data-fb-reel-date]')`.
3. In **Network**, locate the relevant GraphQL response. Match the Reel ID to the
   same story's video and decode `tracking`. Compare its `publish_time` with:

   ```js
   new Date(1792070163 * 1000).toLocaleString(navigator.language);
   ```

4. Advance through several Reels, use browser back/forward, and return to the feed.
   Confirm that the date follows the active Reel, appears only once and disappears
   on exit. Also check a Reel whose metadata does not include `publish_time`.
5. If Facebook changes the heading layout, update `findHeading` in `src/view.ts`
   and its sanitized DOM fixture. Do not replace it with a guessed hashed class or
   a global first-heading selector.
6. Open settings, try each position and turn relative age on. Check that the bottom
   label sits outside the frame, and that changing back to author mode restores
   the Reel size. Color and font changes should apply to the open Reel immediately.
7. Toggle **Show date** off and on. Confirm that the label disappears and returns,
   including when metadata was received through GraphQL. Enable the AI badge on
   a Reel that Facebook explicitly flags. A slow or failed request must not turn
   into an unavailable-date message after a timer.

## Known limits

- Facebook's internal GraphQL and DOM are not a stable public API. The supplied
  files support the implemented paths and layout, but other account experiments
  can differ.
- Metadata fetched before entering the Reel route, before display preferences have
  loaded, before extension injection, by
  a worker, or through an already-cached native fetch/XHR reference may be missed.
  Bootstrap JSON covers the supplied first-load examples; otherwise reload the
  Reel. The extension deliberately makes no extra Facebook request.
- Oversized, encrypted, unsupported or incomplete responses are skipped. Separately
  deferred fields that never coexist in a story are not guessed or globally joined.
- DOM association uses the route and visible player. It does not inspect private
  React state; a layout without an identifiable author heading is unsupported.
- Fullscreen video that hides the author, picture-in-picture, mobile Facebook and
  embedded cross-origin players are outside the supported layout.
- Below-frame placement is conservative on very small viewports or unusual player
  transforms. If the label cannot fit while keeping the video usable, it is hidden
  until space is available. The extension does not wrap or reparent Facebook's DOM.
- Opening settings reconnects the date display in already-open Reel tabs after an
  extension reload. An existing page-world network observer can continue running
  its previous code because its page-level marker prevents a second installation.
  Reload Facebook to apply network-observer code changes or recover metadata fetched
  while the extension was unavailable.

The automated Chromium tests use realistic reduced fixtures and the real extension
loader. They do not constitute a live authenticated Facebook session. The original
GraphQL response and both HTML inputs were additionally parsed locally. Full
private attachments are deliberately excluded from source and test fixtures.

For other metadata observed in the supplied response, see
[the metadata inventory](docs/metadata-inventory.md). These are observations for
possible future features. The AI indication is now available as an optional badge;
the remaining additional metadata is not displayed.
