# Localized date and settings plan

## User requirements

- Use the browser locale and timezone for the exact date, retaining seconds and
  removing GMT/UTC labels from the interface.
- Use date-fns for absolute and relative date formatting.
- Localize the entire interface in Italian, English, Spanish, German and French.
  Fall back to English when the browser's preferred language is unsupported.
- Add a small extension popup with a clickable Reel mockup. Offer top center,
  below the Reel frame, and below the author as positions.
- Let the user choose text color, font size, background color and border color.
- Optionally display a localized relative age below the exact date.
- Show a stylized dancer in the mockup, with the author near the lower frame edge.
- Initialize Git on main and ignore dependencies, generated files and local secrets.

## Implementation choices

- Keep the author position as the default and relative age off initially.
- Persist only appearance preferences in chrome.storage.local, with live updates
  in open Reel tabs. The only new permission is storage.
- Bundle date-fns locally. Keep metadata extraction and the MAIN bridge unchanged.
- Use the system timezone through date-fns Intl helpers, preserving regional
  browser locale variants for the supported languages.
- For below-frame placement, reserve visible space by shrinking the active Reel
  uniformly only when the label would otherwise fall outside the viewport. Restore
  any temporary presentation changes on route exit or position change.

## Work and verification

1. Add failing tests for locales, relative age, fallback and settings validation;
   implement shared formatting, translations and preference storage.
2. Add the popup, the three placement modes and live preference updates. Test the
   real extension popup, persistence and the video/label geometry in Chromium.
3. Run the existing regression suite, lint, formatting and build; inspect the
   popup and each placement visually. Update installation and privacy documentation
   and package the rebuilt extension. Obtain an independent read-only code review.

The initial settings update completed with 42 unit tests and 21 Chromium tests. Independent review identified
one bottom-placement regression, which was reproduced and fixed before its
follow-up review. Appearance settings, including the new border color, persist
in local extension storage. Other observed metadata is documented separately and
is documented separately.

Version 0.3 adds an optional AI badge, a default-on master display switch, and
confirmed date-unavailable messages. All checkboxes share the Display fieldset.
Loading and unknown metadata remain silent. Absence requires an explicit null for
a known matching owner and a completed response; incomplete or failed responses
never establish absence. Pausing preserves bounded metadata for immediate resume
while stopping DOM/network observation. Follow-up review verified fixes for
network-only resume, owner association and nested incomplete responses. The final
suite contains 49 unit tests and 29 Chromium tests.
