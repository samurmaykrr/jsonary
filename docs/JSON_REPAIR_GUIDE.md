# JSON Repair - Complete Guide

## Overview

The JSON Repair system automatically fixes 30+ types of broken JSON patterns. It's built on the battle-tested `jsonrepair` library with custom enhancements for edge cases.

## Quick Start

```typescript
import { repairJson } from '@/lib/json';

// Simple repair
const result = repairJson('{"name": "John",}'); // Remove trailing comma
console.log(result.output); // {"name": "John"}
console.log(result.wasRepaired); // true
```

## All Supported Patterns

### 1. Quotes & Strings

| Pattern | Input | Output |
|---------|-------|--------|
| **Unquoted keys** | `{name: "John"}` | `{"name": "John"}` |
| **Single quotes** | `{'name': 'John'}` | `{"name": "John"}` |
| **Smart quotes** | `{"name": "John"}` | `{"name": "John"}` |
| **Stringified JSON** | `"{\"name\":\"John\"}"` | `{"name":"John"}` |
| **Literal newlines** | `{"text":"hello\nworld"}` | `{"text":"hello\\nworld"}` |

**Example:**
```typescript
repairJson('{name: "John"}')
// ✓ Fixed: {"name": "John"}

repairJson("{'age': '30'}")
// ✓ Fixed: {"age": "30"}
```

### 2. Missing Elements

| Pattern | Input | Output |
|---------|-------|--------|
| **Missing commas (objects)** | `{"a": 1 "b": 2}` | `{"a": 1, "b": 2}` |
| **Missing commas (arrays)** | `[1 2 3]` | `[1, 2, 3]` |
| **Missing quotes** | `{name: John}` | `{"name": "John"}` |
| **Missing closing brace** | `{"name": "John"` | `{"name": "John"}` |
| **Missing closing bracket** | `[1, 2, 3` | `[1, 2, 3]` |
| **Truncated JSON** | `{"name": "Jo` | `{"name": "Jo"}` |

**Example:**
```typescript
repairJson('{"a": 1 "b": 2}')
// ✓ Fixed: {"a": 1, "b": 2}

repairJson('[1, 2, 3')
// ✓ Fixed: [1, 2, 3]
```

### 3. Extra Elements

| Pattern | Input | Output |
|---------|-------|--------|
| **Trailing commas (objects)** | `{"name": "John",}` | `{"name": "John"}` |
| **Trailing commas (arrays)** | `[1, 2, 3,]` | `[1, 2, 3]` |
| **Line comments** | `{"name": "John"} // comment` | `{"name": "John"}` |
| **Block comments** | `{"name": /* comment */ "John"}` | `{"name": "John"}` |
| **Ellipsis** | `[1, 2, ...]` | `[1, 2]` |

**Example:**
```typescript
repairJson('{"name": "John",}')
// ✓ Fixed: {"name": "John"}

repairJson('[1, 2, 3] // my array')
// ✓ Fixed: [1, 2, 3]
```

### 4. Format Wrappers

| Pattern | Input | Output |
|---------|-------|--------|
| **Markdown code fence** | ` ```json\n{"a": 1}\n``` ` | `{"a": 1}` |
| **JSONP** | `callback({"a": 1})` | `{"a": 1}` |
| **NDJSON** | `{"id": 1}\n{"id": 2}` | `[{"id": 1}, {"id": 2}]` |
| **Multiple objects** | `{"a": {"x": 1}, {"x": 2}}` | `{"a": [{"x": 1}, {"x": 2}]}` |

**Example:**
```typescript
repairJson('```json\n{"name": "John"}\n```')
// ✓ Fixed: {"name": "John"}

repairJson('{"id": 1}\n{"id": 2}')
// ✓ Fixed: [{"id": 1}, {"id": 2}]
```

### 5. Language-Specific

| Pattern | Input | Output |
|---------|-------|--------|
| **Python literals** | `{"active": True, "value": None}` | `{"active": true, "value": null}` |
| **JavaScript undefined** | `{"value": undefined}` | `{"value": null}` |
| **MongoDB NumberLong** | `{"count": NumberLong(42)}` | `{"count": 42}` |
| **MongoDB ISODate** | `{"date": ISODate("2023-01-01")}` | `{"date": "2023-01-01"}` |
| **Numeric keys** | `{1: "one", 2: "two"}` | `{"1": "one", "2": "two"}` |
| **Non-breaking spaces** | `{"name": "John"}` (with nbsp) | `{"name": "John"}` |

**Example:**
```typescript
repairJson('{"active": True, "value": None}')
// ✓ Fixed: {"active": true, "value": null}

repairJson('{"count": NumberLong(42)}')
// ✓ Fixed: {"count": 42}
```

### 6. Number Formats

| Pattern | Input | Output |
|---------|-------|--------|
| **Hexadecimal** | `{"value": 0xFF}` | `{"value": "0xFF"}` |
| **NaN** | `{"value": NaN}` | `{"value": "NaN"}` |
| **Infinity** | `{"value": Infinity}` | `{"value": "Infinity"}` |

**Example:**
```typescript
repairJson('{"value": 0xFF}')
// ✓ Fixed: {"value": "0xFF"}
```

## API Reference

### `repairJson(input, options?)`

Main repair function with configurable options.

**Parameters:**
- `input` (string) - The broken JSON to repair
- `options` (RepairOptions, optional) - Configuration options

**Returns:** `RepairResult`
```typescript
interface RepairResult {
  output: string;        // Repaired JSON (or original if failed)
  wasRepaired: boolean;  // Whether any repairs were made
  error: string | null;  // Error message if repair failed
  changes?: RepairChange[]; // List of changes (if trackChanges: true)
}
```

**Options:**
```typescript
interface RepairOptions {
  unescapeStringified?: boolean;  // Unescape double-escaped JSON (default: true)
  wrapMultipleObjects?: boolean;  // Wrap multiple root objects (default: true)
  trackChanges?: boolean;         // Track what was changed (default: false)
}
```

**Examples:**
```typescript
// Basic usage
const result = repairJson('{name: "John"}');

// With options
const result = repairJson(brokenJson, {
  unescapeStringified: true,
  wrapMultipleObjects: true,
  trackChanges: true
});

// Check what was changed
if (result.wasRepaired && result.changes) {
  result.changes.forEach(change => {
    console.log(`${change.type}: ${change.description}`);
  });
}
// Output:
// general_repair: Applied general JSON repairs (quotes, commas, brackets, etc.)
```

### `canRepairJson(input)`

Quickly check if JSON can be repaired without actually repairing it.

**Parameters:**
- `input` (string) - JSON to check

**Returns:** `boolean`

**Example:**
```typescript
if (canRepairJson('{name: "John"}')) {
  console.log('This can be repaired!');
}
// Output: This can be repaired!
```

### `suggestRepairs(input)`

Analyze JSON and get suggestions for what repairs are needed.

**Parameters:**
- `input` (string) - JSON to analyze

**Returns:** `string[]` - Array of suggestions

**Example:**
```typescript
const suggestions = suggestRepairs('{name: "John",}');
console.log(suggestions);
// Output:
// [
//   "Add quotes around object keys",
//   "Remove trailing commas",
//   "Auto-repair available (1 fixes)"
// ]
```

### `repairJsonWithDiagnostics(input)`

Get comprehensive diagnostics including repair result and suggestions.

**Parameters:**
- `input` (string) - JSON to repair

**Returns:**
```typescript
{
  result: RepairResult;    // Full repair result with changes
  suggestions: string[];   // List of suggested fixes
  canRepair: boolean;      // Whether repair is possible
}
```

**Example:**
```typescript
const diagnostics = repairJsonWithDiagnostics('{name: "John"}');

console.log('Can repair:', diagnostics.canRepair);
console.log('Suggestions:', diagnostics.suggestions);
console.log('Result:', diagnostics.result.output);
console.log('Changes:', diagnostics.result.changes);

// Output:
// Can repair: true
// Suggestions: ["Add quotes around object keys", "Auto-repair available (1 fixes)"]
// Result: {"name":"John"}
// Changes: [{ type: 'general_repair', description: '...' }]
```

## Advanced Usage

### Selective Repair

Disable specific repair stages:

```typescript
// Don't unescape stringified JSON
const result = repairJson(input, {
  unescapeStringified: false
});

// Don't wrap multiple objects
const result = repairJson(input, {
  wrapMultipleObjects: false
});
```

### Track What Changed

Enable change tracking to see what was fixed:

```typescript
const result = repairJson(brokenJson, { trackChanges: true });

result.changes?.forEach(change => {
  switch (change.type) {
    case 'unescaped_stringified':
      console.log('Removed double-escaping');
      break;
    case 'wrapped_multiple_objects':
      console.log('Wrapped multiple objects in array');
      break;
    case 'general_repair':
      console.log('Applied general fixes');
      break;
  }
});
```

### Combine with Validation

Use repair with schema validation:

```typescript
import { repairJson, validateJsonSchema } from '@/lib/json';

// Try to repair first
const repaired = repairJson(brokenJson);

if (repaired.wasRepaired) {
  // Now validate against schema
  const parsed = JSON.parse(repaired.output);
  const errors = validateJsonSchema(parsed, mySchema);

  if (errors.length === 0) {
    console.log('Repaired and valid!');
  }
}
```

## UI Integration

### In the Editor

The repair button appears automatically when invalid JSON is detected:

1. **User edits JSON** → Invalid syntax detected
2. **Repair button appears** in toolbar (highlighted)
3. **User clicks "Repair"**
4. **Preview modal shows** before/after diff
5. **User approves** → Content updated

### Programmatic Usage

```typescript
import { useDocumentActions } from '@/store/useDocumentStore';
import { repairJson } from '@/lib/json';

function MyComponent() {
  const { updateContent } = useDocumentActions();

  const handleRepair = () => {
    const result = repairJson(currentContent);

    if (result.wasRepaired) {
      updateContent(documentId, result.output);
    }
  };

  return <button onClick={handleRepair}>Repair JSON</button>;
}
```

## Performance

- **Fast**: Handles large documents efficiently
- **Streaming support**: Via jsonrepair library for huge files
- **Non-blocking**: Can be run in Web Workers
- **Memory efficient**: O(n) space complexity

## Limitations

Some patterns cannot be automatically repaired:

1. **Completely corrupted structure**: Random characters, no recognizable JSON
2. **Ambiguous repairs**: Multiple valid interpretations
3. **Complex regex patterns**: Converted to strings, not regex objects
4. **Functions**: Cannot preserve JavaScript functions in JSON

For these cases, `repairJson()` will:
- Return `wasRepaired: false`
- Set `error` to description of why repair failed
- Return original input as `output`

## Testing

Run the comprehensive test suite:

```bash
pnpm test:run repair
```

**Test Coverage:**
- 55 test cases
- All 30+ repair patterns
- Options testing
- Suggestion engine
- Diagnostics API

## Further Reading

- [jsonrepair GitHub](https://github.com/josdejong/jsonrepair) - Core repair library
- [JSON Specification](https://www.json.org/) - Official JSON standard
- [Architecture Docs](../ARCHITECTURE.md) - Full codebase documentation

---

**Last Updated**: 2025-01-01
**Version**: 1.0.0
