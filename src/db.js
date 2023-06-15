import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

config();

class DB {
  constructor(socketTimeout = 30000) {
    this.url = process.env.DB_URL; // mongodb://...
    this.database = process.env.DB_NAME;
    this.socketTimeout = socketTimeout;
    this.client = null;
    this.connection = null;
  }

  async connect() {
    try {
      this.client = await MongoClient.connect(this.url, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        socketTimeoutMS: this.socketTimeout,
      });
      this.connection = this.client.db(this.database);
      return true;
    } catch (err) {
      console.error('Error connecting to MongoDB:', err);
    }
  }

  async disconnect() {
    try {
      await this.client.close();
      this.client = null;
      this.connection = null;
    } catch (err) {
      console.error('Error disconnecting from MongoDB:', err);
    }
  }

  async insert(collectionName, documents) {
    try {
      const collection = this.connection.collection(collectionName);
      const result = await collection.insertMany(documents);
      return result;
    } catch (err) {
      console.error('Error inserting documents:', err);
    }
  }

  async update(collectionName, filter, update) {
    try {
      const collection = this.connection.collection(collectionName);
      const result = await collection.updateMany(filter, update);
      return result;
    } catch (err) {
      console.error('Error updating documents:', err);
    }
  }

  async updateOrInsert(collectionName, filter, update) {
    try {
      const collection = this.connection.collection(collectionName);
      const result = await collection.updateOne(filter, update, {
        upsert: true,
      });
      return result;
    } catch (err) {
      console.error('Error updating or inserting:', err);
    }
  }

  async find(collectionName, filter = {}) {
    try {
      const collection = this.connection.collection(collectionName);
      const documents = await collection.find(filter).toArray();
      return documents;
    } catch (err) {
      console.error('Error finding documents:', err);
    }
  }

  async clear(collectionName) {
    try {
      const collection = this.connection.collection(collectionName);
      const result = await collection.deleteMany({});
      console.log(
        `Collection "${collectionName}" is cleared [${result.deletedCount}]`
      );
      return result;
    } catch (err) {
      console.error(`Failed to clear "${collectionName}":`, err);
    }
  }
}

export default DB;
