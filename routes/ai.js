const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../database/init');
const { authenticate } = require('../middleware/auth');
const { validate, validateUUID } = require('../middleware/validation');

const router = express.Router();

// Mock AI responses - In production, this would integrate with a real AI service
const aiResponses = {
  ecommerce: {
    triggers: ['e-commerce', 'ecommerce', 'online store', 'shop', 'product', 'order'],
    response: "I'll help you create an e-commerce schema! You'll need tables for users, products, orders, and categories. Would you like me to generate these tables with appropriate columns and relationships?"
  },
  user_management: {
    triggers: ['user', 'authentication', 'login', 'auth', 'account'],
    response: "For user management, I recommend starting with a users table containing id, email, password_hash, first_name, last_name, and timestamps. Consider adding a separate user_sessions table for session management and user_roles for permissions."
  },
  blog: {
    triggers: ['blog', 'post', 'article', 'cms', 'content'],
    response: "A blog schema typically needs: users (authors), posts, categories, tags, and comments tables. Posts should have foreign keys to users and categories. Would you like me to create this structure?"
  },
  optimization: {
    triggers: ['optimize', 'performance', 'index', 'speed', 'query'],
    response: "To optimize your schema, consider: 1) Adding indexes on frequently queried columns, 2) Normalizing data to reduce redundancy, 3) Using appropriate data types, 4) Adding foreign key constraints for data integrity."
  },
  normalization: {
    triggers: ['normalize', 'normalization', '1nf', '2nf', '3nf', 'bcnf'],
    response: "Database normalization reduces redundancy. Ensure: 1NF - atomic values, 2NF - no partial dependencies, 3NF - no transitive dependencies. This prevents data anomalies and saves storage space."
  },
  relationships: {
    triggers: ['relationship', 'foreign key', 'join', 'reference', 'link'],
    response: "I can help you design relationships between tables. Common types are one-to-one, one-to-many, and many-to-many. Which tables do you want to connect?"
  },
  data_types: {
    triggers: ['data type', 'varchar', 'integer', 'decimal', 'date', 'boolean'],
    response: "Choose data types carefully: VARCHAR for variable text, INTEGER for whole numbers, DECIMAL for precise decimals, DATE/TIMESTAMP for dates, BOOLEAN for true/false values. Consider length and precision requirements."
  }
};

// AI Chat endpoint
router.post('/chat', authenticate, validate('aiChat'), async (req, res) => {
  try {
    const { message, schemaId, context } = req.body;
    const userId = req.user.id;

    // Generate AI response
    const aiResponse = generateAIResponse(message, context);

    // Save chat history
    const chatId = uuidv4();
    await runQuery(`
      INSERT INTO ai_chat_history (id, user_id, schema_id, message, response, context)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      chatId,
      userId,
      schemaId || null,
      message,
      aiResponse.response,
      JSON.stringify(context || {})
    ]);

    res.json({
      success: true,
      data: {
        response: aiResponse.response,
        suggestions: aiResponse.suggestions || [],
        chatId
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI chat error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'AI chat failed'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Analyze schema for improvements
router.post('/analyze', authenticate, validateUUID('schemaId'), async (req, res) => {
  try {
    const { schemaId } = req.body;
    const userId = req.user.id;

    // Verify user has access to schema
    const schema = await getQuery(`
      SELECT s.* FROM schemas s
      LEFT JOIN schema_collaborators sc ON s.id = sc.schema_id AND sc.user_id = ? AND sc.is_active = 1
      WHERE s.id = ? AND (s.user_id = ? OR sc.user_id IS NOT NULL)
    `, [userId, schemaId, userId]);

    if (!schema) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Schema not found or access denied'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Get schema data for analysis
    const tables = await allQuery(
      'SELECT * FROM tables WHERE schema_id = ?',
      [schemaId]
    );

    const columns = await allQuery(`
      SELECT c.* FROM columns c
      JOIN tables t ON c.table_id = t.id
      WHERE t.schema_id = ?
    `, [schemaId]);

    const relationships = await allQuery(
      'SELECT * FROM relationships WHERE schema_id = ?',
      [schemaId]
    );

    // Perform analysis
    const analysis = analyzeSchema(tables, columns, relationships);

    res.json({
      success: true,
      data: { analysis },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Schema analysis error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Schema analysis failed'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get AI suggestions for schema improvements
router.get('/suggestions/:schemaId', authenticate, validateUUID('schemaId'), async (req, res) => {
  try {
    const { schemaId } = req.params;
    const userId = req.user.id;

    // Verify user has access to schema
    const schema = await getQuery(`
      SELECT s.* FROM schemas s
      LEFT JOIN schema_collaborators sc ON s.id = sc.schema_id AND sc.user_id = ? AND sc.is_active = 1
      WHERE s.id = ? AND (s.user_id = ? OR sc.user_id IS NOT NULL)
    `, [userId, schemaId, userId]);

    if (!schema) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Schema not found or access denied'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Get schema data
    const tables = await allQuery(
      'SELECT * FROM tables WHERE schema_id = ?',
      [schemaId]
    );

    const columns = await allQuery(`
      SELECT c.* FROM columns c
      JOIN tables t ON c.table_id = t.id
      WHERE t.schema_id = ?
    `, [schemaId]);

    // Generate suggestions based on current schema
    const suggestions = generateSchemaSuggestions(tables, columns, schema);

    res.json({
      success: true,
      data: { suggestions },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI suggestions error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate suggestions'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get chat history
router.get('/chat/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { schemaId, limit = 50, offset = 0 } = req.query;

    let whereClause = 'user_id = ?';
    let queryParams = [userId];

    if (schemaId) {
      whereClause += ' AND schema_id = ?';
      queryParams.push(schemaId);
    }

    const chatHistory = await allQuery(`
      SELECT id, schema_id, message, response, context, created_at
      FROM ai_chat_history
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      data: {
        chatHistory: chatHistory.map(chat => ({
          id: chat.id,
          schemaId: chat.schema_id,
          message: chat.message,
          response: chat.response,
          context: chat.context ? JSON.parse(chat.context) : {},
          createdAt: chat.created_at
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat history error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch chat history'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Generate SQL with AI assistance
router.post('/generate-sql', authenticate, validateUUID('schemaId'), async (req, res) => {
  try {
    const { schemaId, prompt, dialect = 'mysql' } = req.body;
    const userId = req.user.id;

    // Verify user has access to schema
    const schema = await getQuery(`
      SELECT s.* FROM schemas s
      LEFT JOIN schema_collaborators sc ON s.id = sc.schema_id AND sc.user_id = ? AND sc.is_active = 1
      WHERE s.id = ? AND (s.user_id = ? OR sc.user_id IS NOT NULL)
    `, [userId, schemaId, userId]);

    if (!schema) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Schema not found or access denied'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Generate SQL based on prompt (mock implementation)
    const generatedSQL = generateSQLFromPrompt(prompt, dialect, schema);

    res.json({
      success: true,
      data: {
        sql: generatedSQL,
        dialect,
        explanation: `Generated SQL query based on your request: "${prompt}"`
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('SQL generation error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'SQL generation failed'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to generate AI responses
function generateAIResponse(message, context = {}) {
  const lowerMessage = message.toLowerCase();
  
  // Find matching response
  for (const [key, config] of Object.entries(aiResponses)) {
    if (config.triggers.some(trigger => lowerMessage.includes(trigger))) {
      return {
        response: config.response,
        suggestions: generateContextualSuggestions(key, context)
      };
    }
  }
  
  // Default responses
  const defaultResponses = [
    "I can help you design better database schemas! Try asking about table structures, relationships, or optimization.",
    "What specific database design challenge are you facing? I can suggest table structures, data types, or relationships.",
    "I'm here to help with your database design! Feel free to ask about normalization, indexing, or specific schema patterns.",
    "Would you like me to suggest improvements to your current schema or help you design new tables?"
  ];
  
  return {
    response: defaultResponses[Math.floor(Math.random() * defaultResponses.length)],
    suggestions: [
      { type: 'general', title: 'Schema Best Practices', description: 'Learn about database design best practices' },
      { type: 'template', title: 'Use a Template', description: 'Start with a pre-built schema template' }
    ]
  };
}

// Helper function to generate contextual suggestions
function generateContextualSuggestions(responseType, context) {
  const suggestions = {
    ecommerce: [
      { type: 'create_table', title: 'Create Users Table', description: 'Add a users table for customer accounts' },
      { type: 'create_table', title: 'Create Products Table', description: 'Add a products table for your inventory' },
      { type: 'create_table', title: 'Create Orders Table', description: 'Add an orders table for customer purchases' }
    ],
    user_management: [
      { type: 'create_table', title: 'Create Users Table', description: 'Add a users table with authentication fields' },
      { type: 'create_table', title: 'Create User Sessions', description: 'Add a sessions table for login management' }
    ],
    blog: [
      { type: 'create_table', title: 'Create Posts Table', description: 'Add a posts table for blog content' },
      { type: 'create_table', title: 'Create Categories Table', description: 'Add categories for organizing posts' }
    ],
    optimization: [
      { type: 'add_index', title: 'Add Database Indexes', description: 'Improve query performance with indexes' },
      { type: 'normalize', title: 'Normalize Schema', description: 'Reduce data redundancy through normalization' }
    ]
  };
  
  return suggestions[responseType] || [];
}

// Helper function to analyze schema
function analyzeSchema(tables, columns, relationships) {
  const issues = [];
  const recommendations = [];
  let score = 100;

  // Check for tables without primary keys
  const tablesWithoutPK = tables.filter(table => {
    const tableColumns = columns.filter(col => col.table_id === table.id);
    return !tableColumns.some(col => col.is_primary_key);
  });

  if (tablesWithoutPK.length > 0) {
    score -= 20;
    tablesWithoutPK.forEach(table => {
      issues.push({
        type: 'primary_key',
        severity: 'high',
        message: 'Table missing primary key',
        table: table.name,
        suggestion: 'Add a primary key column to ensure unique row identification'
      });
    });
  }

  // Check for very long table names
  const longNameTables = tables.filter(table => table.name.length > 30);
  if (longNameTables.length > 0) {
    score -= 5;
    issues.push({
      type: 'naming',
      severity: 'low',
      message: 'Table names are too long',
      suggestion: 'Consider shorter, more concise table names'
    });
  }

  // Check for missing relationships
  if (tables.length > 1 && relationships.length === 0) {
    score -= 15;
    issues.push({
      type: 'relationships',
      severity: 'medium',
      message: 'No relationships defined between tables',
      suggestion: 'Consider adding foreign key relationships to maintain data integrity'
    });
  }

  // Generate recommendations
  if (tables.length === 0) {
    recommendations.push('Start by adding your first table');
  } else {
    recommendations.push('Add indexes on frequently queried columns');
    recommendations.push('Consider adding audit timestamps (created_at, updated_at)');
    recommendations.push('Ensure all foreign key constraints are properly defined');
  }

  return {
    score: Math.max(0, score),
    issues,
    recommendations,
    summary: {
      tablesCount: tables.length,
      columnsCount: columns.length,
      relationshipsCount: relationships.length
    }
  };
}

// Helper function to generate schema suggestions
function generateSchemaSuggestions(tables, columns, schema) {
  const suggestions = [];

  if (tables.length === 0) {
    suggestions.push({
      type: 'getting_started',
      title: 'Add Your First Table',
      description: 'Start by creating a table for your main entity',
      priority: 'high'
    });
  }

  if (tables.length > 0 && !columns.some(col => col.name.includes('created_at'))) {
    suggestions.push({
      type: 'audit_fields',
      title: 'Add Audit Timestamps',
      description: 'Add created_at and updated_at columns to track record changes',
      priority: 'medium'
    });
  }

  if (tables.length > 1 && !tables.some(table => table.name === 'users')) {
    suggestions.push({
      type: 'user_management',
      title: 'Add User Management',
      description: 'Consider adding a users table for authentication and ownership',
      priority: 'medium'
    });
  }

  // Business-specific suggestions based on table names
  const tableNames = tables.map(t => t.name.toLowerCase());
  
  if (tableNames.includes('products') && !tableNames.includes('categories')) {
    suggestions.push({
      type: 'categorization',
      title: 'Add Product Categories',
      description: 'Create a categories table to organize your products',
      priority: 'medium'
    });
  }

  if (tableNames.includes('users') && !tableNames.includes('orders')) {
    suggestions.push({
      type: 'e-commerce',
      title: 'Add Order Management',
      description: 'Consider adding orders and order_items tables for transactions',
      priority: 'low'
    });
  }

  return suggestions;
}

// Helper function to generate SQL from natural language prompt
function generateSQLFromPrompt(prompt, dialect, schema) {
  // This is a mock implementation - in production, you'd use a real AI service
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('select') || lowerPrompt.includes('find') || lowerPrompt.includes('get')) {
    return `-- Generated query based on: "${prompt}"\nSELECT * FROM ${schema.name}_table\nWHERE condition = 'value';`;
  }
  
  if (lowerPrompt.includes('insert') || lowerPrompt.includes('add') || lowerPrompt.includes('create')) {
    return `-- Generated query based on: "${prompt}"\nINSERT INTO ${schema.name}_table (column1, column2)\nVALUES ('value1', 'value2');`;
  }
  
  if (lowerPrompt.includes('update') || lowerPrompt.includes('modify') || lowerPrompt.includes('change')) {
    return `-- Generated query based on: "${prompt}"\nUPDATE ${schema.name}_table\nSET column1 = 'new_value'\nWHERE condition = 'value';`;
  }
  
  if (lowerPrompt.includes('delete') || lowerPrompt.includes('remove')) {
    return `-- Generated query based on: "${prompt}"\nDELETE FROM ${schema.name}_table\nWHERE condition = 'value';`;
  }
  
  return `-- I need more specific information to generate the right SQL query.\n-- Could you specify which table and what operation you want to perform?`;
}

module.exports = router;