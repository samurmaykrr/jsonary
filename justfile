# Jsonary - Development Commands

# Default recipe: show available commands
default:
    @just --list

# Install dependencies
install:
    bun install

# Start development server
dev:
    bun run dev

# Build for production
build:
    bun run build

# Run ESLint
lint:
    bun run lint

# Preview production build
preview:
    bun run preview

# Run tests in watch mode
test:
    bun run test

# Run tests once
test-run:
    bun run test:run

# Run tests with coverage
test-coverage:
    bun run test:coverage

# Type check
typecheck:
    bunx tsc --noEmit

# Clean build artifacts
clean:
    rm -rf dist node_modules/.vite

# Full clean (including node_modules)
clean-all:
    rm -rf dist node_modules

# Reinstall dependencies
reinstall: clean-all install

# Run lint and tests
check: lint test-run

# Build and preview
build-preview: build preview
