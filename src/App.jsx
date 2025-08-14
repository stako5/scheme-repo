import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { motion } from 'framer-motion'
import SchemaDesigner from './components/SchemaDesigner'
import Layout from './components/layout/Layout'
import ErrorBoundary from './components/ui/ErrorBoundary'
import { useSchemaStore } from './stores/schemaStore'

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="app">
          <Routes>
            <Route path="/" element={
              <Layout>
                <SchemaDesigner />
              </Layout>
            } />
            <Route path="/schema/:id" element={
              <Layout>
                <SchemaDesigner />
              </Layout>
            } />
            <Route path="*" element={
              <Layout>
                <motion.div 
                  className="flex items-center justify-center h-full"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="text-center">
                    <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
                    <p className="text-gray-600 mb-8">The page you're looking for doesn't exist.</p>
                    <button 
                      onClick={() => window.location.href = '/'}
                      className="btn btn--primary"
                    >
                      Go Home
                    </button>
                  </div>
                </motion.div>
              </Layout>
            } />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  )
}

export default App