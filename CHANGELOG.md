# Changelog

All notable changes to Jsonary will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- GitHub Actions CI/CD pipeline with automated testing and builds
- Node version management with `.nvmrc` file
- Comprehensive contributing guidelines in `CONTRIBUTING.md`
- Docker support with `Dockerfile` and `docker-compose.yml`
- Command palette for quick access to features
- Monaco Editor integration for advanced text editing
- YAML export functionality
- TOML export functionality
- PWA configuration for offline support
- Additional component tests for editor components

### Changed
- Improved test coverage across components and utilities
- Enhanced mobile responsiveness

### Fixed
- Various bug fixes and performance improvements

## [0.1.0] - 2025-12-31

### Added
- Initial release of Jsonary
- Multi-view editing: Text, Tree, and Table views
- Multi-document support with tabbed interface
- JSON formatting and minification
- JSON repair for malformed input
- JSONPath querying with filter expressions
- JSON Schema validation
- JSON diff/compare with side-by-side view
- CSV import and export
- Syntax highlighting with custom tokenizer
- Code folding and line numbers
- Search and replace with regex support
- Dark/Light theme with system preference
- Customizable fonts via Google Fonts
- Session persistence using IndexedDB
- Web Workers for heavy processing
- Keyboard shortcuts (30+ shortcuts)
- Split view for comparing documents
- Undo/Redo with full history
- Auto-save with debouncing
- Responsive design for mobile devices

### Technical
- React 19.2.0 with TypeScript
- Vite 7.2.4 build tooling
- Tailwind CSS 4.1.10 for styling
- Vitest for testing with coverage
- ESLint with strict TypeScript rules
- Husky pre-commit hooks
- IndexedDB for persistence

[Unreleased]: https://github.com/USERNAME/jsonary/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/USERNAME/jsonary/releases/tag/v0.1.0
