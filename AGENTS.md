# Project Context for AI Agents

## Project Overview

**Designer** is a cross-platform 3D modular design tool built with React Native (Expo) and @react-three/fiber. It's focused on rapid, standardized kitchen and furniture design.

## Tech Stack

- **Framework**: React Native with Expo SDK 53 (TypeScript)
- **3D Rendering**: @react-three/fiber 9.x + three.js 0.179
- **Navigation**: expo-router (file-based routing)
- **State/Animations**: react-native-reanimated 3.x, react-native-gesture-handler
- **Backend**: ASP.NET Core (C#) REST API (external)

## Build & Development Commands

```bash
# Start development server
npm start              # or expo start

# Platform-specific builds
npm run android        # Build and run on Android
npm run ios            # Build and run on iOS
npm run web            # Start web preview

# Linting
npm run lint           # Run ESLint (expo lint)

# No test framework is currently configured
# No test files exist in the codebase
```

## Code Style Guidelines

### Imports

- Import React explicitly: `import React from 'react';`
- Group imports: React/React Native first, then third-party, then local
- Use relative imports for local files: `import { Component } from './Component';`
- Import types from their definition files: `import { FurnitureInstance } from './remote3dModel';`

### TypeScript

- Strict mode is enabled via `tsconfig.json`
- Use interfaces for object shapes: `interface FurnitureProps { ... }`
- Use enums for fixed sets of values: `enum FurnitureType { Counter, Cupboard }`
- Prefer explicit types over `any`
- Use tuples for fixed-length arrays: `position: [number, number, number]`
- Path alias `@/*` maps to project root

### Component Structure

- Use functional components with hooks
- Export components as default exports: `export default function ComponentName()`
- Destructure props inline in function signature
- Define prop types as inline interfaces or type aliases

```tsx
export default function ComponentName({
  prop1,
  prop2,
  onAction
}: {
  prop1: string;
  prop2: number;
  onAction: (id: string) => void;
}) {
  const [state, setState] = useState(initialValue);
  return <View>...</View>;
}
```

### Styling

- Use `StyleSheet.create()` at the bottom of the file
- No inline styles unless dynamic values are required
- Style naming: camelCase matching CSS properties

### Naming Conventions

- Components: PascalCase (`DesignObjects`, `AddFurnitureInstanceMenu`)
- Functions: camelCase (`getRandomColor`, `handleAddObject`)
- Constants: camelCase for variables (`furnitureModels`), PascalCase for enums (`FurnitureType`)
- Files: PascalCase for components (`Button.tsx`), camelCase for utilities (`remote3dModel.tsx`)
- Event handlers: prefix with `handle` or `on` (`handleAddObject`, `onObjectInteraction`)

### Comments

- Do NOT add comments to code unless explicitly requested by the user
- Self-documenting code is preferred

## Architecture

```
app/
├── _layout.tsx          # Root layout (Stack navigator)
└── (tabs)/              # Tab navigation group
    ├── _layout.tsx      # Tab layout
    └── index.tsx        # Main tab content

components/
├── Button.tsx                 # Reusable button component
├── DesignScreen.tsx           # Main design screen wrapper
└── DesignScreen/
    ├── 3dView/                # 3D scene components
    │   ├── DesignObjects.tsx  # Furniture types, instances, rendering
    │   ├── Room3d.tsx         # Room/grid rendering
    │   └── remote3dModel.tsx  # GLB model loading with drei
    └── 3dViewOverlay/         # Floating UI panels
        ├── AddFurnitureInstanceMenu.tsx
        ├── EditFurnitureInstanceMenu.tsx
        ├── MoveFurnitureInstanceMenu.tsx
        ├── FurnitureInstancesManager.tsx
        ├── ListFurnitureModels.tsx
        └── RoomManager.tsx
```

## Important Patterns

- **Absolute Positioning**: 3D scene uses XYZ coordinates for furniture placement
- **Floating Buttons**: (+) buttons appear in 3D space for quick module placement
- **Floating Panels**: Modal-style cards for precise dimension adjustments
- **State Lift**: Parent components manage state; callbacks pass changes up
- **UUID Generation**: Use `generateUUID()` from three.js for unique IDs
- **3D Models**: GLB files loaded via `@react-three/drei` (useGLTF), stored in Firebase Storage

## 3D Development Notes

- Metro config includes `.glb`, `.gltf` as asset extensions
- Source extensions include `.cjs`, `.mjs`, `.jsx` for drei compatibility
- Model scale typically set to `0.01` for imported GLB files
- React Three Fiber components use lowercase for primitives (`<mesh>`) and PascalCase for components (`<FurnitureInstance>`)

## Key Files to Reference

- `components/DesignScreen/3dView/DesignObjects.tsx` - Furniture types and data structures
- `components/DesignScreen/3dViewOverlay/` - UI overlay patterns
- `components/Button.tsx` - Reusable component pattern
- `app/_layout.tsx` - Root navigation setup
