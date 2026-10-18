export const openApiDocument = {
  openapi: '3.0.3',
  info: { title: 'OpSync API', version: '1.0.0', description: 'Authentication uses secure HTTP-only cookies. Mutating requests require the x-csrf-token header.' },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'accessToken' } },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' } } } } },
    },
  },
  paths: {
    '/auth/csrf-token': { get: { summary: 'Issue a CSRF token', responses: { 200: { description: 'Token issued' } } } },
    '/auth/login': { post: { summary: 'Log in', responses: { 200: { description: 'Authenticated' }, 401: { description: 'Invalid credentials' } } } },
    '/auth/signup': { post: { summary: 'Register an employee account', responses: { 201: { description: 'Account created' } } } },
    '/auth/logout': { post: { summary: 'Log out', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Logged out' } } } },
    '/auth/profile': { get: { summary: 'Current profile', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Profile' } } } },
    '/projects': {
      get: { summary: 'List accessible projects', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Projects' } } },
      post: { summary: 'Create a project', security: [{ cookieAuth: [] }], responses: { 201: { description: 'Project created' } } },
    },
    '/projects/{projectId}/tasks': { get: { summary: 'List project tasks', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Tasks' } } } },
    '/teams': { get: { summary: 'List accessible teams', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Teams' } } } },
    '/chat/conversations': { get: { summary: 'List conversations', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Conversations' } } } },
    '/files/{projectId}': { get: { summary: 'List project files', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Files' } } } },
  },
};
