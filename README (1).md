# Modern Database Schema Designer

A sleek, AI-powered database schema design tool inspired by Apple's design philosophy. Create, visualize, and manage database schemas with an intuitive drag-and-drop interface.

![Database Designer Preview](apple-db-ui.png)

## 🌟 Features

### Core Functionality
- **Visual Schema Design**: Drag-and-drop interface for creating database tables
- **Relationship Management**: Easily define foreign key relationships between tables
- **SQL Export**: Generate clean SQL DDL scripts from your designs
- **AI Assistant Integration**: Get intelligent suggestions and help with database design
- **Real-time Preview**: See your schema structure update in real-time
- **Template Library**: Quick-start with pre-built schema templates

### Design Excellence
- **Apple-Inspired UI**: Clean, minimalist interface following Apple's Human Interface Guidelines
- **Responsive Design**: Works seamlessly across desktop and tablet devices
- **Smooth Animations**: Fluid transitions and interactions
- **Accessibility**: WCAG compliant with keyboard navigation support

### AI-Powered Features
- **Smart Suggestions**: AI assistant provides database design recommendations
- **Schema Optimization**: Get tips for better performance and normalization
- **SQL Generation**: AI helps generate complex queries and table structures
- **Best Practices**: Learn database design patterns and conventions

## 🚀 Quick Start

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No installation required - runs entirely in the browser

### Getting Started
1. Open `index.html` in your web browser
2. Click "Add Table" to create your first database table
3. Edit table names and add columns with appropriate data types
4. Use the AI assistant for suggestions and help
5. Export your schema as SQL when ready

### Development Setup
```bash
# Clone the repository
git clone https://github.com/your-username/modern-db-designer.git

# Navigate to the project directory
cd modern-db-designer

# Open in your preferred web server
# Option 1: Using Python
python -m http.server 8000

# Option 2: Using Node.js http-server
npx http-server

# Option 3: Using Live Server in VS Code
# Install Live Server extension and right-click index.html -> Open with Live Server
```

## 📱 User Interface

### Main Components

#### Toolbar
- **New Schema**: Start with a fresh schema design
- **Add Table**: Create new database tables
- **Save/Load**: Persist your work locally
- **Export SQL**: Generate SQL DDL scripts
- **AI Assistant**: Access intelligent design help

#### Canvas Area
- **Drag & Drop**: Move tables around the design canvas
- **Zoom Controls**: Scale your view for detailed work or overview
- **Grid Background**: Align elements perfectly
- **Relationship Lines**: Visual connections between related tables

#### Sidebars
- **Left Sidebar**: Schema overview, templates, and recent projects
- **Right Sidebar**: AI assistant chat interface
- **Bottom Panel**: SQL preview and table properties

## 🤖 AI Assistant

The integrated AI assistant helps with:

### Database Design Guidance
- **Schema Planning**: Get advice on table structure and relationships
- **Normalization**: Learn about 1NF, 2NF, 3NF, and BCNF
- **Performance**: Index recommendations and query optimization tips
- **Best Practices**: Industry standards and naming conventions

### Code Generation
- **SQL DDL**: Generate CREATE TABLE statements
- **Sample Data**: Create realistic test data
- **Migration Scripts**: Handle schema updates safely
- **Documentation**: Auto-generate schema documentation

### Example AI Interactions
```
User: "How should I design a user authentication system?"
AI: "I recommend starting with a 'users' table containing id (primary key), 
     email (unique), password_hash, and timestamps. Consider adding a separate 
     'user_sessions' table for session management..."

User: "Generate an e-commerce schema"
AI: "I'll create a complete e-commerce schema with users, products, orders, 
     and order_items tables with proper relationships..."
```

## 🎨 Design System

### Apple-Inspired Aesthetics
- **Typography**: San Francisco font family (system fonts)
- **Color Palette**: Clean whites, subtle grays, and accent blues
- **Spacing**: Consistent 8px grid system
- **Rounded Corners**: 12px for cards, 8px for buttons
- **Shadows**: Subtle drop shadows for depth

### Component Library
- **Buttons**: Primary, secondary, and outline variants
- **Cards**: Elevated surfaces for tables and panels
- **Form Elements**: Consistent input styling
- **Icons**: SF Symbols-inspired iconography

## 🔧 Technical Architecture

### Frontend Stack
- **HTML5**: Semantic markup structure
- **CSS3**: Modern styling with CSS Grid and Flexbox
- **Vanilla JavaScript**: No frameworks - pure, performant code
- **LocalStorage**: Client-side data persistence

### Key Classes and Components

#### SchemaDesigner (Main Application)
```javascript
class SchemaDesigner {
    // Core application logic
    // Manages schema state, UI interactions, and AI integration
}
```

#### TableManager
- Table creation and editing
- Column management
- Relationship handling

#### AIAssistant
- Natural language processing
- Context-aware suggestions
- SQL generation

### Data Structure
```javascript
// Schema Object Structure
{
    id: "schema-uuid",
    name: "My Database Schema",
    tables: [
        {
            id: "table-uuid",
            name: "users",
            position: { x: 100, y: 200 },
            columns: [
                {
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true,
                    required: true,
                    unique: false
                }
            ]
        }
    ],
    relationships: [
        {
            id: "rel-uuid",
            sourceTable: "users",
            sourceColumn: "id",
            targetTable: "orders", 
            targetColumn: "user_id",
            type: "one-to-many"
        }
    ]
}
```

## 🛠️ Customization

### Extending the AI Assistant

Add custom AI responses by modifying the `aiResponses` object:

```javascript
const aiResponses = {
    'custom-domain': {
        triggers: ['inventory', 'warehouse', 'stock'],
        response: 'For inventory management, consider...'
    }
};
```

### Adding New Data Types

Extend the supported data types:

```javascript
this.dataTypes = [
    ...this.dataTypes,
    'UUID', 'JSONB', 'ARRAY', 'ENUM'
];
```

### Custom Templates

Create new schema templates:

```javascript
this.templates.push({
    name: "Social Media",
    description: "Posts, users, likes, and comments",
    schema: { /* template schema object */ }
});
```

## 🧪 Testing

### Manual Testing Checklist
- [ ] Create new tables
- [ ] Edit table names and columns
- [ ] Establish relationships between tables
- [ ] Export SQL successfully
- [ ] AI assistant responds appropriately
- [ ] Zoom and pan functionality works
- [ ] Responsive design on mobile/tablet

### Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style Guidelines
- Use semantic HTML5 elements
- Follow BEM methodology for CSS classes
- Write self-documenting JavaScript code
- Maintain consistent indentation (2 spaces)
- Add comments for complex logic

### Areas for Contribution
- 🎨 **UI/UX Improvements**: Enhanced animations, better accessibility
- 🤖 **AI Features**: Smarter suggestions, natural language processing
- 🔧 **Technical Enhancements**: Performance optimizations, new data types
- 📚 **Documentation**: Tutorials, examples, API documentation
- 🌐 **Internationalization**: Multi-language support

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Apple**: For inspiration from their Human Interface Guidelines
- **WWW SQL Designer**: Original concept and foundation
- **Community**: Contributors and users who make this project better

## 📞 Support

### Getting Help
- 📖 Check the documentation first
- 🐛 Report bugs via GitHub Issues
- 💡 Request features via GitHub Issues
- 💬 Join discussions in GitHub Discussions

### FAQ

**Q: Can I use this for commercial projects?**
A: Yes! This project is MIT licensed and free for commercial use.

**Q: Does it work offline?**
A: Yes, once loaded, the application works entirely offline.

**Q: Can I integrate my own AI service?**
A: Absolutely! The AI integration is modular and can be extended.

**Q: What databases are supported for export?**
A: Currently supports MySQL, PostgreSQL, SQLite, and SQL Server.

---

*Built with ❤️ and inspired by great design*
