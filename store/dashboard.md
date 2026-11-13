# Chrome Web Store dashboard text

These notes match the current Manifest V3 package. Recheck the final package before submitting.

## Privacy practices

**Single purpose**

Display the publication date and time of the Facebook Reel currently being viewed, with optional elapsed time and a Facebook-provided AI indication, using metadata already loaded by Facebook.

**Why `storage` is needed**

Save the user's display preferences, including position, colors, size, and optional labels, in `chrome.storage.local` on the user's device. Reel metadata is never saved there.

**Why `scripting` is needed**

When the settings popup opens, reconnect a Reel tab that remained open during an extension restart. The popup first checks whether its content script responds and reinjects only the extension's bundled scripts into an unresponsive Reel tab.

**Why access to `https://www.facebook.com/*` is needed**

Static scripts must be present on Facebook pages to detect navigation into a Reel within Facebook's single-page interface. They inspect GraphQL responses and page metadata only on a matching `/reel/<numeric-id>` route. The same narrow host permission lets the popup find and reconnect stale Reel tabs. No other domain is requested.

**Remote code**

No. All extension code and dependencies are bundled in the ZIP. The extension reads Facebook's data responses but does not fetch or execute remote extension code.

**Data handling**

The extension locally processes the current Reel URL and selected website content: Reel/video ID, owner ID, shareable URL, publication time, and an explicit AI flag if present. Facebook GraphQL responses may also contain suggested Reels; candidate records can enter the short-lived cache to identify the active Reel, while unrelated response fields are not retained. It uses these records only to show the date, optional elapsed time, and optional AI badge for the active Reel. Reel metadata remains in bounded memory; each entry expires 30 minutes after its last observation, and the cache clears on Reel exit or tab close. Display preferences remain in local browser storage until removed. The extension sends no data to the developer, analytics providers, or other third parties. It makes no extra Facebook request.

For the dashboard's data-category checkboxes, disclose **Website content**. Chrome says local processing still counts as handling user data. The extension reads the current Reel URL but does not create a list of visited pages; compare the dashboard's current wording for **Web history** before submitting. Do not claim that the extension handles no user data.

Use the public URL of [the privacy policy](privacy-policy.md) after this file reaches a public branch. The dashboard declarations and the policy must match the submitted ZIP.

## Store listing

- Suggested primary category: **Social & Communication**, if available in the current dashboard.
- Suggested primary language: **English**, matching `default_locale: en`.
- Support URL: `https://github.com/Undermaken/facebook-reel-published-at/issues`.
- Website URL, if desired: `https://github.com/Undermaken/facebook-reel-published-at`.
- The five detailed descriptions are in [listings](listings/).

## Test instructions for reviewers

Replace `PUBLIC_REEL_URL_WITH_VISIBLE_DATE` with a real public Reel that the extension successfully displays. Do not put Facebook credentials in the repository.

```text
1. Install the extension and open PUBLIC_REEL_URL_WITH_VISIBLE_DATE.
2. Wait for Facebook to load the Reel and its metadata. The publication date appears below the creator.
3. Open the extension popup. Select Top center, Below the Reel, and Below the creator. The date moves without a page reload.
4. Change the text or background color. The open Reel updates.
5. Enable Show time elapsed. Enable Show AI badge only on a Reel that Facebook explicitly marks as AI-generated.
6. Disable Show date to hide the label. Some Reels do not provide usable publication metadata, so please use the supplied test URL for the primary check.
```

If Facebook requires a login to reach the test Reel, provide reviewer-only credentials in the dashboard's Test instructions tab, not in Git or the public description.
