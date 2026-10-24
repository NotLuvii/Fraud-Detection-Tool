(function () {
  'use strict';

  const tabs = [...document.querySelectorAll('.segment')];
  const panels = [...document.querySelectorAll('.panel')];
  const results = document.getElementById('results');
  const placeholder = document.getElementById('results-placeholder');
  const content = document.getElementById('results-content');
  const riskFill = document.getElementById('risk-fill');
  const riskValue = document.getElementById('risk-value');
  const riskLevel = document.getElementById('risk-level');
  const riskGuidance = document.getElementById('risk-guidance');
  const meter = document.querySelector('.meter');
  const issuesTitle = document.getElementById('issues-title');
  const issuesList = document.getElementById('issues-list');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // The tool's own guidance for each level, unchanged; shown as a level and a line beneath it.
  const levelText = {
    high: 'High risk — treat as suspicious and avoid clicking links or sharing info.',
    medium: 'Medium risk — review the flagged items before trusting this content.',
    low: 'Low risk — few or no obvious red flags, but stay cautious.',
  };

  /* ── Tabs: a segmented control with arrow-key movement ── */
  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => {
      p.hidden = p.id !== 'panel-' + tab.dataset.tab;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab, false));
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (step) {
        e.preventDefault();
        selectTab(tabs[(i + step + tabs.length) % tabs.length], true);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        selectTab(tabs[e.key === 'Home' ? 0 : tabs.length - 1], true);
      }
    });
  });

  /* ── Marking the phrases the rules quoted, inside the message ── */
  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  }
  // Only phrases a rule quoted, and only where they occur in the text as written.
  function quotedPhrases(issues) {
    const out = [];
    issues.forEach((i) => {
      for (const m of i.msg.matchAll(/"([^"]{2,80})"/g)) out.push(m[1]);
    });
    return out;
  }
  function ranges(text, phrases) {
    const lower = text.toLowerCase();
    const found = [];
    phrases.forEach((p) => {
      const needle = p.toLowerCase();
      let at = lower.indexOf(needle);
      while (at !== -1) {
        found.push([at, at + needle.length]);
        at = lower.indexOf(needle, at + needle.length);
      }
    });
    found.sort((a, b) => a[0] - b[0]);
    const merged = [];
    found.forEach((r) => {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push(r.slice());
    });
    return merged;
  }
  function paintMirror(field, marks) {
    const textarea = field.querySelector('textarea');
    const mirror = field.querySelector('.mirror');
    const text = textarea.value;
    let html = '';
    let at = 0;
    marks.forEach(([a, b]) => {
      html += escapeHtml(text.slice(at, a)) + '<mark>' + escapeHtml(text.slice(a, b)) + '</mark>';
      at = b;
    });
    // A trailing newline needs a character after it to take up a line, as it does in the textarea.
    mirror.innerHTML = html + escapeHtml(text.slice(at)) + '​';
    mirror.scrollTop = textarea.scrollTop;
  }
  document.querySelectorAll('[data-field]').forEach((field) => {
    const textarea = field.querySelector('textarea');
    const mirror = field.querySelector('.mirror');
    // Marks belong to the text that was checked; editing it clears them.
    textarea.addEventListener('input', () => {
      if (mirror.querySelector('mark')) paintMirror(field, []);
      setStatus(field.closest('.panel'), '');
    });
    textarea.addEventListener('scroll', () => {
      mirror.scrollTop = textarea.scrollTop;
    });
  });

  /* ── Status line beside the button ── */
  function setStatus(panel, text, isError) {
    const status = panel && panel.querySelector('[data-status]');
    if (!status) return;
    status.textContent = text;
    status.classList.toggle('is-error', Boolean(isError));
  }

  /* ── The result ── */
  function showResults(result) {
    const { risk, level, issues } = result;
    placeholder.hidden = true;
    content.hidden = false;
    content.classList.remove('is-new');
    void content.offsetWidth;
    content.classList.add('is-new');

    riskValue.textContent = String(risk);
    const [name, guidance] = levelText[level].split(' — ');
    riskLevel.textContent = name;
    riskLevel.className = 'level ' + level;
    riskGuidance.textContent = guidance.charAt(0).toUpperCase() + guidance.slice(1);
    riskFill.className = 'meter-fill ' + level;
    riskFill.style.setProperty('--p', String(risk / 100));
    meter.setAttribute('aria-valuenow', String(risk));
    meter.setAttribute('aria-valuetext', risk + ' out of 100, ' + name);

    issuesList.innerHTML = '';
    const warnings = issues.filter((i) => i.type !== 'legit' && i.type !== 'fetch');
    issuesTitle.textContent = warnings.length
      ? warnings.length + (warnings.length === 1 ? ' warning sign' : ' warning signs')
      : 'No warning signs';
    if (issues.length) {
      issues.forEach((i) => {
        const li = document.createElement('li');
        li.textContent = i.msg;
        if (i.type === 'legit') li.classList.add('legit');
        if (i.type === 'fetch') li.classList.add('note');
        issuesList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'No specific issues detected by this checker.';
      li.classList.add('none');
      issuesList.appendChild(li);
    }

    // On a narrow screen the result sits below the form: bring it into view.
    const box = results.getBoundingClientRect();
    if (box.top > window.innerHeight * 0.6) {
      results.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function clearResults() {
    placeholder.hidden = false;
    content.hidden = true;
  }

  function runDetector(type) {
    const panel = document.getElementById('panel-' + type);
    const input = document.getElementById('input-' + type);
    const text = ((input && input.value) || '').trim();
    if (!text) {
      clearResults();
      setStatus(panel, type === 'link' ? 'Paste a link to check.' : 'Paste something to check.', true);
      input.focus();
      return;
    }
    setStatus(panel, '');
    const detectorMap = { email: 'phishing', sms: 'sms', listing: 'listing', link: 'link' };
    const result = Detectors[detectorMap[type]].run(text);
    const field = panel.querySelector('[data-field]');
    if (field) paintMirror(field, ranges(input.value, quotedPhrases(result.issues)));
    showResults(result);
  }

  document.querySelectorAll('[data-detect]').forEach((btn) => {
    btn.addEventListener('click', () => runDetector(btn.dataset.detect));
  });
  // Cmd/Ctrl + Enter checks from inside a field.
  document.querySelectorAll('.panel textarea, .panel input').forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || el.tagName === 'INPUT')) {
        e.preventDefault();
        runDetector(el.closest('.panel').id.replace('panel-', ''));
      }
    });
  });

  /* ── Fetch the listing behind a link (needs the Node server) ── */
  const btnFetchListing = document.getElementById('btn-fetch-listing');
  const linkPanel = document.getElementById('panel-link');
  if (btnFetchListing) {
    btnFetchListing.addEventListener('click', async () => {
      const input = document.getElementById('input-link');
      const url = ((input && input.value) || '').trim();
      if (!url) {
        clearResults();
        setStatus(linkPanel, 'Paste a link to check.', true);
        input.focus();
        return;
      }
      const label = btnFetchListing.textContent;
      btnFetchListing.textContent = 'Fetching…';
      btnFetchListing.disabled = true;
      setStatus(linkPanel, 'Loading the page…');
      try {
        const res = await fetch('/api/fetch-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        const urlResult = Detectors.link.run(url);
        setStatus(linkPanel, '');
        if (!data.ok) {
          showResults({ ...urlResult, issues: [...urlResult.issues, { type: 'fetch', msg: 'Could not load listing: ' + (data.error || 'Unknown error') }] });
        } else if (!data.content || data.content.length < 30) {
          showResults({ ...urlResult, issues: data.warning ? [...urlResult.issues, { type: 'fetch', msg: data.warning }] : urlResult.issues });
        } else {
          showMergedResults(urlResult, Detectors.listing.run(data.content));
        }
      } catch (_) {
        setStatus(linkPanel, 'Could not reach the server. Run the app with npm start and try again. Showing the link check only.', true);
        showResults(Detectors.link.run(url));
      } finally {
        btnFetchListing.textContent = label;
        btnFetchListing.disabled = false;
      }
    });
  }

  function showMergedResults(urlResult, listingResult) {
    const risk = Math.max(urlResult.risk, listingResult.risk);
    const level = risk >= 70 ? 'high' : risk >= 40 ? 'medium' : 'low';
    const urlIssues = urlResult.issues.map((i) => ({ ...i, msg: (i.type === 'legit' ? '' : 'URL: ') + i.msg }));
    const listingIssues = listingResult.issues.map((i) => ({ ...i, msg: 'Listing: ' + i.msg }));
    showResults({ risk, level, issues: [...urlIssues, ...listingIssues] });
  }
})();
