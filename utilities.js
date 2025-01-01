const jwt = require("jsonwebtoken")

function authenticateToken(req, res, next){
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // No Token -> Unauthorized
    if(!token) return res.sendStatus(401);
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        // If invalid Token
        if(err) return res.sendStatus(401);
        req.user = user;
        next();
    })
}

module.exports = {
    authenticateToken,
}