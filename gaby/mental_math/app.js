/* ==========================================================================
   Mental Math Master - Interactive Application & Game Engine
   ========================================================================== */

// --- STATE MANAGEMENT ---
const AppState = {
  userXP: parseInt(localStorage.getItem('mm_xp') || '0'),
  streak: parseInt(localStorage.getItem('mm_streak') || '0'),
  completedModules: JSON.parse(localStorage.getItem('mm_completed') || '[]'),
  audioEnabled: localStorage.getItem('mm_audio') !== 'false',

  currentModuleId: null,
  currentSlideIndex: 0,
  
  // Game & Drill State
  gameMode: 'guided', // 'guided' | 'timed'
  currentQuestionIndex: 0,
  questions: [],
  score: 0,
  correctCount: 0,
  totalQuestions: 5,
  timer: 60,
  timerInterval: null,
  currentStreak: 0,
  questionStatus: 'unanswered', // 'unanswered' | 'submitted_correct' | 'submitted_incorrect'

  // Helper State
  helperSum: 0,
  helperPct: 0,
  currentQuestionTargetBase: 0,
  currentQuestionTargetPct: 0
};

// --- AUDIO SYNTHESIZER (Web Audio API) ---
class SoundSynth {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playClick() {
    if (!AppState.audioEnabled) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playCorrect() {
    if (!AppState.audioEnabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  playIncorrect() {
    if (!AppState.audioEnabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now); // A3
    osc.frequency.setValueAtTime(196, now + 0.1); // G3
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

const AudioPlayer = new SoundSynth();

// --- CURRICULUM MODULE DEFINITIONS ---
const MODULES_DATA = [
  {
    id: 1,
    number: "Module 1",
    title: "The Anchor Percentages",
    description: "Learn to compute 10%, 5%, 1%, 25%, and 50% instantly without standard multiplication.",
    icon: "fa-anchor",
    slides: [
      {
        title: "The Power of Anchors",
        body: `Instead of multiplying large numbers by decimals directly, mental math relies on <b>Anchor Percentages</b>. By breaking down any salary or number into standard anchor chunks (10%, 5%, 1%), complex percentage math becomes instant addition.`,
        interactiveType: "anchors-demo",
        defaultSalary: 160000
      },
      {
        title: "Rule of Decimal Shifts",
        body: `To find <b>10%</b> of any compensation figure, shift the decimal point 1 position to the left.<br>To find <b>1%</b>, shift it 2 positions to the left.<br><br>
        • $160,000 → 10% = <b>$16,000</b><br>
        • $160,000 → 1% = <b>$1,600</b>`
      },
      {
        title: "Halving Anchors (5% & 2.5%)",
        body: `<b>5%</b> is simply half of 10%.<br>
        If 10% of $160,000 is $16,000, then 5% is $16,000 / 2 = <b>$8,000</b>.<br><br>
        <b>50%</b> is dividing by 2 ($80,000), and <b>25%</b> is half of 50% ($40,000).`
      }
    ]
  },
  {
    id: 2,
    number: "Module 2",
    title: "Percentage Decomposition",
    description: "Combine anchor values additively to calculate odd percentages like 15%, 17.5%, and 18%.",
    icon: "fa-layer-group",
    slides: [
      {
        title: "Additive Breakdown",
        body: `Any non-standard bonus percentage can be formed by adding anchor chunks:<br><br>
        • <b>15%</b> = 10% + 5%<br>
        • <b>18%</b> = 20% - 2% (or 10% + 5% + 3×1%)<br>
        • <b>17.5%</b> = 10% + 5% + 2.5%`,
        interactiveType: "decomposition-demo",
        defaultSalary: 140000
      },
      {
        title: "Step-by-Step Example: 15% Bonus",
        body: `What is a <b>15% bonus</b> on a <b>$160,000 base salary</b>?<br><br>
        1. Find 10%: $16,000<br>
        2. Find 5% (half of 10%): $8,000<br>
        3. Add them together: $16,000 + $8,000 = <b>$24,000</b>`
      }
    ]
  },
  {
    id: 3,
    number: "Module 3",
    title: "Percentage Reciprocity",
    description: "Master the secret rule: A% of B = B% of A for instant mental calculations.",
    icon: "fa-repeat",
    slides: [
      {
        title: "The Reciprocity Trick",
        body: `Multiplication is commutative: <code>A% of B = B% of A</code>.<br>
        If finding 16% of $50,000 sounds hard, flip it! Finding <b>50% of $16,000</b> is trivial: <b>$8,000</b>!`,
        interactiveType: "reciprocity-demo",
        valA: 16,
        valB: 50000
      },
      {
        title: "When to Flip",
        body: `Use Reciprocity whenever the target amount contains easy numbers like 25, 50, 20, or 100.<br><br>
        • <b>84% of $25,000</b> = 25% of $84,000 = $84,000 / 4 = <b>$21,000</b>.<br>
        • <b>64% of $50,000</b> = 50% of $64,000 = <b>$32,000</b>.`
      }
    ]
  },
  {
    id: 4,
    number: "Module 4",
    title: "Compensation Building Blocks",
    description: "Calculate Base + Target Bonus % + 401(k) Match % in under 10 seconds.",
    icon: "fa-cubes",
    slides: [
      {
        title: "The Core Cash Formula",
        body: `Target Annual Cash = Base Salary + Bonus ($) + Effective 401(k) Match ($).<br><br>
        <b>401(k) Match Trick:</b> If an employer offers "50% match up to 6%", the effective match is <b>3% of base salary</b> ($50\% \times 6\% = 3\%$).`,
        interactiveType: "comp-demo",
        defaultBase: 150000
      }
    ]
  },
  {
    id: 5,
    number: "Module 5",
    title: "Equity Annualization & Growth",
    description: "Convert 4-year RSU grants into annual compensation and project stock growth.",
    icon: "fa-chart-line",
    slides: [
      {
        title: "Annualizing Equity",
        body: `RSUs (Restricted Stock Units) typically vest over 4 years.<br><br>
        • <b>Annual Equity Value</b> = Total Grant ÷ Vesting Years (usually 4).<br>
        • A $200,000 RSU grant over 4 years = <b>$50,000 / year</b>.<br>
        • If stock grows 20%, $50,000 × 1.20 = <b>$60,000 / year</b>.`
      }
    ]
  },
  {
    id: 6,
    number: "Module 6",
    title: "Total Compensation (TC) Assembly",
    description: "Assemble Base + Bonus + Equity/4 + Match on the fly to compare competing offers.",
    icon: "fa-trophy",
    slides: [
      {
        title: "Putting It All Together",
        body: `When evaluating an offer live during a call, use mental sub-totals:<br><br>
        <code>TC = Base + (Base × Bonus%) + (RSUs ÷ 4) + (Base × Match%)</code><br><br>
        Keep running subtotals in thousands to stay fast and accurate!`,
        interactiveType: "tc-demo"
      }
    ]
  }
];

// --- DYNAMIC UNLIMITED RANDOM QUESTION GENERATOR ---
function generateRandomQuestion(moduleId) {
  const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const getRandomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const roundTo1000 = (num) => Math.round(num / 1000) * 1000;

  let category = "", text = "", targetBase = 0, targetPct = 0, answer = 0, explanation = "";

  if (moduleId === 1) {
    // Module 1: Anchor Percentages (10%, 5%, 1%, 25%, 50%)
    const pcts = [10, 5, 1, 25, 50];
    targetPct = getRandomChoice(pcts);

    if (targetPct === 25) {
      targetBase = getRandomInt(15, 90) * 4000; // e.g. 60,000 to 360,000 in steps of 4,000
    } else if (targetPct === 50) {
      targetBase = getRandomInt(30, 180) * 2000; // e.g. 60,000 to 360,000 in steps of 2,000
    } else {
      targetBase = getRandomInt(6, 35) * 10000; // e.g. 60,000 to 350,000 in steps of 10,000
    }
    targetBase = roundTo1000(targetBase);
    answer = Math.round((targetBase * targetPct) / 100);

    category = `Module 1 • ${targetPct}% Anchor`;
    text = `Calculate ${targetPct}% of a $${targetBase.toLocaleString()} base salary.`;
    explanation = `Decimal shift or halve: <code>${targetPct}% of $${targetBase.toLocaleString()} = $${answer.toLocaleString()}</code>.`;
  } 
  else if (moduleId === 2) {
    // Module 2: Decomposition (15%, 18%, 12%, 17.5%, 22%, 2.5%, 3.5%)
    const pcts = [15, 18, 12, 22, 17.5, 2.5, 3.5];
    targetPct = getRandomChoice(pcts);

    if (targetPct % 1 !== 0) {
      // Half percentages like 17.5%, 2.5%, 3.5%
      targetBase = getRandomInt(40, 180) * 2000;
    } else {
      targetBase = getRandomInt(8, 35) * 10000;
    }
    targetBase = roundTo1000(targetBase);
    answer = Math.round((targetBase * targetPct) / 100);

    category = `Module 2 • ${targetPct}% Decomposition`;
    text = `Calculate a ${targetPct}% performance bonus on a $${targetBase.toLocaleString()} base salary.`;
    explanation = `Decompose into anchors: 10% = $${(targetBase*0.1).toLocaleString()}, 5% = $${(targetBase*0.05).toLocaleString()} → Total = <code>$${answer.toLocaleString()}</code>.`;
  }
  else if (moduleId === 3) {
    // Module 3: Reciprocity (A% of B = B% of A)
    const anchorAmounts = [25000, 50000, 100000, 200000];
    const anchor = getRandomChoice(anchorAmounts);
    
    if (anchor === 25000) {
      targetPct = getRandomInt(3, 12) * 4; // Multiple of 4
      targetBase = targetPct * 1000;
      answer = Math.round((anchor * targetPct) / 100);
      category = `Module 3 • Reciprocity Rule`;
      text = `What is ${targetPct}% of $${anchor.toLocaleString()}? (Hint: Flip it to 25% of $${targetBase.toLocaleString()})`;
      explanation = `Reciprocity: 25% of $${targetBase.toLocaleString()} = $${targetBase.toLocaleString()} ÷ 4 = <code>$${answer.toLocaleString()}</code>.`;
    } else if (anchor === 50000) {
      targetPct = getRandomInt(6, 24) * 2; // Even percentage
      targetBase = targetPct * 1000;
      answer = Math.round((anchor * targetPct) / 100);
      category = `Module 3 • Reciprocity Rule`;
      text = `What is ${targetPct}% of $${anchor.toLocaleString()}? (Hint: Flip it to 50% of $${targetBase.toLocaleString()})`;
      explanation = `Reciprocity: 50% of $${targetBase.toLocaleString()} = $${targetBase.toLocaleString()} ÷ 2 = <code>$${answer.toLocaleString()}</code>.`;
    } else {
      targetPct = getRandomInt(12, 45);
      targetBase = targetPct * 1000;
      answer = Math.round((anchor * targetPct) / 100);
      category = `Module 3 • Reciprocity Rule`;
      text = `What is ${targetPct}% of $${anchor.toLocaleString()}? (Hint: Shift decimal for $${targetBase.toLocaleString()})`;
      explanation = `Reciprocity calculation = <code>$${answer.toLocaleString()}</code>.`;
    }
  }
  else if (moduleId === 4) {
    // Module 4: Cash & Benefits (Base + Bonus % + Match %)
    targetBase = getRandomInt(9, 30) * 10000; // 90k to 300k
    const bonusPct = getRandomChoice([10, 12, 15, 18, 20, 25]);
    const matchPct = getRandomChoice([2, 3, 4, 5]);

    const bonusAmt = Math.round(targetBase * (bonusPct / 100));
    const matchAmt = Math.round(targetBase * (matchPct / 100));
    answer = targetBase + bonusAmt + matchAmt;
    targetPct = bonusPct + matchPct;

    category = `Module 4 • Cash & Benefits`;
    text = `Calculate total annual cash for a $${targetBase.toLocaleString()} base salary + ${bonusPct}% bonus + ${matchPct}% 401(k) match.`;
    explanation = `Base ($${targetBase.toLocaleString()}) + Bonus ($${bonusAmt.toLocaleString()}) + Match ($${matchAmt.toLocaleString()}) = <code>$${answer.toLocaleString()}</code>.`;
  }
  else if (moduleId === 5) {
    // Module 5: Equity Annualization & Growth
    const grantOptions = [80000, 120000, 160000, 200000, 240000, 280000, 320000, 360000, 400000];
    const grant = getRandomChoice(grantOptions);
    const growthPct = getRandomChoice([0, 10, 20, 25, 50]);

    const baseAnnual = grant / 4;
    answer = Math.round(baseAnnual * (1 + (growthPct / 100)));
    targetBase = grant;
    targetPct = growthPct;

    category = `Module 5 • Annual RSU Equity`;
    if (growthPct === 0) {
      text = `What is the annual equity value of a $${grant.toLocaleString()} RSU grant vesting over 4 years?`;
      explanation = `$${grant.toLocaleString()} ÷ 4 years = <code>$${answer.toLocaleString()}/yr</code>.`;
    } else {
      text = `What is the annual equity value of a $${grant.toLocaleString()} RSU grant over 4 years if the stock grows by ${growthPct}%?`;
      explanation = `Annual Base ($${baseAnnual.toLocaleString()}) + ${growthPct}% Growth ($${(answer - baseAnnual).toLocaleString()}) = <code>$${answer.toLocaleString()}/yr</code>.`;
    }
  }
  else {
    // Module 6: Total Compensation Assembly
    targetBase = getRandomInt(10, 25) * 10000;
    const bonusPct = getRandomChoice([10, 15, 20]);
    const rsuGrant = getRandomChoice([80000, 120000, 160000, 200000, 240000, 280000, 320000]);
    const matchPct = getRandomChoice([0, 2, 3, 4]);

    const bonusAmt = Math.round(targetBase * (bonusPct / 100));
    const annualRsu = rsuGrant / 4;
    const matchAmt = Math.round(targetBase * (matchPct / 100));
    answer = targetBase + bonusAmt + annualRsu + matchAmt;
    targetPct = bonusPct;

    category = `Module 6 • Total Comp Assembly`;
    const matchStr = matchPct > 0 ? ` + ${matchPct}% 401(k)` : '';
    text = `Calculate Total Comp: $${targetBase.toLocaleString()} Base + ${bonusPct}% Bonus + $${rsuGrant.toLocaleString()}/4yr RSUs${matchStr}.`;
    explanation = `Base ($${targetBase.toLocaleString()}) + Bonus ($${bonusAmt.toLocaleString()}) + Equity ($${annualRsu.toLocaleString()})${matchPct > 0 ? ` + Match ($${matchAmt.toLocaleString()})` : ''} = <code>$${answer.toLocaleString()}</code>.`;
  }

  return { category, text, targetBase, targetPct, answer, explanation };
}

// --- DOM ELEMENTS & VIEW ROUTING ---
const views = {
  dashboard: document.getElementById('view-dashboard'),
  lesson: document.getElementById('view-lesson'),
  practice: document.getElementById('view-practice'),
  results: document.getElementById('view-results')
};

function switchView(viewName) {
  Object.keys(views).forEach(name => {
    views[name].classList.remove('active');
  });
  views[viewName].classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  renderDashboard();
  updateHeaderStats();
  setupEventListeners();
});

function updateHeaderStats() {
  document.getElementById('user-xp').textContent = AppState.userXP;
  document.getElementById('user-streak').textContent = AppState.streak;
  document.getElementById('stats-completed').textContent = `${AppState.completedModules.length} / 6`;
}

function setupEventListeners() {
  document.getElementById('btn-home').addEventListener('click', () => {
    AudioPlayer.playClick();
    switchView('dashboard');
  });

  document.getElementById('toggle-audio').addEventListener('click', () => {
    AppState.audioEnabled = !AppState.audioEnabled;
    localStorage.setItem('mm_audio', AppState.audioEnabled);
    document.getElementById('audio-icon').className = AppState.audioEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  });

  document.getElementById('btn-back-dashboard').addEventListener('click', () => {
    AudioPlayer.playClick();
    switchView('dashboard');
  });

  document.getElementById('btn-prev-slide').addEventListener('click', () => {
    AudioPlayer.playClick();
    navigateSlide(-1);
  });

  document.getElementById('btn-next-slide').addEventListener('click', () => {
    AudioPlayer.playClick();
    navigateSlide(1);
  });

  document.getElementById('btn-start-practice').addEventListener('click', () => {
    AudioPlayer.playClick();
    startPracticeDrill(AppState.currentModuleId);
  });

  document.getElementById('btn-exit-practice').addEventListener('click', () => {
    AudioPlayer.playClick();
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    switchView('dashboard');
  });

  document.getElementById('btn-finish-practice').addEventListener('click', () => {
    AudioPlayer.playClick();
    finishDrill();
  });

  document.getElementById('btn-submit-answer').addEventListener('click', () => {
    handleUserAction();
  });

  const inputEl = document.getElementById('answer-input');
  inputEl.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUserAction();
      return;
    }
    // Block non-numeric keys except control keys
    if (!/[0-9]/.test(e.key) && !['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
    }
  });

  // Global keydown listener for Enter key on Practice and Lesson screens
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const practiceView = document.getElementById('view-practice');
      if (practiceView && practiceView.classList.contains('active')) {
        if (AppState.questionStatus === 'submitted_correct') {
          e.preventDefault();
          AudioPlayer.playClick();
          nextQuestion();
        }
      }
    }
  });

  document.getElementById('btn-next-question').addEventListener('click', () => {
    AudioPlayer.playClick();
    nextQuestion();
  });

  document.getElementById('btn-results-dashboard').addEventListener('click', () => {
    AudioPlayer.playClick();
    renderDashboard();
    switchView('dashboard');
  });

  document.getElementById('btn-retry-module').addEventListener('click', () => {
    AudioPlayer.playClick();
    startPracticeDrill(AppState.currentModuleId);
  });

  // Game mode toggle
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      AudioPlayer.playClick();
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      AppState.gameMode = e.target.dataset.mode;
      startPracticeDrill(AppState.currentModuleId);
    });
  });
}

// --- RENDER DASHBOARD ---
function renderDashboard() {
  const grid = document.getElementById('modules-grid');
  grid.innerHTML = '';

  MODULES_DATA.forEach(mod => {
    const isCompleted = AppState.completedModules.includes(mod.id);
    const card = document.createElement('div');
    card.className = `module-card ${isCompleted ? 'completed' : ''}`;
    card.innerHTML = `
      <div class="module-card-header">
        <div class="module-icon-wrap"><i class="fa-solid ${mod.icon}"></i></div>
        <span class="module-number">${mod.number}</span>
      </div>
      <div class="module-card-body">
        <h3>${mod.title}</h3>
        <p>${mod.description}</p>
      </div>
      <div class="module-card-footer">
        <span class="module-status">
          ${isCompleted ? '<i class="fa-solid fa-circle-check"></i> Completed' : '<i class="fa-solid fa-circle"></i> Ready to Learn'}
        </span>
        <button class="btn btn-secondary btn-sm">Start <i class="fa-solid fa-arrow-right"></i></button>
      </div>
    `;

    card.addEventListener('click', () => {
      AudioPlayer.playClick();
      openModuleLesson(mod.id);
    });

    grid.appendChild(card);
  });
}

// --- LESSON & SLIDES SYSTEM ---
function openModuleLesson(moduleId) {
  AppState.currentModuleId = moduleId;
  AppState.currentSlideIndex = 0;

  const mod = MODULES_DATA.find(m => m.id === moduleId);
  document.getElementById('lesson-module-tag').textContent = mod.number;
  document.getElementById('lesson-title').textContent = mod.title;

  renderSlide();
  switchView('lesson');
}

function renderSlide() {
  const mod = MODULES_DATA.find(m => m.id === AppState.currentModuleId);
  const slide = mod.slides[AppState.currentSlideIndex];
  const container = document.getElementById('slide-container');

  document.getElementById('slide-count').textContent = `Step ${AppState.currentSlideIndex + 1} of ${mod.slides.length}`;
  document.getElementById('lesson-progress-fill').style.width = `${((AppState.currentSlideIndex + 1) / mod.slides.length) * 100}%`;

  let interactiveHTML = '';
  if (slide.interactiveType === 'anchors-demo') {
    interactiveHTML = `
      <div class="interactive-demo-box">
        <div class="demo-slider-header">
          <span>Base Salary:</span>
          <span id="demo-salary-val">$160,000</span>
        </div>
        <div class="demo-slider-group">
          <input type="range" id="demo-salary-slider" min="50000" max="400000" step="10000" value="160000">
        </div>
        <div class="demo-breakdown-grid">
          <div class="demo-stat-pill"><span class="demo-stat-lbl">10% (Shift 1)</span><span class="demo-stat-val" id="val-10">$16,000</span></div>
          <div class="demo-stat-pill"><span class="demo-stat-lbl">5% (Half 10%)</span><span class="demo-stat-val" id="val-5">$8,000</span></div>
          <div class="demo-stat-pill"><span class="demo-stat-lbl">1% (Shift 2)</span><span class="demo-stat-val" id="val-1">$1,600</span></div>
          <div class="demo-stat-pill"><span class="demo-stat-lbl">25% (Quarter)</span><span class="demo-stat-val" id="val-25">$40,000</span></div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="slide-content">
      <h2 class="slide-title">${slide.title}</h2>
      <div class="slide-body">${slide.body}</div>
      ${interactiveHTML}
    </div>
  `;

  // Render Dot Indicators
  const dotsContainer = document.getElementById('slide-dots');
  dotsContainer.innerHTML = '';
  mod.slides.forEach((_, idx) => {
    const dot = document.createElement('div');
    dot.className = `slide-dot ${idx === AppState.currentSlideIndex ? 'active' : ''}`;
    dotsContainer.appendChild(dot);
  });

  // Controls Visibility
  document.getElementById('btn-prev-slide').disabled = AppState.currentSlideIndex === 0;
  const isLast = AppState.currentSlideIndex === mod.slides.length - 1;
  document.getElementById('btn-next-slide').classList.toggle('hidden', isLast);
  document.getElementById('btn-start-practice').classList.toggle('hidden', !isLast);

  // Bind interactive elements if demo present
  if (slide.interactiveType === 'anchors-demo') {
    const slider = document.getElementById('demo-salary-slider');
    slider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      document.getElementById('demo-salary-val').textContent = `$${val.toLocaleString()}`;
      document.getElementById('val-10').textContent = `$${(val * 0.1).toLocaleString()}`;
      document.getElementById('val-5').textContent = `$${(val * 0.05).toLocaleString()}`;
      document.getElementById('val-1').textContent = `$${(val * 0.01).toLocaleString()}`;
      document.getElementById('val-25').textContent = `$${(val * 0.25).toLocaleString()}`;
    });
  }
}

function navigateSlide(dir) {
  AppState.currentSlideIndex += dir;
  renderSlide();
}

// --- PRACTICE & DRILL GAME LOGIC ---
function startPracticeDrill(moduleId) {
  AppState.currentModuleId = moduleId;
  AppState.currentQuestionIndex = 0;
  AppState.score = 0;
  AppState.correctCount = 0;
  AppState.currentStreak = 0;
  AppState.questions = [];

  document.getElementById('score-val').textContent = '0';
  document.getElementById('streak-pill').classList.add('hidden');

  // Timed Mode Header Toggle
  const timerBox = document.getElementById('timer-box');
  if (AppState.gameMode === 'timed') {
    timerBox.style.display = 'flex';
    AppState.timer = 60;
    document.getElementById('timer-val').textContent = '60s';
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    AppState.timerInterval = setInterval(() => {
      AppState.timer--;
      document.getElementById('timer-val').textContent = `${AppState.timer}s`;
      if (AppState.timer <= 0) {
        clearInterval(AppState.timerInterval);
        finishDrill();
      }
    }, 1000);
  } else {
    timerBox.style.display = 'none';
  }

  loadQuestion();
  switchView('practice');
}

function loadQuestion() {
  // Generate a random question on the fly if needed
  if (!AppState.questions[AppState.currentQuestionIndex]) {
    const newQ = generateRandomQuestion(AppState.currentModuleId);
    AppState.questions.push(newQ);
  }

  const q = AppState.questions[AppState.currentQuestionIndex];
  AppState.currentQuestionTargetBase = q.targetBase;
  AppState.currentQuestionTargetPct = q.targetPct;
  AppState.questionStatus = 'unanswered';

  // Reset Helper State
  AppState.helperSum = 0;
  AppState.helperPct = 0;
  updateHelperUI();

  // Progress Bar - Animated dynamic progress bar for continuous stream
  const cycleStep = (AppState.currentQuestionIndex % 10) + 1;
  document.getElementById('quiz-progress-fill').style.width = `${cycleStep * 10}%`;

  // Content
  document.getElementById('question-category').textContent = `${q.category} • Exercise #${AppState.currentQuestionIndex + 1}`;
  document.getElementById('question-text').textContent = q.text;
  const inputEl = document.getElementById('answer-input');
  inputEl.value = '';
  inputEl.disabled = false;
  inputEl.focus();

  // Hide Feedback Panel & Reset Buttons
  document.getElementById('feedback-panel').classList.add('hidden');
  document.getElementById('btn-submit-answer').classList.remove('hidden');
  document.getElementById('btn-next-question').classList.remove('hidden');

  // Configure Anchor Helper Buttons dynamically
  const anchorButtonsContainer = document.getElementById('anchor-buttons');
  const base = q.targetBase;
  anchorButtonsContainer.innerHTML = `
    <button class="anchor-chip" data-pct="10">+10% ($${(base*0.1).toLocaleString()})</button>
    <button class="anchor-chip" data-pct="5">+5% ($${(base*0.05).toLocaleString()})</button>
    <button class="anchor-chip" data-pct="1">+1% ($${(base*0.01).toLocaleString()})</button>
    <button class="anchor-chip reset" id="btn-reset-helper"><i class="fa-solid fa-rotate-left"></i> Reset</button>
  `;

  document.querySelectorAll('.anchor-chip[data-pct]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      AudioPlayer.playClick();
      const p = parseFloat(e.target.dataset.pct);
      AppState.helperPct += p;
      AppState.helperSum += (base * (p / 100));
      updateHelperUI();
    });
  });

  document.getElementById('btn-reset-helper').addEventListener('click', () => {
    AudioPlayer.playClick();
    AppState.helperSum = 0;
    AppState.helperPct = 0;
    updateHelperUI();
  });
}

function updateHelperUI() {
  document.getElementById('helper-sum-val').textContent = `$${AppState.helperSum.toLocaleString()}`;
  document.getElementById('helper-pct-val').textContent = `${AppState.helperPct}%`;
}

function handleUserAction() {
  if (AppState.questionStatus === 'submitted_correct') {
    nextQuestion();
    return;
  }
  submitAnswer();
}

function submitAnswer() {
  const inputEl = document.getElementById('answer-input');
  const inputVal = inputEl.value.replace(/[^0-9.]/g, '');
  if (!inputVal) return;

  const numVal = parseFloat(inputVal);
  const q = AppState.questions[AppState.currentQuestionIndex];
  const isCorrect = Math.abs(numVal - q.answer) < 1;

  // --- TIMED / SPEED CHALLENGE MODE ---
  if (AppState.gameMode === 'timed') {
    if (isCorrect) {
      AudioPlayer.playCorrect();
      AppState.score += 100 + (AppState.currentStreak * 20);
      AppState.correctCount++;
      AppState.currentStreak++;
    } else {
      AudioPlayer.playIncorrect();
      AppState.currentStreak = 0;
    }
    document.getElementById('score-val').textContent = AppState.score;
    // Speed challenge moves DIRECTLY to next question!
    nextQuestion();
    return;
  }

  // --- GUIDED PRACTICE MODE ---
  const feedbackPanel = document.getElementById('feedback-panel');
  const feedbackIcon = document.getElementById('feedback-icon');
  const feedbackTitle = document.getElementById('feedback-title');
  const feedbackExp = document.getElementById('feedback-explanation');
  const btnNext = document.getElementById('btn-next-question');

  feedbackPanel.classList.remove('hidden', 'incorrect');

  if (isCorrect) {
    AudioPlayer.playCorrect();
    AppState.questionStatus = 'submitted_correct';
    AppState.score += 100 + (AppState.currentStreak * 20);
    AppState.correctCount++;
    AppState.currentStreak++;

    inputEl.disabled = true;
    document.getElementById('btn-submit-answer').classList.add('hidden');

    feedbackIcon.className = 'fa-solid fa-circle-check';
    feedbackTitle.textContent = 'Spot on! Correct!';
    feedbackExp.innerHTML = `${q.explanation}<br><br><b>Press Enter to continue.</b>`;
    btnNext.classList.remove('hidden');
    btnNext.focus();

    if (AppState.currentStreak > 1) {
      document.getElementById('streak-pill').classList.remove('hidden');
      document.getElementById('streak-count').textContent = AppState.currentStreak;
    }
  } else {
    AudioPlayer.playIncorrect();
    AppState.questionStatus = 'submitted_incorrect';
    AppState.currentStreak = 0;
    document.getElementById('streak-pill').classList.add('hidden');

    // Do NOT let them skip! They must try again.
    feedbackPanel.classList.add('incorrect');
    feedbackIcon.className = 'fa-solid fa-circle-xmark';
    feedbackTitle.textContent = `Not quite ($${numVal.toLocaleString()}). Try again!`;
    feedbackExp.innerHTML = `Break down the anchors carefully:<br>${q.explanation}`;

    // Hide "Next Question" button when incorrect - force retry!
    btnNext.classList.add('hidden');

    // Keep input enabled & select text so user can try again immediately
    inputEl.disabled = false;
    inputEl.focus();
    inputEl.select();
  }

  document.getElementById('score-val').textContent = AppState.score;
}

function nextQuestion() {
  AppState.currentQuestionIndex++;
  loadQuestion();
}

function finishDrill() {
  if (AppState.timerInterval) clearInterval(AppState.timerInterval);

  // Mark module complete & grant XP
  if (!AppState.completedModules.includes(AppState.currentModuleId)) {
    AppState.completedModules.push(AppState.currentModuleId);
    localStorage.setItem('mm_completed', JSON.stringify(AppState.completedModules));
  }

  const xpEarned = AppState.score;
  AppState.userXP += xpEarned;
  AppState.streak += 1;
  localStorage.setItem('mm_xp', AppState.userXP);
  localStorage.setItem('mm_streak', AppState.streak);

  updateHeaderStats();

  // Results Screen
  const totalAttempted = AppState.questions.length;
  const accuracy = totalAttempted > 0 ? Math.round((AppState.correctCount / totalAttempted) * 100) : 100;
  document.getElementById('res-score').textContent = AppState.score;
  document.getElementById('res-accuracy').textContent = `${accuracy}%`;
  document.getElementById('res-xp').textContent = `+${xpEarned} XP`;

  switchView('results');
}
