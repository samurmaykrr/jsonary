# Jsonary - Development Commands

# Default recipe: show available commands
default:
    @just --list

# Install dependencies
install:
    npm install

# Start development server
dev:
    npm run dev

# Build for production
build:
    npm run build

# Run ESLint
lint:
    npm run lint

# Preview production build
preview:
    npm run preview

# Run tests in watch mode
test:
    npm run test

# Run tests once
test-run:
    npm run test:run

# Run tests with coverage
test-coverage:
    npm run test:coverage

# Type check
typecheck:
    npx tsc --noEmit

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
