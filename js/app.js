(function () {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  const resultsPlaceholder = document.getElementById('results-placeholder');
  const resultsContent = document.getElementById('results-content');
  const riskFill = document.getElementById('risk-fill');
  const riskValue = document.getElementById('risk-value');
  const riskLevel = document.getElementById('risk-level');
  const issuesList = document.getElementById('issues-list');

  function switchTab(selectedTab) {
    const tabId = selectedTab.dataset.tab;
    tabs.forEach(t => {
      t.classList.toggle('active', t === selectedTab);
      t.setAttribute('aria-selected', t === selectedTab ? 'true' : 'false');
    });
    panels.forEach(p => {
      const isActive = p.id === 'panel-' + tabId;
      p.classList.toggle('active', isActive);
      p.hidden = !isActive;
    });
  }

  function showResults(result) {
    const { risk, level, issues } = result;
    resultsPlaceholder.hidden = true;
    resultsContent.hidden = false;

    riskFill.style.width = risk + '%';
    riskFill.className = 'risk-fill ' + level;
    riskValue.textContent = risk + '%';
    document.querySelector('.risk-bar').setAttribute('aria-valuenow', risk);

    const levelText = {
      high: 'High risk — treat as suspicious and avoid clicking links or sharing info.',
      medium: 'Medium risk — review the flagged items before trusting this content.',
      low: 'Low risk — few or no obvious red flags, but stay cautious.'
    };
    riskLevel.textContent = levelText[level];
    riskLevel.className = 'risk-level ' + level;

    issuesList.innerHTML = '';
    if (issues.length) {
      issues.forEach(i => {
        const li = document.createElement('li');
        li.textContent = i.msg;
        if (i.type === 'legit') li.classList.add('legit');
        if (i.type === 'fetch') li.setAttribute('data-issue-type', 'fetch');
        issuesList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'No specific issues detected by this checker.';
      li.classList.add('none');
      issuesList.appendChild(li);
    }
  }

  function runDetector(type) {
    const input = document.getElementById('input-' + type);
    const text = (input && input.value || '').trim();
    if (!text) {
      resultsPlaceholder.hidden = false;
      resultsContent.hidden = true;
      resultsPlaceholder.textContent = type === 'link' ? 'Please paste a URL to check.' : 'Please enter some content to analyze.';
      return;
    }
    const detectorMap = { email: 'phishing', sms: 'sms', listing: 'listing', link: 'link' };
    const detector = Detectors[detectorMap[type]];
    const result = detector.run(text);
    showResults(result);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab));
  });

  document.querySelectorAll('[data-detect]').forEach(btn => {
    btn.addEventListener('click', () => runDetector(btn.dataset.detect));
  });

  // Fetch listing from URL and run both URL + listing detectors
  const btnFetchListing = document.getElementById('btn-fetch-listing');
  if (btnFetchListing) {
    btnFetchListing.addEventListener('click', async () => {
      const input = document.getElementById('input-link');
      const url = (input && input.value || '').trim();
      if (!url) {
        resultsPlaceholder.hidden = false;
        resultsContent.hidden = true;
        resultsPlaceholder.textContent = 'Please paste a URL to check.';
        return;
      }

      const originalLabel = btnFetchListing.textContent;
      btnFetchListing.textContent = 'Fetching…';
      btnFetchListing.disabled = true;
      resultsPlaceholder.hidden = false;
      resultsContent.hidden = true;
      resultsPlaceholder.textContent = 'Fetching page content…';

      try {
        const res = await fetch('/api/fetch-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();

        const urlResult = Detectors.link.run(url);
        if (!data.ok) {
          const issues = [...urlResult.issues, { type: 'fetch', msg: 'Could not load listing: ' + (data.error || 'Unknown error') }];
          showResults({ ...urlResult, issues });
        } else if (!data.content || data.content.length < 30) {
          const issues = data.warning
            ? [...urlResult.issues, { type: 'fetch', msg: data.warning }]
            : urlResult.issues;
          showResults({ ...urlResult, issues });
        } else {
          const listingResult = Detectors.listing.run(data.content);
          showMergedResults(urlResult, listingResult);
        }
      } catch (_) {
        resultsPlaceholder.textContent = 'Could not reach the server. Run the app with npm start and try again.';
        resultsPlaceholder.hidden = false;
        resultsContent.hidden = true;
        const urlResult = Detectors.link.run(url);
        showResults(urlResult);
      } finally {
        btnFetchListing.textContent = originalLabel;
        btnFetchListing.disabled = false;
      }
    });
  }

  function showMergedResults(urlResult, listingResult) {
    const risk = Math.max(urlResult.risk, listingResult.risk);
    const level = risk >= 70 ? 'high' : risk >= 40 ? 'medium' : 'low';
    const urlIssues = urlResult.issues.map(i => ({ ...i, msg: (i.type === 'legit' ? '' : 'URL: ') + i.msg }));
    const listingIssues = listingResult.issues.map(i => ({ ...i, msg: 'Listing: ' + i.msg }));
    const combined = [...urlIssues, ...listingIssues];
    showResults({ risk, level, issues: combined });
  }

})();
