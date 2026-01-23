# Contributing to Jsonary

Thank you for your interest in contributing to Jsonary! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## Getting Started

### Prerequisites

- **Node.js**: Version 25.2.1 (specified in `.nvmrc`)
  - Use [nvm](https://github.com/nvm-sh/nvm) for easy version management: `nvm use`
- **npm**: Comes with Node.js
- **Git**: For version control

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/jsonary.git
   cd jsonary
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/jsonary.git
   ```

## Development Setup

1. **Install Node.js version** (using nvm):
   ```bash
   nvm use
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Start development server**:
   ```bash
   pnpm dev
   ```
   The app will be available at `http://localhost:5173`

4. **Run tests**:
   ```bash
   pnpm test              # Run tests in watch mode
   pnpm test:run          # Run tests once
   pnpm test:coverage     # Run with coverage report
   ```

5. **Run linter**:
   ```bash
   pnpm lint
   ```

6. **Build for production**:
   ```bash
   pnpm build
   pnpm preview  # Preview production build
   ```

## Project Structure

```
jsonary/
├── src/
│   ├── components/        # React components
│   │   ├── editor/       # Editor view components (Text, Tree, Table)
│   │   ├── layout/       # Layout components (Header, TabBar, StatusBar)
│   │   └── ui/           # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Core utilities and libraries
│   │   ├── json/         # JSON processing (parser, formatter, etc.)
│   │   ├── csv/          # CSV import/export
│   │   ├── diff/         # JSON diff algorithms
│   │   └── storage/      # IndexedDB persistence
│   ├── store/            # State management (React Context)
│   ├── workers/          # Web Workers for heavy processing
│   ├── types/            # TypeScript type definitions
│   └── config/           # App configuration
├── tests/                # Test files (mirrors src structure)
├── public/               # Static assets
└── scripts/              # Build and utility scripts
```

## Development Workflow

### Creating a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation changes
- `test/` - Test additions/improvements

### Making Changes

1. **Write code** following our [coding standards](#coding-standards)
2. **Add tests** for new functionality
3. **Update documentation** if needed
4. **Run tests and linter** before committing:
   ```bash
   npm test
   npm run lint
   ```

### Git Hooks

We use Husky and lint-staged for pre-commit checks:
- ESLint runs automatically on staged files
- Tests run for affected files
- If checks fail, the commit is blocked

To bypass hooks (not recommended):
```bash
git commit --no-verify
```

## Coding Standards

### TypeScript

- **Use strict TypeScript**: No `any` types unless absolutely necessary
- **Define interfaces/types** for all data structures
- **Use functional components** with TypeScript types for props
- **Prefer `const` over `let`**, avoid `var`

### React

- **Functional components** with hooks (no class components)
- **Custom hooks** for reusable logic
- **Proper cleanup** in `useEffect` hooks
- **Memoization** where appropriate (`useMemo`, `useCallback`)
- **Accessibility**: Include ARIA labels and keyboard navigation

### Styling

- **Tailwind CSS** for styling (utility-first)
- **Use design system variables** for colors and spacing
- **Responsive design**: Mobile-first approach
- **Dark mode support**: Test in both themes

### File Organization

- **One component per file**
- **Co-locate related files** (component + test)
- **Named exports** for utilities, default exports for components
- **Barrel exports** (`index.ts`) for cleaner imports

### Code Style

We use ESLint for code style enforcement. Key rules:
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- No unused variables
- React Hooks rules enforced

## Testing

### Test Structure

- **Unit tests**: For utilities in `src/lib/`
- **Component tests**: For React components
- **Integration tests**: For complex workflows
- **Coverage threshold**: Aim for >80%

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { YourComponent } from './YourComponent'

describe('YourComponent', () => {
  it('should render correctly', () => {
    render(<YourComponent />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })
})
```

### Running Tests

```bash
pnpm test                   # Watch mode
pnpm test:run              # Single run
pnpm test:coverage         # With coverage
pnpm test:browser          # Browser mode
```

### Coverage Reports

- Coverage reports are generated in `coverage/` directory
- View HTML report: `open coverage/index.html`
- Target coverage: 80%+ for new code

## Submitting Changes

### Before Submitting

1. **Sync with upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run full test suite**:
   ```bash
   pnpm test:run
   pnpm lint
   pnpm build
   ```

3. **Update documentation** if needed

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build/tooling changes

Examples:
```
feat(editor): add Monaco editor integration

Replaced custom text editor with Monaco for better syntax highlighting
and advanced editing features.

Closes #123
```

```
fix(parser): handle malformed JSON with trailing commas

Updated parser to provide better error messages for trailing commas.
```

### Pull Request Process

1. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request** on GitHub:
   - Clear title describing the change
   - Detailed description of what/why
   - Reference related issues
   - Screenshots for UI changes

3. **PR Checklist**:
   - [ ] Tests added/updated
   - [ ] Documentation updated
   - [ ] No lint errors
   - [ ] All tests passing
   - [ ] No breaking changes (or documented)
   - [ ] Screenshots included (for UI changes)

4. **Review process**:
   - Address reviewer feedback
   - Keep commits clean (squash if needed)
   - Rebase on main if needed

5. **After approval**:
   - Maintainers will merge your PR
   - Your changes will appear in the next release

## Reporting Issues

### Bug Reports

Include:
- **Clear title** and description
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Environment details**: OS, browser, Node version
- **Error messages** and console logs

### Feature Requests

Include:
- **Use case**: Why is this needed?
- **Proposed solution**: How should it work?
- **Alternatives considered**
- **Examples** from other tools if applicable

### Questions

- Check existing documentation first
- Search existing issues
- Use GitHub Discussions for general questions

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## Getting Help

- **Documentation**: Check README.md and inline code comments
- **Issues**: Search existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Jsonary! Your efforts help make this tool better for everyone.
