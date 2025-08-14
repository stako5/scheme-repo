const Joi = require('joi');

// Validation schemas
const schemas = {
  // User registration
  userRegister: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().min(8).required().max(128),
    firstName: Joi.string().required().max(100),
    lastName: Joi.string().required().max(100)
  }),

  // User login
  userLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // Schema creation/update
  schema: Joi.object({
    name: Joi.string().required().min(1).max(255),
    description: Joi.string().allow('').max(1000),
    isPublic: Joi.boolean().default(false),
    templateId: Joi.string().uuid().optional()
  }),

  // Schema update (partial)
  schemaUpdate: Joi.object({
    name: Joi.string().min(1).max(255),
    description: Joi.string().allow('').max(1000),
    isPublic: Joi.boolean()
  }).min(1), // At least one field required

  // Table creation/update
  table: Joi.object({
    name: Joi.string().required().min(1).max(100).pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    description: Joi.string().allow('').max(500),
    position: Joi.object({
      x: Joi.number().integer().min(0).required(),
      y: Joi.number().integer().min(0).required()
    }).required(),
    color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).default('#ffffff')
  }),

  // Column creation/update
  column: Joi.object({
    name: Joi.string().required().min(1).max(100).pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    dataType: Joi.string().required().valid(
      'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT',
      'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT',
      'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL',
      'DATE', 'TIME', 'DATETIME', 'TIMESTAMP',
      'BOOLEAN', 'BIT', 'JSON', 'JSONB', 'BLOB', 'UUID'
    ),
    length: Joi.number().integer().min(1).max(65535).optional(),
    precision: Joi.number().integer().min(1).max(65).optional(),
    scale: Joi.number().integer().min(0).max(30).optional(),
    isPrimaryKey: Joi.boolean().default(false),
    isUnique: Joi.boolean().default(false),
    isRequired: Joi.boolean().default(false),
    isAutoIncrement: Joi.boolean().default(false),
    defaultValue: Joi.string().allow('', null).optional(),
    description: Joi.string().allow('').max(500),
    orderIndex: Joi.number().integer().min(0).default(0)
  }),

  // Relationship creation/update
  relationship: Joi.object({
    sourceTableId: Joi.string().uuid().required(),
    sourceColumnId: Joi.string().uuid().required(),
    targetTableId: Joi.string().uuid().required(),
    targetColumnId: Joi.string().uuid().required(),
    relationshipType: Joi.string().valid('one-to-one', 'one-to-many', 'many-to-many').required(),
    onDelete: Joi.string().valid('CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION').default('RESTRICT'),
    onUpdate: Joi.string().valid('CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION').default('CASCADE'),
    name: Joi.string().max(100).optional(),
    description: Joi.string().allow('').max(500)
  }),

  // Template creation
  template: Joi.object({
    schemaId: Joi.string().uuid().required(),
    name: Joi.string().required().min(1).max(255),
    description: Joi.string().allow('').max(1000),
    category: Joi.string().max(100).default('General'),
    isPublic: Joi.boolean().default(false),
    tags: Joi.array().items(Joi.string().max(50)).max(10).default([])
  }),

  // AI chat message
  aiChat: Joi.object({
    message: Joi.string().required().min(1).max(2000),
    schemaId: Joi.string().uuid().optional(),
    context: Joi.object().optional()
  }),

  // Collaboration invitation
  collaboration: Joi.object({
    email: Joi.string().email().required(),
    role: Joi.string().valid('editor', 'viewer').required()
  }),

  // Query parameters for listing
  listQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().max(255).optional(),
    sortBy: Joi.string().valid('name', 'createdAt', 'updatedAt').default('updatedAt'),
    order: Joi.string().valid('asc', 'desc').default('desc'),
    category: Joi.string().max(100).optional(),
    isPublic: Joi.boolean().optional()
  }),

  // SQL export options
  sqlExport: Joi.object({
    dialect: Joi.string().valid('mysql', 'postgresql', 'sqlite', 'mssql').default('mysql'),
    includeDropStatements: Joi.boolean().default(false),
    includeComments: Joi.boolean().default(true),
    includeData: Joi.boolean().default(false)
  }),

  // Schema export options
  schemaExport: Joi.object({
    format: Joi.string().valid('sql', 'json', 'xml').required(),
    dialect: Joi.string().valid('mysql', 'postgresql', 'sqlite', 'mssql').when('format', {
      is: 'sql',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    options: Joi.object({
      includeData: Joi.boolean().default(false),
      includeComments: Joi.boolean().default(true),
      includeIndexes: Joi.boolean().default(true),
      includeConstraints: Joi.boolean().default(true)
    }).default({})
  })
};

// Validation middleware factory
function validate(schemaName, source = 'body') {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_SCHEMA_NOT_FOUND',
          message: `Validation schema '${schemaName}' not found`
        },
        timestamp: new Date().toISOString()
      });
    }

    const data = source === 'query' ? req.query : req.body;
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: validationErrors
        },
        timestamp: new Date().toISOString()
      });
    }

    // Replace the original data with the validated and sanitized data
    if (source === 'query') {
      req.query = value;
    } else {
      req.body = value;
    }

    next();
  };
}

// Custom validation for UUID parameters
function validateUUID(paramName) {
  return (req, res, next) => {
    const uuid = req.params[paramName];
    const uuidSchema = Joi.string().uuid().required();
    
    const { error } = uuidSchema.validate(uuid);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_UUID',
          message: `Invalid ${paramName} format`
        },
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
}

// Validate multiple UUIDs in params
function validateUUIDs(...paramNames) {
  return (req, res, next) => {
    const errors = [];
    
    for (const paramName of paramNames) {
      const uuid = req.params[paramName];
      const uuidSchema = Joi.string().uuid().required();
      
      const { error } = uuidSchema.validate(uuid);
      if (error) {
        errors.push(`Invalid ${paramName} format`);
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Invalid parameter format',
          details: errors
        },
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
}

module.exports = {
  validate,
  validateUUID,
  validateUUIDs,
  schemas
};