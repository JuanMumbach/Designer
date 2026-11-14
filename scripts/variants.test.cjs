const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTypeScript(relativePath, imports = {}) {
  const filename = path.resolve(path.dirname(require.resolve('../package.json')), relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  const loaded = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(
    (id) => imports[id] ?? {},
    loaded,
    loaded.exports
  );
  return loaded.exports;
}

const budget = loadTypeScript('services/budget.ts');
const materialParts = loadTypeScript('services/materialParts.ts', { './budget': budget });
const variants = loadTypeScript('services/variants.ts', {
  './budget': budget,
  './materialParts': materialParts,
});

console.log('Testing Variant Properties serialization & parsing...');
const rawProps = 'group:handles;label:Tiradores Modernos;allow-none:true;custom:abc';
const parsedProps = variants.parseVariantProperties(rawProps);
assert.equal(parsedProps.group, 'handles');
assert.equal(parsedProps.label, 'Tiradores Modernos');
assert.equal(parsedProps.allowNone, true);
assert.equal(parsedProps.raw.custom, 'abc');

const serializedProps = variants.serializeVariantProperties({
  group: 'legs',
  label: 'Patas de Madera',
  allowNone: false,
});
assert.ok(serializedProps.includes('group:legs'));
assert.ok(serializedProps.includes('label:Patas de Madera'));
assert.ok(serializedProps.includes('allow-none:false'));

console.log('Testing Default Variants segment parsing & serialization...');
const defaultSegment = 'default-variants:handles=var-h1,legs=null,doors=var-d1';
const parsedDefaults = variants.parseDefaultVariantsSegment(defaultSegment);
assert.equal(parsedDefaults.handles, 'var-h1');
assert.equal(parsedDefaults.legs, null);
assert.equal(parsedDefaults.doors, 'var-d1');

const serializedDefaultSeg = variants.serializeDefaultVariantsSegment({
  handles: 'var-h1',
  legs: null,
  doors: 'var-d2',
});
assert.ok(serializedDefaultSeg.startsWith('default-variants:'));
assert.ok(serializedDefaultSeg.includes('handles=var-h1'));
assert.ok(serializedDefaultSeg.includes('legs=null'));
assert.ok(serializedDefaultSeg.includes('doors=var-d2'));

console.log('Testing active variants resolution & variant modes...');
const mockVariants = [
  {
    id: 'handle-metal',
    objectId: 'mod-1',
    version: 1,
    name: 'Tirador Metálico',
    mode: 'additive',
    fileURL: 'https://storage/handle-metal.glb',
    variantProperties: 'group:handles;label:Tiradores;allow-none:true',
    materialPartsDelta: {
      add: [
        {
          id: 'part-handle-bracket',
          name: 'Soporte Tirador',
          materialSlot: 0,
          widthMm: 100,
          heightMm: 20,
          quantity: 2,
        },
      ],
    },
    budgetEntriesDelta: {
      add: [
        {
          id: 'cost-handle-hardware',
          name: 'Tornillería Tirador',
          basePrice: 15,
          materialSlot: null,
          quantity: 2,
        },
      ],
    },
  },
  {
    id: 'handle-none',
    objectId: 'mod-1',
    version: 1,
    name: 'Sin Tirador',
    mode: 'additive',
    fileURL: '',
    variantProperties: 'group:handles;label:Tiradores;allow-none:true',
  },
  {
    id: 'door-jpull',
    objectId: 'mod-1',
    version: 1,
    name: 'Puerta J-Pull',
    mode: 'replace',
    fileURL: 'https://storage/door-jpull.glb',
    variantProperties: 'group:doors;label:Puertas;allow-none:false',
    materialPartsDelta: {
      replace: [
        {
          targetPartId: 'door-panel',
          heightMm: 680,
        },
      ],
      remove: ['standard-trim'],
    },
    budgetEntriesDelta: {
      replace: [
        {
          targetEntryId: 'door-hinge',
          basePrice: 45,
        },
      ],
      remove: ['standard-handle-budget'],
    },
  },
  {
    id: 'legs-wood',
    objectId: 'mod-1',
    version: 1,
    name: 'Patas de Madera',
    mode: 'additive',
    fileURL: 'https://storage/legs-wood.glb',
    variantProperties: 'group:legs;label:Patas;allow-none:true',
    budgetEntriesDelta: {
      add: [
        {
          id: 'cost-wooden-legs',
          name: 'Kit 4 Patas Madera',
          basePrice: 80,
          materialSlot: null,
        },
      ],
    },
  },
];

// Test resolveActiveVariants with defaults:
const defaultMap = { handles: 'handle-metal', doors: 'door-jpull', legs: null };
const activeFromDefaults = variants.resolveActiveVariants(mockVariants, defaultMap);
assert.equal(activeFromDefaults.length, 2);
assert.ok(activeFromDefaults.some((v) => v.id === 'handle-metal'));
assert.ok(activeFromDefaults.some((v) => v.id === 'door-jpull'));

// Test resolveActiveVariants with instance overrides (e.g. choose legs, remove handles):
const instanceSelections = { handles: null, legs: 'legs-wood' };
const activeFromOverrides = variants.resolveActiveVariants(
  mockVariants,
  defaultMap,
  instanceSelections
);
assert.equal(activeFromOverrides.length, 2);
assert.ok(activeFromOverrides.some((v) => v.id === 'door-jpull'));
assert.ok(activeFromOverrides.some((v) => v.id === 'legs-wood'));
assert.ok(!activeFromOverrides.some((v) => v.id === 'handle-metal'));

// Test mesh resolution:
const meshResolution = variants.resolveVariantMeshes(
  'https://storage/base-module.glb',
  activeFromOverrides
);
assert.equal(meshResolution.primaryModelUrl, 'https://storage/door-jpull.glb');
assert.equal(meshResolution.additiveMeshes.length, 1);
assert.equal(meshResolution.additiveMeshes[0].fileURL, 'https://storage/legs-wood.glb');

console.log('Testing material parts deltas application...');
const baseParts = [
  {
    id: 'door-panel',
    name: 'Puerta Base',
    materialSlot: 0,
    widthMm: 400,
    heightMm: 700,
    quantity: 1,
  },
  {
    id: 'standard-trim',
    name: 'Moldura Estándar',
    materialSlot: 0,
    widthMm: 400,
    heightMm: 50,
    quantity: 1,
  },
  {
    id: 'side-panel',
    name: 'Lateral',
    materialSlot: 0,
    widthMm: 550,
    heightMm: 720,
    quantity: 2,
  },
];

// Apply door-jpull delta: replaces door-panel heightMm to 680, removes standard-trim
const updatedParts = variants.applyMaterialPartsDeltas(baseParts, [
  mockVariants.find((v) => v.id === 'door-jpull'),
  mockVariants.find((v) => v.id === 'handle-metal'),
]);
assert.equal(updatedParts.length, 3); // door-panel (modified), side-panel (unchanged), part-handle-bracket (added)
const doorPart = updatedParts.find((p) => p.id === 'door-panel');
assert.ok(doorPart);
assert.equal(doorPart.heightMm, 680);
assert.equal(doorPart.widthMm, 400); // preserved original width
assert.ok(!updatedParts.some((p) => p.id === 'standard-trim')); // removed
assert.ok(updatedParts.some((p) => p.id === 'part-handle-bracket')); // added

console.log('Testing budget entries deltas application...');
const baseBudgetEntries = [
  {
    id: 'door-hinge',
    name: 'Bisagras',
    basePrice: 30,
    materialSlot: null,
  },
  {
    id: 'standard-handle-budget',
    name: 'Tirador Estándar',
    basePrice: 10,
    materialSlot: null,
  },
];

const updatedBudgetEntries = variants.applyBudgetEntriesDeltas(baseBudgetEntries, [
  mockVariants.find((v) => v.id === 'door-jpull'),
  mockVariants.find((v) => v.id === 'legs-wood'),
]);
assert.equal(updatedBudgetEntries.length, 2); // door-hinge (price overridden to 45), cost-wooden-legs (added 80)
const hingeEntry = updatedBudgetEntries.find((e) => e.id === 'door-hinge');
assert.ok(hingeEntry);
assert.equal(hingeEntry.basePrice, 45);
assert.ok(!updatedBudgetEntries.some((e) => e.id === 'standard-handle-budget')); // removed
const legsEntry = updatedBudgetEntries.find((e) => e.id === 'cost-wooden-legs');
assert.ok(legsEntry);
assert.equal(legsEntry.basePrice, 80);

console.log('Testing resolveEffectiveModuleInventory with budget calculation...');
const mockVersion = {
  objectId: 'mod-1',
  version: 1,
  materialParts: baseParts,
  budgetEntries: baseBudgetEntries,
  variants: mockVariants,
  objectProperties: {
    defaultVariants: { handles: 'handle-metal', doors: null, legs: null },
  },
};

const effectiveInventory = variants.resolveEffectiveModuleInventory(mockVersion, {
  selectedVariants: { handles: 'handle-metal', legs: 'legs-wood' },
});

// Should include handle hardware (15) and wooden legs (80) + base hinges (30) + base standard-handle-budget (10)
const materials = [{ id: 'mdf', name: 'MDF', costMultiplier: 1.0 }];
const calculatedBudget = budget.calculateModuleBudget(
  effectiveInventory.entries,
  materials,
  () => 'mdf'
);
// Base entries: door-hinge (30) + standard-handle-budget (10)
// Added deltas: cost-handle-hardware (15) + cost-wooden-legs (80)
// Total budget should be 30 + 10 + 15 + 80 = 135
assert.equal(calculatedBudget.total, 135);

console.log('All Object Variant & Accessory System tests passed successfully!');
