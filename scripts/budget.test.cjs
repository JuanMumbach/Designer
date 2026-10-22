const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTypeScript(relativePath, imports = {}) {
  const filename = path.resolve(path.dirname(require.resolve('../package.json')), relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(
    (id) => imports[id] ?? {}, loaded, loaded.exports,
  );
  return loaded.exports;
}

const budget = loadTypeScript('services/budget.ts');
const materialParts = loadTypeScript('services/materialParts.ts', { './budget': budget });
const materials = [{ id: 'mdf', name: 'MDF', costMultiplier: 1.2 }, { id: 'marble', name: 'Mármol', costMultiplier: 2 }];
const entries = [
  { id: 'wood', name: 'MDF', basePrice: 100, materialSlot: 0 },
  { id: 'stone', name: 'Mármol', basePrice: 200, materialSlot: 1 },
  { id: 'hinges', name: 'Bisagras', basePrice: 30, materialSlot: null },
];
const resolve = (slot) => ['mdf', 'marble'][slot];
const moduleBudget = budget.calculateModuleBudget(entries, materials, resolve);
assert.equal(moduleBudget.total, 550);
assert.deepEqual(moduleBudget.lines.map((line) => line.amount), [120, 400, 30]);
assert.equal(budget.calculateModuleBudget(entries, [{ ...materials[0], costMultiplier: 1.5 }, materials[1]], resolve).total, 580);
assert.equal(budget.calculateModuleBudget(entries, [materials[0], { ...materials[1], costMultiplier: 3 }], resolve).total, 750);
assert.equal(budget.calculateModuleBudget([entries[0], entries[2]], materials, resolve).total, 150);
assert.equal(budget.calculateModuleBudget(undefined, materials, resolve).total, undefined);
assert.equal(budget.calculateModuleBudget([], materials, resolve).total, undefined);
assert.equal(budget.calculateModuleBudget(entries, [materials[0]], resolve).total, undefined);
assert.equal(budget.calculateModuleBudget([entries[0]], [{ id: 'mdf', name: 'Legacy material' }], resolve).total, 100);
assert.equal(budget.calculateModuleBudget([{ id: 'zero', name: 'Free extra', basePrice: 0 }], [], () => undefined).total, 0);
assert.equal(budget.calculateModuleBudget([{ id: 'round', name: 'Round', basePrice: 1.005 }], [], () => undefined).total, 1.01);
assert.equal(budget.resolveBudgetMaterial(0, { 0: 'marble' }, { body: 'mdf' }, 'body'), 'marble');
assert.equal(budget.resolveBudgetMaterial(0, { 0: 'ref:body' }, { body: 'ref:wood', wood: 'mdf' }), 'mdf');
assert.equal(budget.resolveBudgetMaterial(0, {}, { body: 'mdf', unused: 'marble' }, 'body'), 'mdf');
assert.equal(budget.resolveBudgetMaterial(0, { 0: 'ref:body' }, { body: 'ref:loop', loop: 'ref:body' }), undefined);
const settings = { extras: [{ id: 'delivery', name: 'Entrega', amount: 70 }], multipliers: [{ id: 'margin', name: 'Margen', factor: 1.1 }] };
assert.equal(budget.calculateDesignBudget([moduleBudget], settings).total, 682);
assert.equal(budget.calculateDesignBudget([moduleBudget, moduleBudget], settings).total, 1287);
assert.equal(budget.calculateDesignBudget([], settings).total, 77);
assert.equal(budget.calculateDesignBudget([moduleBudget], { ...settings, multipliers: [...settings.multipliers, { id: 'discount', name: 'Descuento', factor: 0.9 }] }).total, 613.8);
assert.equal(budget.calculateDesignBudget([budget.calculateModuleBudget(undefined, materials, resolve)], settings).total, undefined);
assert.equal(budget.calculateDesignBudget([moduleBudget], { ...settings, multipliers: [{ id: 'bad', name: 'Bad', factor: Infinity }] }).total, undefined);
assert.equal(budget.roundBudgetAmount(1e20), undefined);
for (const value of ['12abc', '', 'NaN', 'Infinity', '-1', '1e3', '1.2.3', '1,2,3']) assert.equal(budget.parseBudgetNumber(value), undefined);
assert.equal(budget.parseBudgetNumber('12,50'), 12.5);
assert.equal(budget.parseBudgetNumber('0', 1e6, true), undefined);
assert.ok(budget.validateBudgetEntries([entries[0], entries[0]]));
assert.ok(budget.validateBudgetEntries([{ ...entries[0], materialSlot: 1.2 }]));
assert.ok(budget.validateBudgetSettings({ extras: [null], multipliers: [] }));

async function testPersistence() {
  const storage = loadTypeScript('services/projectStorage.ts', { './budget': budget, './materialParts': materialParts });
  const room = { width: 4, height: 2.7, depth: 3, leftWall: true, rightWall: true };
  const object = { id: 'instance', name: 'Counter', modelId: 'model', version: 3, position: [0, 0, 0], rotation: 0, dimensions: [0.6, 0.9, 0.6], color: '#fff', modelUrl: 'model.glb', budgetEntries: entries, materialOverrides: { 0: 'ref:body' }, hidden: true };
  const json = JSON.parse(JSON.stringify(storage.serializeProjectState(room, [object], { body: 'mdf' }, settings)));
  const restored = await storage.deserializeProjectState(json, async (id, version) => `${id}-${version}.glb`);
  assert.deepEqual(restored.budgetSettings, settings);
  assert.deepEqual(restored.objects[0].budgetEntries, entries);
  assert.equal(restored.objects[0].modelUrl, 'model-3.glb');
  assert.equal(restored.objects[0].hidden, true);
  assert.deepEqual(restored.objects[0].materialOverrides, { 0: 'ref:body' });
  const cleared = storage.serializeProjectState(room, [{ ...object, budgetEntries: [] }]);
  assert.deepEqual((await storage.deserializeProjectState(cleared, async () => '')).objects[0].budgetEntries, []);
  const legacy = storage.serializeProjectState(room, [{ ...object, budgetEntries: undefined }]);
  const legacyRestored = await storage.deserializeProjectState(legacy, async () => '');
  assert.deepEqual(legacyRestored.budgetSettings, budget.emptyBudgetSettings());
  assert.equal(legacyRestored.objects[0].budgetEntries, undefined);
  await assert.rejects(storage.deserializeProjectState({ ...json, budgetSettings: { extras: [], multipliers: [{ id: 'invalid', name: 'Invalid', factor: 0 }] } }, async () => ''));
  testBudgetScreen(room, object);
  console.log('Budget calculation, material resolution, validation, project round-trip and rendered-screen checks passed.');
}

function testBudgetScreen(room, object) {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const native = require('react-native-web');
  const config = require('../config/defaultDesignMaterials.json');
  function render(options = {}) {
    const instance = { ...object, budgetEntries: undefined, materialOverrides: {} };
    const objects = options.empty ? [] : [instance];
    const modelKeys = options.empty ? '' : 'model:3';
    const scope = `user:workspace:project:${modelKeys}:0`;
    const catalog = { scope, materials, versions: { 'model:3': { budgetEntries: options.unpriced ? [] : entries } }, slots: { 'model:3': [{ slot: 0, displayName: 'Wood', materialTypeName: 'MDF' }, { slot: 1, displayName: 'Stone', materialTypeName: 'marble' }] } };
    let stateIndex = 0;
    const state = [catalog, !!options.loading, options.error, 0, undefined];
    const mockedReact = { ...React, useState: () => [state[stateIndex++], () => {}], useMemo: (fn) => fn(), useCallback: (fn) => fn };
    const Screen = loadTypeScript('app/(design)/budget.tsx', {
      react: mockedReact,
      'react-native': native,
      '@react-navigation/native': { useFocusEffect: () => {} },
      '../../constants/theme': loadTypeScript('constants/theme.ts'),
      '../../services/AccessContext': { useAccess: () => ({ canDesign: true }) },
      '../../services/AuthContext': { useAuth: () => ({ backendUserId: 'user', selectedWorkspaceId: 'workspace' }) },
      '../../services/currentProject': { useCurrentProject: () => ({ project: { id: 'project', name: 'Kitchen' }, designSnapshot: { room, objects, globalMaterials: { mdf_primary: 'mdf', marble: 'marble' } }, budgetSettings: settings, canEditBudgetObjects: true }) },
      '../../services/budget': budget,
      '../../services/materialParts': materialParts,
      '../../services/designMaterialDefaults': { designMaterialsConfig: config, normalizeTypeName: (name) => name.trim().toLowerCase() },
    }).default;
    return renderToStaticMarkup(React.createElement(Screen));
  }
  const html = render();
  assert.ok(html.includes('682,00'));
  assert.ok(html.includes('Bisagras'));
  assert.ok(html.includes('Costos adicionales del proyecto'));
  assert.ok(html.includes('Multiplicadores del proyecto'));
  assert.ok(html.includes('Oculto en vista 3D'));
  assert.ok(render({ empty: true }).includes('77,00'));
  const unpriced = render({ unpriced: true });
  assert.ok(unpriced.includes('Precio sin configurar'));
  assert.ok(unpriced.includes('Presupuesto incompleto'));
  assert.ok(render({ error: 'Catalog unavailable' }).includes('Catalog unavailable'));
  assert.ok(render({ loading: true }).includes('Pendiente'));
}

testPersistence().catch((error) => { console.error(error); process.exitCode = 1; });
