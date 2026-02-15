/**
 * Scam / Fraud Detection - Rule-based detectors for emails, SMS, and listings.
 */

const Detectors = {
  // ---- PHISHING EMAIL ----
  phishing: {
    urgencyWords: [
      'urgent', 'immediately', 'asap', 'act now', 'limited time', 'expires today',
      'account suspended', 'verify now', 'confirm your identity', 'security alert',
      'your account will be closed', 'click here to restore', 'final notice'
    ],
    genericGreetings: ['dear customer', 'dear user', 'dear member', 'dear account holder', 'hello'],
    suspiciousDomains: ['paypal-secure', 'amazon-help', 'apple-id', 'microsoft-verify', 'bank-login', 'secure-update'],
    linkPatterns: [/https?:\/\/[^\s]+/g, /bit\.ly|tinyurl|goo\.gl|t\.co/gi],
    requestPatterns: [
      /password|pin|ssn|social security|credit card|cvv|bank account|wire transfer/gi,
      /click (here|below|the link)/gi,
      /verify (your|my) (account|email|identity)/gi,
      /update (your|my) (information|details)/gi
    ],
    run(text) {
      const lower = text.toLowerCase();
      const issues = [];
      let score = 0;

      this.urgencyWords.forEach(w => {
        if (lower.includes(w)) {
          issues.push({ type: 'urgency', msg: `Urgency language: "${w}"` });
          score += 15;
        }
      });

      const hasGenericGreeting = this.genericGreetings.some(g => lower.startsWith(g) || lower.includes('\n' + g));
      if (hasGenericGreeting) {
        issues.push({ type: 'greeting', msg: 'Generic greeting (e.g. "Dear Customer")' });
        score += 20;
      }

      this.suspiciousDomains.forEach(d => {
        if (lower.includes(d)) {
          issues.push({ type: 'domain', msg: `Suspicious domain-like text: "${d}"` });
          score += 25;
        }
      });

      const links = text.match(this.linkPatterns[0]) || [];
      const shortLinks = text.match(this.linkPatterns[1]);
      if (shortLinks && shortLinks.length > 0) {
        issues.push({ type: 'link', msg: 'Shortened or suspicious links (bit.ly, tinyurl, etc.)' });
        score += 20;
      }
      if (links.length > 2) {
        issues.push({ type: 'link', msg: `Multiple links (${links.length}) - common in phishing` });
        score += 10;
      }

      this.requestPatterns.forEach(re => {
        if (re.test(text)) {
          issues.push({ type: 'request', msg: 'Asks for sensitive info or to click/verify' });
          score += 25;
          re.lastIndex = 0;
        }
      });

      const excessivePunctuation = (text.match(/!|\?/g) || []).length > 3;
      if (excessivePunctuation) {
        issues.push({ type: 'tone', msg: 'Excessive exclamation marks or question marks' });
        score += 10;
      }

      const risk = Math.min(100, score);
      const level = risk >= 70 ? 'high' : risk >= 40 ? 'medium' : 'low';
      return { risk, level, issues: [...new Map(issues.map(i => [i.msg, i])).values()] };
    }
  },

  // ---- SUSPICIOUS SMS ----
  sms: {
    scamPhrases: [
      'you have won', 'you won', 'congratulations you', 'claim your prize', 'claim now',
      'text stop to opt out', 'reply stop', 'urgent', 'your bank', 'suspended', 'verify',
      'click here', 'confirm your', 'unusual activity', 'unrecognized', 'refund',
      'delivery problem', 'package held', 'pay a fee', 'tax refund', 'free gift',
      'limited time', 'act now', 'expires today', 'winner', 'claim your', 'cash prize'
    ],
    shortUrlPattern: /bit\.ly|tinyurl|goo\.gl|t\.co|ow\.ly|is\.gd|buff\.ly/gi,
    numberPattern: /\b\d{4,}\b/g,
    run(text) {
      const lower = text.toLowerCase();
      const issues = [];
      let score = 0;

      this.scamPhrases.forEach(phrase => {
        if (lower.includes(phrase)) {
          issues.push({ type: 'phrase', msg: `Scam-like phrase: "${phrase}"` });
          score += 18;
        }
      });

      if (this.shortUrlPattern.test(text)) {
        issues.push({ type: 'link', msg: 'Shortened URL - often used in SMS scams' });
        score += 25;
      }

      const numbers = text.match(this.numberPattern) || [];
      if (numbers.length >= 2) {
        issues.push({ type: 'numbers', msg: 'Multiple long number sequences (account/code impersonation)' });
        score += 15;
      }

      if (text.length < 20 && (lower.includes('http') || lower.includes('click'))) {
        issues.push({ type: 'short', msg: 'Very short message with link - typical smishing' });
        score += 20;
      }

      if (lower.includes('reply') && lower.includes('yes') || lower.includes('reply y')) {
        issues.push({ type: 'reply', msg: 'Asks you to reply to confirm - common in subscription fraud' });
        score += 15;
      }

      const risk = Math.min(100, score);
      const level = risk >= 60 ? 'high' : risk >= 35 ? 'medium' : 'low';
      return { risk, level, issues: [...new Map(issues.map(i => [i.msg, i])).values()] };
    }
  },

  // ---- FAKE LISTINGS ----
  listing: {
    redFlags: [
      'wire transfer', 'western union', 'moneygram', 'pay before', 'pay in advance',
      'contact me outside', 'email me at', 'text me at', 'whatsapp', 'telegram',
      'too good to be true', 'must sell today', 'moving overseas', 'currently abroad',
      'shipping only', 'cannot meet', 'will ship after payment', 'half price',
      'brand new never used', 'still in box', 'gift', 'inherited', 'divorce'
    ],
    vagueLanguage: ['item', 'thing', 'stuff', 'as described', 'good condition', 'works perfectly'],
    pricePattern: /\$\s*\d+|€\s*\d+|£\s*\d+|\d+\s*(dollars|euros|usd|eur)/gi,
    run(text) {
      const lower = text.toLowerCase();
      const issues = [];
      let score = 0;

      this.redFlags.forEach(phrase => {
        if (lower.includes(phrase)) {
          issues.push({ type: 'redflag', msg: `Listing red flag: "${phrase}"` });
          score += 22;
        }
      });

      const vagueCount = this.vagueLanguage.filter(v => lower.includes(v)).length;
      if (vagueCount >= 2) {
        issues.push({ type: 'vague', msg: 'Vague or generic description (avoids specifics)' });
        score += 15;
      }

      if (lower.includes('price') && (lower.includes('negotiable') || lower.includes('obo')) && text.length < 200) {
        issues.push({ type: 'price', msg: 'Very short ad with "negotiable" or "OBO" - rush to move off platform' });
        score += 10;
      }

      const hasPrice = this.pricePattern.test(text);
      if (hasPrice && (lower.includes('contact') || lower.includes('email')) && !lower.includes('message me on')) {
        issues.push({ type: 'contact', msg: 'Pushes contact outside platform (email/phone instead of in-app)' });
        score += 20;
      }

      if (text.length < 80 && (lower.includes('sell') || lower.includes('selling'))) {
        issues.push({ type: 'short', msg: 'Very short listing - scam ads often lack detail' });
        score += 12;
      }

      const risk = Math.min(100, score);
      const level = risk >= 55 ? 'high' : risk >= 30 ? 'medium' : 'low';
      return { risk, level, issues: [...new Map(issues.map(i => [i.msg, i])).values()] };
    }
  },

  // ---- LINK / URL (e.g. Amazon, eBay) ----
  link: {
    // Official domains for major marketplaces (hostname without subdomain, normalized)
    officialDomains: [
      'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.es', 'amazon.it',
      'amazon.ca', 'amazon.com.au', 'amazon.co.jp', 'amazon.in', 'amazon.com.mx', 'amazon.com.br',
      'ebay.com', 'ebay.co.uk', 'ebay.de', 'ebay.fr', 'ebay.es', 'ebay.it', 'ebay.com.au', 'ebay.ca',
      'paypal.com', 'paypal.co.uk', 'paypal.me',
      'apple.com', 'apple.com/shop', 'microsoft.com', 'microsoft.com/store',
      'walmart.com', 'target.com', 'bestbuy.com', 'aliexpress.com', 'alibaba.com',
      'etsy.com', 'wish.com', 'wayfair.com', 'overstock.com', 'newegg.com', 'rakuten.com'
    ],
    // Known typosquatting / lookalike patterns (regex or string in domain)
    typosquatPatterns: [
      { name: 'Amazon', pattern: /am[ao]zon|amazom|amzon|amaz0n|arnazon|amazom/i },
      { name: 'eBay', pattern: /e[b8]ay|ebayy|eebay|ebbay|ebey/i },
      { name: 'PayPal', pattern: /paypa1|paypai|paypaI|paypal1|paypa\./i },
      { name: 'Apple', pattern: /app1e|aple|appie|app1e/i }
    ],
    shortenedHosts: /^(bit\.ly|tinyurl\.com|goo\.gl|t\.co|ow\.ly|is\.gd|buff\.ly|tiny\.cc|rebrand\.ly|short\.link)$/i,
    suspiciousTlds: ['.tk', '.ml', '.ga', '.cf', '.gq', '.ru', '.xyz', '.top', '.work', '.click', '.link', '.review', '.download', '.stream'],
    suspiciousPathSegments: ['login', 'signin', 'verify', 'secure', 'account', 'update', 'confirm', 'validate', 'phishing'],
    run(input) {
      const issues = [];
      let score = 0;
      let hostname = '';
      let isOfficial = false;

      const raw = input.trim();
      const withProtocol = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;

      let url;
      try {
        url = new URL(withProtocol);
      } catch (_) {
        return {
          risk: 100,
          level: 'high',
          issues: [{ type: 'invalid', msg: 'This is not a valid URL.' }]
        };
      }

      hostname = url.hostname.toLowerCase().replace(/^www\./, '');
      const protocol = url.protocol.toLowerCase();
      const path = url.pathname.toLowerCase();

      // ---- Official domain check ----
      const domainParts = hostname.split('.');
      const baseDomain = domainParts.length >= 2
        ? domainParts.slice(-2).join('.')
        : hostname;
      const fullHost = hostname;

      for (const official of this.officialDomains) {
        const officialBase = official.split('/')[0];
        if (fullHost === officialBase || fullHost.endsWith('.' + officialBase)) {
          isOfficial = true;
          issues.push({ type: 'legit', msg: `Recognized official domain: ${officialBase}` });
          break;
        }
      }

      if (!isOfficial) {
        // Typosquatting: looks like a brand but wrong spelling
        for (const { name, pattern } of this.typosquatPatterns) {
          if (pattern.test(hostname)) {
            issues.push({ type: 'typosquat', msg: `Domain looks like "${name}" but may be misspelled or fake.` });
            score += 55;
            break;
          }
        }

        // Subdomain trick: amazon.com.evil.com
        if (hostname.includes('amazon.com.') || hostname.includes('ebay.com.') || hostname.includes('paypal.com.')) {
          const afterBrand = hostname.split(/amazon\.com\.|ebay\.com\.|paypal\.com\./)[1];
          if (afterBrand && afterBrand.length > 0) {
            issues.push({ type: 'subdomain', msg: 'Domain uses brand name as subdomain of another site (common phishing).' });
            score += 60;
          }
        }

        // Hyphen / extra words in “brand” domain (e.g. amazon-secure.com, ebay-verify.net)
        if (/\b(amazon|ebay|paypal|apple|microsoft)-[a-z]+\./i.test(hostname)) {
          issues.push({ type: 'fake', msg: 'Brand name with hyphen and extra word (e.g. amazon-secure.com) — often fake.' });
          score += 50;
        }

        // Suspicious TLD for shopping
        const tld = hostname.includes('.') ? '.' + hostname.split('.').pop() : '';
        if (this.suspiciousTlds.some(s => tld === s)) {
          issues.push({ type: 'tld', msg: `Suspicious top-level domain (${tld}) for a shopping or brand site.` });
          score += 35;
        }

        // Generic “could be anything” if it has brand-like keywords but not official
        if (/amazon|ebay|paypal|apple|microsoft|walmart|bank/i.test(hostname) && score === 0) {
          issues.push({ type: 'unknown', msg: 'Domain contains brand-like words but is not in the official list — verify separately.' });
          score += 30;
        }
      }

      // ---- Shortened URL ----
      if (this.shortenedHosts.test(hostname)) {
        issues.push({ type: 'short', msg: 'Shortened URL — real destination is hidden. Do not trust for shopping or login links.' });
        score = Math.max(score, 50);
      }

      // ---- IP address ----
      const ipV4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
      if (ipV4.test(hostname)) {
        issues.push({ type: 'ip', msg: 'Host is an IP address, not a domain name — common in phishing.' });
        score += 40;
      }

      // ---- HTTP ----
      if (protocol === 'http:') {
        issues.push({ type: 'http', msg: 'Link uses HTTP (not HTTPS). Legit shopping sites use HTTPS.' });
        score += 25;
      }

      // ---- Suspicious path on non-official domain ----
      if (!isOfficial && this.suspiciousPathSegments.some(seg => path.includes(seg))) {
        issues.push({ type: 'path', msg: 'URL path suggests login/verify/account — risky if domain is not official.' });
        score += 20;
      }

      const risk = Math.min(100, score);
      const level = risk >= 55 ? 'high' : risk >= 35 ? 'medium' : 'low';
      const uniqueIssues = [...new Map(issues.map(i => [i.msg, i])).values()];
      return { risk, level, issues: uniqueIssues };
    }
  }
};

// Export for use in app
if (typeof module !== 'undefined' && module.exports) module.exports = { Detectors };
