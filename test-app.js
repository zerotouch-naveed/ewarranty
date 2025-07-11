require('dotenv').config();

console.log('🔧 Testing Extended Warranty Management System Configuration...\n');

// Test environment variables
console.log('📋 Environment Variables:');
console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`  PORT: ${process.env.PORT || 'not set'}`);
console.log(`  MONGODB_URI: ${process.env.MONGODB_URI ? 'set' : 'not set'}`);
console.log(`  JWT_SECRET: ${process.env.JWT_SECRET ? 'set' : 'not set'}`);

// Test module imports
let fastify, mongoose, User, Company, HierarchyService, authenticate, errorHandler;

try {
  console.log('\n📦 Testing Module Imports...');
  
  fastify = require('fastify');
  console.log('  ✅ Fastify');
  
  mongoose = require('mongoose');
  console.log('  ✅ Mongoose');
  
  ({ User, Company } = require('./schemas'));
  console.log('  ✅ Schemas');
  
  ({ HierarchyService } = require('./services'));
  console.log('  ✅ Services');
  
  ({ authenticate } = require('./middleware/auth'));
  console.log('  ✅ Auth Middleware');
  
  ({ errorHandler } = require('./middleware/errorHandler'));
  console.log('  ✅ Error Handler');
  
  console.log('\n✅ All modules loaded successfully!');
  
} catch (error) {
  console.error('\n❌ Module import error:', error.message);
  process.exit(1);
}

// Test basic server creation
try {
  console.log('\n🚀 Testing Server Creation...');
  
  const app = fastify({ logger: false });
  
  app.get('/test', async (request, reply) => {
    return { status: 'ok', message: 'Test endpoint working!' };
  });
  
  console.log('  ✅ Server instance created');
  
  // Test server start
  const start = async () => {
    try {
      await app.listen({ port: 3001, host: '0.0.0.0' });
      console.log('  ✅ Server started on port 3001');
      console.log('\n🎉 Configuration test completed successfully!');
      console.log('\n📖 To run the full application:');
      console.log('   1. Install MongoDB (see QUICK_START.md)');
      console.log('   2. Run: npm run dev');
      console.log('   3. Visit: http://localhost:3000');
      
      await app.close();
      process.exit(0);
    } catch (error) {
      console.error('  ❌ Server start error:', error.message);
      process.exit(1);
    }
  };
  
  start();
  
} catch (error) {
  console.error('\n❌ Server creation error:', error.message);
  process.exit(1);
}