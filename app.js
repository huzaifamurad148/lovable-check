(function () {
  var A = window.Assessment;
  var ACCENT = '#F47A1F';
  var CFG = window.PAGE_CONFIG || {};
  var root = document.getElementById('assess');
  var statusEl = document.getElementById('assess-status');
  var letters = ['A', 'B', 'C', 'D', 'E'];
  var freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com', 'live.com', 'msn.com'];
  var startedAt = Date.now();

  var state = { step: 0, answers: {}, err: '', formErr: '', submitting: false, name: '', email: '', company: '', emailedProspect: false, result: null };

  // Capture tracking parameters once, so the notification shows where the lead came from.
  var params = new URLSearchParams(window.location.search);
  var tracking = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'arm', 'cid'].forEach(function (k) {
    if (params.get(k)) tracking[k] = params.get(k).slice(0, 200);
  });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fill(p) { return p >= 75 ? '#12B76A' : p >= 45 ? '#F79009' : '#F04438'; }

  var arrow = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path></svg>';
  var check = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="flex: none"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>';
  var lock = '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A93A8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex: none"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>';

  var optBase = 'display:flex;align-items:center;gap:12px;flex:1 1 210px;min-height:54px;padding:10px 14px 10px 10px;border-radius:12px;font:inherit;font-size:15px;line-height:1.35;text-align:left;cursor:pointer;transition:border-color .15s ease, background .15s ease, box-shadow .15s ease;';
  var optOff = optBase + 'border:1px solid #DCE0E8;background:#FFFFFF;color:#0E1220;font-weight:500;box-shadow:0 1px 2px rgba(14,18,32,0.04);';
  var optOn = optBase + 'border:1px solid ' + ACCENT + ';background:#FFF4EB;color:#9A3412;font-weight:650;box-shadow:0 0 0 3px rgba(244,122,31,0.18);';
  var keyOff = 'flex:none;width:30px;height:30px;border-radius:8px;background:#F1F3F7;border:1px solid #E1E5EE;color:#525B70;font-family:Geist Mono, monospace;font-size:12.5px;font-weight:600;display:flex;align-items:center;justify-content:center;box-sizing:border-box;';
  var keyOn = 'flex:none;width:30px;height:30px;border-radius:8px;background:' + ACCENT + ';border:1px solid ' + ACCENT + ';color:#0B0F1A;font-family:Geist Mono, monospace;font-size:12.5px;font-weight:600;display:flex;align-items:center;justify-content:center;box-sizing:border-box;';
  var inputStyle = 'min-height: 48px; padding: 0 14px; border-radius: 10px; border: 1px solid #CFD5E1; font: inherit; font-size: 15px; color: #0E1220; background: #FFFFFF; width: 100%; box-sizing: border-box';

  function renderQuiz() {
    var a = state.answers;
    var setIdx = Math.min(state.step, 3);
    var set = A.SETS[setIdx];
    var complete = set.qs.every(function (q) { return !!a[q]; });

    var segs = A.SETS.map(function (st, i) {
      var done = st.qs.every(function (q) { return !!a[q]; });
      var bg = '#E8EBF1';
      if (i < setIdx || (i === setIdx && done)) bg = ACCENT;
      else if (i === setIdx) bg = '#F9C9A3';
      return '<div style="flex:1 1 0;height:6px;border-radius:99px;transition:background .2s ease;background:' + bg + '"></div>';
    }).join('');

    var qs = set.qs.map(function (qid) {
      var q = A.QUESTIONS[qid];
      var opts = q.o.map(function (o, i) {
        var on = a[qid] === o.id;
        return '<button type="button" data-q="' + qid + '" data-o="' + o.id + '" aria-pressed="' + on + '" style="' + (on ? optOn : optOff) + '">' +
          '<span style="' + (on ? keyOn : keyOff) + '">' + letters[i] + '</span>' +
          '<span style="flex: 1 1 auto">' + esc(o.label) + '</span>' + (on ? check : '') + '</button>';
      }).join('');
      return '<fieldset style="border: 0; margin: 0; padding: 0; min-width: 0">' +
        '<legend style="padding: 0; font-size: 19px; font-weight: 650; line-height: 1.35; letter-spacing: -0.01em; color: #0E1220">' + esc(q.t) + '</legend>' +
        (q.sub ? '<p style="margin: 6px 0 0; font-size: 14px; color: #525B70; line-height: 1.5">' + esc(q.sub) + '</p>' : '') +
        '<div style="margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px">' + opts + '</div></fieldset>';
    }).join('');

    var mins = ['3 min', '2 min', '1 min', '30 sec'][setIdx];
    var nextStyle = 'display:inline-flex;align-items:center;gap:10px;min-height:50px;padding:0 22px;border:0;border-radius:12px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:background .15s ease;' +
      (complete ? 'color:#0B0F1A;background:' + ACCENT + ';box-shadow:0 10px 24px -10px rgba(244,122,31,0.6);' : 'color:#FFFFFF;background:#8D96AE;');

    return '<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap">' +
      '<div style="font-size: 15px; font-weight: 700; color: #0E1220">' + esc(set.label) + '</div>' +
      '<div style="font-family: \'Geist Mono\', monospace; font-size: 12.5px; color: #525B70">Step ' + (setIdx + 1) + '/4 · ~' + mins + ' left</div></div>' +
      '<div style="margin-top: 14px; display: flex; gap: 6px">' + segs + '</div>' +
      '<div style="margin-top: 28px; display: flex; flex-direction: column; gap: 28px">' + qs + '</div>' +
      (state.err ? '<p role="alert" style="margin: 20px 0 0; font-size: 14px; color: #B42318; font-weight: 600">' + esc(state.err) + '</p>' : '') +
      '<div style="margin-top: 30px; padding-top: 22px; border-top: 1px solid #EDEFF4; display: flex; justify-content: space-between; align-items: center; gap: 12px">' +
      (state.step > 0
        ? '<button type="button" data-action="back" style="display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 16px; border-radius: 12px; border: 1px solid #DCE0E8; background: #FFFFFF; color: #0E1220; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M11 18l-6-6 6-6"></path></svg>Back</button>'
        : '<span style="font-size: 13px; color: #525B70">No signup to see your score</span>') +
      '<button type="button" data-action="next" style="' + nextStyle + '">' + (setIdx === 3 ? 'See my score' : 'Next') + arrow + '</button></div>';
  }

  function renderResult() {
    var r = state.result;
    var col = fill(r.score);
    var bandColors = { ready: ['#ECFDF3', '#067647'], harden: ['#FFFAEB', '#93370D'], rebuild: ['#FEF3F2', '#B42318'] }[r.band.key];
    var areas = r.areas.map(function (ar) {
      return '<div><div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 600; color: #0E1220">' +
        '<span style="display: inline-flex; align-items: center; gap: 8px"><span style="width:8px;height:8px;border-radius:50%;background:' + fill(ar.pct) + '"></span>' + ar.label + '</span>' +
        '<span style="font-family: \'Geist Mono\', monospace; font-size: 12.5px; color: #525B70">' + A.tone(ar.pct) + ' · ' + ar.pct + '/100</span></div>' +
        '<div style="margin-top: 7px; height: 6px; border-radius: 99px; background: #EDEFF4; overflow: hidden"><div style="height:100%;border-radius:99px;width:' + Math.max(ar.pct, 4) + '%;background:' + fill(ar.pct) + '"></div></div></div>';
    }).join('');
    var gaps = r.fixes.map(function (f, i) {
      return '<div style="display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #F0F2F6; font-size: 14px; color: #0E1220">' +
        '<span style="font-family: \'Geist Mono\', monospace; font-size: 12px; color: #8A93A8; width: 22px; flex: none">' + (i < 9 ? '0' : '') + (i + 1) + '</span>' +
        '<span style="flex: 1 1 auto">' + esc(f.title) + '</span>' + lock + '</div>';
    }).join('');

    return '<div style="display: flex; align-items: center; gap: 24px; flex-wrap: wrap">' +
      '<div style="flex:none;width:132px;height:132px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:conic-gradient(' + col + ' 0 ' + r.score + '%, #EDEFF4 ' + r.score + '% 100%)">' +
      '<div style="width: 108px; height: 108px; border-radius: 50%; background: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center">' +
      '<div style="font-size: 40px; font-weight: 750; letter-spacing: -0.04em; line-height: 1; color: #0E1220">' + r.score + '</div>' +
      '<div style="font-family: \'Geist Mono\', monospace; font-size: 11px; color: #525B70; margin-top: 4px">OF 100</div></div></div>' +
      '<div style="flex: 1 1 220px; min-width: 0">' +
      '<div style="font-family: \'Geist Mono\', monospace; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: #525B70">Your readiness score</div>' +
      '<div style="margin-top: 8px; display:inline-block;padding:6px 12px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:-0.01em;background:' + bandColors[0] + ';color:' + bandColors[1] + '">' + r.band.title + '</div>' +
      '<p style="margin: 10px 0 0; font-size: 15px; line-height: 1.55; color: #3A4256">' + r.band.line + '</p></div></div>' +
      '<div style="margin-top: 26px; display: flex; flex-direction: column; gap: 14px">' + areas + '</div>' +
      '<div style="margin-top: 26px; border: 1px solid #E4E7EE; border-radius: 16px; overflow: hidden">' +
      '<div style="padding: 14px 18px; background: #F6F7FA; border-bottom: 1px solid #E4E7EE; display: flex; justify-content: space-between; align-items: center; gap: 12px">' +
      '<span style="font-size: 15px; font-weight: 700; color: #0E1220">Your full report</span>' +
      '<span style="font-family: \'Geist Mono\', monospace; font-size: 12px; color: #525B70">' + r.fixes.length + ' fixes, in priority order</span></div>' +
      '<div style="padding: 6px 18px 10px">' + gaps + '<p style="margin: 10px 0 4px; font-size: 13px; color: #525B70">Unlock why each one matters and how to fix it.</p></div></div>' +
      '<form id="lead-form" novalidate style="margin-top: 22px; display: flex; flex-direction: column; gap: 12px">' +
      '<div style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden" aria-hidden="true"><label for="f-website">Website</label><input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>' +
      '<div style="display: flex; flex-wrap: wrap; gap: 12px">' +
      '<div style="flex: 1 1 200px; min-width: 0; display: flex; flex-direction: column; gap: 6px"><label for="f-name" style="font-size: 13px; font-weight: 600; color: #3A4256">First name</label>' +
      '<input id="f-name" name="name" type="text" autocomplete="given-name" maxlength="80" value="' + esc(state.name) + '" style="' + inputStyle + '"></div>' +
      '<div style="flex: 1 1 200px; min-width: 0; display: flex; flex-direction: column; gap: 6px"><label for="f-company" style="font-size: 13px; font-weight: 600; color: #3A4256">Company</label>' +
      '<input id="f-company" name="company" type="text" autocomplete="organization" maxlength="120" value="' + esc(state.company) + '" style="' + inputStyle + '"></div></div>' +
      '<div style="display: flex; flex-direction: column; gap: 6px"><label for="f-email" style="font-size: 13px; font-weight: 600; color: #3A4256">Work email</label>' +
      '<input id="f-email" name="email" type="email" autocomplete="email" maxlength="160" placeholder="you@company.com" value="' + esc(state.email) + '" style="' + inputStyle + '"></div>' +
      (state.formErr ? '<p role="alert" style="margin: 0; font-size: 14px; color: #B42318; font-weight: 600">' + esc(state.formErr) + '</p>' : '') +
      '<button type="submit" ' + (state.submitting ? 'disabled ' : '') + 'style="display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 54px; border: 0; border-radius: 12px; background: ' + ACCENT + '; color: #0B0F1A; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 10px 24px -10px rgba(244,122,31,0.6);' + (state.submitting ? 'opacity:.7;cursor:wait' : '') + '">' +
      (state.submitting ? 'Sending…' : 'Email me the full report' + arrow) + '</button>' +
      '<p style="margin: 0; font-size: 13px; color: #525B70; text-align: center">Free. A call is always optional. <a href="' + esc(CFG.privacyUrl || '#') + '" style="color: #525B70">Privacy policy</a></p></form>' +
      '<button type="button" data-action="restart" style="margin-top: 8px; width: 100%; min-height: 44px; border: 0; background: transparent; color: #525B70; font: inherit; font-size: 14px; text-decoration: underline; cursor: pointer">Change my answers</button>';
  }

  function renderDone() {
    var r = state.result;
    var next = {
      ready: ['Want a second pair of eyes before launch?', 'A TekRevol engineer can walk through your checklist with you in 30 minutes.'],
      harden: ['Want help closing these gaps?', 'Book a 30-minute review and we will scope the fixes with you.'],
      rebuild: ['Talk through a production plan', 'Book a 30-minute review and we will map what to keep, what to rebuild and in what order.']
    }[r.band.key];
    var sentLine = state.emailedProspect
      ? 'We sent it to ' + esc(state.email) + '. It lists the ' + r.fixes.length + ' fixes for your app in the order we\'d tackle them.'
      : 'Our team will send it to ' + esc(state.email) + ' within 6 hours. It lists the ' + r.fixes.length + ' fixes for your app in the order we\'d tackle them.';
    return '<div style="width: 56px; height: 56px; border-radius: 16px; background: #ECFDF3; display: flex; align-items: center; justify-content: center">' +
      '<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#067647" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg></div>' +
      '<h2 style="margin: 20px 0 0; font-size: 30px; font-weight: 700; color: #0E1220; letter-spacing: -0.03em; line-height: 1.15">Your report is on its way, ' + esc(state.name) + '</h2>' +
      '<p style="margin: 12px 0 0; font-size: 16px; line-height: 1.6; color: #3A4256">' + sentLine + '</p>' +
      '<div style="margin-top: 26px; padding: 24px; border-radius: 16px; background: #040B18; color: #FFFFFF">' +
      '<div style="font-family: \'Geist Mono\', monospace; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: #F7934A">Next step, optional</div>' +
      '<div style="margin-top: 10px; font-size: 19px; font-weight: 700; letter-spacing: -0.01em">' + next[0] + '</div>' +
      '<p style="margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: #A9B1C4">' + next[1] + '</p>' +
      '<a href="' + esc(CFG.bookingUrl || '#') + '" target="_blank" rel="noopener" style="margin-top: 18px; display: inline-flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 20px; border-radius: 12px; background: #FFFFFF; color: #040B18; font-weight: 700; font-size: 15px; text-decoration: none">Book a 30-minute review' + arrow + '</a></div>';
  }

  function render() {
    if (state.step < 4) root.innerHTML = renderQuiz();
    else if (state.step === 4) root.innerHTML = renderResult();
    else root.innerHTML = renderDone();
    statusEl.textContent = state.step < 4 ? 'In progress' : state.step === 4 ? 'Score ready' : 'Report sent';
  }

  function keepInView() {
    var card = document.getElementById('check');
    var top = card.getBoundingClientRect().top;
    if (top < 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function saveFormValues() {
    var n = document.getElementById('f-name'), e = document.getElementById('f-email'), c = document.getElementById('f-company');
    if (n) state.name = n.value.trim();
    if (e) state.email = e.value.trim();
    if (c) state.company = c.value.trim();
  }

  root.addEventListener('click', function (ev) {
    var opt = ev.target.closest('button[data-q]');
    if (opt) {
      state.answers[opt.getAttribute('data-q')] = opt.getAttribute('data-o');
      state.err = '';
      render();
      return;
    }
    var act = ev.target.closest('[data-action]');
    if (!act) return;
    var action = act.getAttribute('data-action');
    if (action === 'next') {
      var set = A.SETS[Math.min(state.step, 3)];
      if (!set.qs.every(function (q) { return !!state.answers[q]; })) {
        state.err = 'Pick an answer for each question to continue.';
        render();
        return;
      }
      state.step += 1;
      state.err = '';
      if (state.step === 4) state.result = A.compute(state.answers);
      render();
      keepInView();
    } else if (action === 'back') {
      state.step = Math.max(0, state.step - 1);
      state.err = '';
      render();
      keepInView();
    } else if (action === 'restart') {
      saveFormValues();
      state.step = 0;
      state.err = '';
      state.formErr = '';
      render();
      keepInView();
    }
  });

  root.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (state.submitting) return;
    saveFormValues();
    var em = state.email.toLowerCase();
    if (!state.name) { state.formErr = 'Add your first name so we can address the report.'; return render(); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { state.formErr = 'That email does not look right. Check it and try again.'; return render(); }
    if (freeDomains.indexOf(em.split('@')[1]) !== -1) { state.formErr = 'Please use your work email so the report reaches your team.'; return render(); }

    state.formErr = '';
    state.submitting = true;
    render();

    var hp = document.getElementById('f-website');
    fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: state.name,
        email: state.email,
        company: state.company,
        website: hp ? hp.value : '',
        answers: state.answers,
        tracking: tracking,
        page: window.location.href.split('#')[0].slice(0, 500),
        referrer: (document.referrer || '').slice(0, 500),
        secondsOnPage: Math.round((Date.now() - startedAt) / 1000)
      })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; });
    }).then(function (r) {
      state.submitting = false;
      if (!r.ok) {
        state.formErr = (r.body && r.body.error) || 'Something went wrong. Please try again in a moment.';
        return render();
      }
      state.emailedProspect = !!(r.body && r.body.prospectEmailed);
      state.step = 5;
      render();
      keepInView();
    }).catch(function () {
      state.submitting = false;
      state.formErr = 'We could not reach the server. Check your connection and try again.';
      render();
    });
  });

  render();
})();
