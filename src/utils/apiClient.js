import axios from 'axios'

// Create axios instance with security configurations
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // CSRF protection
  },
  withCredentials: false, // No authentication needed
  maxRedirects: 3,
  maxContentLength: 50 * 1024 * 1024, // 50MB max
  maxBodyLength: 50 * 1024 * 1024, // 50MB max
})

// Request interceptor for security and logging
api.interceptors.request.use(
  (config) => {
    // Add request timestamp for timeout tracking
    config.metadata = { startTime: Date.now() }
    
    // Security headers
    config.headers['X-Content-Type-Options'] = 'nosniff'
    config.headers['X-Frame-Options'] = 'DENY'
    config.headers['Cache-Control'] = 'no-store'
    
    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`, {
        data: config.data,
        params: config.params
      })
    }
    
    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for error handling and logging
api.interceptors.response.use(
  (response) => {
    // Calculate request duration
    const duration = Date.now() - response.config.metadata.startTime
    
    // Log response in development
    if (import.meta.env.DEV) {
      console.log(`✅ ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`)
    }
    
    // Validate response structure
    if (response.data && typeof response.data === 'object') {
      // Ensure response has expected structure
      if (!response.data.hasOwnProperty('success')) {
        console.warn('Response missing success field:', response.data)
      }
    }
    
    return response
  },
  (error) => {
    // Calculate request duration if available
    const duration = error.config?.metadata ? Date.now() - error.config.metadata.startTime : 0
    
    // Log error in development
    if (import.meta.env.DEV) {
      console.error(`❌ ${error.response?.status || 'NETWORK'} ${error.config?.method?.toUpperCase()} ${error.config?.url} (${duration}ms)`, {
        message: error.message,
        response: error.response?.data
      })
    }
    
    // Handle network errors
    if (!error.response) {
      return Promise.reject(new Error('Network error - please check your connection'))
    }
    
    // Handle HTTP errors
    const { status, data } = error.response
    
    // Rate limiting
    if (status === 429) {
      const retryAfter = error.response.headers['retry-after']
      return Promise.reject(new Error(`Too many requests. Please wait ${retryAfter || 60} seconds.`))
    }
    
    // Server errors
    if (status >= 500) {
      return Promise.reject(new Error('Server error - please try again later'))
    }
    
    // Client errors
    if (status >= 400) {
      const message = data?.error?.message || data?.message || 'Request failed'
      return Promise.reject(new Error(message))
    }
    
    return Promise.reject(error)
  }
)

// API client class with security-focused methods
class APIClient {
  constructor() {
    this.api = api
  }

  // Generic request method with input sanitization
  async request(endpoint, options = {}) {
    try {
      // Sanitize endpoint
      const sanitizedEndpoint = this.sanitizeEndpoint(endpoint)
      
      // Prepare config
      const config = {
        url: sanitizedEndpoint,
        ...options
      }
      
      // Sanitize request data
      if (config.data) {
        config.data = this.sanitizeData(config.data)
      }
      
      // Sanitize query parameters
      if (config.params) {
        config.params = this.sanitizeParams(config.params)
      }
      
      const response = await this.api.request(config)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Input sanitization methods
  sanitizeEndpoint(endpoint) {
    // Remove any potential path traversal attempts
    return endpoint.replace(/\.\./g, '').replace(/\/+/g, '/')
  }

  sanitizeData(data) {
    if (typeof data !== 'object' || data === null) {
      return data
    }
    
    const sanitized = Array.isArray(data) ? [] : {}
    
    for (const [key, value] of Object.entries(data)) {
      // Skip potentially dangerous keys
      if (key.startsWith('__') || key.includes('prototype')) {
        continue
      }
      
      if (typeof value === 'string') {
        // Basic XSS prevention
        sanitized[key] = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value)
      } else {
        sanitized[key] = value
      }
    }
    
    return sanitized
  }

  sanitizeParams(params) {
    const sanitized = {}
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        sanitized[key] = encodeURIComponent(value)
      } else {
        sanitized[key] = value
      }
    }
    return sanitized
  }

  handleError(error) {
    // Don't expose internal error details
    if (error.message && typeof error.message === 'string') {
      return new Error(error.message)
    }
    return new Error('An unexpected error occurred')
  }

  // Health check
  async healthCheck() {
    return this.request('/health')
  }

  // Schema methods
  async getSchemas(params = {}) {
    return this.request('/schemas', { 
      method: 'GET',
      params: this.validateListParams(params)
    })
  }

  async getSchema(schemaId) {
    this.validateUUID(schemaId, 'Schema ID')
    return this.request(`/schemas/${schemaId}`)
  }

  async createSchema(schemaData) {
    const validated = this.validateSchemaData(schemaData)
    return this.request('/schemas', {
      method: 'POST',
      data: validated
    })
  }

  async updateSchema(schemaId, schemaData) {
    this.validateUUID(schemaId, 'Schema ID')
    const validated = this.validateSchemaUpdateData(schemaData)
    return this.request(`/schemas/${schemaId}`, {
      method: 'PUT',
      data: validated
    })
  }

  async deleteSchema(schemaId) {
    this.validateUUID(schemaId, 'Schema ID')
    return this.request(`/schemas/${schemaId}`, {
      method: 'DELETE'
    })
  }

  // Table methods
  async createTable(schemaId, tableData) {
    this.validateUUID(schemaId, 'Schema ID')
    const validated = this.validateTableData(tableData)
    return this.request(`/schemas/${schemaId}/tables`, {
      method: 'POST',
      data: validated
    })
  }

  async updateTable(schemaId, tableId, tableData) {
    this.validateUUID(schemaId, 'Schema ID')
    this.validateUUID(tableId, 'Table ID')
    const validated = this.validateTableUpdateData(tableData)
    return this.request(`/schemas/${schemaId}/tables/${tableId}`, {
      method: 'PUT',
      data: validated
    })
  }

  async deleteTable(schemaId, tableId) {
    this.validateUUID(schemaId, 'Schema ID')
    this.validateUUID(tableId, 'Table ID')
    return this.request(`/schemas/${schemaId}/tables/${tableId}`, {
      method: 'DELETE'
    })
  }

  // SQL generation
  async generateSQL(schemaId, options = {}) {
    this.validateUUID(schemaId, 'Schema ID')
    return this.request(`/schemas/${schemaId}/sql`, {
      method: 'GET',
      params: this.validateSQLOptions(options)
    })
  }

  // Template methods
  async getTemplates(params = {}) {
    return this.request('/templates', {
      method: 'GET',
      params: this.validateListParams(params)
    })
  }

  async getTemplate(templateId) {
    this.validateUUID(templateId, 'Template ID')
    return this.request(`/templates/${templateId}`)
  }

  // AI methods
  async sendAIMessage(message, schemaId = null, context = {}) {
    const validated = {
      message: this.validateString(message, 'Message', 1, 2000),
      schemaId: schemaId ? this.validateUUID(schemaId, 'Schema ID') : null,
      context: typeof context === 'object' ? context : {}
    }
    
    return this.request('/ai/chat', {
      method: 'POST',
      data: validated
    })
  }

  async analyzeSchema(schemaId) {
    this.validateUUID(schemaId, 'Schema ID')
    return this.request('/ai/analyze', {
      method: 'POST',
      data: { schemaId }
    })
  }

  // Validation methods
  validateUUID(value, fieldName = 'ID') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!value || typeof value !== 'string' || !uuidRegex.test(value)) {
      throw new Error(`Invalid ${fieldName} format`)
    }
    return value
  }

  validateString(value, fieldName, minLength = 0, maxLength = 255) {
    if (typeof value !== 'string') {
      throw new Error(`${fieldName} must be a string`)
    }
    if (value.length < minLength) {
      throw new Error(`${fieldName} must be at least ${minLength} characters`)
    }
    if (value.length > maxLength) {
      throw new Error(`${fieldName} must be no more than ${maxLength} characters`)
    }
    return value.trim()
  }

  validateSchemaData(data) {
    return {
      name: this.validateString(data.name, 'Schema name', 1, 255),
      description: data.description ? this.validateString(data.description, 'Description', 0, 1000) : '',
      isPublic: Boolean(data.isPublic)
    }
  }

  validateSchemaUpdateData(data) {
    const validated = {}
    if (data.name !== undefined) {
      validated.name = this.validateString(data.name, 'Schema name', 1, 255)
    }
    if (data.description !== undefined) {
      validated.description = this.validateString(data.description, 'Description', 0, 1000)
    }
    if (data.isPublic !== undefined) {
      validated.isPublic = Boolean(data.isPublic)
    }
    return validated
  }

  validateTableData(data) {
    const validated = {
      name: this.validateString(data.name, 'Table name', 1, 100),
      description: data.description ? this.validateString(data.description, 'Description', 0, 500) : '',
      position: {
        x: Number(data.position?.x) || 0,
        y: Number(data.position?.y) || 0
      }
    }
    
    // Validate position bounds
    validated.position.x = Math.max(0, Math.min(5000, validated.position.x))
    validated.position.y = Math.max(0, Math.min(5000, validated.position.y))
    
    return validated
  }

  validateTableUpdateData(data) {
    const validated = {}
    if (data.name !== undefined) {
      validated.name = this.validateString(data.name, 'Table name', 1, 100)
    }
    if (data.description !== undefined) {
      validated.description = this.validateString(data.description, 'Description', 0, 500)
    }
    if (data.position !== undefined) {
      validated.position = {
        x: Math.max(0, Math.min(5000, Number(data.position.x) || 0)),
        y: Math.max(0, Math.min(5000, Number(data.position.y) || 0))
      }
    }
    return validated
  }

  validateListParams(params) {
    const validated = {}
    
    if (params.page !== undefined) {
      validated.page = Math.max(1, Math.min(1000, Number(params.page) || 1))
    }
    if (params.limit !== undefined) {
      validated.limit = Math.max(1, Math.min(100, Number(params.limit) || 10))
    }
    if (params.search !== undefined) {
      validated.search = this.validateString(params.search, 'Search', 0, 255)
    }
    if (params.sortBy !== undefined) {
      const allowedSortFields = ['name', 'createdAt', 'updatedAt', 'usageCount', 'rating']
      if (allowedSortFields.includes(params.sortBy)) {
        validated.sortBy = params.sortBy
      }
    }
    if (params.order !== undefined) {
      validated.order = ['asc', 'desc'].includes(params.order) ? params.order : 'desc'
    }
    
    return validated
  }

  validateSQLOptions(options) {
    const validated = {}
    
    const allowedDialects = ['mysql', 'postgresql', 'sqlite', 'mssql']
    if (options.dialect && allowedDialects.includes(options.dialect)) {
      validated.dialect = options.dialect
    }
    
    if (options.includeDropStatements !== undefined) {
      validated.includeDropStatements = Boolean(options.includeDropStatements)
    }
    
    if (options.includeComments !== undefined) {
      validated.includeComments = Boolean(options.includeComments)
    }
    
    return validated
  }
}

// Create and export singleton instance
export const apiClient = new APIClient()
export default apiClient