# Jsonary - Codebase Architecture

## 📋 Table of Contents
- [Overview](#overview)
- [Project Structure](#project-structure)
- [Core Systems](#core-systems)
- [Component Hierarchy](#component-hierarchy)
- [State Management](#state-management)
- [Data Flow](#data-flow)
- [Key Features](#key-features)

## Overview

Jsonary is a modern, browser-based JSON/CSV/YAML/TOML editor built with React, TypeScript, and Vite. It provides powerful editing capabilities with features like JSON repair, schema validation, diff comparison, and multiple view modes.

**Tech Stack:**
- React 18 + TypeScript
- Vite (build tool)
- Zustand (state management)
- CodeMirror 6 (text editing)
- Vitest (testing)
- Million.js (React optimization)

## Project Structure

```
jsonary/
├── src/
│   ├── components/          # React components
│   │   ├── editor/         # Editor-specific components
│   │   ├── layout/         # Layout components (Header, StatusBar)
│   │   └── ui/             # Reusable UI components
│   ├── lib/                # Core libraries and utilities
│   │   ├── json/           # JSON processing (parser, formatter, validator, repair)
│   │   ├── csv/            # CSV processing
│   │   ├── yaml/           # YAML processing
│   │   ├── toml/           # TOML processing
│   │   ├── diff/           # Diff/comparison utilities
│   │   └── schema/         # Schema validation
│   ├── store/              # Zustand state stores
│   ├── hooks/              # Custom React hooks
│   ├── workers/            # Web Workers for heavy processing
│   ├── types/              # TypeScript type definitions
│   └── config/             # Configuration files
├── tests/                  # Test files (mirrors src/ structure)
├── scripts/                # Build and utility scripts
└── public/                 # Static assets
```

## Core Systems

### 1. JSON Processing (`src/lib/json/`)

The JSON processing system is the heart of the editor, consisting of 5 main modules:

#### **Parser** (`parser.ts`)
- **Purpose**: Parse JSON strings into structured data
- **Key Functions**:
  - `parseJson()` - Parse with detailed error reporting
  - `isValidJson()` - Quick validation check
  - `getValueType()` - Determine JSON value types
  - `getValuePreview()` - Generate preview strings
- **Features**: Line/column error reporting, type detection

#### **Formatter** (`formatter.ts`)
- **Purpose**: Format and beautify JSON
- **Key Functions**:
  - `formatJson()` - Pretty-print with indentation
  - `compactJson()` - Minify JSON
  - `sortJsonKeys()` - Sort object keys
  - `smartFormatJson()` - Context-aware formatting
- **Options**: Configurable indentation, spacing, sorting

#### **Repair** (`repair.ts`) ⭐ **Enhanced Feature**
- **Purpose**: Automatically fix broken/malformed JSON
- **Key Functions**:
  - `repairJson()` - Main repair function with options
  - `canRepairJson()` - Check if JSON is repairable
  - `suggestRepairs()` - Analyze and suggest fixes
  - `repairJsonWithDiagnostics()` - Repair with detailed diagnostics
- **Repair Capabilities** (30+ patterns):
  - **Quotes & Strings**: Single quotes, smart quotes, stringified JSON, literal newlines
  - **Missing Elements**: Commas, quotes, closing brackets, truncated JSON
  - **Extra Elements**: Trailing commas, comments, ellipsis
  - **Format Wrappers**: Markdown code fences, JSONP, NDJSON, multiple objects
  - **Language-Specific**: Python literals, JavaScript undefined, MongoDB types
  - **Number Formats**: Hexadecimal, NaN, Infinity
- **Options**:
  - `unescapeStringified` - Unescape double-escaped JSON
  - `wrapMultipleObjects` - Wrap multiple root objects in array
  - `trackChanges` - Track what repairs were made
- **Integration**: Uses `jsonrepair` library for comprehensive pattern matching

#### **Validator** (`validator.ts`)
- **Purpose**: Validate JSON against JSON Schema
- **Key Functions**:
  - `validateJsonSchema()` - Validate against schema
  - `isValidSchema()` - Check schema validity
  - `formatPath()` - Format JSON pointer paths
  - `findPathLine()` - Map validation errors to line numbers
- **Features**: JSON Schema support (draft-07), human-readable error messages

#### **Tokenizer** (`tokenizer.ts`)
- **Purpose**: Tokenize JSON for syntax highlighting
- **Key Functions**:
  - `tokenize()` - Break JSON into tokens
  - `getTokenClass()` - Get CSS class for token type
- **Token Types**: String, number, boolean, null, key, punctuation

### 2. Document Store (`src/store/documentStore.tsx`)

**Purpose**: Manage document state and operations

**State**:
- `documents` - Array of all open documents
- `activeDocumentId` - Currently selected document
- `history` - Undo/redo history

**Actions**:
- `createDocument()` - Create new document
- `updateContent()` - Update document content
- `deleteDocument()` - Remove document
- `undo()` / `redo()` - History navigation
- `importFile()` / `exportFile()` - File I/O

**Features**:
- Multi-document support
- Undo/redo with history tracking
- File format detection
- Validation state tracking

### 3. Editor Store (`src/store/useEditorStore.tsx`)

**Purpose**: Manage editor UI state

**State**:
- `view` - Current view mode (tree, text, table)
- `panelLayout` - Layout mode (single, split, compare)
- `activePanel` - Active panel in split view
- `rightPanelDocId` - Document in right panel

**Actions**:
- `setView()` - Change view mode
- `setPanelLayout()` - Change layout
- `setActivePanel()` - Switch active panel

### 4. Settings Store (`src/store/settingsStore.tsx`)

**Purpose**: Manage user preferences

**Settings**:
- `theme` - Light/dark mode
- `fontSize` - Editor font size
- `indentSize` - JSON indentation
- `autoSave` - Auto-save enablement
- `lineNumbers` - Show line numbers
- `minimap` - Show minimap

## Component Hierarchy

```
App
├── Header
│   ├── Logo
│   ├── DocumentTabs
│   └── SettingsButton
├── EditorLayout
│   ├── EditorToolbar
│   │   ├── ViewToggle (Tree/Text/Table)
│   │   ├── FormatButton
│   │   ├── RepairButton ⭐
│   │   ├── ValidateButton
│   │   └── CompareButton
│   ├── EditorPanel (single or split)
│   │   ├── TreeEditor (JSON tree view)
│   │   ├── TextEditor (CodeMirror)
│   │   └── TableEditor (CSV/tabular data)
│   └── SearchBar
└── StatusBar
    ├── FileInfo
    ├── LineInfo
    ├── ValidationStatus
    └── RepairStatus ⭐
```

### Key Components

#### **EditorToolbar** (`src/components/editor/EditorToolbar.tsx`)
- Provides actions: Format, Compact, Repair, Validate, Compare
- Shows repair button when broken JSON is detected
- Integrates with `RepairPreviewModal` for repair confirmation

#### **RepairPreviewModal** (`src/components/ui/RepairPreviewModal.tsx`) ⭐
- Shows before/after comparison of repairs
- Displays line-by-line diff with color coding
- Statistics: added, removed, unchanged lines
- Keyboard shortcuts: Cmd/Ctrl+Enter to apply, Esc to cancel

#### **TreeEditor** (`src/components/editor/tree/TreeEditor.tsx`)
- Interactive tree view of JSON
- Expand/collapse nodes
- Edit values inline
- Add/remove properties and array items

#### **TextEditor** (`src/components/editor/text/TextEditor.tsx`)
- CodeMirror-based text editor
- Syntax highlighting
- Line numbers, folding
- Search and replace

#### **TableEditor** (`src/components/editor/table/TableEditor.tsx`)
- Tabular view for arrays of objects
- Edit cells inline
- Add/remove rows and columns

## Data Flow

### 1. Document Loading
```
User uploads file
  → FileReader reads content
  → Format detected (JSON/CSV/YAML/TOML)
  → Parser processes content
  → Validator checks if valid (for JSON)
  → Repair suggested if invalid ⭐
  → Document added to store
  → Editor renders content
```

### 2. JSON Repair Flow ⭐
```
User edits JSON → Invalid JSON detected
  ↓
EditorToolbar shows "Repair" button (highlighted)
  ↓
User clicks "Repair"
  ↓
repairJson() called with trackChanges: true
  ↓
Preprocessing:
  1. unescapeStringifiedJson() - Check for double-escaped JSON
  2. fixMultipleObjects() - Wrap multiple root objects
  3. jsonrepair() - Apply 25+ repair patterns
  ↓
RepairPreviewModal shows:
  - Original vs repaired diff
  - Change statistics
  - List of repairs made
  ↓
User approves → Content updated → Document re-validated
User cancels → No changes made
```

### 3. Validation Flow
```
Document content changes
  ↓
Validator checks syntax
  ↓
If schema provided → validateJsonSchema()
  ↓
Errors mapped to line numbers via findPathLine()
  ↓
StatusBar displays validation result
  ↓
If errors → Repair button shown ⭐
```

## Key Features

### 1. JSON Repair System ⭐ **New Enhanced**

**Capabilities**: Fixes 30+ types of broken JSON patterns

**Common Patterns Handled**:
1. **Quotes** - Single quotes, smart quotes, missing quotes
2. **Commas** - Missing commas, trailing commas
3. **Brackets** - Unclosed braces/brackets
4. **Comments** - `//` and `/* */` style
5. **Wrappers** - Markdown code fences, JSONP
6. **Formats** - NDJSON, stringified JSON, multiple objects
7. **Languages** - Python literals, MongoDB types, JavaScript undefined

**API Example**:
```typescript
import { repairJson, suggestRepairs, repairJsonWithDiagnostics } from '@/lib/json';

// Basic repair
const result = repairJson(brokenJson);
if (result.wasRepaired) {
  console.log(result.output);
}

// With options
const result = repairJson(brokenJson, {
  unescapeStringified: true,
  wrapMultipleObjects: true,
  trackChanges: true
});

// Get suggestions
const suggestions = suggestRepairs(brokenJson);
// ["Replace single quotes with double quotes", "Remove trailing commas", ...]

// Full diagnostics
const { result, suggestions, canRepair } = repairJsonWithDiagnostics(brokenJson);
```

### 2. Multi-View Editing
- **Tree View**: Interactive hierarchical view
- **Text View**: Raw text editing with syntax highlighting
- **Table View**: Spreadsheet-like editing for arrays

### 3. Split Panel & Compare
- Side-by-side document comparison
- Synchronized scrolling
- Line-by-line diff highlighting

### 4. Schema Validation
- JSON Schema (draft-07) support
- Real-time validation
- Error highlighting with line numbers

### 5. Search & Transform
- Full-text search across documents
- JSONPath queries
- Bulk transformations

### 6. File Format Support
- JSON (with repair)
- CSV (import/export)
- YAML (convert to/from JSON)
- TOML (convert to/from JSON)

## Testing

**Test Suite**: 325 tests across 11 test files

**Coverage**:
- Unit tests for all lib/ modules
- Integration tests for components
- E2E scenarios for workflows

**JSON Repair Tests** (`tests/lib/json/repair.test.ts`):
- 55 test cases covering all repair patterns
- Options testing (unescapeStringified, wrapMultipleObjects, trackChanges)
- Suggestion engine testing
- Diagnostics API testing

**Run Tests**:
```bash
pnpm test           # Interactive mode
pnpm test:run       # Single run
pnpm test:run repair # Run specific tests
```

## Performance Optimizations

1. **Web Workers**: Heavy processing (parsing, validation) runs in background threads
2. **Million.js**: Virtual DOM optimization for React rendering
3. **Virtualization**: Large lists rendered with virtual scrolling
4. **Debouncing**: User input debounced to reduce re-renders
5. **Lazy Loading**: Code-split routes and heavy components
6. **Memoization**: Expensive computations cached with `useMemo`

## Build & Deployment

**Development**:
```bash
pnpm dev            # Start dev server
pnpm build          # Production build
pnpm preview        # Preview production build
```

**Build Output**:
- Static files in `dist/`
- Optimized bundles with code splitting
- Source maps for debugging

## Future Enhancements

1. **Streaming JSON**: Support for large files via streaming API
2. **Auto-repair on paste**: Automatically fix broken JSON when pasted
3. **Custom repair rules**: User-defined repair patterns
4. **Plugin system**: Extensible architecture for custom formats
5. **Collaborative editing**: Real-time multi-user editing

---

**Last Updated**: 2025-01-01
**Version**: 0.1.0
**Contributors**: AI Assistant + User
