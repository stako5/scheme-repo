// Schema Designer Application
class SchemaDesigner {
    constructor() {
        this.currentSchema = {
            id: 'new-schema',
            name: 'New Schema',
            tables: [],
            relationships: []
        };
        
        this.selectedTable = null;
        this.editingTable = null; // Track table being edited
        this.dragState = null;
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        
        // Sample data from the provided JSON
        this.dataTypes = [
            "INTEGER", "BIGINT", "VARCHAR(255)", "TEXT", "DECIMAL(10,2)", 
            "BOOLEAN", "DATE", "TIMESTAMP", "TIME", "BLOB", "JSON"
        ];
        
        this.aiSuggestions = [
            "Generate tables for e-commerce system",
            "Create user management schema", 
            "Design blog database structure",
            "Optimize current schema",
            "Add indexes for better performance",
            "Normalize database structure"
        ];
        
        this.templates = [
            {"name": "E-commerce", "description": "Online store with users, products, orders"},
            {"name": "Blog", "description": "Content management with posts, users, comments"},
            {"name": "CRM", "description": "Customer relationship management system"},
            {"name": "Inventory", "description": "Warehouse and inventory tracking"}
        ];

        this.sampleEcommerceSchema = {
            id: "ecommerce",
            name: "E-commerce Schema",
            tables: [
                {
                    id: "users",
                    name: "users",
                    position: {"x": 100, "y": 100},
                    columns: [
                        {"name": "id", "type": "INTEGER", "primaryKey": true, "required": true},
                        {"name": "email", "type": "VARCHAR(255)", "required": true, "unique": true},
                        {"name": "password_hash", "type": "VARCHAR(255)", "required": true},
                        {"name": "first_name", "type": "VARCHAR(100)", "required": false},
                        {"name": "last_name", "type": "VARCHAR(100)", "required": false},
                        {"name": "created_at", "type": "TIMESTAMP", "required": true}
                    ]
                },
                {
                    id: "products", 
                    name: "products",
                    position: {"x": 400, "y": 100},
                    columns: [
                        {"name": "id", "type": "INTEGER", "primaryKey": true, "required": true},
                        {"name": "name", "type": "VARCHAR(255)", "required": true},
                        {"name": "description", "type": "TEXT", "required": false},
                        {"name": "price", "type": "DECIMAL(10,2)", "required": true},
                        {"name": "stock_quantity", "type": "INTEGER", "required": true},
                        {"name": "category_id", "type": "INTEGER", "required": false}
                    ]
                },
                {
                    id: "orders",
                    name: "orders", 
                    position: {"x": 700, "y": 100},
                    columns: [
                        {"name": "id", "type": "INTEGER", "primaryKey": true, "required": true},
                        {"name": "user_id", "type": "INTEGER", "required": true},
                        {"name": "total_amount", "type": "DECIMAL(10,2)", "required": true},
                        {"name": "status", "type": "VARCHAR(50)", "required": true},
                        {"name": "created_at", "type": "TIMESTAMP", "required": true}
                    ]
                }
            ],
            relationships: [
                {
                    id: "user_orders",
                    sourceTable: "users",
                    sourceColumn: "id", 
                    targetTable: "orders",
                    targetColumn: "user_id",
                    type: "one-to-many"
                }
            ]
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.populateTemplates();
        this.populateAISuggestions();
        this.updateSchemaTree();
        this.updateCanvasOverlay();
        this.generateSQL();
    }
    
    setupEventListeners() {
        // Toolbar buttons
        document.getElementById('newSchemaBtn').addEventListener('click', () => this.newSchema());
        document.getElementById('addTableBtn').addEventListener('click', () => this.addTable());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveSchema());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportSQL());
        document.getElementById('importBtn').addEventListener('click', () => this.importSchema());
        
        // AI Assistant
        document.getElementById('aiAssistantBtn').addEventListener('click', () => this.toggleAIAssistant());
        document.getElementById('closeAiBtn').addEventListener('click', () => this.closeAIAssistant());
        document.getElementById('sendAiBtn').addEventListener('click', () => this.sendAIMessage());
        document.getElementById('aiInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendAIMessage();
        });
        
        // Zoom controls
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoomOut());
        
        // Bottom panel
        document.getElementById('togglePanelBtn').addEventListener('click', () => this.toggleBottomPanel());
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Modal events - Fixed event handling
        document.getElementById('closeModalBtn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.closeModal();
        });
        document.getElementById('cancelModalBtn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.closeModal();
        });
        document.getElementById('saveTableBtn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.saveTable();
        });
        document.getElementById('addColumnBtn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.addColumn();
        });
        
        // Canvas events
        const canvas = document.getElementById('canvas');
        canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Close modal on background click - Fixed
        document.getElementById('tableModal').addEventListener('click', (e) => {
            if (e.target.id === 'tableModal') {
                this.closeModal();
            }
        });
    }
    
    populateTemplates() {
        const templatesList = document.getElementById('templatesList');
        templatesList.innerHTML = '';
        
        this.templates.forEach(template => {
            const templateItem = document.createElement('div');
            templateItem.className = 'template-item';
            templateItem.innerHTML = `
                <div class="template-name">${template.name}</div>
                <div class="template-description">${template.description}</div>
            `;
            templateItem.addEventListener('click', () => this.loadTemplate(template.name));
            templatesList.appendChild(templateItem);
        });
    }
    
    populateAISuggestions() {
        const suggestionButtons = document.getElementById('suggestionButtons');
        suggestionButtons.innerHTML = '';
        
        this.aiSuggestions.forEach(suggestion => {
            const button = document.createElement('button');
            button.className = 'suggestion-btn';
            button.textContent = suggestion;
            button.addEventListener('click', () => this.handleAISuggestion(suggestion));
            suggestionButtons.appendChild(button);
        });
    }
    
    newSchema() {
        if (confirm('Create a new schema? This will clear your current work.')) {
            this.currentSchema = {
                id: 'new-schema',
                name: 'New Schema',
                tables: [],
                relationships: []
            };
            this.selectedTable = null;
            this.editingTable = null;
            this.renderTables();
            this.updateSchemaTree();
            this.updateCanvasOverlay();
            this.generateSQL();
        }
    }
    
    addTable() {
        const tableId = 'table_' + Date.now();
        const newTable = {
            id: tableId,
            name: 'new_table',
            position: { x: 200 + Math.random() * 300, y: 150 + Math.random() * 200 },
            columns: [
                { name: 'id', type: 'INTEGER', primaryKey: true, required: true }
            ]
        };
        
        this.currentSchema.tables.push(newTable);
        this.renderTables();
        this.updateSchemaTree();
        this.updateCanvasOverlay();
        this.generateSQL();
        
        // Open edit modal for the new table
        setTimeout(() => this.editTable(tableId), 100);
    }
    
    editTable(tableId) {
        const table = this.currentSchema.tables.find(t => t.id === tableId);
        if (!table) return;
        
        this.editingTable = table; // Use editingTable instead of selectedTable for modal
        document.getElementById('modalTitle').textContent = 'Edit Table: ' + table.name;
        document.getElementById('tableNameInput').value = table.name;
        
        this.renderColumnsEditor(table.columns);
        
        // Force show modal - Fixed
        const modal = document.getElementById('tableModal');
        modal.style.display = 'flex';
        modal.classList.remove('hidden');
    }
    
    renderColumnsEditor(columns) {
        const columnsList = document.getElementById('columnsList');
        columnsList.innerHTML = '';
        
        columns.forEach((column, index) => {
            const columnDiv = document.createElement('div');
            columnDiv.className = 'column-editor';
            columnDiv.innerHTML = `
                <input type="text" value="${column.name}" placeholder="Column name" class="form-control" style="flex: 1;">
                <select class="form-control" style="flex: 1;">
                    ${this.dataTypes.map(type => 
                        `<option value="${type}" ${type === column.type ? 'selected' : ''}>${type}</option>`
                    ).join('')}
                </select>
                <label style="display: flex; align-items: center; gap: 4px; font-size: var(--font-size-sm);">
                    <input type="checkbox" ${column.primaryKey ? 'checked' : ''}> PK
                </label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: var(--font-size-sm);">
                    <input type="checkbox" ${column.required ? 'checked' : ''}> Required
                </label>
                <button type="button" class="remove-column-btn" data-index="${index}">×</button>
            `;
            
            // Add event listener for remove button
            const removeBtn = columnDiv.querySelector('.remove-column-btn');
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.removeColumn(index);
            });
            
            columnsList.appendChild(columnDiv);
        });
    }
    
    addColumn() {
        if (!this.editingTable) return;
        
        this.editingTable.columns.push({
            name: 'new_column',
            type: 'VARCHAR(255)',
            primaryKey: false,
            required: false
        });
        
        this.renderColumnsEditor(this.editingTable.columns);
    }
    
    removeColumn(index) {
        if (!this.editingTable) return;
        
        this.editingTable.columns.splice(index, 1);
        this.renderColumnsEditor(this.editingTable.columns);
    }
    
    saveTable() {
        if (!this.editingTable) return;
        
        // Update table name
        const tableNameInput = document.getElementById('tableNameInput');
        this.editingTable.name = tableNameInput.value || 'unnamed_table';
        
        // Update columns
        const columnEditors = document.querySelectorAll('.column-editor');
        this.editingTable.columns = [];
        
        columnEditors.forEach(editor => {
            const inputs = editor.querySelectorAll('input, select');
            const column = {
                name: inputs[0].value || 'unnamed_column',
                type: inputs[1].value,
                primaryKey: inputs[2].checked,
                required: inputs[3].checked
            };
            this.editingTable.columns.push(column);
        });
        
        this.closeModal();
        this.renderTables();
        this.updateSchemaTree();
        this.generateSQL();
    }
    
    deleteTable(tableId) {
        if (confirm('Delete this table?')) {
            this.currentSchema.tables = this.currentSchema.tables.filter(t => t.id !== tableId);
            this.currentSchema.relationships = this.currentSchema.relationships.filter(
                r => r.sourceTable !== tableId && r.targetTable !== tableId
            );
            this.renderTables();
            this.updateSchemaTree();
            this.updateCanvasOverlay();
            this.generateSQL();
        }
    }
    
    renderTables() {
        const container = document.getElementById('tablesContainer');
        container.innerHTML = '';
        
        this.currentSchema.tables.forEach(table => {
            const tableElement = this.createTableElement(table);
            container.appendChild(tableElement);
        });
        
        this.renderRelationships();
    }
    
    createTableElement(table) {
        const tableDiv = document.createElement('div');
        tableDiv.className = 'table-card';
        tableDiv.style.left = table.position.x + 'px';
        tableDiv.style.top = table.position.y + 'px';
        tableDiv.dataset.tableId = table.id;
        
        const columnsHTML = table.columns.map(column => `
            <div class="column-item">
                <span class="column-name">${column.name}</span>
                <span class="column-type">${column.type}</span>
                <div class="column-constraints">
                    ${column.primaryKey ? '<span class="constraint-badge primary-key">PK</span>' : ''}
                    ${column.required ? '<span class="constraint-badge">NOT NULL</span>' : ''}
                </div>
            </div>
        `).join('');
        
        tableDiv.innerHTML = `
            <div class="table-header">
                <h3 class="table-name">${table.name}</h3>
                <div class="table-actions">
                    <button class="action-btn edit-table-btn" data-table-id="${table.id}" title="Edit table">✏️</button>
                    <button class="action-btn delete-table-btn" data-table-id="${table.id}" title="Delete table">🗑️</button>
                </div>
            </div>
            <div class="table-body">
                ${columnsHTML}
            </div>
        `;
        
        // Add event listeners for table actions
        const editBtn = tableDiv.querySelector('.edit-table-btn');
        const deleteBtn = tableDiv.querySelector('.delete-table-btn');
        
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.editTable(table.id);
        });
        
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.deleteTable(table.id);
        });
        
        // Add drag functionality
        this.makeDraggable(tableDiv, table);
        
        return tableDiv;
    }
    
    makeDraggable(element, table) {
        let isDragging = false;
        let offset = { x: 0, y: 0 };
        
        element.addEventListener('mousedown', (e) => {
            if (e.target.closest('.table-actions')) return;
            
            isDragging = true;
            offset.x = e.clientX - table.position.x;
            offset.y = e.clientY - table.position.y;
            element.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            table.position.x = e.clientX - offset.x;
            table.position.y = e.clientY - offset.y;
            element.style.left = table.position.x + 'px';
            element.style.top = table.position.y + 'px';
            
            this.renderRelationships();
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'move';
            }
        });
    }
    
    renderRelationships() {
        const svg = document.getElementById('relationshipsSvg');
        svg.innerHTML = '';
        
        this.currentSchema.relationships.forEach(rel => {
            const sourceTable = this.currentSchema.tables.find(t => t.name === rel.sourceTable);
            const targetTable = this.currentSchema.tables.find(t => t.name === rel.targetTable);
            
            if (sourceTable && targetTable) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', sourceTable.position.x + 125);
                line.setAttribute('y1', sourceTable.position.y + 50);
                line.setAttribute('x2', targetTable.position.x + 125);
                line.setAttribute('y2', targetTable.position.y + 50);
                line.setAttribute('stroke', '#667eea');
                line.setAttribute('stroke-width', '2');
                line.setAttribute('marker-end', 'url(#arrowhead)');
                svg.appendChild(line);
            }
        });
    }
    
    updateSchemaTree() {
        const tree = document.getElementById('schemaTree');
        
        if (this.currentSchema.tables.length === 0) {
            tree.innerHTML = '<div class="tree-item">No tables yet</div>';
            return;
        }
        
        tree.innerHTML = this.currentSchema.tables.map(table => 
            `<div class="tree-item table-item" data-table-id="${table.id}">${table.name}</div>`
        ).join('');
        
        // Add click listeners to tree items
        tree.querySelectorAll('.table-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectTable(item.dataset.tableId);
            });
        });
    }
    
    updateCanvasOverlay() {
        const overlay = document.getElementById('canvasOverlay');
        if (this.currentSchema.tables.length === 0) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }
    
    selectTable(tableId) {
        // Remove previous selection
        document.querySelectorAll('.table-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Select new table
        const tableElement = document.querySelector(`[data-table-id="${tableId}"]`);
        if (tableElement) {
            tableElement.classList.add('selected');
            this.selectedTable = this.currentSchema.tables.find(t => t.id === tableId);
            this.updatePropertiesPanel();
        }
    }
    
    updatePropertiesPanel() {
        const propertiesContent = document.querySelector('#propertiesTab .properties-content');
        
        if (this.selectedTable) {
            propertiesContent.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: var(--space-16);">
                    <div>
                        <h4 style="margin: 0 0 var(--space-8) 0;">Table: ${this.selectedTable.name}</h4>
                        <p style="margin: 0; color: var(--color-text-secondary);">Columns: ${this.selectedTable.columns.length}</p>
                    </div>
                    <div class="columns-list">
                        ${this.selectedTable.columns.map(col => `
                            <div style="display: flex; justify-content: space-between; padding: var(--space-8); background: var(--color-secondary); border-radius: var(--radius-sm);">
                                <span style="font-weight: var(--font-weight-medium);">${col.name}</span>
                                <span style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">${col.type}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            propertiesContent.innerHTML = 'Select a table to view properties';
        }
    }
    
    generateSQL() {
        let sql = '';
        
        this.currentSchema.tables.forEach(table => {
            sql += `CREATE TABLE ${table.name} (\n`;
            
            const columnDefinitions = table.columns.map(column => {
                let def = `  ${column.name} ${column.type}`;
                if (column.primaryKey) def += ' PRIMARY KEY';
                if (column.required && !column.primaryKey) def += ' NOT NULL';
                return def;
            });
            
            sql += columnDefinitions.join(',\n');
            sql += '\n);\n\n';
        });
        
        // Add foreign key constraints
        this.currentSchema.relationships.forEach(rel => {
            sql += `ALTER TABLE ${rel.targetTable} ADD CONSTRAINT fk_${rel.targetTable}_${rel.sourceTable} `;
            sql += `FOREIGN KEY (${rel.targetColumn}) REFERENCES ${rel.sourceTable}(${rel.sourceColumn});\n\n`;
        });
        
        document.getElementById('sqlOutput').value = sql;
    }
    
    // AI Assistant functionality
    toggleAIAssistant() {
        const sidebar = document.getElementById('aiSidebar');
        sidebar.classList.toggle('collapsed');
    }
    
    closeAIAssistant() {
        document.getElementById('aiSidebar').classList.add('collapsed');
    }
    
    handleAISuggestion(suggestion) {
        this.addAIMessage(suggestion, 'user');
        
        // Mock AI responses
        setTimeout(() => {
            let response = this.getAIResponse(suggestion);
            this.addAIMessage(response, 'ai');
        }, 1000);
    }
    
    sendAIMessage() {
        const input = document.getElementById('aiInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        this.addAIMessage(message, 'user');
        input.value = '';
        
        // Mock AI response
        setTimeout(() => {
            let response = this.getAIResponse(message);
            this.addAIMessage(response, 'ai');
        }, 1500);
    }
    
    addAIMessage(message, sender) {
        const chatHistory = document.getElementById('chatHistory');
        const messageDiv = document.createElement('div');
        messageDiv.className = `${sender}-message`;
        messageDiv.innerHTML = `<div class="message-bubble">${message}</div>`;
        chatHistory.appendChild(messageDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
    
    getAIResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('e-commerce') || lowerMessage.includes('ecommerce')) {
            return "I'll help you create an e-commerce schema! You'll need tables for users, products, orders, and categories. Would you like me to generate these tables with appropriate columns and relationships?";
        }
        
        if (lowerMessage.includes('user') && lowerMessage.includes('management')) {
            return "For user management, I recommend starting with a users table containing id, email, password_hash, first_name, last_name, and timestamps. You might also want roles and permissions tables for access control.";
        }
        
        if (lowerMessage.includes('blog')) {
            return "A blog schema typically needs: users (authors), posts, categories, tags, and comments tables. Posts should have foreign keys to users and categories. Would you like me to create this structure?";
        }
        
        if (lowerMessage.includes('optimize')) {
            return "To optimize your schema, consider: 1) Adding indexes on frequently queried columns, 2) Normalizing data to reduce redundancy, 3) Using appropriate data types, 4) Adding foreign key constraints for data integrity.";
        }
        
        if (lowerMessage.includes('index')) {
            return "Indexes improve query performance! Add them on: foreign key columns, columns used in WHERE clauses, and columns used for JOINs. But be careful - too many indexes can slow down INSERT/UPDATE operations.";
        }
        
        if (lowerMessage.includes('normalize')) {
            return "Database normalization reduces redundancy. Ensure: 1NF - atomic values, 2NF - no partial dependencies, 3NF - no transitive dependencies. This prevents data anomalies and saves storage space.";
        }
        
        // Default responses
        const responses = [
            "I can help you design better database schemas! Try asking about table structures, relationships, or optimization.",
            "What specific database design challenge are you facing? I can suggest table structures, data types, or relationships.",
            "I'm here to help with your database design! Feel free to ask about normalization, indexing, or specific schema patterns.",
            "Would you like me to suggest improvements to your current schema or help you design new tables?"
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }
    
    // Template loading
    loadTemplate(templateName) {
        if (templateName === 'E-commerce') {
            if (confirm('Load the E-commerce template? This will replace your current schema.')) {
                this.currentSchema = JSON.parse(JSON.stringify(this.sampleEcommerceSchema));
                this.renderTables();
                this.updateSchemaTree();
                this.updateCanvasOverlay();
                this.generateSQL();
            }
        } else {
            alert(`Template "${templateName}" will be available in a future update!`);
        }
    }
    
    // Utility functions
    closeModal() {
        const modal = document.getElementById('tableModal');
        modal.style.display = 'none';
        modal.classList.add('hidden');
        this.editingTable = null;
    }
    
    switchTab(tabName) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab and content
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }
    
    toggleBottomPanel() {
        document.getElementById('bottomPanel').classList.toggle('collapsed');
    }
    
    zoomIn() {
        this.zoomLevel = Math.min(this.zoomLevel * 1.2, 3);
        this.updateZoom();
    }
    
    zoomOut() {
        this.zoomLevel = Math.max(this.zoomLevel / 1.2, 0.3);
        this.updateZoom();
    }
    
    updateZoom() {
        const canvas = document.getElementById('canvas');
        canvas.style.transform = `scale(${this.zoomLevel})`;
        document.querySelector('.zoom-level').textContent = Math.round(this.zoomLevel * 100) + '%';
    }
    
    handleKeyboard(e) {
        // Cmd/Ctrl + N - New table
        if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
            e.preventDefault();
            this.addTable();
        }
        
        // Delete key - Delete selected table
        if (e.key === 'Delete' && this.selectedTable) {
            this.deleteTable(this.selectedTable.id);
        }
        
        // Escape - Close modal/deselect
        if (e.key === 'Escape') {
            this.closeModal();
            this.closeAIAssistant();
        }
    }
    
    handleCanvasClick(e) {
        if (e.target.id === 'canvas' || e.target.className === 'canvas-grid') {
            // Deselect all tables
            document.querySelectorAll('.table-card').forEach(card => {
                card.classList.remove('selected');
            });
            this.selectedTable = null;
            this.updatePropertiesPanel();
        }
    }
    
    handleMouseDown(e) {
        // Canvas panning logic could go here
    }
    
    handleMouseMove(e) {
        // Canvas panning logic could go here
    }
    
    handleMouseUp(e) {
        // Canvas panning logic could go here
    }
    
    saveSchema() {
        const schemaJSON = JSON.stringify(this.currentSchema, null, 2);
        const blob = new Blob([schemaJSON], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentSchema.name.replace(/\s+/g, '_').toLowerCase()}_schema.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    exportSQL() {
        const sql = document.getElementById('sqlOutput').value;
        if (!sql.trim()) {
            alert('No SQL to export. Please add some tables first.');
            return;
        }
        
        const blob = new Blob([sql], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentSchema.name.replace(/\s+/g, '_').toLowerCase()}_schema.sql`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    importSchema() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const schema = JSON.parse(e.target.result);
                    this.currentSchema = schema;
                    this.renderTables();
                    this.updateSchemaTree();
                    this.updateCanvasOverlay();
                    this.generateSQL();
                    alert('Schema imported successfully!');
                } catch (error) {
                    alert('Error importing schema: Invalid JSON format');
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }
}

// Initialize the application
const schemaDesigner = new SchemaDesigner();