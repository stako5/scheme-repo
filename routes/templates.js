const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../database/init');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { validate, validateUUID } = require('../middleware/validation');

const router = express.Router();

// Get all templates (public + user's private templates)
router.get('/', optionalAuthenticate, validate('listQuery', 'query'), async (req, res) => {
  try {
    const { page, limit, search, sortBy, order, category } = req.query;
    const userId = req.user?.id;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = `(t.is_public = 1)`;
    let queryParams = [];

    if (userId) {
      whereClause = `(t.is_public = 1 OR t.user_id = ?)`;
      queryParams.push(userId);
    }

    if (search) {
      whereClause += ` AND (t.name LIKE ? OR t.description LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      whereClause += ` AND t.category = ?`;
      queryParams.push(category);
    }

    // Build ORDER BY clause
    const validSortFields = {
      name: 't.name',
      createdAt: 't.created_at',
      updatedAt: 't.updated_at',
      usageCount: 't.usage_count',
      rating: 't.rating'
    };
    
    const orderBy = `${validSortFields[sortBy] || 't.created_at'} ${order.toUpperCase()}`;

    // Get templates
    const templates = await allQuery(`
      SELECT 
        t.id,
        t.name,
        t.description,
        t.category,
        t.is_public,
        t.usage_count,
        t.rating,
        t.tags,
        t.created_at,
        t.updated_at,
        u.first_name || ' ' || u.last_name as author_name,
        CASE WHEN t.user_id = ? THEN 1 ELSE 0 END as is_owner
      FROM templates t
      JOIN users u ON t.user_id = u.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [userId, ...queryParams, limit, offset]);

    // Get total count
    const totalResult = await getQuery(`
      SELECT COUNT(*) as total
      FROM templates t
      WHERE ${whereClause}
    `, queryParams);

    const total = totalResult.total;
    const totalPages = Math.ceil(total / limit);

    // Parse tags and calculate preview info
    const templatesWithPreview = templates.map(template => {
      let tags = [];
      let preview = { tablesCount: 0, relationshipsCount: 0 };
      
      try {
        if (template.tags) {
          tags = JSON.parse(template.tags);
        }
      } catch (e) {
        console.error('Error parsing template tags:', e);
      }

      try {
        if (template.schema_data) {
          const schemaData = JSON.parse(template.schema_data);
          preview.tablesCount = schemaData.tables?.length || 0;
          preview.relationshipsCount = schemaData.relationships?.length || 0;
        }
      } catch (e) {
        console.error('Error parsing template schema data:', e);
      }

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        isPublic: Boolean(template.is_public),
        usageCount: template.usage_count,
        rating: template.rating,
        tags,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        authorName: template.author_name,
        isOwner: Boolean(template.is_owner),
        preview
      };
    });

    res.json({
      success: true,
      data: {
        templates: templatesWithPreview,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get templates error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch templates'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get template details
router.get('/:templateId', optionalAuthenticate, validateUUID('templateId'), async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user?.id;

    // Get template
    const template = await getQuery(`
      SELECT 
        t.*,
        u.first_name || ' ' || u.last_name as author_name
      FROM templates t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ? AND (t.is_public = 1 OR t.user_id = ?)
    `, [templateId, userId || '']);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Template not found'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Parse schema data and tags
    let schemaData = {};
    let tags = [];

    try {
      if (template.schema_data) {
        schemaData = JSON.parse(template.schema_data);
      }
    } catch (e) {
      console.error('Error parsing template schema data:', e);
    }

    try {
      if (template.tags) {
        tags = JSON.parse(template.tags);
      }
    } catch (e) {
      console.error('Error parsing template tags:', e);
    }

    res.json({
      success: true,
      data: {
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          isPublic: Boolean(template.is_public),
          usageCount: template.usage_count,
          rating: template.rating,
          tags,
          createdAt: template.created_at,
          updatedAt: template.updated_at,
          authorName: template.author_name,
          isOwner: template.user_id === userId,
          schemaData
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get template error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch template'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Create template from schema
router.post('/', authenticate, validate('template'), async (req, res) => {
  try {
    const { schemaId, name, description, category, isPublic, tags } = req.body;
    const userId = req.user.id;

    // Verify user owns the schema or has editor access
    const schema = await getQuery(`
      SELECT s.*, 
        CASE 
          WHEN s.user_id = ? THEN 'owner'
          ELSE sc.role
        END as user_role
      FROM schemas s
      LEFT JOIN schema_collaborators sc ON s.id = sc.schema_id AND sc.user_id = ? AND sc.is_active = 1
      WHERE s.id = ?
    `, [userId, userId, schemaId]);

    if (!schema || (schema.user_role !== 'owner' && schema.user_role !== 'editor')) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Access denied to this schema'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Get full schema data
    const tables = await allQuery(
      'SELECT * FROM tables WHERE schema_id = ? ORDER BY name',
      [schemaId]
    );

    const columns = await allQuery(`
      SELECT c.* FROM columns c
      JOIN tables t ON c.table_id = t.id
      WHERE t.schema_id = ?
      ORDER BY c.table_id, c.order_index, c.name
    `, [schemaId]);

    const relationships = await allQuery(
      'SELECT * FROM relationships WHERE schema_id = ?',
      [schemaId]
    );

    // Build schema data object
    const tableColumnsMap = {};
    columns.forEach(column => {
      if (!tableColumnsMap[column.table_id]) {
        tableColumnsMap[column.table_id] = [];
      }
      tableColumnsMap[column.table_id].push(column);
    });

    const schemaData = {
      tables: tables.map(table => ({
        ...table,
        columns: tableColumnsMap[table.id] || []
      })),
      relationships
    };

    // Create template
    const templateId = uuidv4();
    await runQuery(`
      INSERT INTO templates (id, user_id, name, description, category, is_public, schema_data, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      templateId,
      userId,
      name,
      description || '',
      category,
      isPublic,
      JSON.stringify(schemaData),
      JSON.stringify(tags)
    ]);

    // Get created template
    const template = await getQuery(
      'SELECT * FROM templates WHERE id = ?',
      [templateId]
    );

    res.status(201).json({
      success: true,
      data: {
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          isPublic: Boolean(template.is_public),
          usageCount: template.usage_count,
          rating: template.rating,
          tags: JSON.parse(template.tags || '[]'),
          createdAt: template.created_at,
          updatedAt: template.updated_at
        }
      },
      message: 'Template created successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Create template error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create template'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Update template
router.put('/:templateId', authenticate, validateUUID('templateId'), async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, description, category, isPublic, tags } = req.body;
    const userId = req.user.id;

    // Verify user owns the template
    const template = await getQuery(
      'SELECT user_id FROM templates WHERE id = ?',
      [templateId]
    );

    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Template not found'
        },
        timestamp: new Date().toISOString()
      });
    }

    if (template.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Access denied to this template'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Build update query
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (isPublic !== undefined) updateData.is_public = isPublic;
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No valid fields to update'
        },
        timestamp: new Date().toISOString()
      });
    }

    updateData.updated_at = new Date().toISOString();

    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), templateId];

    await runQuery(
      `UPDATE templates SET ${fields} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Template updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Update template error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update template'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Delete template
router.delete('/:templateId', authenticate, validateUUID('templateId'), async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;

    // Verify user owns the template
    const template = await getQuery(
      'SELECT user_id FROM templates WHERE id = ?',
      [templateId]
    );

    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Template not found'
        },
        timestamp: new Date().toISOString()
      });
    }

    if (template.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Access denied to this template'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Delete template
    await runQuery('DELETE FROM templates WHERE id = ?', [templateId]);

    res.json({
      success: true,
      message: 'Template deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Delete template error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete template'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Increment template usage count
router.post('/:templateId/use', optionalAuthenticate, validateUUID('templateId'), async (req, res) => {
  try {
    const { templateId } = req.params;

    // Increment usage count
    await runQuery(
      'UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?',
      [templateId]
    );

    res.json({
      success: true,
      message: 'Template usage recorded',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Template usage error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to record template usage'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get template categories
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await allQuery(`
      SELECT category, COUNT(*) as count
      FROM templates
      WHERE is_public = 1
      GROUP BY category
      ORDER BY count DESC, category
    `);

    res.json({
      success: true,
      data: {
        categories: categories.map(cat => ({
          name: cat.category,
          count: cat.count
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get categories error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch categories'
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;