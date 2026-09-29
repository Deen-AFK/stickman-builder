export const WORLD_WIDTH = 2560;
export const WORLD_HEIGHT = 680;

export const LEVELS = [
  {
    name: 'First Gap',
    spawnX: 96,
    finishX: 2496,
    platforms: [
      { x: 0, top: 512, width: 512 },
      { x: 768, top: 512, width: 544 },
      { x: 1536, top: 512, width: 1024 },
      { x: 576, top: 416, width: 128, height: 16 },
      { x: 1312, top: 448, width: 128, height: 16 }
    ],
    lava: [{ x: 512, width: 256 }, { x: 1312, width: 224 }],
    enemies: [
      { x: 960, top: 512, left: 832, right: 1216, speed: 58, aggroRange: 190, chaseSpeed: 105 }
    ],
    inventory: { wall: 3, ramp: 3, platform: 4, ladder: 2 }
  },
  {
    name: 'Long Way Down',
    spawnX: 96,
    finishX: 2496,
    platforms: [
      { x: 0, top: 512, width: 384 },
      { x: 768, top: 448, width: 416 },
      { x: 1408, top: 512, width: 352 },
      { x: 1984, top: 448, width: 576 },
      { x: 544, top: 416, width: 96, height: 16 },
      { x: 1216, top: 384, width: 96, height: 16 },
      { x: 1792, top: 416, width: 96, height: 16 }
    ],
    lava: [{ x: 384, width: 384 }, { x: 1184, width: 224 }, { x: 1760, width: 224 }],
    enemies: [
      { x: 960, top: 448, left: 816, right: 1120, speed: 76, aggroRange: 210, chaseSpeed: 128 },
      { x: 2240, top: 448, left: 2048, right: 2496, speed: 70, aggroRange: 190, chaseSpeed: 120 }
    ],
    inventory: { wall: 2, ramp: 3, platform: 5, ladder: 2 }
  },
  {
    name: 'High Voltage',
    spawnX: 96,
    finishX: 2496,
    platforms: [
      { x: 0, top: 512, width: 512 },
      { x: 768, top: 448, width: 320 },
      { x: 1216, top: 384, width: 384 },
      { x: 1792, top: 512, width: 768 },
      { x: 608, top: 384, width: 96, height: 16 },
      { x: 1088, top: 320, width: 96, height: 16 },
      { x: 1632, top: 416, width: 96, height: 16 }
    ],
    lava: [{ x: 512, width: 256 }, { x: 1088, width: 128 }, { x: 1600, width: 192 }],
    enemies: [
      { x: 896, top: 448, left: 800, right: 1056, speed: 82, aggroRange: 220, chaseSpeed: 140 },
      { x: 1408, top: 384, left: 1248, right: 1568, speed: 88, aggroRange: 210, chaseSpeed: 145 },
      { x: 2080, top: 512, left: 1856, right: 2448, speed: 80, aggroRange: 200, chaseSpeed: 138 }
    ],
    inventory: { wall: 3, ramp: 4, platform: 4, ladder: 3 }
  },
  {
    name: 'Hot Pursuit',
    spawnX: 96,
    finishX: 2496,
    platforms: [
      { x: 0, top: 512, width: 384 },
      { x: 640, top: 448, width: 320 },
      { x: 1152, top: 512, width: 352 },
      { x: 1696, top: 416, width: 320 },
      { x: 2176, top: 512, width: 384 },
      { x: 448, top: 384, width: 96, height: 16 },
      { x: 1024, top: 384, width: 96, height: 16 },
      { x: 1568, top: 320, width: 96, height: 16 },
      { x: 2048, top: 384, width: 96, height: 16 }
    ],
    lava: [{ x: 384, width: 256 }, { x: 960, width: 192 }, { x: 1504, width: 192 }, { x: 2016, width: 160 }],
    enemies: [
      { x: 768, top: 448, left: 672, right: 928, speed: 100, aggroRange: 230, chaseSpeed: 158 },
      { x: 1344, top: 512, left: 1184, right: 1472, speed: 104, aggroRange: 220, chaseSpeed: 165 },
      { x: 1856, top: 416, left: 1728, right: 1984, speed: 108, aggroRange: 220, chaseSpeed: 172 }
    ],
    inventory: { wall: 3, ramp: 3, platform: 5, ladder: 3 }
  },
  {
    name: 'Neon Gauntlet',
    spawnX: 96,
    finishX: 2496,
    boss: { x: 2340, y: 402, fireballSpeed: 260, cooldown: 2400, triggerRange: 900 },
    platforms: [
      { x: 0, top: 512, width: 352 },
      { x: 608, top: 448, width: 320 },
      { x: 1120, top: 384, width: 320 },
      { x: 1728, top: 448, width: 320 },
      { x: 2240, top: 512, width: 320 },
      { x: 416, top: 384, width: 96, height: 16 },
      { x: 960, top: 320, width: 96, height: 16 },
      { x: 1472, top: 320, width: 96, height: 16 },
      { x: 2080, top: 384, width: 96, height: 16 }
    ],
    lava: [{ x: 352, width: 256 }, { x: 928, width: 192 }, { x: 1440, width: 288 }, { x: 2048, width: 192 }],
    enemies: [],
    inventory: { wall: 3, ramp: 4, platform: 5, ladder: 3 }
  }
];

export const BUILD_SIZES = {
  wall: { width: 32, height: 128 },
  ramp: { width: 192, height: 96 },
  platform: { width: 192, height: 32 },
  ladder: { width: 32, height: 128 }
};
