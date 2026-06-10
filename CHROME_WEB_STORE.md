# Chrome Web Store submission

## Upload package

Upload this ZIP in the Chrome Web Store Developer Dashboard:

`dist/chrome-web-store/linkedin-job-match-keywords-0.1.0.zip`

## Store listing assets

Use these generated assets in the listing:

- Store icon: `icons/icon-128.png`
- Required small promotional image: `store-assets/promo/promo-small-440x280.png`
- Optional marquee image: `store-assets/promo/promo-marquee-1400x560.png`
- Screenshot: `store-assets/screenshots/screenshot-main-1280x800.png`

## Suggested listing copy

Title:

`LinkedIn Job Match Keywords`

Summary:

`Compare LinkedIn job descriptions against your positive, core, and negative keywords.`

Description:

`LinkedIn Job Match Keywords adds a compact sidebar to LinkedIn Jobs pages so you can quickly understand whether a job description matches what you are looking for.`

Main features:

- Add very positive, positive, and negative keyword lists.
- Match full words and exact phrases in the job description.
- See found and missing keywords with occurrence counts.
- Get a directional match percentage without relying on LinkedIn's recommendations.
- Works on classic LinkedIn Jobs pages and newer AI Power Search / SDUI job pages.

Privacy note:

`The extension stores your keyword lists in chrome.storage.sync. It reads the job description text from the active LinkedIn Jobs page to calculate matches. It does not send job descriptions or keywords to any external server.`

## Permission justification

- `storage`: saves the user's keyword lists between sessions.
- `activeTab`: lets the popup send rescan/restart commands to the active LinkedIn Jobs tab.
- `scripting`: lets the popup restart the widget on an already-open LinkedIn Jobs tab if the content script is not responding.
- Host permission `https://www.linkedin.com/jobs/*`: limits the content script to LinkedIn Jobs pages.

## Manual dashboard checklist

1. Create a new item in the Chrome Web Store Developer Dashboard.
2. Upload `dist/chrome-web-store/linkedin-job-match-keywords-0.1.0.zip`.
3. Add the listing assets above.
4. Select a category such as `Productivity`.
5. Fill in support/contact fields.
6. Complete privacy practices using the privacy note above.
7. Submit for review.
