# Facebook Reel date implementation plan

The user requested a complete TypeScript Manifest V3 extension in this folder, with
Prettier, lint/build scripts and Chrome installation instructions. Only the exact
publication date is displayed, only on `https://www.facebook.com/reel/*`.

## Evidence and design

- The supplied GraphQL response contains 18 newline-separated JSON envelopes and
  four distinct Reel stories, including streamed and deferred fragments.
- `tracking` is serialized JSON. Extract only
  `page_insights[ownerId].post_context.publish_time`.
- Associate that timestamp with the same story's `attachments[].media`, `video`,
  `video_id` or Reel URL. Never search an entire response for the first timestamp.
- The supplied cURL requests `FBUnifiedVideoContainerQuery`. Do not execute it or
  copy its credentials into this project.
- The supplied HTML contains bootstrap JSON but no rendered video, headings,
  links or ARIA roles. Extract initial metadata from its JSON scripts, but do not
  claim that it verifies a runtime DOM selector.
- A later body snapshot contains the rendered viewer: a dialog, a main region,
  separate active and preloaded video containers, and an author h2 inside its own
  div. Insert the date after that h2 without using generated class names.
- A small page-world bootstrap watches route changes. Only on the Reel route does
  it observe fetch/XHR responses. An isolated content script validates the bridge
  and renders a plain date near an unambiguous heading in the active video container.
- No runtime dependencies, remote requests, background worker, privileged API,
  persisted data, settings page or popup.

## Work and checks

1. Write failing parser/route tests, then implement bounded JSON framing, strict
   story-to-video association, timestamp validation and Italian date formatting.
   Test the original GraphQL and HTML locally without storing either in the repo.
2. Write failing browser tests for fetch/XHR observation, inline JSON, route gating,
   SPA changes, delayed headings, duplicate prevention and response integrity.
   Implement the MAIN/ISOLATED scripts with bounded caches and cleanup.
3. Build with esbuild, run lint, formatting, unit and Chromium extension tests.
   Document the exact permissions, threat model, unsupported cases and manual DOM
   verification. Review the completed code before delivery.

## Review focus

- A story with several unrelated nested videos must never donate its date to them.
- Responses or bootstrap data may arrive before the heading or the bridge listener.
- The visible video and current URL may briefly disagree during SPA transitions.
- Leaving the Reel route must remove the badge and stop response inspection.
- The host page can spoof bridge messages; they must never cause privileged actions.

## Completion

All three work steps are complete. The implementation passed clean installation,
lint, formatting, type checking, 22 unit tests, 11 Chromium extension tests and
build. Review findings received regression tests and fixes. See `validation.md`
for evidence and the limits of the automated checks.
