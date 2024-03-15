const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const DB = process.env.DB;
console.log('module: ', DB);
const sequelize = new Sequelize(DB);

const user = sequelize.define('User', {
  user_id: DataTypes.STRING,
  access_token: DataTypes.STRING,
  item_id: DataTypes.STRING,
},{
  tableName: 'users',
  timestamps: false
});

module.exports = user;