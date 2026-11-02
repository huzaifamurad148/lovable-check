/*
 * Shared assessment logic. Loaded by the browser (window.Assessment) and by
 * the server (require), so the score the visitor sees and the score in the
 * notification email always come from the same rules.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Assessment = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function mk(arr) {
    return arr.map(function (o) { return { id: o[0], label: o[1], v: o[2] }; });
  }

  var QUESTIONS = {
    who: { t: 'Who will use the app?', o: mk([['team', 'Just our team'], ['customers', 'Our customers'], ['both', 'Both'], ['undecided', 'Not decided yet']]) },
    users: { t: 'How many users do you expect in the next 6 months?', o: mk([['u1', 'Under 100', 1], ['u2', '100 to 1,000', 0.75], ['u3', '1,000 to 10,000', 0.5], ['u4', 'More than 10,000', 0.3]]) },
    data: { t: 'What is the most sensitive data it stores?', o: mk([['none', 'Nothing sensitive', 1], ['personal', 'Personal details', 0.6], ['payment', 'Payment details', 0.4], ['health', 'Health or financial records', 0.3]]) },
    access: { t: 'Has anyone reviewed who can read or change your data?', sub: 'For example, Supabase access rules (called row-level security).', o: mk([['yes', 'Yes, fully reviewed', 1], ['partly', 'Partly', 0.5], ['no', 'No', 0], ['unsure', 'Not sure', 0.1]]) },
    links: { t: 'Which other systems does it need to connect to?', o: mk([['none', 'None', 1], ['few', 'One or two tools', 0.7], ['many', 'Three or more tools', 0.45], ['core', 'Core systems like ERP or billing', 0.3]]) },
    ops: { t: 'Do you have backups and error monitoring set up?', o: mk([['yes', 'Yes, both', 1], ['some', 'One of them', 0.55], ['no', 'Neither', 0.1], ['unsure', 'Not sure', 0.2]]) },
    owner: { t: 'Who will maintain it after launch?', o: mk([['inhouse', 'Our in-house developers', 1], ['vendor', 'A freelancer or agency', 0.6], ['nobody', 'No one yet', 0.15]]) },
    plan: { t: 'What happens next with it?', o: mk([['launch', 'Launch as is'], ['extend', 'Add more features'], ['rebuild', 'Rebuild it properly'], ['unsure', 'Not sure yet']]) },
    when: { t: 'When do you want it in front of real users?', o: mk([['month', 'This month'], ['quarter', 'This quarter'], ['later', 'Later this year'], ['nodate', 'No date yet']]) }
  };

  var SETS = [
    { label: 'Your app', qs: ['who', 'users'] },
    { label: 'Data and security', qs: ['data', 'access'] },
    { label: 'Connections and upkeep', qs: ['links', 'ops'] },
    { label: 'Ownership and plans', qs: ['owner', 'plan', 'when'] }
  ];

  // Short guidance used in the prospect report email. General good practice,
  // not claims about the prospect's app.
  var FIXES = {
    lockdown: {
      title: 'Lock down who can read and change sensitive data',
      priority: 'High',
      why: 'Your app stores sensitive data and its access rules have not been fully reviewed. This is the most common way fast-built apps expose customer records.',
      how: 'If your Lovable app uses Supabase, confirm row-level security is switched on for every table and that each policy only lets a user see their own records. Test it by signing in as two different users and trying to read each other\'s data.'
    },
    access: {
      title: 'Review your data access rules before launch',
      priority: 'High',
      why: 'Even without sensitive data, open access rules let anyone change or delete records.',
      how: 'Check that every table has access rules, that write access is limited to the right users, and that no API keys with admin rights are used in the browser.'
    },
    owner: {
      title: 'Decide who owns and maintains the app after launch',
      priority: 'High',
      why: 'Live apps need bug fixes, dependency updates and security patches. Without a named owner, small issues pile up quietly.',
      how: 'Name a person or team responsible, give them access to the code and hosting, and agree how fast they respond when something breaks.'
    },
    ops: {
      title: 'Set up backups and error monitoring',
      priority: 'Medium',
      why: 'Without backups, one bad change can lose data for good. Without monitoring, you hear about errors from users first.',
      how: 'Confirm your database plan includes automated backups and test a restore once. Add an error tracking tool so failures alert your team.'
    },
    integrations: {
      title: 'Plan how the app connects to your core systems',
      priority: 'Medium',
      why: 'Connections to billing, CRM or ERP systems are where prototypes most often need real engineering.',
      how: 'List each system, the data that moves and in which direction. Keep API keys on the server side, never in the browser, and handle failed syncs gracefully.'
    },
    scale: {
      title: 'Test performance at your expected number of users',
      priority: 'Medium',
      why: 'An app that feels fast with ten testers can slow down sharply with thousands of real users.',
      how: 'Load-test your busiest screens, check database queries have the right indexes and set sensible limits on how much data each request pulls.'
    },
    vendor: {
      title: 'Agree on support terms with whoever maintains it',
      priority: 'Low',
      why: 'Outside help works best when response times and responsibilities are clear before something goes wrong.',
      how: 'Put response times, what counts as urgent and who owns the code in writing.'
    },
    extend: {
      title: 'Check the codebase can take new features cleanly',
      priority: 'Low',
      why: 'Generated code can repeat logic in several places, which makes each new feature slower and riskier.',
      how: 'Have an engineer review the structure before adding features and tidy up duplicated components first.'
    },
    review: {
      title: 'Run a final pre-launch review',
      priority: 'Low',
      why: 'Your answers look solid. A last check catches the small things that are easy to miss.',
      how: 'Walk through sign-up, payments and data access as a new user, and confirm backups and monitoring are working.'
    }
  };

  function val(answers, qid) {
    var q = QUESTIONS[qid];
    for (var i = 0; i < q.o.length; i++) {
      if (q.o[i].id === answers[qid]) return typeof q.o[i].v === 'number' ? q.o[i].v : 0;
    }
    return 0;
  }

  function label(qid, id) {
    var q = QUESTIONS[qid];
    for (var i = 0; i < q.o.length; i++) if (q.o[i].id === id) return q.o[i].label;
    return '';
  }

  function isComplete(answers) {
    return Object.keys(QUESTIONS).every(function (k) { return !!label(k, answers[k]); });
  }

  function compute(a) {
    var security = val(a, 'access');
    if (a.data === 'none') security = Math.max(security, 0.6);
    var data = (val(a, 'data') + val(a, 'ops')) / 2;
    var scale = (val(a, 'users') + val(a, 'links')) / 2;
    var ownership = val(a, 'owner');
    var areas = [['Security', security], ['Data', data], ['Scale', scale], ['Ownership', ownership]].map(function (x) {
      return { label: x[0], pct: Math.round(x[1] * 100) };
    });
    var score = Math.round(areas.reduce(function (s, x) { return s + x.pct; }, 0) / areas.length);

    var sensitive = a.data && a.data !== 'none';
    var keys = [];
    if (a.access !== 'yes' && sensitive) keys.push('lockdown');
    else if (a.access !== 'yes') keys.push('access');
    if (a.owner === 'nobody') keys.push('owner');
    if (a.ops !== 'yes') keys.push('ops');
    if (a.links === 'many' || a.links === 'core') keys.push('integrations');
    if (a.users === 'u3' || a.users === 'u4') keys.push('scale');
    if (a.owner === 'vendor') keys.push('vendor');
    if (a.plan === 'extend') keys.push('extend');
    if (keys.length === 0) keys.push('review');
    var fixes = keys.map(function (k) { return Object.assign({ key: k }, FIXES[k]); });

    var band;
    if (score >= 75) band = { key: 'ready', title: 'Ready with small fixes', line: 'The foundations look solid. A short checklist should get you launch-ready.' };
    else if (score >= 45) band = { key: 'harden', title: 'Needs hardening', line: 'The app works, but a few gaps should be closed before real users and data arrive.' };
    else band = { key: 'rebuild', title: 'Needs a proper build', line: 'The prototype proved the idea. The core likely needs rebuilding before it can carry real users.' };

    return { score: score, areas: areas, fixes: fixes, band: band };
  }

  function tone(p) { return p >= 75 ? 'Strong' : p >= 45 ? 'Needs work' : 'At risk'; }

  return { QUESTIONS: QUESTIONS, SETS: SETS, compute: compute, label: label, isComplete: isComplete, tone: tone };
});
