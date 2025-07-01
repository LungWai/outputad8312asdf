# Cursor Chat Manager

A powerful VSCode extension that provides enhanced management capabilities for chat history from Cursor IDE, with advanced tagging, organization, and export features.

## 🎯 Key Features

- **Enhanced Chat Management**: Organize and manage Cursor IDE chat history with advanced filtering and search
- **Smart Tagging System**: Tag chats and dialogues for easy categorization and retrieval
- **Workspace Organization**: Automatic project detection with meaningful names (no more hash displays)
- **Export Capabilities**: Export chat history in multiple formats (JSON, HTML, text)
- **Rule Management**: Import and manage Cursor rules with advanced organization
- **Professional Logging**: Production-ready logging system with appropriate verbosity control

## 🚀 Recent Updates

### v0.0.1 - Major Refactoring Complete ✅
- **Fixed workspace name display**: Shows actual folder names instead of hashes
- **Restored tag system**: Tags now properly persist at dialogue and chat level
- **Eliminated console flood**: Replaced 329 console statements with structured logging
- **Optimized code structure**: Modular architecture with centralized configuration
- **Production-ready**: Professional logging system with environment-based levels

## 📦 Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Load the extension in VSCode

## 🔧 Development

### Prerequisites
- Node.js 16+ 
- TypeScript 4.8+
- VSCode 1.85+

### Build Commands
```bash
npm install          # Install dependencies
npm run compile      # Compile TypeScript
npm run watch        # Watch mode for development
npm run package      # Build for production
```

### Environment Configuration
```bash
# Development mode (verbose logging)
NODE_ENV=development
CURSOR_LOG_LEVEL=DEBUG

# Production mode (minimal logging)
NODE_ENV=production
```

## 📖 Architecture

### Core Components
- **Data Access Layer**: Secure reading of Cursor's SQLite databases
- **Service Layer**: Business logic for chat processing, tagging, and organization
- **View Layer**: VSCode tree views and webviews for user interaction
- **Logging System**: Centralized, level-based logging with component identification

### Project Structure
```
src/
├── config/          # Configuration and constants
├── data/           # Data access and storage
├── services/       # Business logic services
├── views/          # UI components
├── commands/       # VSCode command implementations
├── models/         # Data models and types
└── utils/          # Utility functions and logging
```

## 🎛️ Configuration

The extension supports various configuration options:

- **Log Level**: Control verbosity (DEBUG/INFO/WARN/ERROR)
- **Auto-refresh**: Automatic detection of new chat data
- **Export Formats**: Customize export templates
- **Tag Categories**: Organize tags into categories

## 🐛 Troubleshooting

### Common Issues
1. **No chat data found**: Ensure Cursor IDE has been used and has chat history
2. **Permission errors**: Check file permissions on Cursor storage directories
3. **Performance issues**: Adjust log level to INFO or WARN in production

### Debug Mode
Enable debug logging by setting:
```bash
CURSOR_DEBUG=1
NODE_ENV=development
```

## 📊 Logging

The extension uses a professional logging system:
- **Component-based**: Each service logs with its own identifier
- **Level-controlled**: Appropriate verbosity for development vs production
- **Structured output**: Consistent formatting with timestamps and error details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with appropriate logging
4. Ensure TypeScript compilation passes
5. Submit a pull request

### Code Style
- Use the centralized logger instead of console statements
- Follow existing patterns for service organization
- Add appropriate error handling
- Include documentation for new features

## 📜 License

[Add your license here]

## 🔍 Status

**Current Status**: ✅ PRODUCTION READY

- All core functionality implemented and tested
- Console flood eliminated with professional logging
- Tag system fully functional
- Workspace name display corrected
- Comprehensive documentation complete

## 📞 Support

For issues, feature requests, or questions:
- Create an issue in this repository
- Check the troubleshooting section above
- Review the implementation status documentation

---

**Built with ❤️ for the Cursor IDE community**