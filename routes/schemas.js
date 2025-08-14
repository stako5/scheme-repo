const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../database/init');
const { authenticate, authorizeSchemaAccess } = require('../middleware/auth');
const { validate, validateUUID, validateUUIDs } = require('../middleware/validation');
const SQLGenerator = require('../utils/sqlGenerator');

const router = express.Router();

// Get all schemas for authenticated user
router.get('/', authenticate, validate('listQuery', 'query'), async (req, res) => {
  try {
    const { page, limit, search, sortBy, order } = req.query;
    const userId = req.user.id;
    const offset = (page - 1) * limit;

    // Build WHERE clause for search
    let whereClause = `(s.user_id = ? OR sc.user_id = ?)`;
    let queryParams = [userId, userId];

    if (search) {
      whereClause += ` AND (s.name LIKE ? OR s.description LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // Build ORDER BY clause
    const orderBy = `s.${sortBy} ${order.toUpperCase()}`;

    // Get schemas with collaboration info
    const schemas = await allQuery(`
      SELECT DISTINCT
        s.id,
        s.name,
        s.description,
        s.is_public,
        s.version,
        s.created_at,
        s.updated_at,
        s.user_id,
        u.first_name || ' ' || u.last_name as owner_name,
        COALESCE(sc.role, 'owner') as user_role,
        (SELECT COUNT(*) FROM tables WHERE schema_id = s.id) as tables_count,
        (SELECT COUNT(*) FROM schema_collaborators WHERE schema_id = s.id AND is_active = 1) + 1 as collaborators_count
      FROM schemas s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN schema_collaborators sc ON s.id = sc.schema_id AND sc.user_id = ? AND sc.is_active = 1
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [...queryParams, userId, limit, offset]);

    // Get total count for pagination
    const totalResult = await getQuery(`
      SELECT COUNT(DISTINCT s.id) as total
      FROM schemas s
      LEFT JOIN schema_collaborators sc ON s.id = sc.schema_id AND sc.user_id = ? AND sc.is_active = 1
      WHERE ${whereClause}
    `, [userId, ...queryParams.slice(2)]);

    const total = totalResult.total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        schemas: schemas.map(schema => ({
          id: schema.id,
          name: schema.name,
          description: schema.description,
          isPublic: Boolean(schema.is_public),
          version: schema.version,
          createdAt: schema.created_at,
          updatedAt: schema.updated_at,
          ownerName: schema.owner_name,
          userRole: schema.user_role,
          tablesCount: schema.tables_count,
          collaboratorsCount: schema.collaborators_count,
          isOwner: schema.user_id === userId
        })),
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
    console.error('Get schemas error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch schemas'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get specific schema with full details
router.get('/:schemaId', authenticate, validateUUID('schemaId'), authorizeSchemaAccess('viewer'), async (req, res) => {
  try {
    const { schemaId } = req.params;

    // Get schema details
    const schema = await getQuery(`
      SELECT s.*, u.first_name || ' ' || u.last_name as owner_name
      FROM schemas s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [schemaId]);

    if (!schema) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Schema not found'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Get tables
    const tables = await allQuery(`
      SELECT * FROM tables 
      WHERE schema_id = ? 
      ORDER BY name
    `, [schemaId]);

    // Get columns for all tables
    const columns = await allQuery(`
      SELECT c.* FROM columns c
      JOIN tables t ON c.table_id = t.id
      WHERE t.schema_id = ?
      ORDER BY c.table_id, c.order_index, c.name
    `, [schemaId]);

    // Get relationships
    const relationships = await allQuery(`
      SELECT r.*, 
        st.name as source_table_name,
        sc.name as source_column_name,
        tt.name as target_table_name,
        tc.name as target_column_name
      FROM relationships r
      JOIN tables st ON r.source_table_id = st.id
      JOIN columns sc ON r.source_column_id = sc.id
      JOIN tables tt ON r.target_table_id = tt.id
      JOIN columns tc ON r.target_column_id = tc.id
      WHERE r.schema_id = ?
    `, [schemaId]);

    // Group columns by table
    const tableColumnsMap = {};
    columns.forEach(column => {
      if (!tableColumnsMap[column.table_id]) {
        tableColumnsMap[column.table_id] = [];
      }
      tableColumnsMap[column.table_id].push({
        id: column.id,
        name: column.name,
        dataType: column.data_type,
        length: column.length,
        precision: column.precision_val,
        scale: column.scale_val,
        isPrimaryKey: Boolean(column.is_primary_key),
        isForeignKey: Boolean(column.is_foreign_key),
        isUnique: Boolean(column.is_unique),
        isRequired: Boolean(column.is_required),
        isAutoIncrement: Boolean(column.is_auto_increment),
        defaultValue: column.default_value,
        description: column.description,
        orderIndex: column.order_index
      });
    });

    // Build response
    const schemaData = {
      id: schema.id,
      name: schema.name,
      description: schema.description,
      isPublic: Boolean(schema.is_public),
      version: schema.version,
      createdAt: schema.created_at,
      updatedAt: schema.updated_at,
      ownerName: schema.owner_name,
      userRole: req.userRole,
      tables: tables.map(table => ({
        id: table.id,
        name: table.name,
        description: table.description,
        position: {
          x: table.position_x,
          y: table.position_y
        },
        color: table.color,
        columns: tableColumnsMap[table.id] || []
      })),
      relationships: relationships.map(rel => ({
        id: rel.id,
        sourceTableId: rel.source_table_id,
        sourceColumnId: rel.source_column_id,
        targetTableId: rel.target_table_id,
        targetColumnId: rel.target_column_id,
        relationshipType: rel.relationship_type,
        onDelete: rel.on_delete,
        onUpdate: rel.on_update,
        name: rel.name,
        description: rel.description,
        sourceTableName: rel.source_table_name,
        sourceColumnName: rel.source_column_name,
        targetTableName: rel.target_table_name,
        targetColumnName: rel.target_column_name
      }))
    };

    res.json({
      success: true,
      data: { schema: schemaData },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get schema error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch schema'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Create new schema
router.post('/', authenticate, validate('schema'), async (req, res) => {
  try {
    const { name, description, isPublic, templateId } = req.body;
    const userId = req.user.id;
    const schemaId = uuidv4();

    // Create schema
    await runQuery(`
      INSERT INTO schemas (id, user_id, name, description, is_public, version)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [schemaId, userId, name, description || '', isPublic, '1.0.0']);

    // If template is specified, copy its structure
    if (templateId) {
      try {
        const template = await getQuery(
          'SELECT schema_data FROM templates WHERE id = ? AND (is_public = 1 OR user_id = ?)',
          [templateId, userId]
        );

        if (template) {
          const templateData = JSON.parse(template.schema_data);
          // TODO: Implement template copying logic here
          // This would involve creating tables, columns, and relationships from template
        }
      } catch (templateError) {
        console.error('Template copying error:', templateError);
        // Continue without template if there's an error
      }
    }

    // Get the created schema
    const schema = await getQuery(
      'SELECT * FROM schemas WHERE id = ?',
      [schemaId]
    );

    res.status(201).json({
      success: true,
      data: {
        schema: {
          id: schema.id,
          name: schema.name,
          description: schema.description,
          isPublic: Boolean(schema.is_public),
          version: schema.version,
          createdAt: schema.created_at,
          updatedAt: schema.updated_at,
          tables: [],
          relationships: []
        }
      },
      message: 'Schema created successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Create schema error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create schema'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Update schema
router.put('/:schemaId', authenticate, validateUUID('schemaId'), authorizeSchemaAccess('editor'), validate('schemaUpdate'), async (req, res) => {
  try {
    const { schemaId } = req.params;
    const updateData = req.body;

    // Build update query
    const fields = Object.keys(updateData).map(key => {
      const dbKey = key === 'isPublic' ? 'is_public' : key;
      return `${dbKey} = ?`;
    }).join(', ');
    
    const values = Object.values(updateData);
    values.push(new Date().toISOString(), schemaId);

    await runQuery(
      `UPDATE schemas SET ${fields}, updated_at = ? WHERE id = ?`,
      values
    );

    // Get updated schema
    const schema = await getQuery(
      'SELECT * FROM schemas WHERE id = ?',
      [schemaId]
    );

    res.json({
      success: true,
      data: {
        schema: {
          id: schema.id,
          name: schema.name,
          description: schema.description,
          isPublic: Boolean(schema.is_public),
          version: schema.version,
          createdAt: schema.created_at,
          updatedAt: schema.updated_at
        }
      },
      message: 'Schema updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Update schema error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update schema'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Delete schema
router.delete('/:schemaId', authenticate, validateUUID('schemaId'), authorizeSchemaAccess('owner'), async (req, res) => {
  try {
    const { schemaId } = req.params;

    // Delete schema (cascade will handle related tables, columns, relationships)
    const result = await runQuery(
      'DELETE FROM schemas WHERE id = ?',
      [schemaId]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Schema not found'
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Schema deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Delete schema error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete schema'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Create table in schema
router.post('/:schemaId/tables', authenticate, validateUUID('schemaId'), authorizeSchemaAccess('editor'), validate('table'), async (req, res) => {
  try {
    const { schemaId } = req.params;
    const { name, description, position, color } = req.body;
    const tableId = uuidv4();

    // Check if table name already exists in schema
    const existingTable = await getQuery(
      'SELECT id FROM tables WHERE schema_id = ? AND name = ?',
      [schemaId, name]
    );

    if (existingTable) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_RESOURCE',
          message: 'Table with this name already exists in schema'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Create table
    await runQuery(`
      INSERT INTO tables (id, schema_id, name, description, position_x, position_y, color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [tableId, schemaId, name, description || '', position.x, position.y, color || '#ffffff']);

    // Create default ID column
    const columnId = uuidv4();
    await runQuery(`
      INSERT INTO columns (id, table_id, name, data_type, is_primary_key, is_required, is_auto_increment, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [columnId, tableId, 'id', 'INTEGER', 1, 1, 1, 0]);

    // Update schema timestamp
    await runQuery(
      'UPDATE schemas SET updated_at = ? WHERE id = ?',
      [new Date().toISOString(), schemaId]
    );

    // Get the created table with columns
    const table = await getQuery(
      'SELECT * FROM tables WHERE id = ?',
      [tableId]
    );

    const columns = await allQuery(
      'SELECT * FROM columns WHERE table_id = ? ORDER BY order_index, name',
      [tableId]
    );

    res.status(201).json({
      success: true,
      data: {
        table: {
          id: table.id,
          name: table.name,
          description: table.description,
          position: {
            x: table.position_x,
            y: table.position_y
          },
          color: table.color,
          columns: columns.map(col => ({
            id: col.id,
            name: col.name,
            dataType: col.data_type,
            length: col.length,
            precision: col.precision_val,
            scale: col.scale_val,
            isPrimaryKey: Boolean(col.is_primary_key),
            isForeignKey: Boolean(col.is_foreign_key),
            isUnique: Boolean(col.is_unique),
            isRequired: Boolean(col.is_required),
            isAutoIncrement: Boolean(col.is_auto_increment),
            defaultValue: col.default_value,
            description: col.description,
            orderIndex: col.order_index
          }))
        }
      },
      message: 'Table created successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Create table error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create table'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Update table
router.put('/:schemaId/tables/:tableId', authenticate, validateUUIDs('schemaId', 'tableId'), authorizeSchemaAccess('editor'), async (req, res) => {
  try {
    const { schemaId, tableId } = req.params;
    const { name, description, position, color } = req.body;

    // Verify table belongs to schema
    const table = await getQuery(
      'SELECT id FROM tables WHERE id = ? AND schema_id = ?',
      [tableId, schemaId]
    );

    if (!table) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Table not found in schema'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Build update query
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (position?.x !== undefined) updateData.position_x = position.x;
    if (position?.y !== undefined) updateData.position_y = position.y;
    if (color !== undefined) updateData.color = color;

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
    const values = [...Object.values(updateData), tableId];

    await runQuery(
      `UPDATE tables SET ${fields} WHERE id = ?`,
      values
    );

    // Update schema timestamp
    await runQuery(
      'UPDATE schemas SET updated_at = ? WHERE id = ?',
      [new Date().toISOString(), schemaId]
    );

    res.json({
      success: true,
      message: 'Table updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Update table error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update table'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Delete table
router.delete('/:schemaId/tables/:tableId', authenticate, validateUUIDs('schemaId', 'tableId'), authorizeSchemaAccess('editor'), async (req, res) => {
  try {
    const { schemaId, tableId } = req.params;

    // Verify table belongs to schema
    const table = await getQuery(
      'SELECT id FROM tables WHERE id = ? AND schema_id = ?',
      [tableId, schemaId]
    );

    if (!table) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Table not found in schema'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Delete table (cascade will handle columns and relationships)
    await runQuery('DELETE FROM tables WHERE id = ?', [tableId]);

    // Update schema timestamp
    await runQuery(
      'UPDATE schemas SET updated_at = ? WHERE id = ?',
      [new Date().toISOString(), schemaId]
    );

    res.json({
      success: true,
      message: 'Table deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Delete table error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete table'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Generate SQL DDL for schema
router.get('/:schemaId/sql', authenticate, validateUUID('schemaId'), authorizeSchemaAccess('viewer'), async (req, res) => {
  try {
    const { schemaId } = req.params;
    const { dialect = 'mysql', includeDropStatements = false, includeComments = true } = req.query;

    // Get schema with full details
    const schema = await getQuery('SELECT * FROM schemas WHERE id = ?', [schemaId]);
    const tables = await allQuery('SELECT * FROM tables WHERE schema_id = ? ORDER BY name', [schemaId]);
    const columns = await allQuery(`
      SELECT c.* FROM columns c
      JOIN tables t ON c.table_id = t.id
      WHERE t.schema_id = ?
      ORDER BY c.table_id, c.order_index, c.name
    `, [schemaId]);
    const relationships = await allQuery(`
      SELECT r.*, 
        st.name as source_table_name,
        sc.name as source_column_name,
        tt.name as target_table_name,
        tc.name as target_column_name
      FROM relationships r
      JOIN tables st ON r.source_table_id = st.id
      JOIN columns sc ON r.source_column_id = sc.id
      JOIN tables tt ON r.target_table_id = tt.id
      JOIN columns tc ON r.target_column_id = tc.id
      WHERE r.schema_id = ?
    `, [schemaId]);

    // Group columns by table
    const tableColumnsMap = {};
    columns.forEach(column => {
      if (!tableColumnsMap[column.table_id]) {
        tableColumnsMap[column.table_id] = [];
      }
      tableColumnsMap[column.table_id].push({
        name: column.name,
        dataType: column.data_type,
        length: column.length,
        precision: column.precision_val,
        scale: column.scale_val,
        isPrimaryKey: Boolean(column.is_primary_key),
        isForeignKey: Boolean(column.is_foreign_key),
        isUnique: Boolean(column.is_unique),
        isRequired: Boolean(column.is_required),
        isAutoIncrement: Boolean(column.is_auto_increment),
        defaultValue: column.default_value,
        description: column.description
      });
    });

    // Prepare data for SQL generator
    const tablesData = tables.map(table => ({
      name: table.name,
      description: table.description,
      columns: tableColumnsMap[table.id] || []
    }));

    const relationshipsData = relationships.map(rel => ({
      name: rel.name,
      sourceTableName: rel.source_table_name,
      sourceColumnName: rel.source_column_name,
      targetTableName: rel.target_table_name,
      targetColumnName: rel.target_column_name,
      onDelete: rel.on_delete,
      onUpdate: rel.on_update
    }));

    // Generate SQL
    const sqlGenerator = new SQLGenerator(dialect);
    const sql = sqlGenerator.generateSchema(tablesData, relationshipsData, {
      includeDropStatements: includeDropStatements === 'true',
      includeComments: includeComments === 'true',
      includeIndexes: true,
      includeConstraints: true
    });

    res.json({
      success: true,
      data: {
        sql,
        dialect,
        generatedAt: new Date().toISOString(),
        schemaName: schema.name
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('SQL generation error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate SQL'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Export schema in various formats
router.post('/:schemaId/export', authenticate, validateUUID('schemaId'), authorizeSchemaAccess('viewer'), validate('schemaExport'), async (req, res) => {
  try {
    const { schemaId } = req.params;
    const { format, dialect, options } = req.body;

    // Get schema data (same as SQL generation)
    const schema = await getQuery('SELECT * FROM schemas WHERE id = ?', [schemaId]);
    
    if (format === 'sql') {
      // Use the existing SQL generation logic
      const sqlGenerator = new SQLGenerator(dialect);
      // ... implement SQL export
      
      const filename = `${schema.name.replace(/\s+/g, '_').toLowerCase()}_schema.sql`;
      
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('-- SQL export would be implemented here');
    } else if (format === 'json') {
      // JSON export
      const filename = `${schema.name.replace(/\s+/g, '_').toLowerCase()}_schema.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json({ message: 'JSON export would be implemented here' });
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FORMAT',
          message: 'Unsupported export format'
        },
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Schema export error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to export schema'
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;