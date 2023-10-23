function logRequest(req, res, next) {
    console.log(`Received ${req.method} request for ${req.url}`);
    next();
  }
  
  module.exports = logRequest;