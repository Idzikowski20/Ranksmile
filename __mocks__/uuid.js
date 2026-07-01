// Stub for sequelize's uuid ESM import
module.exports = {
  v1: () => 'v1-' + Math.random().toString(36).substr(2, 9),
  v4: () => 'v4-' + Math.random().toString(36).substr(2, 9),
};
