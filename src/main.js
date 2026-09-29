import Phaser from 'phaser';
import { GameScene } from './game.js';
import './style.css';

const LEVEL_NAMES = ['First Gap', 'Long Way Down', 'High Voltage', 'Hot Pursuit', 'Neon Gauntlet'];
const PIECES = ['wall', 'ramp', 'platform', 'ladder'];
const PROGRESS_KEY = 'stickman-builder-unlocked-level';
let unlockedLevel = 0;
let currentLevel = 0;
let primaryAction = 'next-level';
let secondaryAction = 'level-select';

try {
  const storedLevel = Number(window.localStorage.getItem(PROGRESS_KEY));
  if (Number.isInteger(storedLevel)) unlockedLevel = Phaser.Math.Clamp(storedLevel, 0, LEVEL_NAMES.length - 1);
} catch {
  unlockedLevel = 0;
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 600,
  backgroundColor: '#100b20',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1100 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [GameScene]
});

const pieceButtons = [...document.querySelectorAll('[data-piece]')];
const playButton = document.querySelector('[data-action="play"]');
const pauseButton = document.querySelector('[data-action="pause"]');
const levelLabel = document.querySelector('#level-label');
const levelName = document.querySelector('#level-name');
const screenOverlay = document.querySelector('#screen-overlay');
const screenEyebrow = document.querySelector('#screen-eyebrow');
const screenTitle = document.querySelector('#screen-title');
const screenMessage = document.querySelector('#screen-message');
const levelGrid = document.querySelector('#level-grid');
const screenActions = document.querySelector('#screen-actions');
const screenPrimary = document.querySelector('#screen-primary');
const screenSecondary = document.querySelector('#screen-secondary');
const bossHud = document.querySelector('#boss-hud');
const bossHearts = document.querySelector('#boss-hearts');
const dragonHeartIcons = [...bossHearts.querySelectorAll('[data-heart]')];
const bossCue = document.querySelector('#boss-cue');

function sendAction(action, detail = {}) {
  window.dispatchEvent(new CustomEvent('game-action', { detail: { action, ...detail } }));
}

function updateLevelOptions() {
  document.querySelectorAll('[data-level]').forEach((button) => {
    const levelIndex = Number(button.dataset.level);
    const isUnlocked = levelIndex <= unlockedLevel;
    button.disabled = !isUnlocked;
    button.querySelector('small').textContent = isUnlocked ? 'UNLOCKED' : 'LOCKED';
  });
}

function setLevelHeader(levelIndex) {
  currentLevel = levelIndex;
  levelLabel.textContent = levelIndex === 4 ? 'LEVEL 5 — DRAGON' : `LEVEL ${levelIndex + 1} / ${LEVEL_NAMES.length}`;
  levelName.textContent = LEVEL_NAMES[levelIndex].toUpperCase();
}

function showScreen(mode, detail = {}) {
  screenOverlay.hidden = false;
  levelGrid.hidden = mode !== 'select';
  screenActions.hidden = mode === 'select';
  screenEyebrow.textContent = `NEON BUILDER // LEVEL ${currentLevel + 1}`;

  if (mode === 'select') {
    screenTitle.textContent = 'Choose a level';
    screenMessage.textContent = 'Clear each course to unlock the next.';
    updateLevelOptions();
  } else if (mode === 'complete') {
    screenTitle.textContent = 'Level Complete!';
    screenMessage.textContent = `${LEVEL_NAMES[currentLevel]} cleared. The next course is now unlocked.`;
    screenPrimary.textContent = 'NEXT LEVEL';
    primaryAction = 'next-level';
    screenSecondary.hidden = false;
  } else if (mode === 'victory') {
    screenEyebrow.textContent = 'CAMPAIGN COMPLETE';
    screenTitle.textContent = 'Final Victory';
    screenMessage.textContent = 'You cleared all five neon courses.';
    screenPrimary.textContent = 'REPLAY LEVEL 5';
    primaryAction = 'replay-final';
    screenSecondary.hidden = false;
  } else if (mode === 'lost') {
    screenTitle.textContent = 'Level Failed';
    screenMessage.textContent = 'The course is unchanged. Give it another try.';
    screenPrimary.textContent = 'RETRY LEVEL';
    primaryAction = 'restart';
    screenSecondary.hidden = false;
  } else if (mode === 'paused') {
    screenTitle.textContent = 'Paused';
    screenMessage.textContent = `${LEVEL_NAMES[currentLevel]} is waiting.`;
    screenPrimary.textContent = 'RESUME';
    primaryAction = 'pause';
    screenSecondary.hidden = false;
  }
}

document.querySelectorAll('[data-level]').forEach((button) => {
  button.addEventListener('click', () => {
    const levelIndex = Number(button.dataset.level);
    if (levelIndex > unlockedLevel) return;
    setLevelHeader(levelIndex);
    screenOverlay.hidden = true;
    sendAction('start-level', { levelIndex });
  });
});

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const { action } = button.dataset;
    if (action === 'play') {
      setLevelHeader(currentLevel);
      screenOverlay.hidden = true;
      sendAction('start-level', { levelIndex: currentLevel });
    } else if (action === 'select-piece') {
      pieceButtons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle('selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      sendAction(action, { piece: button.dataset.piece });
    } else {
      sendAction(action);
    }
  });
});

screenPrimary.addEventListener('click', () => {
  if (primaryAction === 'replay-final') {
    setLevelHeader(LEVEL_NAMES.length - 1);
    screenOverlay.hidden = true;
    sendAction('start-level', { levelIndex: LEVEL_NAMES.length - 1 });
    return;
  }
  if (primaryAction === 'restart') screenOverlay.hidden = true;
  if (primaryAction === 'pause') screenOverlay.hidden = true;
  sendAction(primaryAction);
});

screenSecondary.addEventListener('click', () => sendAction('level-select'));

window.addEventListener('piece-count', (event) => {
  const { inventory, selected } = event.detail;
  PIECES.forEach((piece) => {
    document.querySelector(`[data-inventory-count="${piece}"]`).textContent = String(inventory[piece]);
  });
  pieceButtons.forEach((button) => button.classList.toggle('selected', button.dataset.piece === selected));
});

window.addEventListener('level-state', (event) => {
  const detail = typeof event.detail === 'string' ? { state: event.detail, levelIndex: currentLevel } : event.detail;
  setLevelHeader(detail.levelIndex);
  if (detail.state === 'playing') {
    screenOverlay.hidden = true;
    bossHud.hidden = detail.levelIndex !== 4;
    playButton.classList.add('is-playing');
    pauseButton.classList.remove('is-paused');
    pauseButton.textContent = 'Ⅱ';
    pauseButton.title = 'Pause';
    pauseButton.setAttribute('aria-label', 'Pause game');
  } else if (detail.state === 'won') {
    bossHud.hidden = true;
    showScreen('complete', detail);
  } else if (detail.state === 'victory') {
    bossHud.hidden = true;
    showScreen('victory', detail);
  } else if (detail.state === 'lost') {
    bossHud.hidden = true;
    showScreen('lost', detail);
  } else if (detail.state === 'paused') {
    bossHud.hidden = true;
    pauseButton.classList.add('is-paused');
    pauseButton.textContent = '▶';
    pauseButton.title = 'Resume';
    pauseButton.setAttribute('aria-label', 'Resume game');
    showScreen('paused', detail);
  } else if (detail.state === 'selecting' || detail.state === 'ready') {
    bossHud.hidden = true;
    showScreen('select', detail);
  } else {
    playButton.classList.remove('is-playing');
  }
});

window.addEventListener('level-progress', (event) => {
  unlockedLevel = Math.max(unlockedLevel, event.detail.unlockedLevel);
  updateLevelOptions();
});

window.addEventListener('dragon-state', (event) => {
  const { hp, cue, warning } = event.detail;
  dragonHeartIcons.forEach((heart, index) => {
    const active = index < hp;
    const wasActive = heart.classList.contains('is-active');
    heart.classList.toggle('is-active', active);
    if (wasActive && !active) {
      heart.classList.add('is-losing');
      window.setTimeout(() => heart.classList.remove('is-losing'), 360);
    }
  });
  bossHearts.setAttribute('aria-label', `${hp} of ${dragonHeartIcons.length} HP`);
  bossCue.textContent = cue;
  bossCue.classList.toggle('is-warning', warning);
});

window.addEventListener('dragon-message', (event) => {
  screenOverlay.hidden = false;
  levelGrid.hidden = true;
  screenActions.hidden = true;
  screenEyebrow.textContent = 'LEVEL 5 // BOSS DEFEATED';
  screenTitle.textContent = event.detail.title;
  screenMessage.textContent = event.detail.message || '';
});

window.addEventListener('keydown', (event) => {
  const index = Number(event.key) - 1;
  if (index >= 0 && index < PIECES.length) {
    const piece = PIECES[index];
    const button = document.querySelector(`[data-piece="${piece}"]`);
    button.click();
  }
});

updateLevelOptions();

window.addEventListener('beforeunload', () => game.destroy(true));
