# Changelog

All notable changes to the AI Studio Prompt Library extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-01-20

### Added
- **Most Recently Used (MRU) Sorting**: Prompts now automatically sort by usage, with the most recently inserted prompts appearing first
- Enhanced dialog close button detection for improved auto-close functionality
- `lastUsedAt` timestamp tracking for each prompt

### Fixed
- **Auto-Close Dialog Issue**: Fixed system instructions dialog not closing automatically after prompt insertion
- Improved Material Angular dialog compatibility with multiple selector strategies
- Enhanced button detection for both inline and dialog modes

### Changed
- Prompt lists now use MRU sorting instead of alphabetical sorting in UI
- Export functionality uses alphabetical sorting for consistent file output
- Updated storage schema to track prompt usage timestamps

### Technical Improvements
- Added `findDialogCloseButton()` function with multiple fallback selectors
- Refactored sorting logic into reusable `sortPromptsByMRU()` utility function
- Enhanced auto-close logic to handle both dialog and panel modes

## [0.2.0] - Previous Release
- Initial stable release with core functionality
- Basic prompt management and insertion
- Settings and customization options

## [0.1.0] - Initial Release
- Basic extension functionality