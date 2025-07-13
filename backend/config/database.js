const mongoose = require('mongoose');

const connectDatabase = async () => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    console.log('📍 Connection URI:', process.env.MONGODB_URI ? 'Atlas URI found' : 'Using localhost fallback');

    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-todo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.log('⚠️  MongoDB connection failed. Details:');
    console.log('   • Error:', error.name);
    console.log('   • Message:', error.message);
    if (error.code) console.log('   • Code:', error.code);
    console.log('   • Server will continue without database (limited functionality)');
    throw error;
  }
};

module.exports = connectDatabase;
