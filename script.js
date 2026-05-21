/* ================================================================
   PHISHGUARD — script.js
   ================================================================ */

const CONFIG = {
  gameLength:      15,
  phishingCount:   9,
  legitCount:       6,
  pointsCorrect:   10,
  pointsWrong:     -5,
  streakBonus:      5,
  streakThreshold:  3,
};

/* ── SUPABASE ─────────────────────────────────────────────────── */
const SUPABASE_URL     = 'https://syqnkcdjnoblfzeosodm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cW5rY2Rqbm9ibGZ6ZW9zb2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODg0MTAsImV4cCI6MjA5NDc2NDQxMH0.aSI06wkqi2e0_HI00Ps7P6p2Iu58XeDX2MFOsa7afcc';
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let playerName = '';

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function submitScore(accuracy) {
  try {
    await db.from('scores').insert({
      name:            playerName,
      score:           state.score,
      correct:         state.correct,
      wrong:           state.wrong,
      accuracy:        accuracy,
      phishing_caught: state.phishingCaught,
      best_streak:     state.bestStreak,
    });
  } catch (e) {
    console.warn('Score submit failed:', e);
  }
}

async function fetchLeaderboard() {
  const lbLoading = document.getElementById('lb-loading');
  const lbList    = document.getElementById('lb-list');
  try {
    const { data, error } = await db
      .from('scores')
      .select('name, score, accuracy, phishing_caught')
      .order('score', { ascending: false })
      .limit(5);
    if (error) throw error;
    lbLoading.classList.add('hidden');
    lbList.classList.remove('hidden');
    lbList.innerHTML = data.map((row, i) => {
      const isYou = row.name.toLowerCase() === playerName.toLowerCase();
      return '<div class="lb-row' + (isYou ? ' lb-row-you' : '') + '">' +
        '<span class="lb-rank">#' + (i + 1) + '</span>' +
        '<span class="lb-name">' + esc(row.name) +
          (isYou ? '<span class="lb-you-tag">YOU</span>' : '') + '</span>' +
        '<span class="lb-score">' + row.score + ' pts</span>' +
        '<span class="lb-acc">' + row.accuracy + '%</span>' +
        '</div>';
    }).join('');
  } catch (e) {
    lbLoading.textContent = 'Unable to load leaderboard.';
    console.warn('Leaderboard fetch failed:', e);
  }
}

let state = {
  scenarios: [], index: 0, score: 0,
  streak: 0, bestStreak: 0, correct: 0, wrong: 0,
  phishingCaught: 0, falsePositives: 0, missedPhishing: 0,
  answered: false,
};

/* ── BOOT ─────────────────────────────────────────────────────── */
const BOOT_LINES = [
  'Initializing scenario database... [50 scenarios loaded]',
  'Loading up leaderboard and analytics modules... [OK]',
  'Think you can spot which is fake or not?',
  'Good luck User! :)',
];

function runBoot() {
  let li = 0;
  function typeLine(el, text, cb) {
    let i = 0;
    const t = setInterval(() => {
      el.textContent += text[i++];
      if (i >= text.length) { clearInterval(t); if (cb) setTimeout(cb, 400); }
    }, 28);
  }
  function next() {
    const el = document.getElementById('boot-line-' + (li + 1));
    if (!el || li >= BOOT_LINES.length) return;
    typeLine(el, BOOT_LINES[li++], next);
  }
  setTimeout(next, 400);
}

/* ── INIT ─────────────────────────────────────────────────────── */
function initGame() {
  state = {
    scenarios: [], index: 0, score: 0,
    streak: 0, bestStreak: 0, correct: 0, wrong: 0,
    phishingCaught: 0, falsePositives: 0, missedPhishing: 0,
    answered: false,
  };
  const all      = [...SCENARIOS].sort(() => Math.random() - 0.5);
  const phishing = all.filter(s =>  s.isPhishing).slice(0, CONFIG.phishingCount);
  const legit    = all.filter(s => !s.isPhishing).slice(0, CONFIG.legitCount);
  state.scenarios = [...phishing, ...legit].sort(() => Math.random() - 0.5);
  document.getElementById('scenario-total').textContent = state.scenarios.length;
  showScenario(0);
  updateNextButton();
}

/* ── SHOW SCENARIO ────────────────────────────────────────────── */
function showScenario(i) {
  state.index = i;
  state.answered = false;
  const s = state.scenarios[i];

  document.getElementById('scenario-num').textContent = i + 1;
  document.getElementById('progress-bar').style.width = (i / CONFIG.gameLength * 100) + '%';
  document.getElementById('scenario-type-tag').textContent = s.type;
  document.getElementById('scenario-title').textContent = s.title;

  const diff = s.difficulty;
  document.getElementById('scenario-diff-tag').textContent = diff.toUpperCase();
  const db = document.getElementById('difficulty-badge');
  db.textContent = diff.toUpperCase();
  db.className = 'difficulty-badge ' + diff;

  document.getElementById('url-lock').textContent = s.hasLock ? '🔒' : '🔓';
  document.getElementById('url-protocol').textContent = s.hasLock ? 'https://' : 'http://';
  const domEl = document.getElementById('url-domain');
  domEl.textContent = s.domain;
  domEl.className = 'url-domain' + (s.domainClass ? ' ' + s.domainClass : '');

  document.getElementById('scenario-content').innerHTML = s.html;
  document.getElementById('decision-panel').classList.remove('hidden');
  document.getElementById('feedback-panel').classList.add('hidden');
  
  // Update button text based on current position
  updateNextButton();
}

/* ── ANSWER ───────────────────────────────────────────────────── */
function handleAnswer(userSaidPhishing) {
  if (state.answered) return;
  state.answered = true;
  const s = state.scenarios[state.index];
  const correct = userSaidPhishing === s.isPhishing;

  if (correct) {
    state.correct++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    
    let pts = CONFIG.pointsCorrect; // 10 points
    
    // NEW STREAK BONUS LOGIC
    if (state.streak === 3) {
      pts += 5;  // +5 bonus at streak 3
    } else if (state.streak >= 5) {
      pts += 10; // +10 bonus for streak 5 and above
    }
    
    state.score += pts;
    if (s.isPhishing) state.phishingCaught++;
  } else {
    state.wrong++;
    state.streak = 0;  // Reset streak on wrong answer
    state.score = Math.max(0, state.score + CONFIG.pointsWrong); // -5 points, min 0
    if (s.isPhishing && !userSaidPhishing) state.missedPhishing++;
    if (!s.isPhishing && userSaidPhishing) state.falsePositives++;
  }
  
  updateHUD();
  showFeedback(correct, userSaidPhishing, s);
}

/* ── FEEDBACK ─────────────────────────────────────────────────── */
function showFeedback(correct, userSaidPhishing, s) {
  document.getElementById('decision-panel').classList.add('hidden');
  const panel  = document.getElementById('feedback-panel');
  const header = document.getElementById('feedback-header');
  const indSec = document.getElementById('indicators-section');
  panel.classList.remove('hidden');
  header.className = 'feedback-header';
  indSec.classList.add('hidden');

  const icon  = document.getElementById('feedback-icon');
  const title = document.getElementById('feedback-title');
  const msg   = document.getElementById('feedback-message');

  if (correct) {
  header.classList.add(s.isPhishing ? 'success' : 'info');
  icon.textContent = '✔';
  title.textContent = s.isPhishing
    ? 'Threat Neutralized — Phishing Detected'
    : 'Verified — Legitimate Source Confirmed';
  let bonusText = '';
  if (state.streak === 3) {
    bonusText = ' (+5 streak bonus!)';
  } else if (state.streak >= 5) {
    bonusText = ' (+10 streak bonus!)';
  }
  msg.textContent = s.explanation + bonusText;
    if (s.isPhishing && s.indicators.length) {
      indSec.classList.remove('hidden');
      document.getElementById('indicators-title').textContent = '⚑ Indicators (educational review):';
      document.getElementById('indicators-list').innerHTML =
        s.indicators.map(x => '<li>' + x + '</li>').join('');
    }
  } else if (s.isPhishing && !userSaidPhishing) {
    header.classList.add('danger');
    icon.textContent  = '✘';
    title.textContent = 'Security Breach — Phishing Attack Missed';
    msg.textContent   = 'You marked this as legitimate. Review the indicators below:';
    indSec.classList.remove('hidden');
    document.getElementById('indicators-title').textContent = '⚠ Phishing Indicators:';
    document.getElementById('indicators-list').innerHTML =
      s.indicators.map(x => '<li>' + x + '</li>').join('');
  } else {
    header.classList.add('warning');
    icon.textContent  = '⚠';
    title.textContent = 'False Alarm — This Was Legitimate';
      const hintMsg = s.hints.length 
    ? s.hints[Math.floor(Math.random() * s.hints.length)]
    : 'No specific phishing indicators were detected. Check the URL — it matches the legitimate domain.';
  msg.textContent = hintMsg;
  }
}

/* ── HUD ──────────────────────────────────────────────────────── */
function updateHUD() {
  const el = document.getElementById('score-display');
  el.textContent = state.score;
  el.classList.remove('score-pop');
  void el.offsetWidth;
  el.classList.add('score-pop');
  document.getElementById('streak-display').textContent = state.streak;
  document.getElementById('correct-display').textContent = state.correct;
  document.getElementById('wrong-display').textContent = state.wrong;
  
  const total = state.correct + state.wrong;
  document.getElementById('accuracy-display').textContent =
    total > 0 ? Math.round(state.correct / total * 100) + '%' : '—';
  
  // Optional: Add streak bonus indicator
  const streakEl = document.getElementById('streak-display');
  if (state.streak >= 5) {
    streakEl.style.color = 'var(--accent)';
    streakEl.title = '+10 bonus per correct answer!';
  } else if (state.streak >= 3) {
    streakEl.style.color = 'var(--yellow)';
    streakEl.title = '+5 bonus on next correct!';
  } else {
    streakEl.style.color = 'var(--text-primary)';
    streakEl.title = '';
  }
}

/* ── NEXT / RESULTS ───────────────────────────────────────────── */
function nextScenario() {
  if (state.index + 1 >= CONFIG.gameLength) { showResults(); return; }
  showScenario(state.index + 1);
}

async function showResults() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('results-screen').classList.remove('hidden');
  document.getElementById('progress-bar').style.width = '100%';

  const total    = state.correct + state.wrong;
  const accuracy = total > 0 ? Math.round(state.correct / total * 100) : 0;
  let riskClass, riskText, icon, evalText;

  if (accuracy >= 85) {
    riskClass = 'aware';      riskText = 'SECURITY AWARE'; icon = '🛡';
    evalText  = 'Outstanding. You caught ' + state.phishingCaught + ' phishing attempts with only ' + state.falsePositives + ' false alarm(s). Strong threat recognition skills demonstrated.';
  } else if (accuracy >= 65) {
    riskClass = 'moderate';   riskText = 'MODERATE RISK';  icon = '⚠';
    evalText  = 'Decent awareness, but you missed ' + state.missedPhishing + ' phishing attack(s). Focus on domain name inspection and urgency-based manipulation tactics.';
  } else {
    riskClass = 'vulnerable'; riskText = 'HIGH RISK';      icon = '☠';
    evalText  = 'High vulnerability detected. You missed ' + state.missedPhishing + ' phishing attack(s) and had ' + state.falsePositives + ' false alarm(s). Study the Detection Guide and practise spotting domain spoofing and pressure tactics.';
  }

  document.getElementById('results-icon').textContent   = icon;
  document.getElementById('r-score').textContent        = state.score;
  document.getElementById('r-accuracy').textContent     = accuracy + '%';
  document.getElementById('r-correct').textContent      = state.correct;
  document.getElementById('r-wrong').textContent        = state.wrong;
  document.getElementById('r-streak').textContent       = state.bestStreak;
  document.getElementById('r-phish-caught').textContent = state.phishingCaught;
  const riskEl = document.getElementById('results-risk');
  riskEl.textContent = riskText;
  riskEl.className   = 'results-risk ' + riskClass;
  document.getElementById('results-eval').textContent = evalText;

  // Save and display leaderboard
  const submitEl   = document.getElementById('submit-status');
  const lbLoading  = document.getElementById('lb-loading');
  const lbList     = document.getElementById('lb-list');
  submitEl.classList.remove('hidden');
  lbList.classList.add('hidden');
  lbLoading.textContent = 'Loading scores...';
  lbLoading.classList.remove('hidden');

  await submitScore(accuracy);
  submitEl.classList.add('hidden');
  await fetchLeaderboard();
}

function updateNextButton() {
  const nextBtn = document.getElementById('next-btn');
  const isLastScenario = state.index + 1 >= CONFIG.gameLength;
  
  if (isLastScenario) {
    nextBtn.textContent = 'Submit → View Results';
  } else {
    nextBtn.textContent = 'Next Scenario →';
  }
}

/* ── EVENTS ───────────────────────────────────────────────────── */
function showBoot() {
  document.getElementById('instruction-screen').classList.add('hidden');
  document.getElementById('results-screen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('boot-screen').classList.remove('hidden');
}

function showInstructions() {
  document.getElementById('boot-screen').classList.add('hidden');
  document.getElementById('results-screen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('instruction-screen').classList.remove('hidden');
  // Reset leaderboard for next session
  document.getElementById('submit-status').classList.add('hidden');
  document.getElementById('lb-list').classList.add('hidden');
  document.getElementById('lb-loading').textContent = 'Loading scores...';
  document.getElementById('lb-loading').classList.remove('hidden');
}

function startGame() {
  const input = document.getElementById('player-name-input');
  const name  = input.value.trim();
  if (!name) {
    document.getElementById('name-error').classList.remove('hidden');
    input.focus();
    return;
  }
  document.getElementById('name-error').classList.add('hidden');
  playerName = name;
  document.getElementById('instruction-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initGame();
}

document.addEventListener('DOMContentLoaded', () => {
  runBoot();

  // Boot → Instructions
  document.getElementById('start-btn').addEventListener('click', showInstructions);

  // Instructions → Game
  document.getElementById('instr-start-btn').addEventListener('click', startGame);
  document.getElementById('player-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') startGame();
  });
  document.getElementById('player-name-input').addEventListener('input', () =>
    document.getElementById('name-error').classList.add('hidden'));

  // In-game controls
  document.getElementById('btn-legit').addEventListener('click', () => handleAnswer(false));
  document.getElementById('btn-phish').addEventListener('click', () => handleAnswer(true));
  document.getElementById('next-btn').addEventListener('click', nextScenario);
  document.getElementById('guide-toggle').addEventListener('click', () =>
    document.getElementById('guide-panel').classList.toggle('hidden'));
  document.getElementById('guide-close').addEventListener('click', () =>
    document.getElementById('guide-panel').classList.add('hidden'));

  // Back to Main Menu buttons
  document.getElementById('instr-back-btn').addEventListener('click', showBoot);
  document.getElementById('results-back-btn').addEventListener('click', showBoot);

  // Restart → Instructions (re-brief before next session)
  document.getElementById('restart-btn').addEventListener('click', showInstructions);
  document.getElementById('restart-results-btn').addEventListener('click', showInstructions);
});

/* ================================================================
   SCENARIOS — phishing 1-13
   ================================================================ */
const SCENARIOS = [

{
  id: 1, title: 'PayPal — Account Restricted',
  type: 'EMAIL', difficulty: 'hard', isPhishing: true,
  url: 'paypal.com.verify-account.net/login', domain: 'paypal.com.verify-account.net', domainClass: 'suspicious', hasLock: true,
  indicators: [
    'Domain contains "paypal.com" but the actual domain is "verify-account.net" — subdomain spoofing.',
    'Real PayPal domains end with paypal.com — anything after paypal.com/ is a path, but paypal.com.XXX is a different domain.',
    'Requests SSN and full card number during "verification" — PayPal never asks for this.',
  ],
  explanation: 'Correct. The domain "paypal.com.verify-account.net" looks like it belongs to PayPal, but the real domain is verify-account.net. Always look for the last slash before .com',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">PayPal Security &lt;security@paypal.com.verify-account.net&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">user@email.com</span></div>
    <div class="sim-email-subject">&#9888; Your account has been restricted — Action required</div>
  </div>
  <div class="sim-email-body">
    <p>Dear valued customer,</p>
    <p>We noticed unusual activity on your PayPal account. To avoid permanent limitation, please verify your identity within 24 hours.</p>
    <p><strong>Required verification:</strong> SSN (last 4 digits) and card number on file.</p>
    <a class="sim-email-cta" href="#">Verify Account Now</a>
    <p style="margin-top:12px;font-size:0.78rem">Link: https://paypal.com.verify-account.net/login</p>
  </div>
  <div class="sim-email-footer">PayPal | security@paypal.com.verify-account.net</div>
</div>`
},

{
  id: 2, title: 'Netflix — Billing Suspension Notice',
  type: 'EMAIL', difficulty: 'easy', isPhishing: true,
  url: 'netflix-billing-update.com/account', domain: 'netflix-billing-update.com', domainClass: 'suspicious', hasLock: false,
  indicators: [
    'Sender domain is "netflix-update.net" — not the official netflix.com.',
    'Generic greeting "Dear Customer" — no account name or last-4 card digits shown.',
    'Threatens permanent account suspension within 48 hours to force a click.',
    'CTA button links to a non-Netflix domain.',
  ],
  explanation: 'Correct. Netflix sends billing emails from @netflix.com and always addresses you by your registered name. This sender domain is a lookalike.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Netflix Billing &lt;billing@netflix-update.net&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">user@email.com</span></div>
    <div class="sim-email-subject">&#9888; Your Netflix account will be suspended — update payment now</div>
  </div>
  <div class="sim-email-body">
    <p>Dear Customer,</p>
    <p>We were unable to process your latest payment. Your account will be <strong>permanently suspended within 48 hours</strong> unless you update your billing information immediately.</p>
    <p>Failure to act will result in loss of all your watch history and profiles.</p>
    <a class="sim-email-cta red-btn" href="#">Update Payment Now &#8594;</a>
  </div>
  <div class="sim-email-footer">Netflix Inc. | billing@netflix-update.net</div>
</div>`
},

{
  id: 3, title: 'Chase Bank — Secure Sign-In',
  type: 'LOGIN PAGE', difficulty: 'easy', isPhishing: true,
  url: 'chase-secure-online.com/signin', domain: 'chase-secure-online.com', domainClass: 'suspicious', hasLock: true,
  indicators: [
    'Domain is "chase-secure-online.com" — Chase\'s real domain is chase.com.',
    'Login form requests full 16-digit card number — never required to sign in.',
    'Form requests 4-digit card PIN during login — banks never ask for this here.',
  ],
  explanation: 'Correct. Chase only requires username and password at chase.com. Any page requesting full card number and PIN during login is a credential-harvesting site.',
  hints: [],
  html: `<div class="sim-page">
  <div class="sim-login-box">
    <div class="sim-login-logo" style="color:#117ACA">Chase&#174;</div>
    <div class="sim-login-title">Sign in to your account</div>
    <div class="sim-field"><label>Username</label><input placeholder="Username"></div>
    <div class="sim-field"><label>Password</label><input type="password" placeholder="Password"></div>
    <div class="sim-field"><label>Card Number (for identity verification)</label><input placeholder="#### #### #### ####"></div>
    <div class="sim-field"><label>4-Digit Card PIN</label><input type="password" placeholder="PIN"></div>
    <button class="sim-btn blue-btn">Sign In Securely</button>
    <div class="sim-small">Secured by 256-bit SSL encryption</div>
  </div>
</div>`
},

{
  id: 4, title: 'Google — Account Suspended Alert',
  type: 'EMAIL', difficulty: 'hard', isPhishing: true,
  url: 'accounts.google.com.security-alert.co/signin', domain: 'accounts.google.com.security-alert.co', domainClass: 'suspicious', hasLock: true,
  indicators: [
    'Sender is "security@accounts-google.com" — Google uses @google.com or @accounts.google.com.',
    'URL "accounts.google.com.security-alert.co" is controlled by security-alert.co, not Google.',
    'Threatens account deletion within 12 hours to force a panicked click.',
    'Generic "Google User" greeting — Google always personalises security emails.',
  ],
  explanation: 'Correct. The URL looks like it starts with accounts.google.com but the actual domain is security-alert.co. Google security emails come from @google.com and include your name.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Google Security &lt;security@accounts-google.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">user@gmail.com</span></div>
    <div class="sim-email-subject">&#128308; URGENT: Your Google Account has been suspended</div>
  </div>
  <div class="sim-email-body">
    <p>Dear Google User,</p>
    <p>Your Google Account has been <strong>temporarily suspended</strong> due to a Terms of Service violation. If you do not verify your identity within <strong>12 hours</strong>, your account and all data will be permanently deleted.</p>
    <a class="sim-email-cta red-btn" href="#">Verify Identity Now</a>
    <p style="margin-top:12px;font-size:0.78rem">Link: http://accounts.google.com.security-alert.co/signin</p>
  </div>
  <div class="sim-email-footer">Google LLC | security@accounts-google.com</div>
</div>`
},

{
  id: 5, title: 'Apple ID — Sign-In Request',
  type: 'LOGIN PAGE', difficulty: 'hard', isPhishing: true,
  url: 'appleid.icloud.com.signin-verify.net', domain: 'appleid.icloud.com.signin-verify.net', domainClass: 'suspicious', hasLock: true,
  indicators: [
    'Domain contains "appleid.icloud.com" but the actual domain is "signin-verify.net" — classic subdomain trick.',
    'The real Apple ID login is at appleid.apple.com — not .net or .verify domains.',
    'Requests full credit card details during login — Apple never asks for this.',
  ],
  explanation: 'Correct. The domain uses "appleid.icloud.com" as a subdomain of signin-verify.net. Always check what comes immediately before .com',
  hints: [],
  html: `<div class="sim-page">
  <div class="sim-login-box">
    <div class="sim-login-logo" style="font-size:2rem">&#63743;</div>
    <div class="sim-login-title">Apple ID — Sign in to verify your account</div>
    <div class="sim-warning-banner">We've detected unusual activity. Please verify your identity.</div>
    <div class="sim-field"><label>Apple ID</label><input placeholder="name@icloud.com"></div>
    <div class="sim-field"><label>Password</label><input type="password" placeholder="Password"></div>
    <div class="sim-field"><label>Full Name (as on card)</label><input placeholder="First and last name"></div>
    <div class="sim-field"><label>Card Number</label><input placeholder="#### #### #### ####"></div>
    <button class="sim-btn">Verify Identity</button>
    <div class="sim-small">Apple will never ask for your full card number during login</div>
  </div>
</div>`
},

{
  id: 6, title: 'IRS — Tax Refund Notification',
  type: 'EMAIL', difficulty: 'easy', isPhishing: true,
  url: 'irs-refund-services.gov.co/claim', domain: 'irs-refund-services.gov.co', domainClass: 'suspicious', hasLock: false,
  indicators: [
    'Domain is "irs-gov-services.com" — US government agencies only use .gov domains.',
    'The IRS contacts taxpayers by postal mail only, never by unsolicited email.',
    'Promises a specific refund amount with no prior correspondence.',
    'Requests bank account and routing number to "process the deposit".',
  ],
  explanation: 'Correct. The IRS never initiates contact via email. All official IRS communication is by postal mail from irs.gov — never from .com or .gov.co domains.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">IRS Refund Dept &lt;refunds@irs-gov-services.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">taxpayer@email.com</span></div>
    <div class="sim-email-subject">You have a pending tax refund of $1,247.00 — Claim before deadline</div>
  </div>
  <div class="sim-email-body">
    <p>Dear Taxpayer,</p>
    <p>After reviewing your tax records, the IRS has determined you are owed a refund of <strong>$1,247.00</strong> for the previous fiscal year.</p>
    <p>To process your direct deposit, provide your bank account and routing number. This offer expires in <strong>72 hours</strong>.</p>
    <a class="sim-email-cta" href="#">Claim Your Refund &#8594;</a>
  </div>
  <div class="sim-email-footer">Internal Revenue Service | refunds@irs-gov-services.com</div>
</div>`
},

{
  id: 7, title: 'Microsoft — Security Alert Popup',
  type: 'ALERT', difficulty: 'medium', isPhishing: true,
  url: 'microsoft-security-scan.com/alert', domain: 'microsoft-security-scan.com', domainClass: 'suspicious', hasLock: false,
  indicators: [
    'Microsoft never displays phone numbers inside browser security alerts.',
    'Fake virus count ("14 threats") is fabricated to create fear.',
    'Countdown timer is a pressure tactic — legitimate alerts do not expire.',
    'Domain "microsoft-security-scan.com" is not owned by Microsoft.',
  ],
  explanation: 'Correct. This is a fake tech-support scare page. Windows Defender runs silently in the background and never instructs you to call a phone number through a browser popup.',
  hints: [],
  html: `<div class="sim-page">
  <div class="sim-alert-overlay">
    <div class="sim-alert-icon">&#9940;</div>
    <div class="sim-alert-title">WINDOWS DEFENDER — CRITICAL ALERT</div>
    <div class="sim-alert-body"><strong>14 threats detected</strong> on your computer.<br>Your system has been locked to prevent data theft.<br>Do NOT restart your PC — you may lose all files.<br><br>Call Microsoft Support immediately:</div>
    <div class="sim-alert-phone">1-800-642-7676</div>
    <div class="sim-alert-countdown">04:47</div>
    <button class="sim-btn red-btn">Call Now — Do Not Close This Window</button>
  </div>
</div>`
},

{
  id: 8, title: 'Facebook — Login Alert',
  type: 'EMAIL', difficulty: 'hard', isPhishing: true,
  url: 'facebook-security.verify-account.net/alert', domain: 'facebook-security.verify-account.net', domainClass: 'suspicious', hasLock: false,
  indicators: [
    'Sender domain is "security@facebook-security.verify-account.net" — not facebook.com.',
    'The link goes to a lookalike domain with "facebook-security" as a subdomain.',
    'Threatens account lock within 12 hours to create urgency.',
    'Generic greeting — Facebook knows your name.',
  ],
  explanation: 'Correct. Facebook security emails come from @facebookmail.com or @facebook.com. This domain is a lookalike.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Facebook Security &lt;security@facebook-security.verify-account.net&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">user@email.com</span></div>
    <div class="sim-email-subject">⚠️ Someone tried to log into your account</div>
  </div>
  <div class="sim-email-body">
    <p>Hi there,</p>
    <p>We noticed a login attempt to your Facebook account from a device we don't recognize.</p>
    <p><strong>Location:</strong> Ho Chi Minh City, Vietnam<br><strong>Device:</strong> Samsung Galaxy S22</p>
    <p>If this wasn't you, please secure your account immediately. Your account will be locked in <strong>12 hours</strong> if you don't act.</p>
    <a class="sim-email-cta red-btn" href="#">Secure Your Account</a>
  </div>
  <div class="sim-email-footer">Facebook | security@facebook-security.verify-account.net</div>
</div>`
},

{
  id: 9, title: 'Elon Musk — Bitcoin Giveaway',
  type: 'WEBSITE', difficulty: 'easy', isPhishing: true,
  url: 'elon-bitcoin-giveaway.com/claim', domain: 'elon-bitcoin-giveaway.com', domainClass: 'suspicious', hasLock: false,
  indicators: [
    'No legitimate giveaway requires you to send cryptocurrency first.',
    '"Send BTC and receive double back" is a classic advance-fee fraud.',
    'Celebrity name used without verification — fabricated association.',
    'Countdown timer and "limited slots" are manufactured scarcity tactics.',
  ],
  explanation: 'Correct. No real giveaway requires you to send money first to receive more back. The celebrity name is fabricated. Cryptocurrency sent to these addresses is unrecoverable.',
  hints: [],
  html: `<div class="sim-page">
  <div class="sim-login-box" style="max-width:460px;text-align:center">
    <div style="font-size:2.5rem">&#8383;</div>
    <div class="sim-login-logo">ELON MUSK &#8212; BITCOIN GIVEAWAY 2026</div>
    <div class="sim-success-banner">&#127881; 5,000 BTC remaining &#8212; Limited time only!</div>
    <p style="font-size:0.88rem;color:var(--text-secondary);margin:8px 0">Send 0.1&#8211;5 BTC and receive <strong>2x back within 30 minutes</strong>. Celebrating X Payments launch.</p>
    <div class="sim-warning-banner" style="font-family:var(--font-mono);letter-spacing:0.04em">bc1qxy2kgdygjrsqtzq2n0yrf249</div>
    <div class="sim-alert-countdown" style="margin-top:8px">02:34</div>
    <button class="sim-btn green-btn">Participate Now &#8594;</button>
  </div>
</div>`
},

{
  id: 10, title: 'Amazon — Payment Method Expired',
  type: 'EMAIL', difficulty: 'hard', isPhishing: true,
  url: 'amazon.com.payment-update.net/verify', domain: 'amazon.com.payment-update.net', domainClass: 'suspicious', hasLock: true,
  indicators: [
    'Domain contains "amazon.com" but the actual domain is "payment-update.net".',
    'Real Amazon payment emails come from @amazon.com — not subdomains of random .net domains.',
    'Requests full card number and CVV to "update payment" — Amazon never asks for CVV via email.',
  ],
  explanation: 'Correct. "amazon.com.payment-update.net" uses amazon.com as a subdomain of payment-update.net. The real domain is payment-update.net, not amazon.com.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Amazon Payments &lt;payments@amazon.com.payment-update.net&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">user@email.com</span></div>
    <div class="sim-email-subject">Your payment method has expired — Update now</div>
  </div>
  <div class="sim-email-body">
    <p>Hello,</p>
    <p>The credit card associated with your Amazon account has expired. To avoid interruption of your Prime membership and subscriptions, please update your payment information within <strong>48 hours</strong>.</p>
    <p><strong>Card on file:</strong> Visa ending in 4821 (Expired 05/26)</p>
    <a class="sim-email-cta" href="#">Update Payment Method</a>
  </div>
  <div class="sim-email-footer">Amazon.com | payments@amazon.com.payment-update.net</div>
</div>`
},

{
  id: 11, title: 'FedEx — Delivery Attempt Failed',
  type: 'EMAIL', difficulty: 'easy', isPhishing: true,
  url: 'fedex-delivery-alert.com/track', domain: 'fedex-delivery-alert.com', domainClass: 'suspicious', hasLock: false,
  indicators: [
    'Sender domain is "fedex-delivery-alert.com" — FedEx uses @fedex.com.',
    'No real tracking number is included in the email.',
    'Claims a $1.99 redelivery fee is required — FedEx does not charge for redelivery this way.',
    'Urgency: package will be returned in 24 hours.',
  ],
  explanation: 'Correct. FedEx delivery notifications always include a real tracking number and come from @fedex.com. A delivery email with no tracking number and a lookalike domain is phishing.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">FedEx Delivery &lt;noreply@fedex-delivery-alert.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">recipient@email.com</span></div>
    <div class="sim-email-subject">&#9888; DELIVERY FAILED &#8212; Reschedule Required Within 24 Hours</div>
  </div>
  <div class="sim-email-body">
    <p>Dear Customer,</p>
    <p>A delivery attempt was made to your address today but was unsuccessful. Your package will be returned to the sender unless you reschedule within <strong>24 hours</strong>.</p>
    <p>A redelivery fee of <strong>$1.99</strong> is required to confirm your new slot. Please have your card ready.</p>
    <a class="sim-email-cta red-btn" href="#">Reschedule Delivery &#8594;</a>
  </div>
  <div class="sim-email-footer">FedEx Corporation | noreply@fedex-delivery-alert.com</div>
</div>`
},

{
  id: 12, title: 'LinkedIn — Exclusive Job Opportunity',
  type: 'EMAIL', difficulty: 'hard', isPhishing: true,
  url: 'linkedin-careers.com/apply', domain: 'linkedin-careers.com', domainClass: 'suspicious', hasLock: false,
  indicators: [
    'Sender domain is "recruiter@linkedin-careers.com" — LinkedIn emails come from @linkedin.com.',
    'Requests Social Security Number in the first outreach email — no legitimate recruiter does this.',
    'Unrealistically high salary with no job description or company name.',
    'Grammar errors: "good candidate", "following informations".',
  ],
  explanation: 'Correct. LinkedIn communications come from @linkedin.com. No legitimate recruiter asks for SSN in an initial email — this is identity theft.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">LinkedIn Recruiter &lt;recruiter@linkedin-careers.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">candidate@email.com</span></div>
    <div class="sim-email-subject">Exclusive Opportunity &#8212; $145,000/year &#8212; Apply Immediately</div>
  </div>
  <div class="sim-email-body">
    <p>Hello,</p>
    <p>We have reviewed your profile and believe you are good candidate for senior position. Salary being offered is <strong>$145,000 per year</strong> with full benefits.</p>
    <p>To fast-track your application please reply with the following informations:<br>&#8226; Full Legal Name&#160;&#160;&#8226; Date of Birth&#160;&#160;&#8226; Social Security Number&#160;&#160;&#8226; Current Address</p>
    <a class="sim-email-cta" href="#">Submit Application &#8594;</a>
  </div>
  <div class="sim-email-footer">LinkedIn Recruiting | recruiter@linkedin-careers.com</div>
</div>`
},

{
  id: 13, title: 'Steam — Trade Offer Login',
  type: 'LOGIN PAGE', difficulty: 'hard', isPhishing: true,
  url: 'steamcommurnity.com/tradeoffer/new', domain: 'steamcommurnity.com', domainClass: 'suspicious', hasLock: true,
  indicators: [
    'Domain is "steamcommurnity.com" — uses "rn" to mimic "m" in "community" (homoglyph attack).',
    'Steam\'s real domains are steampowered.com and steamcommunity.com.',
    'Design is nearly identical to real Steam — domain check is the only tell.',
  ],
  explanation: 'Correct. "steamcommurnity.com" visually resembles "steamcommunity.com" in many fonts. Always read domains letter by letter.',
  hints: [],
  html: `<div class="sim-page">
  <div class="sim-login-box" style="max-width:340px">
    <div class="sim-login-logo" style="color:#1b2838;background:#c7d5e0;border-radius:4px;padding:4px 10px;font-size:1.1rem">&#9679; STEAM</div>
    <div class="sim-login-title">Sign in to accept trade offer</div>
    <div class="sim-success-banner">You have a new trade offer from: xX_SniperKing_Xx</div>
    <div class="sim-field"><label>Steam Account Name</label><input placeholder="Account name"></div>
    <div class="sim-field"><label>Password</label><input type="password" placeholder="Password"></div>
    <button class="sim-btn" style="background:#4c6b22;color:#d2e885">Sign In &#8594;</button>
    <div class="sim-small">I agree to the Steam Subscriber Agreement</div>
  </div>
</div>`
},


/* phishing 14-25 */

{
  id: 14, title: 'Zoom — Missed Meeting Alert',
  type: 'EMAIL', difficulty: 'medium', isPhishing: true,
  url: 'zoom-meeting.net/j/89123456', domain: 'zoom-meeting.net', domainClass: 'suspicious', hasLock: false,
  indicators: [
    'Sender domain is "zoom-meeting.net" — Zoom\'s real domain is zoom.us.',
    'Claims you missed a meeting you never scheduled.',
    'Urgency: "join immediately" to create pressure without reflection.',
    'Link destination is a non-Zoom domain.',
  ],
  explanation: 'Correct. Zoom sends all notifications from @zoom.us. The domain zoom-meeting.net is a lookalike designed to harvest credentials when you try to "join" the fake meeting.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Zoom Meetings &lt;no-reply@zoom-meeting.net&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">user@email.com</span></div>
    <div class="sim-email-subject">[MISSED] Zoom Meeting — Join Immediately to Catch Up</div>
  </div>
  <div class="sim-email-body">
    <p>Dear User,</p>
    <p>You missed an important Zoom meeting. The host has extended the session and you can still join <strong>now</strong>.</p>
    <p>Meeting ID: <strong>891 2345 6789</strong><br>Passcode: <strong>secure</strong></p>
    <a class="sim-email-cta red-btn" href="#">Join Meeting Now &#8594;</a>
  </div>
  <div class="sim-email-footer">Zoom Video Communications | no-reply@zoom-meeting.net</div>
</div>`
},

{
  id: 15, title: 'DocuSign — Signature Required',
  type: 'EMAIL', difficulty: 'hard', isPhishing: true,
  url: 'docusign.secure.com/sign', domain: 'docusign.secure.com', domainClass: 'suspicious', hasLock: true,
  indicators: [
    'Sender domain is "dse@docusign.secure.com" — legitimate DocuSign uses docusign.com or docusign.net.',
    '"secure.com" is a domain anyone can register — not affiliated with DocuSign.',
    'User did not initiate or expect this signing request.',
  ],
  explanation: 'Correct. DocuSign sends documents from @docusign.com or @docusign.net. "docusign.secure.com" is a lookalike. Unexpected document requests should always be verified directly.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">DocuSign eSignature &lt;dse@docusign.secure.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">user@email.com</span></div>
    <div class="sim-email-subject">SIGNATURE REQUIRED — Please review and sign your document</div>
  </div>
  <div class="sim-email-body">
    <p>DocuSign eSignature</p>
    <p><strong>John Smith</strong> has sent you a document to review and sign.</p>
    <p>Document: <strong>NDA_Agreement_Final_2026.pdf</strong><br>Sent: Today at 9:14 AM</p>
    <a class="sim-email-cta" href="#">Review &amp; Sign Document &#8594;</a>
  </div>
  <div class="sim-email-footer">DocuSign Inc. | dse@docusign.secure.com | docusign.secure.com</div>
</div>`
},

{
  id: 16, title: 'Instagram — Prize Winner Notification',
  type: 'EMAIL', difficulty: 'easy', isPhishing: true,
  url: 'instagram-rewards.com/prize', domain: 'instagram-rewards.com', domainClass: 'suspicious', hasLock: false,
  indicators: [
    'Sender domain is "instagram-rewards.com" — not instagram.com.',
    'Instagram does not run unsolicited random prize draws.',
    'Requires a "shipping fee" to claim prize — classic advance-fee fraud.',
    'Emotional manipulation: excitement and urgency combined.',
  ],
  explanation: 'Correct. Instagram does not send prize winner emails from external domains. The "shipping fee" request is an advance-fee scam — you pay, receive nothing, and your card details are stolen.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Instagram Rewards &lt;winners@instagram-rewards.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">user@email.com</span></div>
    <div class="sim-email-subject">&#127881; Congratulations! You have been selected as an Instagram Winner!</div>
  </div>
  <div class="sim-email-body">
    <p>Dear Instagram User,</p>
    <p>You have been <strong>randomly selected</strong> from millions of users to receive an <strong>Apple iPhone 16 Pro Max</strong> as part of Instagram's 15th Anniversary Giveaway!</p>
    <p>To claim your prize, a small shipping and handling fee of <strong>$3.99</strong> is required. This offer expires in <strong>24 hours</strong>.</p>
    <a class="sim-email-cta" href="#">Claim Your Prize &#8594;</a>
  </div>
  <div class="sim-email-footer">Instagram Inc. | winners@instagram-rewards.com</div>
</div>`
},

{
  id: 17, title: 'IT Help Desk — Password Reset Required',
  type: 'LOGIN PAGE', difficulty: 'medium', isPhishing: true,
  url: 'company-helpdesk-support.net/reset', domain: 'company-helpdesk-support.net', domainClass: 'suspicious', hasLock: true,
  indicators: [
    'Page is hosted on an external domain — real IT portals use internal company domains.',
    'No company name, logo, or branding on the page.',
    'Claims password has expired and must be changed immediately.',
    'Requests current password to "verify identity" — IT never needs your current password to reset it.',
  ],
  explanation: 'Correct. Your company IT department would use an internal domain. Any IT page hosted externally asking for your current password is harvesting credentials — IT resets never require your old password.',
  hints: [],
  html: `<div class="sim-page">
  <div class="sim-login-box">
    <div class="sim-login-logo" style="font-size:1.1rem;letter-spacing:0.1em">IT HELP DESK PORTAL</div>
    <div class="sim-warning-banner">&#9888; Your password has expired. Reset required before you can continue working.</div>
    <div class="sim-field"><label>Corporate Email</label><input placeholder="yourname@company.com"></div>
    <div class="sim-field"><label>Current Password (to verify identity)</label><input type="password" placeholder="Current password"></div>
    <div class="sim-field"><label>New Password</label><input type="password" placeholder="New password"></div>
    <div class="sim-field"><label>Confirm New Password</label><input type="password" placeholder="Confirm password"></div>
    <button class="sim-btn">Reset Password</button>
  </div>
</div>`
},

{
  id: 18, title: 'Government — COVID Relief Fund',
  type: 'EMAIL', difficulty: 'easy', isPhishing: true,
  url: 'covid-relief-government.com/apply', domain: 'covid-relief-government.com', domainClass: 'suspicious', hasLock: false,
  indicators: [
    'Domain is "covid-relief-government.com" — government sites use .gov, not .com.',
    'Unsolicited email promising unclaimed relief funds.',
    'Requests bank account and routing number for "direct deposit".',
    'Deadline pressure to act within 48 hours.',
  ],
  explanation: 'Correct. Real government relief programs are administered through .gov websites like irs.gov or benefits.gov. Any .com site requesting bank details for government payments is a scam.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Federal Relief Office &lt;relief@covid-relief-government.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">citizen@email.com</span></div>
    <div class="sim-email-subject">You qualify for unclaimed COVID relief funds — $1,400 available</div>
  </div>
  <div class="sim-email-body">
    <p>Dear Citizen,</p>
    <p>Our records indicate you have <strong>$1,400 in unclaimed COVID-19 relief funds</strong>. To receive your payment by direct deposit, provide your bank account and routing number within <strong>48 hours</strong>.</p>
    <a class="sim-email-cta" href="#">Claim Relief Payment &#8594;</a>
  </div>
  <div class="sim-email-footer">Federal Relief Administration | relief@covid-relief-government.com</div>
</div>`
},

{
  id: 19, title: 'Venmo — Unclaimed Payment',
  type: 'EMAIL', difficulty: 'medium', isPhishing: true,
  url: 'venmo-payments.co/claim', domain: 'venmo-payments.co', domainClass: 'suspicious', hasLock: false,
  indicators: [
    'Sender domain is "venmo-payments.co" — Venmo\'s real domain is venmo.com.',
    'You did not initiate a Venmo transaction.',
    'Requests full card number and CVV to "receive" money — Venmo recipients never provide card details.',
  ],
  explanation: 'Correct. Venmo emails come from @venmo.com. Receiving money on Venmo never requires entering card details — that is a data theft tactic.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Venmo &lt;payment@venmo-payments.co&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">user@email.com</span></div>
    <div class="sim-email-subject">Someone sent you $200.00 — Claim your Venmo payment</div>
  </div>
  <div class="sim-email-body">
    <p>Hi there,</p>
    <p><strong>Alex M.</strong> has sent you <strong>$200.00</strong> via Venmo. To receive your funds, verify your payment method.</p>
    <div class="sim-field" style="margin:12px 0"><label style="font-size:0.8rem;color:var(--text-muted)">Card Number</label><input placeholder="#### #### #### ####"></div>
    <div class="sim-field" style="margin:12px 0"><label style="font-size:0.8rem;color:var(--text-muted)">CVV</label><input placeholder="CVV"></div>
    <button class="sim-btn" style="background:#3d95ce;color:#fff">Claim $200.00 &#8594;</button>
  </div>
  <div class="sim-email-footer">Venmo | payment@venmo-payments.co</div>
</div>`
},

{
  id: 20, title: 'Windows Defender — Browser Alert',
  type: 'ALERT', difficulty: 'medium', isPhishing: true,
  url: 'windows-defender-alert.com/scan', domain: 'windows-defender-alert.com', domainClass: 'suspicious', hasLock: false,
  indicators: [
    'Windows Defender never displays alerts inside a web browser — it runs on the OS level.',
    'Fake threat list is fabricated to manufacture fear.',
    'Phone number in a browser alert is the hallmark of tech-support fraud.',
    'Domain has no affiliation with Microsoft.',
  ],
  explanation: 'Correct. Windows Defender is an OS-level application — it never shows infection alerts in a browser window. Browser-based security alerts with phone numbers are always fake.',
  hints: [],
  html: `<div class="sim-page">
  <div class="sim-alert-overlay">
    <div class="sim-alert-icon">&#128680;</div>
    <div class="sim-alert-title">WINDOWS DEFENDER ALERT: ACTION REQUIRED</div>
    <div class="sim-alert-body">Suspicious activity detected on this computer.<br><br><strong>Threats found:</strong> Trojan.GenericKD, Spyware.AgentTesla, Ransomware.WannaCry<br><br>Your personal files, passwords, and banking information are at risk. Contact Windows Support immediately:</div>
    <div class="sim-alert-phone">+1 (877) 245-3140</div>
    <div class="sim-alert-countdown">03:22</div>
    <button class="sim-btn red-btn">&#128222; Call Windows Support Now</button>
  </div>
</div>`
},

{
  id: 21, title: 'Your Bank — OTP Verification Required',
  type: 'EMAIL', difficulty: 'medium', isPhishing: true,
  url: 'secure-bank-verification.com/otp', domain: 'secure-bank-verification.com', domainClass: 'suspicious', hasLock: true,
  indicators: [
    'Banks send OTPs to your registered phone — they never ask you to enter an OTP via email.',
    'Sender domain is not a real bank domain.',
    'Generic "Dear Valued Customer" greeting with no account details.',
    'Urgency: account will be locked unless OTP is entered immediately.',
  ],
  explanation: 'Correct. OTPs (One-Time Passwords) are sent to your phone for use on the bank\'s official website. Any email asking you to enter an OTP is attempting to intercept your authentication code.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Secure Banking &lt;verify@secure-bank-verification.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">customer@email.com</span></div>
    <div class="sim-email-subject">Action Required: Enter OTP to Prevent Account Lock</div>
  </div>
  <div class="sim-email-body">
    <p>Dear Valued Customer,</p>
    <p>We have detected unusual activity on your account. To prevent your account from being locked, please enter the One-Time Password (OTP) that was sent to your registered mobile number.</p>
    <div class="sim-field" style="margin:12px 0;max-width:200px"><label style="font-size:0.8rem;color:var(--text-muted)">Enter 6-Digit OTP</label><input placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;" style="letter-spacing:0.3em;text-align:center"></div>
    <button class="sim-btn blue-btn" style="max-width:200px">Submit OTP</button>
  </div>
  <div class="sim-email-footer">Secure Banking Services | verify@secure-bank-verification.com</div>
</div>`
},

{
  id: 22, title: 'Global Lottery — Winner Notification',
  type: 'EMAIL', difficulty: 'easy', isPhishing: true,
  url: 'global-lottery-winner.com/claim', domain: 'global-lottery-winner.com', domainClass: 'suspicious', hasLock: false,
  indicators: [
    'You cannot win a lottery you never entered.',
    'Requests bank account details and a processing fee — advance-fee fraud.',
    'Grammar errors and awkward phrasing throughout.',
    'Exaggerated prize amount ($2,000,000) used for emotional manipulation.',
  ],
  explanation: 'Correct. You cannot win a lottery you never entered. The processing fee request is an advance-fee scam — money sent is unrecoverable and the prize does not exist.',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Global Lottery Board &lt;winners@global-lottery-winner.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">winner@email.com</span></div>
    <div class="sim-email-subject">CONGRATULATIONS!!! You Have WON $2,000,000.00!!!</div>
  </div>
  <div class="sim-email-body">
    <p>DEAR WINNER,</p>
    <p>WE ARE PLEASED TO INFORM YOU THAT YOUR EMAIL ADDRESS HAS WIN THE SUM OF <strong>TWO MILLION UNITED STATES DOLLARS ($2,000,000.00 USD)</strong> IN OUR GLOBAL LOTTERY PROMOTION.</p>
    <p>To claims your prize, you must pays a small processing fee of $250 and provides your bank informations for wire transfer. Contact our agent immediately.</p>
    <a class="sim-email-cta" href="#">Claim Prize &#8594;</a>
  </div>
  <div class="sim-email-footer">Global Lottery Board | winners@global-lottery-winner.com</div>
</div>`
},

{
  id: 23, title: 'Adobe Sign — Document for Review',
  type: 'EMAIL', difficulty: 'hard', isPhishing: true,
  url: 'adobe-esign.com/sign', domain: 'adobe-esign.com', domainClass: 'suspicious', hasLock: true,
  indicators: [
    'Sender domain is "dse@adobe-esign.com" — legitimate Adobe Sign uses adobesign.com.',
    'Missing the letter "b" (adobesign vs adobe-sign) is subtle.',
    'User did not request or expect this document.',
  ],
  explanation: 'Correct. Legitimate Adobe Sign emails come from @adobesign.com. "adobe-esign.com" is a lookalike that adds a hyphen and drops the "b".',
  hints: [],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Adobe Sign &lt;dse@adobe-esign.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">user@email.com</span></div>
    <div class="sim-email-subject">Please review and sign: Employment Contract 2026.pdf</div>
  </div>
  <div class="sim-email-body">
    <p style="color:var(--text-muted);font-size:0.8rem">ADOBE SIGN</p>
    <p><strong>HR Department</strong> has sent you a document to sign.</p>
    <p>Document: <strong>Employment Contract 2026.pdf</strong><br>Expires: 3 days from now</p>
    <a class="sim-email-cta" href="#">Review &amp; Sign &#8594;</a>
  </div>
  <div class="sim-email-footer">Adobe Systems Inc. | dse@adobe-esign.com | Powered by Adobe Sign</div>
</div>`
},

{
  id: 24, title: 'University — Student Portal Login',
  type: 'LOGIN PAGE', difficulty: 'hard', isPhishing: true,
  url: 'universitv-portal.edu/login', domain: 'universitv-portal.edu', domainClass: 'suspicious', hasLock: true,
  indicators: [
    'Domain is "universitv-portal.edu" — uses the letter "v" instead of "y" in "university".',
    'No specific university name or branding — generic "Student Portal".',
    'Requests Social Security Number at login — universities never require SSN to sign in.',
  ],
  explanation: 'Correct. The domain uses a homoglyph ("v" for "y") to mimic "university-portal.edu". Always verify exact spelling.',
  hints: [],
  html: `<div class="sim-page">
  <div class="sim-login-box">
    <div class="sim-login-logo" style="font-size:1rem;letter-spacing:0.08em">UNIVERSITY STUDENT PORTAL</div>
    <div class="sim-login-title">Student Sign-In</div>
    <div class="sim-field"><label>Student Email</label><input placeholder="student@university.edu"></div>
    <div class="sim-field"><label>Password</label><input type="password" placeholder="Password"></div>
    <div class="sim-field"><label>Student ID Number</label><input placeholder="e.g. S-20241234"></div>
    <div class="sim-field"><label>Social Security Number (for identity verification)</label><input placeholder="###-##-####"></div>
    <button class="sim-btn blue-btn">Sign In to Portal</button>
  </div>
</div>`
},

{
  id: 25, title: 'CAPTCHA Verification Required',
  type: 'LOGIN PAGE', difficulty: 'hard', isPhishing: true,
  url: 'cloudflare-verify.com/captcha', domain: 'cloudflare-verify.com', domainClass: 'suspicious', hasLock: true,
  indicators: [
    'Domain is "cloudflare-verify.com" — real Cloudflare uses cloudflare.com.',
    'The CAPTCHA is fake — real CAPTCHAs never ask you to "press Windows + R".',
    'The instructions are designed to make you run malicious code.',
  ],
  explanation: 'Correct. This is a fake CAPTCHA phishing page. Real CAPTCHAs never instruct you to open Run dialog boxes or press keyboard shortcuts.',
  hints: [],
  html: `<div class="sim-page">
    <div class="sim-login-box" style="max-width:420px">
      <div class="sim-login-logo" style="font-size:1.2rem">✓ Verify you are human</div>
      <div class="sim-warning-banner" style="background:#e8f0fe;color:#1a73e8;border-color:#1a73e8">Complete the verification to continue</div>
      <div style="background:#f8f9fa;padding:20px;text-align:center;border-radius:8px">
        <div style="font-size:2rem">☑️</div>
        <p style="font-size:0.85rem;margin:8px 0">Press <strong>Windows + R</strong>, type <strong>certmgr.msc</strong>, and click OK to verify your identity.</p>
        <p style="font-size:0.7rem;color:#80868b">This is a security check to prove you are not a robot.</p>
      </div>
      <button class="sim-btn blue-btn">I have completed verification</button>
      <div class="sim-small">Protected by reCAPTCHA</div>
    </div>
  </div>`
},

/* ================================================================
   LEGITIMATE SCENARIOS 26-50
   ================================================================ */

{
  id: 26, title: 'Google — New Sign-In Alert',
  type: 'EMAIL', difficulty: 'medium', isPhishing: false,
  url: 'myaccount.google.com', domain: 'myaccount.google.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @accounts.google.com — an official Google domain. The email is personalised with your name and account, shows the specific device and location, and requests no credentials.',
  hints: [
    'Check the sender: no-reply@accounts.google.com is an official Google address.',
    'The email shows your specific name and Gmail address — phishing emails use generic greetings.',
    'No link asks you to enter your password — it only offers to review activity.',
    'Google security alerts include the exact device, browser, location, and time.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Google &lt;no-reply@accounts.google.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">New sign-in to your Google Account</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p>A new sign-in to your Google Account <strong>john.doe@gmail.com</strong> was just detected.</p>
    <p><strong>Device:</strong> Windows PC &#8212; Chrome<br><strong>Location:</strong> New York, NY, USA<br><strong>Time:</strong> May 19, 2026, 3:24 PM EDT</p>
    <p>If this was you, no action is needed. If you don&#8217;t recognize this sign-in:</p>
    <a class="sim-email-cta" href="#">Review your account activity</a>
  </div>
  <div class="sim-email-footer">Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043</div>
</div>`
},

{
  id: 27, title: 'Amazon — Order Confirmation',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'amazon.com', domain: 'amazon.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @amazon.com — the official domain. The email includes a specific 17-digit order number, exact product name, price, and delivery estimate. No login or payment action is required.',
  hints: [
    'Sender is auto-confirm@amazon.com — a verified Amazon address.',
    'A specific order number is included — phishing emails use generic messages.',
    'No link asks you to re-enter payment or login credentials.',
    'Product name, price, and delivery window are all precisely listed.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Amazon.com &lt;auto-confirm@amazon.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Your Amazon order #112-4839471-2938451 has been placed</div>
  </div>
  <div class="sim-email-body">
    <p>Hello John,</p>
    <p>Thank you for your order. We&#8217;ll send a confirmation when your item ships.</p>
    <p><strong>Order #112-4839471-2938451</strong><br>Logitech MX Master 3S Wireless Mouse &#8212; <strong>$99.99</strong><br>Estimated delivery: <strong>May 21&#8211;23, 2026</strong></p>
    <a class="sim-email-cta" href="#">View Order Details</a>
  </div>
  <div class="sim-email-footer">Amazon.com, Inc. | 410 Terry Ave N, Seattle, WA 98109 | auto-confirm@amazon.com</div>
</div>`
},

{
  id: 28, title: 'GitHub — New SSH Key Added',
  type: 'EMAIL', difficulty: 'medium', isPhishing: false,
  url: 'github.com', domain: 'github.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @github.com. The email is informational only — it notifies you that a new SSH key was added and provides a link to review if you didn\'t do it. No credentials are requested.',
  hints: [
    'Sender is noreply@github.com — the official GitHub notifications address.',
    'Email is informational — it does not ask you to click a login link.',
    'If you added the key yourself, simply ignore it.',
    'GitHub security notifications always link back to github.com for review.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">GitHub &lt;noreply@github.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">[GitHub] A new public key was added to your account</div>
  </div>
  <div class="sim-email-body">
    <p>Hi johndoe,</p>
    <p>A new public SSH key was added to your GitHub account.</p>
    <p><strong>Key title:</strong> Work MacBook Pro<br><strong>Added:</strong> May 19, 2026 at 10:02 AM UTC</p>
    <p>If you added this key, you can safely ignore this email. If you did not add this key, remove it immediately and change your password.</p>
    <a class="sim-email-cta" href="#">Review SSH Keys &#8594;</a>
  </div>
  <div class="sim-email-footer">GitHub, Inc. | noreply@github.com | github.com</div>
</div>`
},

{
  id: 29, title: 'Netflix — Payment Confirmation',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'netflix.com', domain: 'netflix.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. Netflix uses @mailer.netflix.com for transactional emails — a verified subdomain. The email is a receipt with specific plan and amount. No action or credentials are required.',
  hints: [
    'Sender is info@mailer.netflix.com — a legitimate Netflix transactional subdomain.',
    'Shows your specific plan name and billing amount.',
    'Receipt only — no link requires entering payment or login credentials.',
    'Netflix always shows the last 4 digits of your card on file for reference.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Netflix &lt;info@mailer.netflix.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Your Netflix payment was received</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p>Your payment has been processed. Thank you!</p>
    <p><strong>Plan:</strong> Standard with Ads<br><strong>Amount:</strong> $7.99<br><strong>Date:</strong> May 19, 2026<br><strong>Card on file:</strong> &#8226;&#8226;&#8226;&#8226; 4821</p>
    <a class="sim-email-cta" href="#">View Billing Details</a>
  </div>
  <div class="sim-email-footer">Netflix Inc. | 100 Winchester Circle, Los Gatos, CA 95032 | info@mailer.netflix.com</div>
</div>`
},

{
  id: 30, title: 'PayPal — Transaction Receipt',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'paypal.com', domain: 'paypal.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is service@paypal.com — the official domain (not paypa1.com). The email includes a specific transaction ID, amount, and recipient. No credentials or card data are requested.',
  hints: [
    'Sender is service@paypal.com — the real PayPal domain with the letter L, not a 1.',
    'Includes a specific transaction ID and exact dollar amount.',
    'Receipt only — no request to re-enter password or card number.',
    'PayPal receipts always show the recipient name and transaction reference.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">PayPal &lt;service@paypal.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">You sent a payment of $45.00 to John&#8217;s Coffee Shop</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p>You sent a payment.</p>
    <p><strong>Amount:</strong> $45.00 USD<br><strong>To:</strong> John&#8217;s Coffee Shop<br><strong>Transaction ID:</strong> 7XK29381BMNQ4<br><strong>Date:</strong> May 19, 2026</p>
    <a class="sim-email-cta" href="#">View Transaction Details</a>
  </div>
  <div class="sim-email-footer">PayPal | 2211 North First Street, San Jose, CA 95131 | service@paypal.com</div>
</div>`
},

{
  id: 31, title: 'LinkedIn — Connection Request',
  type: 'EMAIL', difficulty: 'medium', isPhishing: false,
  url: 'linkedin.com', domain: 'linkedin.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @linkedin.com. The email shows the connecting person\'s name and title. No external links, no credential request, and no urgency — standard social network notification.',
  hints: [
    'Sender is messages-noreply@linkedin.com — the official LinkedIn domain.',
    'Shows the specific person\'s name, title, and mutual connections.',
    'No sensitive information or credentials are requested.',
    'You can accept or ignore directly from your LinkedIn account — no external action needed.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">LinkedIn &lt;messages-noreply@linkedin.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Sarah Chen wants to connect on LinkedIn</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p><strong>Sarah Chen</strong>, Senior Product Manager at Acme Corp, wants to connect with you on LinkedIn.</p>
    <p>3 mutual connections &#8212; Emily R., David K., and 1 other</p>
    <a class="sim-email-cta" href="#">Accept Invitation</a>
  </div>
  <div class="sim-email-footer">LinkedIn Corporation | 1000 W Maude Ave, Sunnyvale, CA 94085 | messages-noreply@linkedin.com</div>
</div>`
},

{
  id: 32, title: 'Zoom — Meeting Invitation',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'zoom.us', domain: 'zoom.us', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @zoom.us — Zoom\'s official domain (note: .us, not .net or .com). The email includes a real meeting ID, passcode, and host name. No credentials are requested.',
  hints: [
    'Sender is no-reply@zoom.us — Zoom\'s real TLD is .us, not .net or .com.',
    'Includes a real 11-digit meeting ID and alphanumeric passcode.',
    'Shows the host\'s name and scheduled time.',
    'No link asks for your Zoom password — you join with the meeting ID and passcode.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Zoom &lt;no-reply@zoom.us&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">John Smith is inviting you to a scheduled Zoom meeting</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p><strong>John Smith</strong> is inviting you to a Zoom meeting.</p>
    <p><strong>Topic:</strong> Q2 Strategy Review<br><strong>Time:</strong> May 20, 2026 10:00 AM EDT<br><strong>Meeting ID:</strong> 891 2345 6789<br><strong>Passcode:</strong> mK9xR2</p>
    <a class="sim-email-cta" href="#">Join Zoom Meeting</a>
  </div>
  <div class="sim-email-footer">Zoom Video Communications | 55 Almaden Blvd, San Jose, CA 95113 | no-reply@zoom.us</div>
</div>`
},

{
  id: 33, title: 'Spotify — Subscription Renewed',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'spotify.com', domain: 'spotify.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @spotify.com. The email is a receipt showing specific plan, amount, and renewal date. No action or credentials are required.',
  hints: [
    'Sender is no-reply@spotify.com — the official Spotify domain.',
    'Shows specific plan name, amount, and next billing date.',
    'Receipt only — no link requires re-entering payment details.',
    'Spotify receipts always show the last 4 digits of the card charged.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Spotify &lt;no-reply@spotify.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Your Spotify Premium subscription has been renewed</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p>Your subscription has been renewed. Thanks for being a Premium member!</p>
    <p><strong>Plan:</strong> Individual Premium<br><strong>Amount charged:</strong> $11.99<br><strong>Card:</strong> &#8226;&#8226;&#8226;&#8226; 3847<br><strong>Next renewal:</strong> June 19, 2026</p>
    <a class="sim-email-cta" href="#">View Receipt</a>
  </div>
  <div class="sim-email-footer">Spotify AB | Regeringsgatan 19, Stockholm, Sweden | no-reply@spotify.com</div>
</div>`
},

{
  id: 34, title: 'Apple — App Store Receipt',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'apple.com', domain: 'apple.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. Apple sends receipts from @email.apple.com — a verified transactional subdomain. The email shows a specific app, amount, and purchase date. No credentials or payment action needed.',
  hints: [
    'Sender is no_reply@email.apple.com — Apple\'s legitimate receipt subdomain.',
    'Shows the specific app name, version, and purchase price.',
    'No link requires entering your Apple ID password or payment method.',
    'Apple receipts always include the Apple ID account the purchase was made on.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Apple &lt;no_reply@email.apple.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Your receipt from Apple</div>
  </div>
  <div class="sim-email-body">
    <p>Dear John Doe,</p>
    <p>Thank you for your purchase.</p>
    <p><strong>Billed to:</strong> john.doe@gmail.com<br><strong>App:</strong> Notchmeister &#8212; $2.99<br><strong>Date:</strong> May 19, 2026<br><strong>Order:</strong> MWXK7-8QR39</p>
    <a class="sim-email-cta" href="#">View or Manage Purchases</a>
  </div>
  <div class="sim-email-footer">Apple Inc. | One Apple Park Way, Cupertino, CA 95014 | no_reply@email.apple.com</div>
</div>`
},

{
  id: 35, title: 'Google Drive — File Shared',
  type: 'EMAIL', difficulty: 'medium', isPhishing: false,
  url: 'drive.google.com', domain: 'drive.google.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @google.com — the official domain. The email names the specific person sharing the file and the exact file title. You can verify by navigating directly to drive.google.com.',
  hints: [
    'Sender is drive-shares-noreply@google.com — an official Google domain.',
    'Names the specific person who shared and the exact file title.',
    'No credentials are requested — link goes to drive.google.com.',
    'You can ignore and go to drive.google.com directly to verify the share.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Google Drive &lt;drive-shares-noreply@google.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Sarah Chen shared a file with you</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p><strong>Sarah Chen</strong> (s.chen@acmecorp.com) shared the following file with you in Google Drive:</p>
    <p>&#128196; <strong>Q2 Marketing Strategy 2026.pptx</strong></p>
    <a class="sim-email-cta" href="#">Open in Google Drive</a>
  </div>
  <div class="sim-email-footer">Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043</div>
</div>`
},

{
  id: 36, title: 'Facebook — Suspicious Login Alert',
  type: 'EMAIL', difficulty: 'medium', isPhishing: false,
  url: 'facebook.com', domain: 'facebook.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. Facebook uses @facebookmail.com — a verified domain for security emails. The alert shows specific device, location, and time. No credentials are requested — only notification.',
  hints: [
    'Sender is security@facebookmail.com — Facebook\'s official security email domain.',
    'Shows the specific device, browser, location, and timestamp of the login.',
    'No link asks for your password — it only offers to review or secure your account.',
    'Facebook security emails never embed a password field inside the email itself.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Facebook Security &lt;security@facebookmail.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">We detected a new login to your Facebook account</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p>We detected a login to your Facebook account from a new device.</p>
    <p><strong>Device:</strong> iPhone 15 Pro &#8212; Safari<br><strong>Location:</strong> Chicago, IL, USA<br><strong>Time:</strong> May 19, 2026, 8:41 AM CDT</p>
    <p>If this was you, no action is needed. If you don&#8217;t recognise this login:</p>
    <a class="sim-email-cta" href="#">Secure Your Account</a>
  </div>
  <div class="sim-email-footer">Meta Platforms Inc. | 1 Hacker Way, Menlo Park, CA 94025 | security@facebookmail.com</div>
</div>`
},

{
  id: 37, title: 'Twitter/X — Weekly Activity Digest',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'twitter.com', domain: 'twitter.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @twitter.com. This is a weekly digest of account activity — no links require credential entry and no sensitive information is requested.',
  hints: [
    'Sender is info@twitter.com — the official Twitter/X domain.',
    'Digest format — shows impressions, profile visits, and mentions.',
    'No link requires entering your password.',
    'Twitter activity digests never include urgent warnings or account threats.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">X (Twitter) &lt;info@twitter.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Your weekly X activity &#8212; May 12&#8211;18, 2026</div>
  </div>
  <div class="sim-email-body">
    <p>Hi @johndoe,</p>
    <p>Here&#8217;s your X activity for the past week:</p>
    <p>&#128065; <strong>Impressions:</strong> 1,248<br>&#128100; <strong>Profile visits:</strong> 84<br>&#10024; <strong>Mentions:</strong> 7<br>&#128279; <strong>Link clicks:</strong> 29</p>
    <a class="sim-email-cta" href="#">View Full Analytics</a>
  </div>
  <div class="sim-email-footer">X Corp. | 1355 Market St, Suite 900, San Francisco, CA 94103 | info@twitter.com</div>
</div>`
},

{
  id: 38, title: 'Slack — Workspace Invitation',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'slack.com', domain: 'slack.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @slack.com. The email shows the specific workspace name and the person who sent the invite. No sensitive data is requested beyond creating a Slack account.',
  hints: [
    'Sender is no-reply@slack.com — the official Slack domain.',
    'Shows the specific workspace name and the inviting person\'s email.',
    'No credentials from another service are requested.',
    'Standard workspace invitation format — Slack never sends unsolicited invites without a known sender.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Slack &lt;no-reply@slack.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Sarah Chen has invited you to join Acme Corp on Slack</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p><strong>Sarah Chen</strong> (s.chen@acmecorp.com) has invited you to join the <strong>Acme Corp</strong> workspace on Slack.</p>
    <p>Slack is where Acme Corp&#8217;s team communicates. Join to start collaborating.</p>
    <a class="sim-email-cta" href="#">Join Acme Corp on Slack</a>
  </div>
  <div class="sim-email-footer">Slack Technologies | 415 Mission St, San Francisco, CA 94105 | no-reply@slack.com</div>
</div>`
},

{
  id: 39, title: 'Stripe — Invoice Ready',
  type: 'EMAIL', difficulty: 'medium', isPhishing: false,
  url: 'stripe.com', domain: 'stripe.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. Stripe uses the receipts+acct_XXX@stripe.com format for invoice emails — a verified Stripe address pattern. The email contains a specific invoice number and amount. No credentials needed.',
  hints: [
    'Stripe uses the "receipts+acct_XXXX@stripe.com" format — this is a legitimate Stripe address pattern.',
    'Specific invoice number, amount, and period are included.',
    'No links require re-entering payment credentials.',
    'You can log in directly at stripe.com to verify and pay.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Stripe &lt;receipts+acct_1N9vK2BG29@stripe.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Your invoice from Acme Corp is ready &#8212; $299.00 due</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p>Your invoice from <strong>Acme Corp</strong> is ready.</p>
    <p><strong>Invoice #:</strong> INV-2026-00841<br><strong>Amount due:</strong> $299.00<br><strong>Due date:</strong> June 2, 2026<br><strong>Period:</strong> May 2026</p>
    <a class="sim-email-cta" href="#">View Invoice</a>
  </div>
  <div class="sim-email-footer">Stripe, Inc. | 510 Townsend St, San Francisco, CA 94103 | receipts+acct_1N9vK2BG29@stripe.com</div>
</div>`
},

{
  id: 40, title: 'GitHub — Pull Request Review Request',
  type: 'EMAIL', difficulty: 'medium', isPhishing: false,
  url: 'github.com', domain: 'github.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @github.com. The email references a specific repository, branch, and PR title. No credentials are requested — this is a standard code review workflow notification.',
  hints: [
    'Sender is notifications@github.com — the official GitHub notifications address.',
    'References a specific repo name and pull request title.',
    'No link asks for your GitHub password.',
    'Standard pull request review format — GitHub never asks for credentials in PR notifications.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">GitHub &lt;notifications@github.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">[acmecorp/backend-api] Review requested: feat/add-oauth-login (#284)</div>
  </div>
  <div class="sim-email-body">
    <p>Hi johndoe,</p>
    <p><strong>sarah-chen</strong> requested your review on pull request <strong>#284</strong> in <strong>acmecorp/backend-api</strong>.</p>
    <p><strong>PR:</strong> feat/add-oauth-login<br><strong>Branch:</strong> feature/oauth &#8594; main<br><strong>Files changed:</strong> 14 &#160;&#160; <strong>+312</strong> / <strong>&#8722;48</strong></p>
    <a class="sim-email-cta" href="#">Review Pull Request &#8594;</a>
  </div>
  <div class="sim-email-footer">GitHub, Inc. | notifications@github.com | You are receiving this because a review was requested.</div>
</div>`
},

{
  id: 41, title: 'Airbnb — Booking Confirmation',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'airbnb.com', domain: 'airbnb.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @airbnb.com. The email includes specific property name, host, dates, and total amount paid. No further credentials or payment action is required.',
  hints: [
    'Sender is automated@airbnb.com — the official Airbnb domain.',
    'Includes specific property name, host name, and exact check-in / check-out dates.',
    'Total amount and confirmation code are included.',
    'No link asks you to re-enter payment details or credentials.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Airbnb &lt;automated@airbnb.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Booking confirmed! Ocean View Studio, Miami</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p>Your trip is confirmed. Pack your bags!</p>
    <p><strong>Property:</strong> Ocean View Studio &#8212; Miami Beach<br><strong>Host:</strong> Maria G.<br><strong>Check-in:</strong> June 14, 2026<br><strong>Check-out:</strong> June 18, 2026<br><strong>Total:</strong> $487.00<br><strong>Confirmation:</strong> HMXQ29</p>
    <a class="sim-email-cta" href="#">View Booking Details</a>
  </div>
  <div class="sim-email-footer">Airbnb, Inc. | 888 Brannan St, San Francisco, CA 94103 | automated@airbnb.com</div>
</div>`
},

{
  id: 42, title: 'Uber — Trip Receipt',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'uber.com', domain: 'uber.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @uber.com. The email shows specific trip details, fare breakdown, driver name, and date. It is a receipt — no payment or credential action is required.',
  hints: [
    'Sender is noreply@uber.com — the official Uber domain.',
    'Shows pickup and drop-off addresses, exact fare, and driver name.',
    'Receipt only — no link requires entering payment or account credentials.',
    'Uber receipts always include a specific trip amount and route.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Uber Receipts &lt;noreply@uber.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Your Tuesday trip with Uber &#8212; $14.72</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p>Here&#8217;s your receipt for your May 19 trip.</p>
    <p><strong>From:</strong> 42 W 14th St, New York<br><strong>To:</strong> JFK International Airport<br><strong>Driver:</strong> Carlos M.<br><strong>Fare:</strong> $14.72<br><strong>Card:</strong> &#8226;&#8226;&#8226;&#8226; 4821</p>
    <a class="sim-email-cta" href="#">View Full Receipt</a>
  </div>
  <div class="sim-email-footer">Uber Technologies Inc. | 1515 3rd St, San Francisco, CA 94158 | noreply@uber.com</div>
</div>`
},

{
  id: 43, title: 'Microsoft — Unusual Sign-In Activity',
  type: 'EMAIL', difficulty: 'medium', isPhishing: false,
  url: 'account.microsoft.com', domain: 'account.microsoft.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. Microsoft uses @accountprotection.microsoft.com — a verified subdomain for security alerts. The email shows specific sign-in details and requests no credentials — it is informational only.',
  hints: [
    'Sender is account-security-noreply@accountprotection.microsoft.com — a legitimate Microsoft subdomain.',
    'Shows specific sign-in location, device, and time.',
    'No credentials are requested — notification only.',
    'You can verify by going directly to account.microsoft.com and checking recent activity.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Microsoft &lt;account-security-noreply@accountprotection.microsoft.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Microsoft account unusual sign-in activity</div>
  </div>
  <div class="sim-email-body">
    <p>Dear John Doe,</p>
    <p>We detected something unusual about a recent sign-in to the Microsoft account john.doe@outlook.com.</p>
    <p><strong>Country/Region:</strong> United States<br><strong>IP Address:</strong> 72.14.205.99<br><strong>Platform:</strong> Windows 11<br><strong>Browser:</strong> Edge</p>
    <p>If this was you, no action is needed. If not, review your recent activity:</p>
    <a class="sim-email-cta" href="#">Review Recent Activity</a>
  </div>
  <div class="sim-email-footer">Microsoft Corporation | One Microsoft Way, Redmond, WA 98052 | accountprotection.microsoft.com</div>
</div>`
},

{
  id: 44, title: 'Discord — Server Invitation',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'discord.com', domain: 'discord.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @discord.com. The email shows the specific server name and inviting user\'s handle. No credentials or sensitive information are requested.',
  hints: [
    'Sender is noreply@discord.com — the official Discord domain.',
    'Shows the specific server name and the Discord handle of the person who invited you.',
    'No credentials from other services are requested.',
    'Discord invites link to discord.com — not an external domain.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Discord &lt;noreply@discord.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">You have been invited to join a server on Discord</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p><strong>sarah_dev#4821</strong> has invited you to join the <strong>Acme Dev Team</strong> server on Discord.</p>
    <p>Acme Dev Team &#8212; 48 members online</p>
    <a class="sim-email-cta" href="#">Accept Invite</a>
  </div>
  <div class="sim-email-footer">Discord Inc. | 444 De Haro St, San Francisco, CA 94107 | noreply@discord.com</div>
</div>`
},

{
  id: 45, title: 'Steam — Purchase Receipt',
  type: 'EMAIL', difficulty: 'hard', isPhishing: false,
  url: 'steampowered.com', domain: 'steampowered.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate — and a deliberate contrast to Scenario 13. The sender is @steampowered.com (not .trade). The email includes a specific game title, price, and transaction ID. Compare this domain carefully against the phishing Steam scenario.',
  hints: [
    'Sender is noreply@steampowered.com — Steam\'s real domain, not steamcommunity.trade.',
    'Includes a specific game title, purchase price, and Steam transaction ID.',
    'Receipt only — no link requires entering your Steam password.',
    'This is the key contrast to phishing Scenario 13: domain is steampowered.com vs steamcommunity.trade.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Steam &lt;noreply@steampowered.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Thank you for your purchase on Steam</div>
  </div>
  <div class="sim-email-body">
    <p>Dear johndoe,</p>
    <p>Thank you for your purchase. You now own the following on Steam:</p>
    <p><strong>Cyberpunk 2077</strong> &#8212; $29.99<br><strong>Transaction ID:</strong> TXID-7743920-STEAM<br><strong>Date:</strong> May 19, 2026</p>
    <a class="sim-email-cta" href="#">View Purchase History</a>
  </div>
  <div class="sim-email-footer">Valve Corporation | steampowered.com | noreply@steampowered.com</div>
</div>`
},

{
  id: 46, title: 'Dropbox — File Shared With You',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'dropbox.com', domain: 'dropbox.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @dropbox.com. The email names the specific person sharing and the file name. No credentials are requested — link goes to dropbox.com.',
  hints: [
    'Sender is no-reply@dropbox.com — the official Dropbox domain.',
    'Shows the specific sharer\'s email and the exact file name.',
    'No credentials are requested.',
    'You can verify by logging into dropbox.com directly to check shared files.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Dropbox &lt;no-reply@dropbox.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Sarah Chen shared a file with you on Dropbox</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p><strong>Sarah Chen</strong> (s.chen@acmecorp.com) shared a file with you:</p>
    <p>&#128193; <strong>Q2_Budget_Forecast_Final.xlsx</strong></p>
    <a class="sim-email-cta" href="#">Open in Dropbox</a>
  </div>
  <div class="sim-email-footer">Dropbox, Inc. | 1800 Owens St, San Francisco, CA 94158 | no-reply@dropbox.com</div>
</div>`
},

{
  id: 47, title: 'Bank of America — Statement Available',
  type: 'EMAIL', difficulty: 'medium', isPhishing: false,
  url: 'bankofamerica.com', domain: 'bankofamerica.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. Bank of America uses @ealerts.bankofamerica.com for e-alerts. The email does not include account numbers in the body (a security practice) and directs you to bankofamerica.com — not an external domain.',
  hints: [
    'Sender is onlinebanking@ealerts.bankofamerica.com — a legitimate BofA subdomain for alerts.',
    'No account numbers or balances are shown in the email body — this is a security best practice.',
    'Link directs to bankofamerica.com — not a lookalike domain.',
    'No credentials are requested — statement notification only.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Bank of America &lt;onlinebanking@ealerts.bankofamerica.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Your April statement is now available</div>
  </div>
  <div class="sim-email-body">
    <p>Dear John Doe,</p>
    <p>Your April 2026 statement is now available to view online. For your security, account details are not included in this email.</p>
    <p>Log in to Online Banking to view your statement, download a PDF, or set up paperless billing.</p>
    <a class="sim-email-cta" href="#">View Statement at bankofamerica.com</a>
  </div>
  <div class="sim-email-footer">Bank of America | 100 N Tryon St, Charlotte, NC 28255 | onlinebanking@ealerts.bankofamerica.com</div>
</div>`
},

{
  id: 48, title: 'Adobe — Creative Cloud Renewal',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'adobe.com', domain: 'adobe.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. Adobe uses @mail.adobe.com for subscription emails — a verified subdomain. The email shows specific plan, amount, and next billing date. No credentials or card input required.',
  hints: [
    'Sender is mail@mail.adobe.com — Adobe\'s legitimate transactional email subdomain.',
    'Shows the specific Creative Cloud plan and billing amount.',
    'Receipt only — no link requires re-entering payment or Adobe ID credentials.',
    'Adobe receipts always show the last 4 digits of the card charged.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Adobe &lt;mail@mail.adobe.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">Your Adobe Creative Cloud plan has been renewed</div>
  </div>
  <div class="sim-email-body">
    <p>Dear John Doe,</p>
    <p>Your subscription has been successfully renewed.</p>
    <p><strong>Plan:</strong> Creative Cloud All Apps<br><strong>Amount charged:</strong> $54.99/month<br><strong>Card:</strong> &#8226;&#8226;&#8226;&#8226; 3921<br><strong>Next renewal:</strong> June 19, 2026</p>
    <a class="sim-email-cta" href="#">Manage Subscription</a>
  </div>
  <div class="sim-email-footer">Adobe Inc. | 345 Park Ave, San Jose, CA 95110 | mail@mail.adobe.com</div>
</div>`
},

{
  id: 49, title: 'Instagram — You Were Mentioned',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'instagram.com', domain: 'instagram.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. Instagram uses @mail.instagram.com for notifications. The email shows the specific @username and an excerpt of the comment. No credentials or sensitive data are requested.',
  hints: [
    'Sender is no-reply@mail.instagram.com — Instagram\'s official notification subdomain.',
    'Shows the specific @username who mentioned you.',
    'No credentials are requested.',
    'Instagram mention notifications never ask you to re-enter your password.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">Instagram &lt;no-reply@mail.instagram.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">@sarah_chen mentioned you in a comment</div>
  </div>
  <div class="sim-email-body">
    <p>Hi johndoe,</p>
    <p><strong>@sarah_chen</strong> mentioned you in a comment:</p>
    <p style="background:var(--bg-elevated);border-left:3px solid var(--accent);padding:8px 12px;border-radius:4px;font-size:0.88rem">&#8220;Great shot @johndoe! The lighting here is perfect &#127774;&#8221;</p>
    <a class="sim-email-cta" href="#">View Comment</a>
  </div>
  <div class="sim-email-footer">Instagram, Inc. | 1601 Willow Rd, Menlo Park, CA 94025 | no-reply@mail.instagram.com</div>
</div>`
},

{
  id: 50, title: 'YouTube — New Videos From Subscriptions',
  type: 'EMAIL', difficulty: 'easy', isPhishing: false,
  url: 'youtube.com', domain: 'youtube.com', domainClass: 'safe', hasLock: true,
  indicators: [],
  explanation: 'Legitimate. The sender is @youtube.com. The email lists specific video titles and channel names from your subscriptions — a weekly digest. No credentials or action required.',
  hints: [
    'Sender is noreply@youtube.com — the official YouTube domain.',
    'Lists specific video titles and channel names you actually subscribed to.',
    'Digest only — no link requires entering credentials.',
    'YouTube subscription digests never contain urgent warnings or account threats.',
  ],
  html: `<div class="sim-email">
  <div class="sim-email-header">
    <div class="sim-email-field"><span class="sim-email-field-label">From:</span><span class="sim-email-field-value">YouTube &lt;noreply@youtube.com&gt;</span></div>
    <div class="sim-email-field"><span class="sim-email-field-label">To:</span><span class="sim-email-field-value">john.doe@gmail.com</span></div>
    <div class="sim-email-subject">New videos from channels you subscribed to</div>
  </div>
  <div class="sim-email-body">
    <p>Hi John,</p>
    <p>Here are the latest uploads from your subscriptions:</p>
    <p>&#9654; <strong>Fireship</strong> &#8212; &#8220;I tried every JS framework in 2026&#8221;<br>&#9654; <strong>Theo &#8212; t3.gg</strong> &#8212; &#8220;Why I stopped using Next.js&#8221;<br>&#9654; <strong>Fireship</strong> &#8212; &#8220;Rust in 100 seconds&#8221;</p>
    <a class="sim-email-cta" href="#">Watch Now on YouTube</a>
  </div>
  <div class="sim-email-footer">Google LLC | 901 Cherry Ave, San Bruno, CA 94066 | noreply@youtube.com</div>
</div>`
},

]; // END SCENARIOS

