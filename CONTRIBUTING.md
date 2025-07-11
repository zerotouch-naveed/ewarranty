# Contributing to Extended Warranty Management System

Thank you for your interest in contributing to the Extended Warranty Management System! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- MongoDB 4.4+
- Git

### Setup Development Environment

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/extended-warranty-management.git
   cd extended-warranty-management
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Configure your environment variables
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📝 Development Guidelines

### Code Style
- Use ESLint configuration provided
- Follow existing code patterns
- Use meaningful variable and function names
- Add comments for complex business logic

### Commit Messages
Follow conventional commit format:
```
type(scope): description

Examples:
feat(auth): add refresh token functionality
fix(customer): resolve warranty key generation issue
docs(readme): update installation instructions
```

### Branch Naming
- `feature/description` for new features
- `fix/description` for bug fixes
- `docs/description` for documentation updates
- `refactor/description` for code refactoring

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint
```

## 📋 Pull Request Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write clear, concise code
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   npm test
   npm run lint
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat(scope): your feature description"
   ```

5. **Push to Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**
   - Provide clear description of changes
   - Reference any related issues
   - Include screenshots if UI changes

## 🐛 Bug Reports

When reporting bugs, please include:
- Operating system and version
- Node.js version
- Clear steps to reproduce
- Expected vs actual behavior
- Error messages and stack traces

## 💡 Feature Requests

For feature requests:
- Check if feature already exists
- Provide clear use case
- Explain expected behavior
- Consider backwards compatibility

## 🏗️ Architecture Guidelines

### Adding New Routes
1. Create route file in `routes/`
2. Add business logic to `services.js`
3. Update validation in `utils/validation.js`
4. Add tests
5. Update API documentation

### Database Changes
1. Update schemas in `schemas.js`
2. Consider migration requirements
3. Update related services
4. Test thoroughly

### Adding Middleware
1. Create in `middleware/` directory
2. Follow existing patterns
3. Add comprehensive error handling
4. Document usage

## 📚 Documentation

- Update README.md for major changes
- Add JSDoc comments for functions
- Update API documentation
- Include examples where helpful

## 🔒 Security

- Never commit sensitive data
- Follow security best practices
- Report security issues privately
- Use proper authentication/authorization

## 📞 Questions?

- Create an issue for discussion
- Check existing documentation
- Follow project coding standards

Thank you for contributing! 🙏