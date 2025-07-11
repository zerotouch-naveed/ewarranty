const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/warranty_management';
    
    // const connectionOptions = {
    //   // Connection pool settings
    //   maxPoolSize: 10,
    //   serverSelectionTimeoutMS: 5000,
    //   socketTimeoutMS: 45000,
    //   family: 4, // Use IPv4, skip trying IPv6
      
    //   // Buffering settings
    //   bufferMaxEntries: 0,
    //   bufferCommands: false,
      
    //   // Other options
    //   retryWrites: true,
    //   w: 'majority'
    // };

    console.log('Attempting to connect to MongoDB...');
    const conn = await mongoose.connect(MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('✅ Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  Mongoose disconnected from MongoDB');
    });

    // If Node process ends, close the Mongoose connection
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('Mongoose connection closed due to app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.error('\n🔧 To fix this issue:');
    console.error('1. Install MongoDB locally or use Docker');
    console.error('2. Check QUICK_START.md for detailed instructions');
    console.error('3. Ensure MongoDB is running on port 27017\n');
    
    // Instead of exiting, we'll continue without database for demo
    console.log('⚠️  Continuing without database connection...');
    console.log('📖 Check http://localhost:3000/docs for API documentation');
    return null;
  }
};

module.exports = connectDB;