import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { apiClient } from '../utils/apiClient'

export const useSchemaStore = create()(
  devtools(
    immer((set, get) => ({
      // Schema state
      schemas: [],
      currentSchema: null,
      selectedTable: null,
      editingTable: null,
      
      // UI state
      isLoading: false,
      error: null,
      zoomLevel: 1,
      panOffset: { x: 0, y: 0 },
      
      // Canvas state
      isDragging: false,
      dragState: null,
      
      // AI state
      aiMessages: [],
      aiSuggestions: [
        "Generate tables for e-commerce system",
        "Create user management schema", 
        "Design blog database structure",
        "Optimize current schema",
        "Add indexes for better performance",
        "Normalize database structure"
      ],
      
      // Template state
      templates: [],
      
      // Actions
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      
      // Schema actions
      setSchemas: (schemas) => set({ schemas }),
      setCurrentSchema: (schema) => set({ currentSchema: schema }),
      
      addSchema: (schema) => set((state) => {
        state.schemas.unshift(schema)
      }),
      
      updateSchema: (schemaId, updates) => set((state) => {
        const index = state.schemas.findIndex(s => s.id === schemaId)
        if (index !== -1) {
          Object.assign(state.schemas[index], updates)
        }
        if (state.currentSchema?.id === schemaId) {
          Object.assign(state.currentSchema, updates)
        }
      }),
      
      removeSchema: (schemaId) => set((state) => {
        state.schemas = state.schemas.filter(s => s.id !== schemaId)
        if (state.currentSchema?.id === schemaId) {
          state.currentSchema = null
        }
      }),
      
      // Table actions
      setSelectedTable: (table) => set({ selectedTable: table }),
      setEditingTable: (table) => set({ editingTable: table }),
      
      addTable: (table) => set((state) => {
        if (state.currentSchema) {
          state.currentSchema.tables.push(table)
        }
      }),
      
      updateTable: (tableId, updates) => set((state) => {
        if (state.currentSchema) {
          const table = state.currentSchema.tables.find(t => t.id === tableId)
          if (table) {
            Object.assign(table, updates)
          }
        }
      }),
      
      removeTable: (tableId) => set((state) => {
        if (state.currentSchema) {
          state.currentSchema.tables = state.currentSchema.tables.filter(t => t.id !== tableId)
          state.currentSchema.relationships = state.currentSchema.relationships.filter(
            r => r.sourceTableId !== tableId && r.targetTableId !== tableId
          )
        }
        if (state.selectedTable?.id === tableId) {
          state.selectedTable = null
        }
        if (state.editingTable?.id === tableId) {
          state.editingTable = null
        }
      }),
      
      // Relationship actions
      addRelationship: (relationship) => set((state) => {
        if (state.currentSchema) {
          state.currentSchema.relationships.push(relationship)
        }
      }),
      
      updateRelationship: (relationshipId, updates) => set((state) => {
        if (state.currentSchema) {
          const relationship = state.currentSchema.relationships.find(r => r.id === relationshipId)
          if (relationship) {
            Object.assign(relationship, updates)
          }
        }
      }),
      
      removeRelationship: (relationshipId) => set((state) => {
        if (state.currentSchema) {
          state.currentSchema.relationships = state.currentSchema.relationships.filter(
            r => r.id !== relationshipId
          )
        }
      }),
      
      // Canvas actions
      setZoomLevel: (level) => set({ zoomLevel: Math.max(0.3, Math.min(3, level)) }),
      setPanOffset: (offset) => set({ panOffset: offset }),
      setDragState: (dragState) => set({ dragState }),
      setIsDragging: (isDragging) => set({ isDragging }),
      
      // AI actions
      addAIMessage: (message, sender) => set((state) => {
        state.aiMessages.push({
          id: Date.now().toString(),
          message,
          sender,
          timestamp: new Date().toISOString()
        })
      }),
      
      clearAIMessages: () => set({ aiMessages: [] }),
      
      // Template actions
      setTemplates: (templates) => set({ templates }),
      
      // Async actions
      loadSchemas: async () => {
        set({ isLoading: true, error: null })
        try {
          const response = await apiClient.getSchemas({
            page: 1,
            limit: 50,
            sortBy: 'updatedAt',
            order: 'desc'
          })
          set({ schemas: response.data.schemas, isLoading: false })
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },
      
      loadSchema: async (schemaId) => {
        set({ isLoading: true, error: null })
        try {
          const response = await apiClient.getSchema(schemaId)
          set({ 
            currentSchema: response.data.schema, 
            selectedTable: null,
            editingTable: null,
            isLoading: false 
          })
          return response.data.schema
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },
      
      createSchema: async (schemaData) => {
        set({ isLoading: true, error: null })
        try {
          const response = await apiClient.createSchema(schemaData)
          const newSchema = response.data.schema
          set((state) => {
            state.schemas.unshift(newSchema)
            state.currentSchema = newSchema
            state.isLoading = false
          })
          return newSchema
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },
      
      deleteSchema: async (schemaId) => {
        set({ isLoading: true, error: null })
        try {
          await apiClient.deleteSchema(schemaId)
          set((state) => {
            state.schemas = state.schemas.filter(s => s.id !== schemaId)
            if (state.currentSchema?.id === schemaId) {
              state.currentSchema = null
            }
            state.isLoading = false
          })
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },
      
      createTable: async (tableData) => {
        if (!get().currentSchema) {
          throw new Error('No schema selected')
        }
        
        set({ isLoading: true, error: null })
        try {
          const response = await apiClient.createTable(get().currentSchema.id, tableData)
          const newTable = response.data.table
          set((state) => {
            if (state.currentSchema) {
              state.currentSchema.tables.push(newTable)
            }
            state.isLoading = false
          })
          return newTable
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },
      
      deleteTable: async (tableId) => {
        if (!get().currentSchema) return
        
        set({ isLoading: true, error: null })
        try {
          await apiClient.deleteTable(get().currentSchema.id, tableId)
          set((state) => {
            if (state.currentSchema) {
              state.currentSchema.tables = state.currentSchema.tables.filter(t => t.id !== tableId)
              state.currentSchema.relationships = state.currentSchema.relationships.filter(
                r => r.sourceTableId !== tableId && r.targetTableId !== tableId
              )
            }
            if (state.selectedTable?.id === tableId) {
              state.selectedTable = null
            }
            if (state.editingTable?.id === tableId) {
              state.editingTable = null
            }
            state.isLoading = false
          })
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },
      
      updateTablePosition: async (tableId, position) => {
        if (!get().currentSchema) return
        
        // Optimistically update the UI
        set((state) => {
          if (state.currentSchema) {
            const table = state.currentSchema.tables.find(t => t.id === tableId)
            if (table) {
              table.position = position
            }
          }
        })
        
        try {
          await apiClient.updateTable(get().currentSchema.id, tableId, { position })
        } catch (error) {
          // Revert on error
          console.error('Failed to update table position:', error)
          // Could implement rollback logic here
        }
      },
      
      sendAIMessage: async (message, context = {}) => {
        const currentSchema = get().currentSchema
        
        // Add user message immediately
        get().addAIMessage(message, 'user')
        
        try {
          const response = await apiClient.sendAIMessage(
            message, 
            currentSchema?.id,
            { 
              ...context,
              currentTable: get().selectedTable?.name 
            }
          )
          
          // Add AI response
          get().addAIMessage(response.data.response, 'ai')
          
          return response.data
        } catch (error) {
          get().addAIMessage('Sorry, I encountered an error. Please try again.', 'ai')
          throw error
        }
      },
      
      loadTemplates: async () => {
        try {
          const response = await apiClient.getTemplates({
            page: 1,
            limit: 20,
            isPublic: true
          })
          set({ templates: response.data.templates })
        } catch (error) {
          console.error('Failed to load templates:', error)
        }
      },
      
      // WebSocket methods (to be implemented with socket.io integration)
      setupWebSocket: () => {
        // WebSocket setup will be handled by a separate hook
      },
      
      // Utility methods
      reset: () => set({
        schemas: [],
        currentSchema: null,
        selectedTable: null,
        editingTable: null,
        isLoading: false,
        error: null,
        zoomLevel: 1,
        panOffset: { x: 0, y: 0 },
        isDragging: false,
        dragState: null,
        aiMessages: [],
        templates: []
      })
    })),
    {
      name: 'schema-store',
      partialize: (state) => ({
        zoomLevel: state.zoomLevel,
        panOffset: state.panOffset,
        aiMessages: state.aiMessages.slice(-10), // Keep only last 10 messages
      }),
    }
  )
)