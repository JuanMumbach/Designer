const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, imports = {}) {
  const filename = path.resolve(path.dirname(require.resolve('../package.json')), relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const target = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })((id) => imports[id] ?? {}, target, target.exports);
  return target.exports;
}

const { simulateBoardCuts } = load('services/cuttingPlan.ts');
const budget = load('services/budget.ts');
const parts = load('services/materialParts.ts', { './budget': budget });
const piece = (id, widthMm, heightMm) => ({ id, name: id, widthMm, heightMm });
const exact = simulateBoardCuts([piece('exact', 2600, 1600)], 2600, 1600, 3);
assert.equal(exact.boards.length, 1);
assert.equal(exact.utilization, 1);
assert.equal(exact.wasteAreaM2, 0);
const adjacent = [piece('left', 500, 1000), piece('right', 500, 1000)];
assert.equal(simulateBoardCuts(adjacent, 1000, 1000, 0).boards.length, 1);
assert.equal(simulateBoardCuts(adjacent, 1000, 1000, 3).boards.length, 2);
const rotated = simulateBoardCuts([piece('rotated', 300, 700)], 700, 300, 3);
assert.equal(rotated.boards.length, 1);
assert.equal(rotated.boards[0].pieces[0].rotated, true);
assert.equal(rotated.boards[0].pieces[0].widthMm, 700);
assert.equal(simulateBoardCuts([piece('fixed', 300, 700)], 700, 300, 3, false).unplaced.length, 1);
assert.equal(simulateBoardCuts([piece('oversize', 2601, 1601)], 2600, 1600, 3).unplaced.length, 1);
assert.equal(simulateBoardCuts([piece('invalid', NaN, 400)], 2600, 1600, 3).unplaced.length, 1);
assert.ok(simulateBoardCuts([], 0, 1600, 3).error);
assert.ok(simulateBoardCuts([], 2600, 1600, 1600).error);
assert.ok(simulateBoardCuts(Array.from({ length: 5001 }, (_, index) => piece(String(index), 1, 1)), 2600, 1600, 3).error);
const generated = Array.from({ length: 90 }, (_, index) => piece(`piece-${index}`, 100 + (index * 79 % 1200), 80 + (index * 137 % 1000)));
const packed = simulateBoardCuts(generated, 2600, 1600, 3);
assert.equal(packed.unplaced.length, 0);
assert.deepEqual(packed, simulateBoardCuts(generated, 2600, 1600, 3));
const placed = packed.boards.flatMap((board) => board.pieces);
assert.equal(new Set(placed.map((cut) => cut.id)).size, generated.length);
assert.equal(placed.length, generated.length);
for (const board of packed.boards) for (let first = 0; first < board.pieces.length; first++) {
  const a = board.pieces[first];
  assert.ok(a.xMm >= 0 && a.yMm >= 0 && a.xMm + a.widthMm <= board.widthMm + 1e-7 && a.yMm + a.heightMm <= board.heightMm + 1e-7);
  for (let second = first + 1; second < board.pieces.length; second++) {
    const b = board.pieces[second];
    assert.ok(a.xMm + a.widthMm + 3 <= b.xMm + 1e-7 || b.xMm + b.widthMm + 3 <= a.xMm + 1e-7 || a.yMm + a.heightMm + 3 <= b.yMm + 1e-7 || b.yMm + b.heightMm + 3 <= a.yMm + 1e-7);
  }
}
const actualArea = generated.reduce((sum, cut) => sum + cut.widthMm * cut.heightMm / 1e6, 0);
assert.ok(Math.abs(packed.usedAreaM2 - actualArea) < 1e-8);
assert.ok(Math.abs(packed.usedAreaM2 + packed.wasteAreaM2 - packed.boardAreaM2) < 1e-8);

const materialParts = [
  { id: 'sides', name: 'Laterales', materialSlot: 0, widthMm: 600, heightMm: 400, quantity: 2, allowRotation: true },
  { id: 'top', name: 'Tapa', materialSlot: 1, widthMm: 600, heightMm: 600, quantity: 1, allowRotation: true },
];
const materials = [{ id: 'mdf', name: 'MDF', pricePerSquareMeter: 1000 }, { id: 'marble', name: 'Marble', pricePerSquareMeter: 3000 }];
const entries = [{ id: 'old-wood', name: 'Old wood', basePrice: 100, materialSlot: 0 }, { id: 'old-stone', name: 'Old stone', basePrice: 500, materialSlot: 1 }, { id: 'extra', name: 'Extras', basePrice: 50 }];
const cost = parts.calculatePartsBudget(materialParts, entries, materials, (slot) => materials[slot]?.id);
assert.equal(cost.total, 1610);
assert.equal(cost.lines.length, 1);
assert.deepEqual(cost.partCosts.map((row) => row.amount), [480, 1080]);
assert.ok(Math.abs(cost.areaM2 - 0.84) < 1e-8);
assert.equal(parts.calculatePartsBudget(materialParts, [], [materials[0]], (slot) => materials[slot]?.id).total, undefined);
assert.equal(parts.calculatePartsBudget([materialParts[0]], [], [{ ...materials[0], pricePerSquareMeter: 0 }], () => 'mdf').total, 0);
assert.equal(parts.calculatePartsBudget([materialParts[0]], [], [{ ...materials[0], pricePerSquareMeter: null }], () => 'mdf').total, undefined);
assert.ok(parts.validateMaterialParts([{ ...materialParts[0], quantity: 1.5 }]));
assert.ok(parts.validateMaterialParts([{ ...materialParts[0], widthMm: -1 }]));
assert.ok(parts.validateMaterialParts([materialParts[0], materialParts[0]]));
const demands = parts.collectMaterialDemand([{ object: { id: 'module-a', name: 'A' }, result: cost }, { object: { id: 'module-b', name: 'B' }, result: cost }], materials);
assert.equal(demands.length, 2);
assert.equal(demands[0].count, 4);
assert.equal(demands[0].areaM2, 0.96);
assert.equal(new Set(demands[0].pieces.map((cut) => cut.id)).size, 4);

async function roundTrip() {
  const storage = load('services/projectStorage.ts', { './budget': budget, './materialParts': parts });
  const room = { width: 4, height: 2.7, depth: 3, leftWall: true, rightWall: true };
  const object = { id: 'module', modelId: 'model', name: 'Module', version: 1, position: [0, 0, 0], rotation: 0, dimensions: [0.6, 0.9, 0.6], color: '#fff', modelUrl: '', materialParts };
  const settings = { ...budget.emptyBudgetSettings(), cutting: { mdf: { boardWidthMm: 2600, boardHeightMm: 1600, cutSpacingMm: 4 } } };
  const json = JSON.parse(JSON.stringify(storage.serializeProjectState(room, [object], {}, settings)));
  const restored = await storage.deserializeProjectState(json, async () => 'model.glb');
  assert.deepEqual(restored.objects[0].materialParts, materialParts);
  assert.deepEqual(restored.budgetSettings.cutting, settings.cutting);
  await assert.rejects(storage.deserializeProjectState({ ...json, budgetSettings: { ...settings, cutting: { mdf: { ...settings.cutting.mdf, cutSpacingMm: -1 } } } }, async () => ''));
  testBoardRender(demands[0]);
  testModuleManagerRender();
  console.log('Cut layout geometry, spacing, rotation, m² pricing, material grouping, persistence, board and module-manager rendering checks passed.');
}

function testBoardRender(demand) {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Screen = load('components/DesignScreen/Budget/BoardCuttingSimulation.tsx', {
    react: React, 'react-native': require('react-native-web'), '../../../constants/theme': load('constants/theme.ts'),
    '../../../services/budget': budget, '../../../services/materialParts': parts, '../../../services/cuttingPlan': { simulateBoardCuts },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Screen, { demand }));
  assert.ok(html.includes('Simular cortes'));
  assert.ok(html.includes('2600'));
  assert.ok(html.includes('Giros de 90° habilitados'));
  assert.ok(html.includes('Plano de placa 1'));
  assert.ok(html.includes('Laterales'));
}

function testModuleManagerRender() {
  const React = require('react');
  const native = require('react-native-web');
  const { renderToStaticMarkup } = require('react-dom/server');
  const models = [
    { id: 'counter', name: 'Counter', categoryId: null, lastVersion: 2, lastUpdate: '2026-10-19', isPublic: false },
    { id: 'cupboard', name: 'Cupboard', categoryId: null, lastVersion: 1, lastUpdate: '2026-10-18', isPublic: true },
  ];
  function render(search = '') {
    let index = 0;
    const mockedReact = {
      ...React, useEffect: () => {}, useMemo: (fn) => fn(), useCallback: (fn) => fn(), useRef: (initial) => ({ current: initial }),
      useState: (initial) => { const position = index++; const defaults = typeof initial === 'function' ? initial() : initial; return [position === 0 ? search : position === 3 ? { counter: { count: 3, area: 0.84 }, cupboard: { count: 0, area: 0 } } : defaults, () => {}]; },
    };
    const Manager = load('components/Editors/Objects/ObjectBrowser.tsx', {
      react: mockedReact, 'react-native': { ...native, useWindowDimensions: () => ({ width: 1280, height: 900 }) },
      '../../../services/AccessContext': { useAccess: () => ({ canManageApplication: false }) },
      '../../../services/AuthContext': { useAuth: () => ({ backendUserId: 'user', selectedWorkspaceId: 'workspace' }) },
      '../../../services/materialParts': parts,
      '../../../services/thumbnailCapture': { createThumbnailCaptureApi: () => ({}) },
      '../../Thumbnail': () => React.createElement(native.Text, null, 'Preview'),
      '@/constants/theme': load('constants/theme.ts'),
      './ObjectEditor': () => { throw new Error('An inactive editor should not occupy the module catalog.'); },
    }).default;
    return renderToStaticMarkup(React.createElement(Manager, { objects: models, categories: [], onRefresh: () => {} }));
  }
  const html = render();
  assert.ok(html.includes('Módulos'));
  assert.ok(html.includes('Counter'));
  assert.ok(html.includes('Cupboard'));
  assert.ok(html.includes('3 piezas'));
  assert.ok(html.includes('0,84 m²'));
  assert.ok(html.includes('Despiece pendiente'));
  const filtered = render('Counter');
  assert.ok(filtered.includes('Counter'));
  assert.ok(!filtered.includes('Cupboard'));
  assert.ok(render('no-match').includes('No hay módulos que coincidan'));
}

roundTrip().catch((error) => { console.error(error); process.exitCode = 1; });
