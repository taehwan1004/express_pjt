const express = require('express');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const authMiddleware = require('./authMiddleware');  // authMiddleware import

const app = express();
const SECRET_KEY = process.env.SECRET_KEY || 'mysecretkey'; // 환경 변수로부터 SECRET_KEY 가져오기

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./database.db');
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});

// 게시글 작성
app.post('/articles', authMiddleware, (req, res) => {
    const { title, content } = req.body;
    const userId = req.user.id; // 인증된 유저의 id 가져오기

    if (!title || !content) {
        return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
    }

    // 게시글 작성 전에 로그로 userId와 함께 들어오는 값을 확인
    console.log('게시글 작성 요청:', { title, content, userId });

    // 게시글 작성
    db.run(
        `INSERT INTO articles (title, content, user_id) VALUES (?, ?, ?)`,
        [title, content, userId], // userId가 제대로 삽입되도록 확인
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // 정상적으로 작성된 경우, 게시글 정보와 함께 userId를 반환
            res.json({ id: this.lastID, title, content, userId });
        }
    );
});


// 게시글 목록 조회
app.get('/articles', (req, res) => {
    db.all('SELECT * FROM articles', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 특정 게시글 조회
app.get('/articles/:id', (req, res) => {
    const id = req.params.id;
    const sql = `
        SELECT articles.*, users.email 
        FROM articles
        JOIN users ON articles.user_id = users.id
        WHERE articles.id = ?`;

    db.get(sql, [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: "Article not found" });
        }
        res.json({
            id: row.id,
            title: row.title,
            content: row.content,
            email: row.email // 작성자 이메일 추가
        });
    });
});

// 게시글 수정
app.put('/articles/:id', authMiddleware, (req, res) => {
    const id = req.params.id;
    const { title, content } = req.body;

    db.run(
        'UPDATE articles SET title = ?, content = ? WHERE id = ?',
        [title, content, id],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({ message: '해당 ID의 게시글이 없습니다.' });
            }

            res.json({ message: '게시글 수정 완료!' });
        }
    );
});

// 게시글 삭제
app.delete('/articles/:id', authMiddleware, (req, res) => {
    const id = req.params.id;

    db.run('DELETE FROM articles WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: '해당 ID의 아티클이 없습니다.' });
        }

        res.json({ message: '아티클 삭제 완료!' });
    });
});

// 댓글 추가
app.post("/articles/:id/comments", authMiddleware, (req, res) => {
    let article_id = req.params.id;
    let content = req.body.content;
    let created_at = new Date().toISOString();
    const userId = req.user.id; // 유저 ID 가져오기

    if (!content) {
        return res.status(400).send({ error: "댓글 내용을 입력해주세요." });
    }

    const sql = "INSERT INTO comments (content, created_at, article_id, user_id) VALUES (?, ?, ?, ?)";
    db.run(sql, [content, created_at, article_id, userId], function (err) {
        if (err) {
            return res.status(500).send({ error: "댓글을 추가하는데 문제가 발생했습니다." });
        }

        res.status(201).send({
            message: "댓글이 성공적으로 추가되었습니다.",
            commentId: this.lastID
        });
    });
});

// 댓글 삭제
app.delete("/comments/:id", authMiddleware, (req, res) => {
    let comment_id = req.params.id;

    const checkSql = "SELECT * FROM comments WHERE id = ?";
    db.get(checkSql, [comment_id], (err, row) => {
        if (err) {
            return res.status(500).send({ error: "댓글을 확인하는데 문제가 발생했습니다." });
        }

        if (!row) {
            return res.status(404).send({ error: "댓글을 찾을 수 없습니다." });
        }

        const deleteSql = "DELETE FROM comments WHERE id = ?";
        db.run(deleteSql, [comment_id], function (err) {
            if (err) {
                return res.status(500).send({ error: "댓글을 삭제하는데 문제가 발생했습니다." });
            }

            res.status(200).send({
                message: "댓글이 성공적으로 삭제되었습니다."
            });
        });
    });
});

// 댓글 조회
app.get("/articles/:id/comments", (req, res) => {
    let article_id = req.params.id;

    const sql = 
        `SELECT comments.*, users.email 
        FROM comments
        JOIN users ON comments.user_id = users.id
        WHERE comments.article_id = ?`;

    db.all(sql, [article_id], (err, rows) => {
        if (err) {
            return res.status(500).send({ error: "댓글을 조회하는데 문제가 발생했습니다." });
        }

        if (rows.length === 0) {
            return res.status(404).send({ message: "댓글이 없습니다." });
        }
        const commentsWithEmail = rows.map(row => ({
            id: row.id,
            content: row.content,
            created_at: row.created_at,
            email: row.email // 댓글 작성자의 이메일 추가
        }));

        res.status(200).json({
            message: "댓글 조회 성공",
            comments: commentsWithEmail
        });
    });
});

app.post('/users', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users(email, password) VALUES(?, ?)`,

            [email, hashedPassword],
            function (err) {
                if (err) {
                    return res.status(500).json({ error: '회원가입 실패', details: err.message });
                }
                res.status(201).json({ message: '회원가입 성공', userId: this.lastID });
            }
        );
    } catch (error) {
        res.status(500).json({ error: '서버 오류' });
    }
});

// 로그인
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: '서버 오류' });
        }
        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });

        res.json({ message: '로그인 성공', token });
    });
});

// 사용자 정보 반환
app.get('/user-info', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: '토큰이 없습니다.' });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }
        res.json({ email: decoded.email });
    });
});
