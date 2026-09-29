import { BUILD_SIZES, LEVELS, WORLD_HEIGHT, WORLD_WIDTH } from './levels.js';
import dragonBodyAssetUrl from '../assets/neon-dragon-body.svg?url&no-inline';
import dragonWingAssetUrl from '../assets/neon-dragon-wing.svg?url&no-inline';

const GRID = 32;
const NEON_CYAN = 0x54edff;
const NEON_PINK = 0xff4fc8;
const NEON_PURPLE = 0xa875ff;
const NEON_ORANGE = 0xff9d55;
const NEON_BLUE = 0x458bff;
const NEON_GREEN = 0x42ff87;
const PROGRESS_KEY = 'stickman-builder-unlocked-level';
let fallbackUnlockedLevel = 0;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  preload() {
    if (!this.textures.exists('neon-dragon-body')) {
      this.load.svg('neon-dragon-body', dragonBodyAssetUrl, { width: 768, height: 768 });
    }
    if (!this.textures.exists('neon-dragon-wing')) {
      this.load.svg('neon-dragon-wing', dragonWingAssetUrl, { width: 768, height: 768 });
    }
  }

  init(data = {}) {
    this.levelIndex = Number.isInteger(data.levelIndex) ? Phaser.Math.Clamp(data.levelIndex, 0, LEVELS.length - 1) : 0;
    this.autoStart = Boolean(data.autoStart);
    this.level = LEVELS[this.levelIndex];
    this.state = 'ready';
    this.buildMode = 'wall';
    this.inventory = { ...this.level.inventory };
    this.builtPieces = [];
    this.enemies = [];
    this.fireballs = [];
    this.dragonHp = this.level.boss ? 5 : 0;
    this.dragonDefeated = false;
    this.dragonCue = '';
    this.lastGroundedAt = -Infinity;
    this.jumpPressedAt = -Infinity;
    this.wasGrounded = false;
    this.facing = 1;
    this.jumpHeld = false;
    this.isClimbing = false;
  }

  create() {
    this.physics.world.setBounds(0, 0, this.level.width || WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, this.level.width || WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor('#100b20');

    this.platforms = this.physics.add.staticGroup();
    this.buildingBodies = this.physics.add.staticGroup();
    this.hazards = this.physics.add.staticGroup();
    this.enemyGroup = this.physics.add.group();
    this.drawBackdrop();
    this.createLevel(this.level);
    this.createPlayer(this.level);
    this.createEnemies(this.level.enemies);
    if (this.level.boss) this.createDragonBoss(this.level.boss);
    const goalPlatform = this.level.platforms.find((platform) => this.level.finishX >= platform.x && this.level.finishX < platform.x + platform.width);
    this.createFinish(this.level.finishX, goalPlatform.top);
    this.createBuildPreview();

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.buildingBodies);
    this.physics.add.collider(this.enemyGroup, this.platforms);
    this.physics.add.collider(this.enemyGroup, this.buildingBodies);
    this.physics.add.overlap(this.player, this.enemyGroup, () => this.endLevel(false));
    this.physics.add.overlap(this.player, this.hazards, () => this.endLevel(false));
    this.physics.add.overlap(this.player, this.finishZone, () => {
      if (!this.level.boss || this.dragonSequenceFinished) this.endLevel(true);
    });

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('A,D,S,W,SPACE');
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', this.handlePointer, this);
    this.actionHandler = (event) => this.handleAction(event.detail);
    window.addEventListener('game-action', this.actionHandler);
    this.jumpKeyHandler = (event) => {
      if (this.state !== 'playing' || event.repeat) return;
      if (event.code === 'ArrowUp' || event.code === 'Space' || event.code === 'KeyW') {
        this.jumpHeld = true;
        this.jumpPressedAt = this.time.now;
      }
    };
    this.jumpReleaseHandler = (event) => {
      if (event.code === 'ArrowUp' || event.code === 'Space' || event.code === 'KeyW') this.jumpHeld = false;
    };
    window.addEventListener('keydown', this.jumpKeyHandler);
    window.addEventListener('keyup', this.jumpReleaseHandler);
    this.events.once('shutdown', () => {
      window.removeEventListener('game-action', this.actionHandler);
      window.removeEventListener('keydown', this.jumpKeyHandler);
      window.removeEventListener('keyup', this.jumpReleaseHandler);
    });

    this.physics.world.pause();
    this.publishCount();
    this.publishLevelState();
    if (this.autoStart) this.startLevel();
  }

  drawBackdrop() {
    const haze = this.add.graphics().setDepth(-10).setScrollFactor(0.25);
    haze.fillStyle(0x130d29, 1);
    haze.fillRect(0, 0, WORLD_WIDTH + 500, WORLD_HEIGHT);
    haze.fillStyle(0x37165c, 0.22);
    haze.fillEllipse(620, 370, 950, 430);
    haze.fillStyle(0x142c55, 0.2);
    haze.fillEllipse(1650, 260, 900, 520);

    const skyline = this.add.graphics().setDepth(-8).setScrollFactor(0.4);
    skyline.fillStyle(0x1a1234, 1);
    skyline.fillPoints([
      { x: 0, y: 472 }, { x: 140, y: 370 }, { x: 285, y: 468 }, { x: 450, y: 335 },
      { x: 640, y: 470 }, { x: 850, y: 350 }, { x: 1050, y: 470 }, { x: 1250, y: 345 },
      { x: 1460, y: 465 }, { x: 1660, y: 355 }, { x: 1880, y: 475 },
      { x: WORLD_WIDTH + 500, y: 350 }, { x: WORLD_WIDTH + 500, y: 620 }, { x: 0, y: 620 }
    ], true);
    skyline.lineStyle(2, 0x6038a0, 0.38);
    skyline.lineBetween(0, 470, WORLD_WIDTH + 500, 470);

    const city = this.add.graphics().setDepth(-7).setScrollFactor(0.48);
    const neonColors = [NEON_PURPLE, NEON_CYAN, NEON_PINK, NEON_BLUE];
    let buildingX = -20;
    let buildingIndex = 0;
    while (buildingX < WORLD_WIDTH + 420) {
      const width = 54 + (buildingIndex * 23) % 52;
      const height = 125 + (buildingIndex * 47) % 190;
      const top = 488 - height;
      const color = neonColors[buildingIndex % neonColors.length];
      city.fillStyle(0x100b20, 0.94);
      city.fillRect(buildingX, top, width, height);
      city.lineStyle(2, color, 0.3);
      city.strokeRect(buildingX, top, width, height);
      city.lineStyle(1, color, 0.17);
      city.lineBetween(buildingX + width / 2, top + 10, buildingX + width / 2, 488);
      for (let row = 0; row < Math.floor((height - 24) / 24); row += 1) {
        for (let column = 0; column < Math.floor((width - 14) / 17); column += 1) {
          if ((buildingIndex * 7 + row * 3 + column * 5) % 4 === 0) continue;
          const window = this.add.rectangle(buildingX + 10 + column * 17, top + 15 + row * 24, 5, 8, color, 0.5)
            .setDepth(-6).setScrollFactor(0.48);
          if ((buildingIndex + row + column) % 13 === 0) {
            this.tweens.add({ targets: window, alpha: 0.12, duration: 850 + (row % 3) * 180, yoyo: true, repeat: -1 });
          }
        }
      }
      if (buildingIndex % 4 === 1) {
        city.lineStyle(4, NEON_PINK, 0.45);
        city.strokeRect(buildingX + width * 0.25, top + 26, width * 0.5, 24);
        city.lineStyle(2, NEON_CYAN, 0.7);
        city.lineBetween(buildingX + width * 0.32, top + 38, buildingX + width * 0.68, top + 38);
      }
      buildingX += width + 18;
      buildingIndex += 1;
    }

    const road = this.add.graphics().setDepth(-5).setScrollFactor(0.35);
    road.lineStyle(2, NEON_CYAN, 0.2);
    road.lineBetween(0, 492, WORLD_WIDTH + 500, 492);
    for (let index = 0; index <= 20; index += 1) road.lineBetween(index * 140, 610, WORLD_WIDTH / 2 + 250, 478);
    road.lineStyle(2, NEON_PINK, 0.18);
    road.lineBetween(0, 514, WORLD_WIDTH + 500, 514);

    let seed = 29;
    for (let index = 0; index < 90; index += 1) {
      seed = (seed * 16807) % 2147483647;
      const x = seed % (WORLD_WIDTH + 400);
      seed = (seed * 16807) % 2147483647;
      const y = 30 + (seed % 360);
      const star = this.add.circle(x, y, index % 8 === 0 ? 2 : 1, index % 3 === 0 ? NEON_CYAN : NEON_PURPLE, 0.42)
        .setDepth(-6).setScrollFactor(0.2);
      if (index % 7 === 0) this.tweens.add({ targets: star, alpha: 0.12, duration: 1100 + (index % 4) * 230, yoyo: true, repeat: -1 });
    }
  }

  createLevel(level) {
    level.platforms.forEach(({ x, top, width, height }) => this.addGround(x, top, width, height));
    this.lavaZones = level.lava;
    level.lava.forEach(({ x, width }) => this.addHazard(x, WORLD_HEIGHT - 84, width, 168));
    this.lavaGraphics = this.add.graphics().setDepth(1);
  }

  addGround(x, top, width, height = WORLD_HEIGHT - top) {
    const y = top + height / 2;
    const colors = [NEON_PURPLE, NEON_CYAN, NEON_PINK, NEON_PURPLE, NEON_CYAN];
    const edgeColor = colors[Math.floor(x / 400) % colors.length];
    this.add.rectangle(x + width / 2, y, width + 12, height + 8, edgeColor, 0.1).setDepth(-1);
    const block = this.add.rectangle(x + width / 2, y, width, height, 0x201536);
    block.setStrokeStyle(2, edgeColor);
    this.physics.add.existing(block, true);
    this.platforms.add(block);
    const turf = this.add.rectangle(x + width / 2, top + 4, width, 5, edgeColor).setDepth(1);
    turf.setStrokeStyle(1, 0xe7fbff);
    for (let mark = x + 22; mark < x + width; mark += 42) this.add.line(mark, top + 25, -5, 0, 5, 0, edgeColor, 0.38).setDepth(1);
  }

  addHazard(x, y, width, height) {
    const body = this.add.rectangle(x + width / 2, y, width, height, NEON_PINK, 0);
    this.physics.add.existing(body, true);
    this.hazards.add(body);
  }

  createPlayer(level) {
    const poses = {
      idle: { leftArm: [10, 32], rightArm: [30, 32], leftLeg: [14, 55], rightLeg: [26, 55] },
      walkA: { leftArm: [7, 25], rightArm: [31, 34], leftLeg: [11, 51], rightLeg: [29, 56] },
      walkB: { leftArm: [9, 35], rightArm: [33, 25], leftLeg: [12, 56], rightLeg: [28, 51] },
      jump: { leftArm: [8, 16], rightArm: [32, 16], leftLeg: [13, 53], rightLeg: [27, 49] },
      fall: { leftArm: [5, 23], rightArm: [35, 23], leftLeg: [12, 56], rightLeg: [28, 56] }
    };
    Object.entries(poses).forEach(([name, pose]) => this.createStickmanTexture(name, pose));
    const spawnPlatform = level.platforms.find((platform) => level.spawnX >= platform.x && level.spawnX < platform.x + platform.width);
    this.player = this.physics.add.sprite(level.spawnX, spawnPlatform.top - 24, 'stickman-idle');
    this.player.setDepth(5).setCollideWorldBounds(true);
    this.player.body.setSize(22, 48).setOffset(9, 6);
    this.player.body.setFrictionX(1);
    this.player.setMaxVelocity(250, 800).setDragX(2400);
    this.currentAnimation = 'idle';
  }

  createStickmanTexture(name, pose) {
    const art = this.make.graphics({ x: 0, y: 0, add: false });
    const lines = [[20, 20, 20, 40], [20, 25, ...pose.leftArm], [20, 25, ...pose.rightArm], [20, 40, ...pose.leftLeg], [20, 40, ...pose.rightLeg]];
    for (const [width, alpha, color] of [[10, 0.1, NEON_CYAN], [6, 0.28, NEON_CYAN], [3, 1, NEON_CYAN], [1, 1, 0xe5fcff]]) {
      art.lineStyle(width, color, alpha);
      lines.forEach(([x1, y1, x2, y2]) => art.lineBetween(x1, y1, x2, y2));
    }
    art.fillStyle(0x100b20, 1);
    art.fillCircle(20, 11, 7);
    art.lineStyle(8, NEON_CYAN, 0.12);
    art.strokeCircle(20, 11, 8);
    art.lineStyle(3, NEON_CYAN, 1);
    art.strokeCircle(20, 11, 7);
    art.lineStyle(1, 0xe5fcff, 1);
    art.strokeCircle(20, 11, 5.5);
    art.generateTexture(`stickman-${name}`, 40, 60);
    art.destroy();
  }

  createEnemies(enemyDefinitions) {
    for (let frame = 0; frame < 2; frame += 1) {
      const monster = this.make.graphics({ x: 0, y: 0, add: false });
      monster.fillStyle(NEON_PURPLE, 0.16);
      monster.fillCircle(20, 20, 22);
      monster.fillStyle(0x1c1233, 1);
      monster.fillRoundedRect(2, 8, 36, 27, 8);
      monster.lineStyle(7, NEON_PINK, 0.18);
      monster.strokeRoundedRect(2, 8, 36, 27, 8);
      monster.lineStyle(2, NEON_PINK, 1);
      monster.strokeRoundedRect(2, 8, 36, 27, 8);
      monster.lineStyle(2, NEON_CYAN, 1);
      monster.lineBetween(5, 13, 3, 2);
      monster.lineBetween(3, 2, 15, 10);
      monster.lineBetween(24, 10, 36, 2);
      monster.lineBetween(36, 2, 34, 15);
      monster.fillStyle(0xe9fcff, 1);
      monster.fillCircle(13, 18, 4);
      monster.fillCircle(28, 18, 4);
      monster.fillStyle(NEON_PINK, 1);
      monster.fillCircle(14, 18, 1.5);
      monster.fillCircle(27, 18, 1.5);
      monster.lineStyle(3, NEON_CYAN, 1);
      const footShift = frame === 0 ? -3 : 3;
      monster.lineBetween(12, 33, 9 + footShift, 38);
      monster.lineBetween(28, 33, 31 - footShift, 38);
      monster.generateTexture(`monster-walk-${frame}`, 40, 40);
      monster.destroy();
    }

    enemyDefinitions.forEach((definition, index) => {
      const enemy = this.physics.add.sprite(definition.x, definition.top - 20, 'monster-walk-0');
      enemy.setDepth(4).setCollideWorldBounds(true);
      enemy.body.setSize(32, 30).setOffset(4, 6);
      enemy.body.setDragX(900);
      enemy.setMaxVelocity(definition.chaseSpeed, 400);
      enemy.setBounce(0);
      enemy.patrol = definition;
      enemy.patrolDirection = index % 2 === 0 ? 1 : -1;
      enemy.chaseUntil = 0;
      enemy.nextChaseAllowedAt = 0;
      enemy.lastChaseAt = -Infinity;
      enemy.animationFrame = 0;
      this.enemyGroup.add(enemy);
      this.enemies.push(enemy);
    });
  }

  createDragonBossLegacy(config) {
    this.dragonConfig = config;
    this.dragonRoot = this.add.container(config.x, config.y).setDepth(6);
    this.dragonBodyArt = this.add.graphics();
    const neonTube = (graphics, controls, color, width = 3, closed = false) => {
      const extended = closed
        ? [controls[controls.length - 1], ...controls, controls[0], controls[1]]
        : [controls[0], ...controls, controls[controls.length - 1]];
      const segmentCount = closed ? controls.length : controls.length - 1;
      const samples = [];
      for (let segment = 0; segment < segmentCount; segment += 1) {
        const p0 = extended[segment];
        const p1 = extended[segment + 1];
        const p2 = extended[segment + 2];
        const p3 = extended[segment + 3];
        for (let step = 0; step < 8; step += 1) {
          const t = step / 8;
          const t2 = t * t;
          const t3 = t2 * t;
          const smooth = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
          samples.push({ x: smooth(p0.x, p1.x, p2.x, p3.x), y: smooth(p0.y, p1.y, p2.y, p3.y) });
        }
      }
      samples.push(closed ? controls[0] : controls[controls.length - 1]);
      for (const [lineWidth, lineColor, alpha] of [[width * 4.5, color, 0.1], [width, color, 1], [Math.max(1, width * 0.32), 0xf2fff7, 0.88]]) {
        graphics.lineStyle(lineWidth, lineColor, alpha);
        graphics.beginPath();
        graphics.moveTo(samples[0].x, samples[0].y);
        samples.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
        graphics.strokePath();
      }
    };

    const farWingPivot = this.add.container(-40, -24);
    const farWing = this.add.graphics().setPosition(40, 24);
    neonTube(farWing, [
      { x: -40, y: -24 }, { x: -67, y: -86 }, { x: -109, y: -149 }, { x: -180, y: -224 },
      { x: -147, y: -148 }, { x: -205, y: -176 }, { x: -151, y: -111 }, { x: -222, y: -118 },
      { x: -143, y: -67 }, { x: -78, y: -32 }, { x: -40, y: -24 }
    ], NEON_PURPLE, 3.2, true);
    for (const rib of [
      [{ x: -40, y: -24 }, { x: -109, y: -149 }, { x: -180, y: -224 }],
      [{ x: -40, y: -24 }, { x: -147, y: -148 }, { x: -205, y: -176 }],
      [{ x: -40, y: -24 }, { x: -151, y: -111 }, { x: -222, y: -118 }],
      [{ x: -40, y: -24 }, { x: -143, y: -67 }]
    ]) neonTube(farWing, rib, NEON_PURPLE, 2.4);
    farWingPivot.add(farWing);
    this.dragonRoot.add(farWingPivot);

    const nearWingPivot = this.add.container(-8, -27);
    const nearWing = this.add.graphics().setPosition(8, 27);
    neonTube(nearWing, [
      { x: -8, y: -27 }, { x: 8, y: -91 }, { x: 49, y: -150 }, { x: 103, y: -231 },
      { x: 92, y: -151 }, { x: 157, y: -192 }, { x: 132, y: -116 }, { x: 211, y: -143 },
      { x: 151, y: -65 }, { x: 78, y: -34 }, { x: -8, y: -27 }
    ], NEON_PURPLE, 3.5, true);
    for (const rib of [
      [{ x: -8, y: -27 }, { x: 49, y: -150 }, { x: 103, y: -231 }],
      [{ x: -8, y: -27 }, { x: 92, y: -151 }, { x: 157, y: -192 }],
      [{ x: -8, y: -27 }, { x: 132, y: -116 }, { x: 211, y: -143 }],
      [{ x: -8, y: -27 }, { x: 151, y: -65 }]
    ]) neonTube(nearWing, rib, NEON_PURPLE, 2.5);
    nearWingPivot.add(nearWing);
    this.dragonRoot.add(nearWingPivot);

    this.dragonTailPivot = this.add.container(43, 9);
    this.dragonTailArt = this.add.graphics();
    this.dragonTailArt.setScale(0.75, 1);
    neonTube(this.dragonTailArt, [
      { x: -2, y: 0 }, { x: 33, y: 9 }, { x: 70, y: 11 }, { x: 106, y: 5 },
      { x: 140, y: -7 }, { x: 172, y: -24 }, { x: 201, y: -47 }, { x: 187, y: -15 },
      { x: 224, y: -31 }, { x: 204, y: -3 }, { x: 174, y: 17 }, { x: 139, y: 28 },
      { x: 99, y: 27 }, { x: 58, y: 19 }, { x: 22, y: 12 }, { x: -2, y: 0 }
    ], NEON_GREEN, 3.1, true);
    for (let index = 0; index < 6; index += 1) {
      const x = 65 + index * 21;
      neonTube(this.dragonTailArt, [
        { x, y: 13 - index * 1.8 }, { x: x + 8, y: -4 - index * 1.8 }, { x: x + 15, y: 8 - index * 1.8 }
      ], NEON_GREEN, 2.2);
    }
    this.dragonTailPivot.add(this.dragonTailArt);
    this.dragonRoot.add(this.dragonTailPivot);
    this.tweens.add({ targets: this.dragonTailPivot, angle: -4, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.dragonBodyArt = this.add.graphics();
    neonTube(this.dragonBodyArt, [
      { x: 64, y: 5 }, { x: 50, y: -17 }, { x: 27, y: -31 }, { x: 0, y: -35 },
      { x: -29, y: -30 }, { x: -53, y: -15 }, { x: -70, y: 1 }, { x: -51, y: 15 },
      { x: -25, y: 28 }, { x: 7, y: 32 }, { x: 37, y: 24 }, { x: 58, y: 12 }, { x: 64, y: 5 }
    ], NEON_GREEN, 3.2, true);
    neonTube(this.dragonBodyArt, [
      { x: -51, y: -16 }, { x: -72, y: -36 }, { x: -96, y: -47 }, { x: -119, y: -44 },
      { x: -142, y: -30 }, { x: -158, y: -15 }
    ], NEON_GREEN, 3.2);
    neonTube(this.dragonBodyArt, [
      { x: -52, y: 8 }, { x: -76, y: 2 }, { x: -98, y: -2 }, { x: -119, y: 1 }, { x: -140, y: 9 }
    ], NEON_GREEN, 3);
    this.dragonRoot.add(this.dragonBodyArt);

    const bellyArt = this.add.graphics();
    neonTube(bellyArt, [
      { x: -61, y: 9 }, { x: -39, y: 22 }, { x: -11, y: 29 }, { x: 18, y: 28 }, { x: 43, y: 18 }
    ], 0xf4fff8, 2.5);
    neonTube(bellyArt, [
      { x: -88, y: -1 }, { x: -71, y: -8 }, { x: -56, y: -7 }
    ], 0xf4fff8, 1.8);
    this.dragonRoot.add(bellyArt);

    const backSpikes = this.add.graphics();
    for (let index = 0; index < 7; index += 1) {
      const x = -39 + index * 17;
      neonTube(backSpikes, [
        { x, y: -27 + index * 1.6 }, { x: x + 5, y: -45 + index * 1.5 }, { x: x + 11, y: -25 + index * 1.6 }
      ], NEON_GREEN, 2.1);
    }
    this.dragonRoot.add(backSpikes);

    const legs = this.add.graphics();
    const legPaths = [
      [{ x: -45, y: 5 }, { x: -55, y: 23 }, { x: -67, y: 43 }, { x: -82, y: 51 }, { x: -101, y: 51 }, { x: -111, y: 58 }, { x: -96, y: 56 }, { x: -102, y: 66 }, { x: -87, y: 58 }, { x: -79, y: 66 }, { x: -78, y: 51 }],
      [{ x: -24, y: 20 }, { x: -28, y: 38 }, { x: -39, y: 53 }, { x: -56, y: 59 }, { x: -68, y: 66 }, { x: -53, y: 63 }, { x: -53, y: 72 }, { x: -42, y: 62 }, { x: -32, y: 70 }, { x: -34, y: 55 }],
      [{ x: 30, y: 16 }, { x: 37, y: 36 }, { x: 29, y: 52 }, { x: 11, y: 59 }, { x: 2, y: 67 }, { x: 17, y: 63 }, { x: 17, y: 72 }, { x: 28, y: 62 }, { x: 39, y: 68 }, { x: 38, y: 51 }],
      [{ x: 51, y: 4 }, { x: 62, y: 25 }, { x: 58, y: 43 }, { x: 42, y: 51 }, { x: 35, y: 59 }, { x: 48, y: 56 }, { x: 50, y: 65 }, { x: 59, y: 53 }, { x: 70, y: 58 }, { x: 67, y: 41 }]
    ];
    legPaths.forEach((path) => neonTube(legs, path, NEON_GREEN, 2.8));
    this.dragonRoot.add(legs);

    this.dragonHeadPivot = this.add.container(-103, -45);
    this.dragonHeadArt = this.add.graphics();
    neonTube(this.dragonHeadArt, [
      { x: -10, y: 5 }, { x: -25, y: -10 }, { x: -44, y: -19 }, { x: -65, y: -20 },
      { x: -83, y: -14 }, { x: -101, y: -15 }, { x: -123, y: -8 }, { x: -106, y: -2 },
      { x: -91, y: 0 }, { x: -81, y: 9 }, { x: -61, y: 12 }, { x: -39, y: 8 }, { x: -10, y: 5 }
    ], NEON_GREEN, 3, true);
    neonTube(this.dragonHeadArt, [
      { x: -43, y: -19 }, { x: -59, y: -43 }, { x: -55, y: -21 }, { x: -73, y: -36 }, { x: -67, y: -15 }
    ], NEON_GREEN, 2.5);
    neonTube(this.dragonHeadArt, [
      { x: -81, y: -14 }, { x: -94, y: -30 }, { x: -91, y: -11 }
    ], NEON_GREEN, 2.3);
    neonTube(this.dragonHeadArt, [
      { x: -110, y: -3 }, { x: -119, y: -2 }, { x: -113, y: 1 }
    ], NEON_GREEN, 1.7);
    neonTube(this.dragonHeadArt, [
      { x: -110, y: 3 }, { x: -102, y: 5 }, { x: -107, y: 10 },
      { x: -88, y: 5 }, { x: -94, y: 12 }, { x: -76, y: 7 }
    ], 0xf4fff8, 1.25);
    this.dragonHeadArt.fillStyle(NEON_GREEN, 1);
    this.dragonHeadArt.fillCircle(-73, -11, 2.2);
    this.dragonHeadArt.fillStyle(0xf4fff8, 1);
    this.dragonHeadArt.fillCircle(-72, -11, 0.9);
    this.dragonHeadPivot.add(this.dragonHeadArt);

    this.dragonJawPivot = this.add.container(-82, 5);
    this.dragonJawArt = this.add.graphics();
    neonTube(this.dragonJawArt, [
      { x: -4, y: 0 }, { x: -24, y: 5 }, { x: -42, y: 10 }, { x: -62, y: 9 }, { x: -78, y: 3 }
    ], NEON_GREEN, 2.4);
    neonTube(this.dragonJawArt, [
      { x: -32, y: 6 }, { x: -27, y: 13 }, { x: -21, y: 6 }, { x: -10, y: 7 }, { x: -5, y: 13 }, { x: 1, y: 6 }
    ], 0xf4fff8, 1.2);
    this.dragonHeadPivot.add(this.dragonJawPivot);
    this.dragonRoot.add(this.dragonHeadPivot);

    this.dragonMouthCharge = this.add.graphics();
    this.dragonMouthCharge.fillStyle(NEON_GREEN, 0.95);
    this.dragonMouthCharge.fillTriangle(-120, -4, -96, -5, -113, 1);
    this.dragonMouthCharge.lineStyle(7, NEON_GREEN, 0.28);
    this.dragonMouthCharge.strokeTriangle(-120, -4, -96, -5, -113, 1);
    this.dragonMouthCharge.setVisible(false);
    this.dragonHeadPivot.add(this.dragonMouthCharge);

    this.dragonWhiteFlash = this.add.graphics().setAlpha(0).setDepth(2);
    neonTube(this.dragonWhiteFlash, [
      { x: 64, y: 5 }, { x: 50, y: -17 }, { x: 27, y: -31 }, { x: 0, y: -35 },
      { x: -29, y: -30 }, { x: -53, y: -15 }, { x: -70, y: 1 }, { x: -51, y: 15 },
      { x: -25, y: 28 }, { x: 7, y: 32 }, { x: 37, y: 24 }, { x: 58, y: 12 }, { x: 64, y: 5 }
    ], 0xffffff, 4.2, true);
    this.dragonRoot.add(this.dragonWhiteFlash);

    this.dragonWings = [nearWingPivot, farWingPivot];
    this.tweens.add({ targets: nearWingPivot, angle: -7, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: farWingPivot, angle: 6, duration: 1080, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: this.dragonRoot, scaleY: 1.012, duration: 1350, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: this.dragonBodyArt, alpha: 0.74, duration: 1150, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.dragonHitBounds = new Phaser.Geom.Rectangle(config.x - 222, config.y - 220, 432, 306);
    this.nextDragonAttackAt = 0;
    this.dragonTutorialUntil = 0;
    this.dragonCharging = false;
    this.publishDragonState('BUILD A WALL TO BLOCK THE FIREBALL!', false);
  }

  createDragonBoss(config) {
    this.dragonConfig = config;
    this.dragonRoot = this.add.container(config.x, config.y).setDepth(6);

    const spriteWidth = 540;
    const spriteHeight = 420;
    const spriteTop = -45;
    const spriteLeft = -spriteWidth / 2;
    const spriteTopLeft = spriteTop - spriteHeight / 2;
    const scaleX = spriteWidth / 768;
    const scaleY = spriteHeight / 768;
    const hingeX = (291 - 384) * scaleX;
    const hingeY = (406 - 384) * scaleY + spriteTop;

    const wingPivot = this.add.container(hingeX, hingeY);
    const wingSprite = this.add.image(spriteLeft - hingeX, spriteTopLeft - hingeY, 'neon-dragon-wing')
      .setOrigin(0, 0)
      .setDisplaySize(spriteWidth, spriteHeight);
    wingPivot.add(wingSprite);
    this.dragonRoot.add(wingPivot);
    this.dragonWings = [wingPivot];

    this.dragonBodyArt = this.add.image(0, spriteTop, 'neon-dragon-body').setDisplaySize(spriteWidth, spriteHeight);
    this.dragonHeadPivot = this.add.container(0, 0);
    this.dragonHeadPivot.add(this.dragonBodyArt);
    this.dragonRoot.add(this.dragonHeadPivot);
    this.dragonHeadArt = this.dragonBodyArt;
    this.dragonTailArt = this.dragonBodyArt;
    this.dragonTailPivot = this.add.container(0, 0);
    this.dragonRoot.add(this.dragonTailPivot);

    this.dragonJawPivot = this.add.container(-165, -88);
    this.dragonJawArt = this.add.graphics();
    this.dragonJawArt.lineStyle(3, NEON_GREEN, 0.9);
    this.dragonJawArt.lineBetween(-9, 1, 5, -1);
    this.dragonJawArt.lineStyle(8, NEON_GREEN, 0.18);
    this.dragonJawArt.lineBetween(-9, 1, 5, -1);
    this.dragonJawPivot.add(this.dragonJawArt);
    this.dragonRoot.add(this.dragonJawPivot);

    this.dragonMouthCharge = this.add.graphics();
    this.dragonMouthCharge.fillStyle(NEON_GREEN, 0.92);
    this.dragonMouthCharge.fillEllipse(-168, -98, 17, 5);
    this.dragonMouthCharge.lineStyle(8, NEON_GREEN, 0.28);
    this.dragonMouthCharge.strokeEllipse(-168, -98, 17, 5);
    this.dragonMouthCharge.setVisible(false);
    this.dragonRoot.add(this.dragonMouthCharge);

    this.dragonWhiteFlash = this.add.image(0, spriteTop, 'neon-dragon-body')
      .setDisplaySize(spriteWidth, spriteHeight)
      .setTintFill(0xffffff)
      .setAlpha(0)
      .setDepth(2);
    this.dragonRoot.add(this.dragonWhiteFlash);

    this.tweens.add({ targets: wingPivot, angle: -8, duration: 880, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: this.dragonRoot, scaleY: 1.012, duration: 1350, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: this.dragonBodyArt, alpha: 0.74, duration: 1150, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.dragonHitBounds = new Phaser.Geom.Rectangle(config.x - 222, config.y - 220, 432, 306);
    this.nextDragonAttackAt = 0;
    this.dragonTutorialUntil = 0;
    this.dragonCharging = false;
    this.publishDragonState('BUILD A WALL TO BLOCK THE FIREBALL!', false);
  }

  publishDragonState(cue, warning = false) {
    if (!this.level.boss || (this.dragonCue === cue && this.dragonWarning === warning)) return;
    this.dragonCue = cue;
    this.dragonWarning = warning;
    window.dispatchEvent(new CustomEvent('dragon-state', { detail: { hp: this.dragonHp, cue, warning } }));
  }

  createDragonFireball(x, y, vx, vy) {
    const trail = this.add.graphics();
    trail.lineStyle(16, NEON_PINK, 0.13);
    trail.lineBetween(-32, 0, 0, 0);
    trail.lineStyle(5, NEON_ORANGE, 0.46);
    trail.lineBetween(-29, 0, 0, 0);
    const glow = this.add.circle(0, 0, 16, NEON_PINK, 0.24);
    const core = this.add.circle(0, 0, 8, NEON_ORANGE, 1).setStrokeStyle(2, 0xffe2a3);
    const view = this.add.container(x, y, [trail, glow, core]).setDepth(7);
    this.tweens.add({ targets: glow, scale: 1.35, alpha: 0.1, duration: 240, yoyo: true, repeat: -1 });
    const fireball = { x, y, vx, vy, view, trail, glow, core, reflected: false, resolved: false, radius: 12, age: 0 };
    this.fireballs.push(fireball);
    return fireball;
  }

  reflectDragonFireball(fireball, wall) {
    if (fireball.reflected || fireball.resolved) return;
    fireball.reflected = true;
    const targetX = this.dragonConfig.x - 88;
    const targetY = this.dragonConfig.y - 42;
    const dx = targetX - fireball.x;
    const dy = targetY - fireball.y;
    const length = Math.hypot(dx, dy) || 1;
    fireball.vx = (dx / length) * 440;
    fireball.vy = (dy / length) * 440;
    fireball.core.setFillStyle(NEON_CYAN, 1).setStrokeStyle(2, 0xe7fbff);
    fireball.glow.setFillStyle(NEON_CYAN, 0.28);
    fireball.trail.clear();
    fireball.trail.lineStyle(16, NEON_CYAN, 0.16);
    fireball.trail.lineBetween(-32, 0, 0, 0);
    fireball.trail.lineStyle(5, 0xe7fbff, 0.72);
    fireball.trail.lineBetween(-29, 0, 0, 0);
    this.removePiece(wall, true);
    this.publishCount();
    const flash = this.add.circle(fireball.x, fireball.y, 25, NEON_CYAN, 0.9).setDepth(9);
    this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 240, onComplete: () => flash.destroy() });
    this.emitBurst(fireball.x, fireball.y, NEON_CYAN, 13);
  }

  handleDragonHit(fireball) {
    if (!fireball.reflected || fireball.resolved) return;
    fireball.resolved = true;
    this.dragonHp = Math.max(0, this.dragonHp - 1);
    this.destroyDragonFireball(fireball);
    this.publishDragonState(this.dragonHp > 0 ? 'FIREBALL REFLECTED — BUILD ANOTHER WALL!' : 'DRAGON DEFEATED!', false);
    const flash = this.add.circle(this.dragonConfig.x - 65, this.dragonConfig.y - 20, 88, NEON_CYAN, 0.78).setDepth(8);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.45, duration: 250, onComplete: () => flash.destroy() });
    this.dragonWhiteFlash.setAlpha(0.95);
    this.tweens.add({ targets: this.dragonWhiteFlash, alpha: 0, duration: 180, ease: 'Quad.Out' });
    this.tweens.add({ targets: this.dragonRoot, x: this.dragonConfig.x + 15, duration: 45, yoyo: true, repeat: 3 });
    this.tweens.add({ targets: this.dragonHeadPivot, x: -6, duration: 55, yoyo: true, repeat: 3, ease: 'Quad.Out' });
    this.emitBurst(this.dragonConfig.x - 55, this.dragonConfig.y - 25, NEON_PINK, 12);
    window.dispatchEvent(new CustomEvent('dragon-state', { detail: { hp: this.dragonHp, cue: this.dragonHp > 0 ? 'FIREBALL REFLECTED — BUILD ANOTHER WALL!' : 'DRAGON DEFEATED!', warning: false } }));
    if (this.dragonHp === 0) this.defeatDragon();
  }

  defeatDragon() {
    if (this.dragonDefeated) return;
    this.dragonDefeated = true;
    this.state = 'boss-defeating';
    this.physics.world.pause();
    this.tweens.killTweensOf(this.dragonRoot);
    this.dragonWings.forEach((wing) => this.tweens.killTweensOf(wing));
    this.fireballs.forEach((fireball) => this.destroyDragonFireball(fireball));
    this.dragonRoot.setDepth(8);
    this.emitBurst(this.dragonConfig.x - 45, this.dragonConfig.y - 20, NEON_CYAN, 32);
    this.emitBurst(this.dragonConfig.x - 45, this.dragonConfig.y - 20, NEON_PINK, 24);
    this.dragonWings.forEach((wing, index) => {
      this.tweens.add({ targets: wing, x: wing.x + (index === 0 ? -38 : 38), y: wing.y - 26, angle: index === 0 ? -24 : 24, alpha: 0, duration: 1150, ease: 'Cubic.In' });
    });
    this.tweens.add({
      targets: this.dragonRoot,
      alpha: 0.12,
      duration: 75,
      yoyo: true,
      repeat: 5,
      onComplete: () => this.tweens.add({
        targets: this.dragonRoot,
        angle: 24,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 0.4,
        y: this.dragonConfig.y + 90,
        duration: 1050,
        ease: 'Cubic.In'
      })
    });
    this.time.delayedCall(950, () => {
      window.dispatchEvent(new CustomEvent('dragon-message', { detail: { title: 'DRAGON DEFEATED!', message: 'The neon fire fades.' } }));
    });
    this.time.delayedCall(2450, () => {
      window.dispatchEvent(new CustomEvent('dragon-message', { detail: { title: 'LEVEL 5 COMPLETE!', message: 'The city is safe.' } }));
    });
    this.time.delayedCall(3900, () => {
      this.dragonSequenceFinished = true;
      this.state = 'playing';
      this.endLevel(true);
    });
  }

  destroyDragonFireball(fireball) {
    if (!fireball || fireball.resolved && !fireball.view.active) return;
    fireball.resolved = true;
    fireball.view.destroy();
    this.fireballs = this.fireballs.filter((item) => item !== fireball);
  }

  updateDragon(time, delta) {
    if (!this.dragonConfig || this.dragonDefeated) return;
    const horizontalDistance = Math.abs(this.dragonConfig.x - this.player.x);
    const inRange = horizontalDistance > 100 && horizontalDistance < this.dragonConfig.triggerRange &&
      Math.abs(this.player.y - this.dragonConfig.y) < 260;
    if (inRange) this.dragonRoot.scaleX = this.player.x < this.dragonConfig.x ? 1 : -1;
    if (inRange && this.nextDragonAttackAt === 0) {
      this.nextDragonAttackAt = time + 1800;
      this.dragonTutorialUntil = time + 5200;
    }
    const untilAttack = this.nextDragonAttackAt - time;
    const charging = inRange && this.fireballs.length === 0 && untilAttack > 0 && untilAttack <= 720;
    if (charging && !this.dragonCharging) {
      this.dragonCharging = true;
      this.dragonHeadPivot.x = -6;
      this.dragonJawPivot.y = -80;
      this.dragonJawPivot.angle = -7;
      this.dragonMouthCharge.setVisible(true).setScale(0.75);
      this.tweens.add({ targets: this.dragonMouthCharge, scale: 1.35, alpha: 0.5, duration: 180, yoyo: true, repeat: -1 });
      this.publishDragonState('DRAGON CHARGING — BUILD A WALL!', true);
    }
    if (inRange && time >= this.nextDragonAttackAt && this.fireballs.length === 0) {
      const attackDirection = this.player.x < this.dragonConfig.x ? -1 : 1;
      this.dragonRoot.scaleX = attackDirection < 0 ? 1 : -1;
      this.dragonCharging = false;
      this.tweens.killTweensOf(this.dragonMouthCharge);
      this.dragonMouthCharge.setVisible(false).setScale(1).setAlpha(1);
      this.dragonHeadPivot.x = 0;
      this.dragonJawPivot.setPosition(-165, -88).setAngle(0);
      this.tweens.add({ targets: this.dragonHeadPivot, x: -12, duration: 90, yoyo: true, ease: 'Quad.Out' });
      const startX = this.dragonConfig.x + attackDirection * 207;
      const startY = this.dragonConfig.y - 51;
      const targetX = this.player.x;
      const targetY = this.player.y - 8;
      const angle = Math.atan2(targetY - startY, targetX - startX);
      this.createDragonFireball(startX, startY, Math.cos(angle) * this.dragonConfig.fireballSpeed, Math.sin(angle) * this.dragonConfig.fireballSpeed);
      this.nextDragonAttackAt = time + this.dragonConfig.cooldown;
      this.publishDragonState('FIREBALL OUT — REFLECT IT WITH A WALL!', false);
    } else if (charging) {
      this.publishDragonState('DRAGON CHARGING — BUILD A WALL!', true);
    } else if (time < this.dragonTutorialUntil) {
      this.publishDragonState('BUILD A WALL TO BLOCK THE FIREBALL!', false);
    }

    for (const fireball of [...this.fireballs]) {
      fireball.age += delta;
      fireball.x += fireball.vx * delta / 1000;
      fireball.y += fireball.vy * delta / 1000;
      fireball.view.setPosition(fireball.x, fireball.y);
      fireball.trail.rotation = Math.atan2(fireball.vy, fireball.vx);

      if (!fireball.reflected) {
        const wall = this.builtPieces.find((piece) => piece.mode === 'wall' &&
          Phaser.Geom.Intersects.CircleToRectangle(new Phaser.Geom.Circle(fireball.x, fireball.y, fireball.radius), piece.bounds));
        if (wall) {
          this.reflectDragonFireball(fireball, wall);
          continue;
        }
        const playerBounds = new Phaser.Geom.Rectangle(this.player.body.x, this.player.body.y, this.player.body.width, this.player.body.height);
        if (Phaser.Geom.Intersects.CircleToRectangle(new Phaser.Geom.Circle(fireball.x, fireball.y, fireball.radius), playerBounds)) {
          this.destroyDragonFireball(fireball);
          this.endLevel(false);
          return;
        }
      } else if (Phaser.Geom.Intersects.CircleToRectangle(new Phaser.Geom.Circle(fireball.x, fireball.y, fireball.radius), this.dragonHitBounds)) {
        this.handleDragonHit(fireball);
        continue;
      }

      if (fireball.age > 8000 || fireball.x < 0 || fireball.x > WORLD_WIDTH || fireball.y < 0 || fireball.y > WORLD_HEIGHT) {
        this.destroyDragonFireball(fireball);
      }
    }
  }

  createFinish(finishX, surfaceTop) {
    const flag = this.add.graphics().setDepth(2);
    flag.lineStyle(10, NEON_CYAN, 0.16);
    flag.lineBetween(finishX, surfaceTop, finishX, surfaceTop - 82);
    flag.lineStyle(3, NEON_CYAN, 1);
    flag.lineBetween(finishX, surfaceTop, finishX, surfaceTop - 82);
    flag.fillStyle(NEON_PURPLE, 1);
    flag.fillPoints([{ x: finishX + 2, y: surfaceTop - 80 }, { x: finishX + 52, y: surfaceTop - 68 }, { x: finishX + 2, y: surfaceTop - 50 }], true);
    flag.lineStyle(8, NEON_PINK, 0.18);
    flag.strokePoints([{ x: finishX + 2, y: surfaceTop - 80 }, { x: finishX + 52, y: surfaceTop - 68 }, { x: finishX + 2, y: surfaceTop - 50 }], true);
    flag.lineStyle(2, NEON_PINK, 1);
    flag.strokePoints([{ x: finishX + 2, y: surfaceTop - 80 }, { x: finishX + 52, y: surfaceTop - 68 }, { x: finishX + 2, y: surfaceTop - 50 }], true);
    this.finishZone = this.add.rectangle(finishX, surfaceTop - 42, 34, 84, 0xffffff, 0);
    this.physics.add.existing(this.finishZone, true);
  }

  createBuildPreview() {
    this.preview = this.add.graphics().setDepth(8);
  }

  createStatusMessage() {
    this.message = this.add.container(480, 280).setScrollFactor(0).setDepth(20).setVisible(false);
    const panel = this.add.rectangle(0, 0, 330, 130, 0xf4f7f2, 0.96).setStrokeStyle(2, 0x17201e);
    const title = this.add.text(0, -22, '', {
      fontFamily: 'Barlow Condensed, sans-serif', fontSize: '38px', fontStyle: '800', color: '#17201e'
    }).setOrigin(0.5);
    const hint = this.add.text(0, 28, 'CLICK HERE OR PRESS PLAY TO TRY AGAIN', {
      fontFamily: 'DM Mono, monospace', fontSize: '9px', color: '#53635a'
    }).setOrigin(0.5);
    this.message.add([panel, title, hint]);
    this.messageTitle = title;
    this.messageHint = hint;
    panel.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.handleAction(this.state === 'won' ? 'restart' : 'play'));
  }

  handleAction(action) {
    if (action.action === 'asset-visual-check' && this.level.boss && this.state === 'playing') {
      this.player.setPosition(2240, 488).setVelocity(0, 0);
      this.physics.world.pause();
      this.cameras.main.stopFollow();
      this.cameras.main.centerOn(this.dragonConfig.x, this.dragonConfig.y);
      window.dispatchEvent(new CustomEvent('asset-visual-result', {
        detail: { bodyTexture: this.dragonBodyArt.texture.key, wingTexture: this.dragonWings[0].list[0].texture.key }
      }));
      return;
    }
    if (action.action === 'start-level') {
      const requestedLevel = Number(action.levelIndex);
      const unlockedLevel = this.getUnlockedLevel();
      if ((this.state === 'ready' || this.state === 'selecting') && Number.isInteger(requestedLevel) && requestedLevel >= 0 && requestedLevel <= unlockedLevel) {
        this.scene.restart({ levelIndex: requestedLevel, autoStart: true });
      }
      return;
    }
    if (action.action === 'next-level') {
      if (this.state === 'won' && this.levelIndex < LEVELS.length - 1) {
        const nextLevel = this.levelIndex + 1;
        this.saveUnlockedLevel(nextLevel);
        this.scene.restart({ levelIndex: nextLevel, autoStart: true });
      }
      return;
    }
    if (action.action === 'restart') {
      this.restartLevel();
      return;
    }
    if (action.action === 'level-select') {
      this.state = 'selecting';
      this.physics.world.pause();
      this.publishLevelState();
      return;
    }
    if (action.action === 'select-piece' && Object.hasOwn(this.inventory, action.piece)) {
      this.buildMode = action.piece;
      this.publishCount();
      return;
    }
    if (action.action === 'pause') {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.physics.world.pause();
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this.physics.world.resume();
      }
      this.publishLevelState();
      return;
    }
  }

  startLevel() {
    this.state = 'playing';
    this.physics.world.resume();
    if (this.level.boss) {
      this.nextDragonAttackAt = 0;
      this.dragonTutorialUntil = this.time.now + 5200;
      this.publishDragonState('BUILD A WALL TO BLOCK THE FIREBALL!', false);
    }
    this.publishLevelState();
  }

  restartLevel() {
    this.scene.restart({ levelIndex: this.levelIndex, autoStart: true });
  }

  endLevel(won) {
    if (this.state !== 'playing' && !(won && this.state === 'boss-defeating' && this.dragonSequenceFinished)) return;
    if (won) this.saveUnlockedLevel(Math.min(LEVELS.length - 1, this.levelIndex + 1));
    this.state = won ? (this.levelIndex === LEVELS.length - 1 ? 'victory' : 'won') : 'lost';
    this.physics.world.pause();
    this.publishLevelState();
  }

  getUnlockedLevel() {
    try {
      const stored = Number(window.localStorage.getItem(PROGRESS_KEY));
      if (Number.isInteger(stored)) fallbackUnlockedLevel = Phaser.Math.Clamp(stored, 0, LEVELS.length - 1);
    } catch {
      return fallbackUnlockedLevel;
    }
    return fallbackUnlockedLevel;
  }

  saveUnlockedLevel(levelIndex) {
    fallbackUnlockedLevel = Math.max(fallbackUnlockedLevel, Phaser.Math.Clamp(levelIndex, 0, LEVELS.length - 1));
    try {
      window.localStorage.setItem(PROGRESS_KEY, String(fallbackUnlockedLevel));
    } catch {}
    window.dispatchEvent(new CustomEvent('level-progress', { detail: { unlockedLevel: fallbackUnlockedLevel } }));
    return fallbackUnlockedLevel;
  }

  publishLevelState() {
    window.dispatchEvent(new CustomEvent('level-state', {
      detail: { state: this.state, levelIndex: this.levelIndex, levelCount: LEVELS.length, levelName: this.level.name }
    }));
  }

  handlePointer(pointer) {
    if (this.state !== 'playing') return;
    const point = pointer.positionToCamera(this.cameras.main);
    const piece = this.builtPieces.find((item) =>
      Phaser.Geom.Rectangle.Contains(item.bounds, point.x, point.y)
    );
    if (piece) {
      this.removePiece(piece, true);
      this.publishCount();
      return;
    }
    if (pointer.button === 2 || pointer.event.shiftKey) return;
    const candidate = this.getBuildCandidate(point);
    if (candidate.valid) this.placePiece(candidate);
  }

  getBuildCandidate(point) {
    const size = BUILD_SIZES[this.buildMode];
    const left = Math.floor(point.x / GRID) * GRID;
    const top = Math.floor(point.y / GRID) * GRID;
    const bounds = new Phaser.Geom.Rectangle(left, top, size.width, size.height);
    const overlaps = (first, second) =>
      first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
    const playerBounds = new Phaser.Geom.Rectangle(this.player.body.x, this.player.body.y, this.player.body.width, this.player.body.height);
    const enemyOverlap = this.enemies.some((enemy) => {
      const enemyBounds = new Phaser.Geom.Rectangle(enemy.body.x, enemy.body.y, enemy.body.width, enemy.body.height);
      return overlaps(bounds, enemyBounds);
    }) || (this.dragonHitBounds && !this.dragonDefeated && overlaps(bounds, this.dragonHitBounds));
    const terrainOverlap = this.platforms.getChildren().some((platform) =>
      overlaps(bounds, platform.body)
    );
    const buildOverlap = this.builtPieces.some((piece) =>
      overlaps(bounds, piece.bounds)
    );
    const supported = this.platforms.getChildren().some((platform) =>
      Math.abs(bounds.bottom - platform.body.top) <= 1 && bounds.right > platform.body.left && bounds.left < platform.body.right
    ) || this.builtPieces.some((piece) =>
      (Math.abs(bounds.bottom - piece.bounds.top) <= 1 && bounds.right > piece.bounds.left && bounds.left < piece.bounds.right) ||
      ((Math.abs(bounds.left - piece.bounds.right) <= 1 || Math.abs(bounds.right - piece.bounds.left) <= 1) &&
        bounds.bottom > piece.bounds.top && bounds.top < piece.bounds.bottom)
    );
    const withinBuildReach = Math.abs(bounds.centerX - this.player.x) <= 480 || this.builtPieces.some((piece) =>
      (Math.abs(bounds.left - piece.bounds.right) <= 1 || Math.abs(bounds.right - piece.bounds.left) <= 1) &&
      bounds.bottom > piece.bounds.top && bounds.top < piece.bounds.bottom
    );
    const playerOverlap = overlaps(bounds, playerBounds);
    const inWorld = bounds.left >= 0 && bounds.right <= (this.level.width || WORLD_WIDTH) && bounds.top >= 64 && bounds.bottom <= WORLD_HEIGHT;
    const hasInventory = this.inventory[this.buildMode] > 0;
    const valid = hasInventory && inWorld && withinBuildReach && !playerOverlap && !enemyOverlap && !terrainOverlap && !buildOverlap && supported;
    return { left, top, width: size.width, height: size.height, bounds, valid };
  }

  placePiece(candidate) {
    const { left, top, width, height, bounds } = candidate;
    const x = left + width / 2;
    const y = top + height / 2;
    const piece = { x, y, left, top, width, height, bounds, mode: this.buildMode, bodies: [], decorations: [], graphics: null };
    if (piece.mode === 'wall') {
      const glow = this.add.rectangle(x, y, width + 10, height + 10, NEON_CYAN, 0.1).setDepth(3);
      piece.decorations.push(glow);
      const wall = this.add.rectangle(x, y, width, height, 0x241638).setStrokeStyle(2, NEON_CYAN).setDepth(4);
      this.addBuildingBody(piece, wall);
      for (let lineY = top + 32; lineY < top + height; lineY += 32) {
        piece.decorations.push(this.add.line(x, lineY, -width / 2, 0, width / 2, 0, NEON_PURPLE, 0.8).setDepth(5));
      }
    } else if (piece.mode === 'ramp') {
      const stepCount = 8;
      const stepWidth = width / stepCount;
      const stepHeight = height / stepCount;
      for (let index = 0; index < stepCount; index += 1) {
        const stepX = left + index * stepWidth + stepWidth / 2;
        const stepY = top + height - stepHeight / 2 - index * stepHeight;
        const step = this.add.rectangle(stepX, stepY, stepWidth + 1, stepHeight, 0x211435).setStrokeStyle(1, NEON_CYAN).setDepth(4);
        this.addBuildingBody(piece, step);
      }
      piece.graphics = this.add.graphics().setDepth(4);
      piece.graphics.lineStyle(10, NEON_PURPLE, 0.14);
      piece.graphics.lineBetween(left, top + height, left + width, top);
      piece.graphics.lineStyle(3, NEON_PURPLE, 1);
      piece.graphics.lineBetween(left, top + height, left + width, top);
    } else if (piece.mode === 'platform') {
      piece.decorations.push(this.add.rectangle(x, y, width + 10, height + 10, NEON_CYAN, 0.08).setDepth(3));
      const platform = this.add.rectangle(x, y, width, height, 0x211435).setStrokeStyle(2, NEON_CYAN).setDepth(4);
      this.addBuildingBody(piece, platform);
    } else if (piece.mode === 'ladder') {
      const rails = this.add.graphics().setDepth(4);
      rails.lineStyle(9, NEON_PURPLE, 0.14);
      rails.lineBetween(left + 7, top, left + 7, top + height);
      rails.lineBetween(left + width - 7, top, left + width - 7, top + height);
      rails.lineStyle(3, NEON_PURPLE, 1);
      rails.lineBetween(left + 7, top, left + 7, top + height);
      rails.lineBetween(left + width - 7, top, left + width - 7, top + height);
      piece.graphics = rails;
      for (let rungY = top + 16; rungY < top + height; rungY += 24) {
        piece.decorations.push(this.add.rectangle(x, rungY, width - 8, 5, 0x211435).setStrokeStyle(1, NEON_CYAN).setDepth(4));
      }
    }
    this.builtPieces.push(piece);
    this.inventory[piece.mode] -= 1;
    this.emitBurst(x, y, piece.mode === 'wall' ? NEON_CYAN : NEON_PURPLE, 7);
    this.publishCount();
  }

  addBuildingBody(piece, body) {
    this.physics.add.existing(body, true);
    this.buildingBodies.add(body);
    piece.bodies.push(body);
  }

  removePiece(piece, refund) {
    if (refund) this.emitBurst(piece.x, piece.y, NEON_PINK, 7);
    piece.bodies.forEach((body) => {
      if (body) this.buildingBodies.remove(body, true, true);
    });
    piece.decorations.forEach((decoration) => decoration.destroy());
    if (piece.graphics) piece.graphics.destroy();
    this.builtPieces = this.builtPieces.filter((item) => item !== piece);
    if (refund) this.inventory[piece.mode] = Math.min(this.level.inventory[piece.mode], this.inventory[piece.mode] + 1);
  }

  emitBurst(x, y, color, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count;
      const distance = 18 + (index % 3) * 5;
      const particle = this.add.circle(x, y, index % 2 === 0 ? 3 : 2, color, 0.95).setDepth(9);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: 260,
        onComplete: () => particle.destroy()
      });
    }
  }

  publishCount() {
    window.dispatchEvent(new CustomEvent('piece-count', { detail: { inventory: this.inventory, selected: this.buildMode } }));
  }

  drawBuildPreview(candidate) {
    const preview = this.preview;
    const color = candidate.valid ? NEON_CYAN : NEON_PINK;
    preview.clear();
    preview.fillStyle(candidate.valid ? 0x211435 : 0x451534, 0.5);
    preview.lineStyle(10, color, 0.14);

    if (this.buildMode === 'ramp') {
      preview.fillPoints([
        { x: candidate.left, y: candidate.top + candidate.height },
        { x: candidate.left + candidate.width, y: candidate.top },
        { x: candidate.left + candidate.width, y: candidate.top + candidate.height }
      ], true);
      preview.lineBetween(candidate.left, candidate.top + candidate.height, candidate.left + candidate.width, candidate.top);
    } else if (this.buildMode === 'ladder') {
      preview.lineBetween(candidate.left + 7, candidate.top, candidate.left + 7, candidate.top + candidate.height);
      preview.lineBetween(candidate.left + candidate.width - 7, candidate.top, candidate.left + candidate.width - 7, candidate.top + candidate.height);
      for (let rungY = candidate.top + 16; rungY < candidate.top + candidate.height; rungY += 24) {
        preview.lineBetween(candidate.left + 4, rungY, candidate.left + candidate.width - 4, rungY);
      }
    } else {
      preview.fillRect(candidate.left, candidate.top, candidate.width, candidate.height);
      preview.strokeRect(candidate.left, candidate.top, candidate.width, candidate.height);
    }

    preview.lineStyle(2, color, 0.98);
    if (this.buildMode === 'ramp') {
      preview.lineBetween(candidate.left, candidate.top + candidate.height, candidate.left + candidate.width, candidate.top);
      preview.lineBetween(candidate.left + candidate.width, candidate.top, candidate.left + candidate.width, candidate.top + candidate.height);
      preview.lineBetween(candidate.left + candidate.width, candidate.top + candidate.height, candidate.left, candidate.top + candidate.height);
    } else if (this.buildMode === 'ladder') {
      preview.lineBetween(candidate.left + 7, candidate.top, candidate.left + 7, candidate.top + candidate.height);
      preview.lineBetween(candidate.left + candidate.width - 7, candidate.top, candidate.left + candidate.width - 7, candidate.top + candidate.height);
    } else {
      preview.strokeRect(candidate.left, candidate.top, candidate.width, candidate.height);
    }
    if (!candidate.valid) {
      preview.lineStyle(3, NEON_PINK, 0.95);
      preview.lineBetween(candidate.left + 4, candidate.top + 4, candidate.left + candidate.width - 4, candidate.top + candidate.height - 4);
      preview.lineBetween(candidate.left + candidate.width - 4, candidate.top + 4, candidate.left + 4, candidate.top + candidate.height - 4);
    }
  }

  updateEnemies(time) {
    this.enemies.forEach((enemy) => {
      const dx = this.player.x - enemy.x;
      const dy = Math.abs(this.player.y - enemy.y);
      const definition = enemy.patrol;
      if (Math.abs(dx) < definition.aggroRange && dy < 150 && time >= enemy.nextChaseAllowedAt) {
        enemy.chaseUntil = time + 1000;
        enemy.nextChaseAllowedAt = time + 2600;
      }

      const chasing = time < enemy.chaseUntil;
      if (chasing && enemy.x > definition.left - 96 && enemy.x < definition.right + 96) {
        enemy.patrolDirection = dx < 0 ? -1 : 1;
      } else {
        if (enemy.x <= definition.left) enemy.patrolDirection = 1;
        if (enemy.x >= definition.right) enemy.patrolDirection = -1;
      }
      const direction = enemy.patrolDirection;
      enemy.setAccelerationX(direction * 850);
      enemy.setMaxVelocity(chasing ? definition.chaseSpeed : definition.speed, 400);
      enemy.setFlipX(direction < 0);

      if (Math.abs(enemy.body.velocity.x) > 10) {
        const frame = Math.floor(time / 170) % 2;
        if (frame !== enemy.animationFrame) {
          enemy.setTexture(`monster-walk-${frame}`);
          enemy.animationFrame = frame;
        }
      }
    });
  }

  updateLadderClimbing() {
    const body = this.player.body;
    const playerBounds = new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
    const ladder = this.builtPieces.find((piece) => piece.mode === 'ladder' &&
      playerBounds.left < piece.bounds.right && playerBounds.right > piece.bounds.left &&
      playerBounds.top < piece.bounds.bottom && playerBounds.bottom > piece.bounds.top);
    const climbUp = this.jumpHeld || this.keys.W.isDown || this.keys.SPACE.isDown || this.cursors.up.isDown;
    const climbDown = this.keys.S.isDown || this.cursors.down.isDown;

    if (!ladder) {
      if (this.isClimbing) {
        body.allowGravity = true;
        body.setVelocityY(0);
        this.isClimbing = false;
      }
      return false;
    }

    if (!this.isClimbing && !climbUp && !climbDown) return false;
    this.isClimbing = true;
    body.allowGravity = false;
    body.setAccelerationX(0);
    body.setVelocityX(0);
    body.setVelocityY(climbUp ? -180 : climbDown ? 180 : 0);
    if (climbUp) this.jumpPressedAt = -Infinity;

    if ((climbUp && body.top <= ladder.bounds.top) ||
      (climbDown && body.bottom >= ladder.bounds.bottom && (body.blocked.down || body.touching.down))) {
      body.allowGravity = true;
      body.setVelocityY(0);
      this.isClimbing = false;
      return false;
    }
    return true;
  }

  update(time, delta) {
    const pointer = this.input.activePointer;
    const candidate = this.getBuildCandidate({ x: pointer.worldX, y: pointer.worldY });
    this.drawBuildPreview(candidate);

    this.lavaGraphics.clear();
    this.lavaZones.forEach(({ x: startX, width }, index) => {
      this.lavaGraphics.fillStyle(NEON_PINK, 0.12);
      this.lavaGraphics.fillRect(startX - 8, 500, width + 16, WORLD_HEIGHT - 500);
      this.lavaGraphics.fillStyle(0x681447, 1);
      this.lavaGraphics.fillRect(startX, 512, width, WORLD_HEIGHT - 512);
      this.lavaGraphics.fillStyle(0xff397c, 0.85);
      this.lavaGraphics.fillRect(startX, 518, width, WORLD_HEIGHT - 518);
      for (const [lineWidth, alpha] of [[8, 0.25], [2, 0.95]]) {
        this.lavaGraphics.lineStyle(lineWidth, NEON_ORANGE, alpha);
        this.lavaGraphics.beginPath();
        for (let dx = 0; dx <= width; dx += 8) {
          const waveY = 510 + Math.sin((dx + time * 0.09 + index * 30) / 18) * 4;
          if (dx === 0) this.lavaGraphics.moveTo(startX + dx, waveY);
          else this.lavaGraphics.lineTo(startX + dx, waveY);
        }
        this.lavaGraphics.strokePath();
      }
    });

    if (this.state === 'playing') {
      const moveLeft = this.cursors.left.isDown || this.keys.A.isDown;
      const moveRight = this.cursors.right.isDown || this.keys.D.isDown;
      if (moveLeft !== moveRight) {
        this.facing = moveLeft ? -1 : 1;
        this.player.setAccelerationX(this.facing * 1700);
      } else {
        this.player.setAccelerationX(0);
      }

      const climbing = this.updateLadderClimbing();
      const onGround = this.player.body.blocked.down || this.player.body.touching.down;
      if (onGround) this.lastGroundedAt = time;
      const jumpBuffered = time - this.jumpPressedAt <= 140;
      const canCoyoteJump = time - this.lastGroundedAt <= 110;
      let jumpedThisFrame = false;
      if (!climbing && jumpBuffered && canCoyoteJump) {
        this.player.setVelocityY(-480);
        this.jumpPressedAt = -Infinity;
        this.lastGroundedAt = -Infinity;
        jumpedThisFrame = true;
        this.emitBurst(this.player.x, this.player.body.bottom, NEON_CYAN, 5);
      }
      if (onGround && !this.wasGrounded && !jumpedThisFrame) this.emitBurst(this.player.x, this.player.body.bottom, NEON_PURPLE, 4);
      this.wasGrounded = jumpedThisFrame ? false : onGround;
      this.player.setFlipX(this.facing < 0);
      let animation = 'idle';
      if (!onGround) animation = this.player.body.velocity.y < 0 ? 'jump' : 'fall';
      else if (Math.abs(this.player.body.velocity.x) > 28) animation = Math.floor(time / 110) % 2 ? 'walkA' : 'walkB';
      if (this.currentAnimation !== animation) {
        this.player.setTexture(`stickman-${animation}`);
        this.currentAnimation = animation;
      }
      this.updateEnemies(time);
      this.updateDragon(time, delta);
      if (this.player.y > WORLD_HEIGHT) this.endLevel(false);
    }
  }
}
