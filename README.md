# Scam & Fraud Detection Tool

A browser-based tool that helps you spot **phishing emails**, **suspicious SMS**, **fake listings**, and **sketchy product links**. Paste content or a URL and get a risk score plus specific red flags. For product links (e.g. Amazon, eBay), you can optionally **fetch the page** and analyze the listing text as well.

---

## Features

- **Phishing email** — Checks for urgency language, generic greetings, suspicious or shortened links, and requests for passwords or verification.
- **SMS / Text** — Flags prize/winner wording, bank/urgent/verify language, shortened URLs, and “reply to confirm” style traps.
- **Fake listing** — Looks for payment red flags (wire transfer, pay in advance), contact off-platform (WhatsApp, “email me”), and vague or rushed descriptions.
- **Link / URL** — Validates the URL only (official domains vs typosquatting, subdomain tricks, shortened URLs, HTTP vs HTTPS). Optional: **fetch the page** and run the listing checker on the extracted content.

All checks are **rule-based** and run in the browser (or via a small Node server for the fetch feature). No account or API keys required.

---

## Quick Start

### Option A: No server (URL, email, SMS, listing text only)

1. Open `index.html` in your browser (double-click or use any static file server).
2. Pick a tab, paste your content or URL, and click the analyze button.
3. Review the risk score (0–100%) and the list of issues.

### Option B: With server (fetch & analyze listing at a link)

1. Install dependencies and start the app:
   ```bash
   npm install
   npm start
   ```
2. Open **http://localhost:3035** in your browser.
3. Go to the **Link / URL** tab, paste a product or store link (e.g. Amazon, eBay).
4. Click **Fetch & analyze listing** to have the server load the page, extract the listing text, and run both the URL checker and the fake-listing checker.
5. Review the combined risk score and issues (labeled as URL vs Listing).

---

## What You Get

- **Risk score** — 0–100% (higher = more red flags).
- **Risk level** — Low / Medium / High, with short guidance.
- **Issues list** — Concrete reasons (e.g. “Shortened URL”, “Recognized official domain: amazon.com”, “Listing: Payment red flag: wire transfer”).

For **Link / URL** with **Fetch & analyze listing**, results combine URL and listing checks; if the fetch fails (e.g. site blocks the request), you still see the URL-only result plus a note.

---

## Example Inputs

**Phishing email (high risk):**
```
Dear Customer, Your account has been suspended due to unusual activity.
Verify your identity immediately: https://paypal-secure.com/verify-now
Click here to restore access. Do not ignore this message.
```

**Suspicious SMS (high risk):**
```
URGENT: Your bank detected unusual activity. Confirm now: https://bit.ly/xy7z
Reply YES to secure your account.
```

**Fake listing (high risk):**
```
iPhone 15 Pro - brand new, must sell today. Moving overseas.
Contact me on WhatsApp. Wire transfer or Western Union only. Price negotiable.
```

**Legit link (low risk):**  
Paste a real product URL like `https://www.amazon.com/dp/...` or `https://www.ebay.com/itm/...` and run **Check URL only** or **Fetch & analyze listing**.

---

## Project Structure

```
Fraud-Detection-Tool/
├── index.html       # Single-page app and tabs
├── server.js       # Optional Node server: fetches listing pages for “Fetch & analyze listing”
├── package.json    # Dependencies (express, axios, cheerio)
├── css/
│   └── styles.css  # Layout and theme
├── js/
│   ├── detectors.js # Phishing, SMS, listing, and URL detection logic
│   └── app.js       # UI, result display, and fetch-listing flow
└── README.md
```

---

## Tech Stack

- **Frontend:** HTML, CSS, vanilla JavaScript. No framework.
- **Backend (optional):** Node.js, Express. Fetches pages with axios and extracts text with Cheerio for the “Fetch & analyze listing” feature.

---

## Limitations

- **Pattern-based only.** The tool uses keyword and pattern rules, not AI or real-time threat data. It can miss sophisticated scams and may occasionally flag safe content.
- **Not a guarantee.** Use it as a first check. When in doubt, use official sites, apps, or phone numbers—never links or contacts from the message or listing.
- **URL-only mode** does not visit the link; it only analyzes the URL string. **Fetch & analyze listing** does request the page from the Node server; some sites may block or throttle such requests (you’ll still get the URL check and an error note).

---

## Running Without npm start

For URL-only, email, SMS, and manual listing paste you don’t need the Node server. You can:

- Open `index.html` directly from the file system, or
- Serve the folder with any static server, e.g.:
  - `npx serve .`
  - `python -m http.server 8000`

Then use the app as usual; only **Fetch & analyze listing** will be unavailable until you run `npm start`.
