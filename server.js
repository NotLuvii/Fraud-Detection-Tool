/**
 * Serves the fraud detection app and provides an API to fetch listing page content.
 * Run: npm install && npm start
 */

const path = require('path');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3035;
const FETCH_TIMEOUT_MS = 12000;
const MAX_TEXT_LENGTH = 50000;

// Browser-like headers so some sites don't block the request
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

app.use(express.json());
app.use(express.static(path.join(__dirname)));

/**
 * Extract main text from HTML for listing/product pages.
 * Prefers product title, description, and main content; falls back to body text.
 */
function extractListingText(html, url) {
  const $ = cheerio.load(html);

  // Remove script, style, nav, footer
  $('script, style, nav, footer, [role="navigation"], .nav, .footer, iframe').remove();

  const selectors = [
    // Product / listing page selectors (Amazon, eBay, generic)
    '[data-feature-name="productDescription"]',
    '#productDescription',
    '.product-description',
    '#itemDesc',
    '.item-description',
    '[class*="product-description"]',
    '[class*="ProductDescription"]',
    '#viTabs_0_panel',           // eBay description
    '.x-item-description',
    '.ux-labels-values__values-content',
    '#dp-container',             // Amazon product
    '#ppd',                      // Amazon product
    '[data-cel-widget="feature-bullets"]',
    '#feature-bullets',
    '.a-section.content',
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '#main',
    '.content',
    'body'
  ];

  let text = '';
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      text = el.text().replace(/\s+/g, ' ').trim();
      if (text.length >= 80) break;
    }
  }

  if (!text) {
    text = $('body').text().replace(/\s+/g, ' ').trim();
  }

  // Title from page
  const title = $('title').text().trim() || $('h1').first().text().trim();
  if (title && !text.includes(title)) {
    text = title + '\n\n' + text;
  }

  return text.slice(0, MAX_TEXT_LENGTH);
}

app.post('/api/fetch-listing', async (req, res) => {
  const url = req.body?.url?.trim();
  if (!url) {
    return res.status(400).json({ ok: false, error: 'Missing url' });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return res.status(400).json({ ok: false, error: 'Invalid URL' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ ok: false, error: 'URL must be http or https' });
  }

  try {
    const response = await axios.get(url, {
      timeout: FETCH_TIMEOUT_MS,
      headers: FETCH_HEADERS,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
      responseType: 'text',
    });

    const html = response.data;
    const content = extractListingText(html, url);

    if (!content || content.length < 20) {
      return res.json({
        ok: true,
        content: '',
        title: null,
        warning: 'Little or no readable text could be extracted from the page.',
      });
    }

    res.json({ ok: true, content, title: null });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const message = status === 403 ? 'Site blocked the request (403).'
        : status === 404 ? 'Page not found (404).'
        : status ? `Server returned ${status}.`
        : err.code === 'ECONNABORTED' ? 'Request timed out.'
        : 'Could not reach the site.';
      return res.status(200).json({ ok: false, error: message });
    }
    res.status(200).json({ ok: false, error: 'Failed to fetch the page.' });
  }
});

app.listen(PORT, () => {
  console.log(`Fraud Detection Tool running at http://localhost:${PORT}`);
});
