const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY;

const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: '로그인 후 이용할 수 있습니다.' });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }
        req.user = decoded;  // 인증된 사용자 정보 저장
        next();
    });
};

module.exports = authMiddleware;
