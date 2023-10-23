function validateRequestBody(req, res, next) {
    if (!req.body || !req.body.username) {
      return res.status(400).send('Bad Request: Username is required.');
    }
    next();
  }
  
  module.exports = validateRequestBody;