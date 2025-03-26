const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const cors = require('cors')
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'mysecretkey';
app.use(cors())




app.use(express.json())
const PORT = 3000;

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');


app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});





app.post('/articles', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]; // Authorization 헤더에서 토큰 추출

    if (!token) {
        return res.status(401).json({ error: '로그인 후 게시글을 작성할 수 있습니다.' });
    }

    // 토큰 검증
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }

        // 토큰 검증이 성공하면 게시글 작성
        const { title, content } = req.body;

        db.run(`INSERT INTO articles (title, content) VALUES (?, ?)`,
            [title, content],
            function (err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ id: this.lastID, title, content });
            });
    });
});



app.get('/articles', (req, res) => {
    db.all('SELECT * FROM articles', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });


});





app.get('/articles/:id', (req, res) => {
    let id = req.params.id;

    // id에 해당하는 article만 조회하는 쿼리
    db.get('SELECT * FROM articles WHERE id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: "Article not found" });
        }
        res.json(row);
    });
});



app.delete('/articles/:id', (req, res) => {
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



app.put('/articles/:id', (req, res) => {
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

            res.json({ message: '게시글 수s정 완료!' });
        }
    )
})


app.post("/articles/:id/comments", (req, res) => {
    let article_id = req.params.id
    let content = req.body.content
    let created_at = new Date().toISOString();

    if (!content) {
        return res.status(400).send({ error: "댓글 내용을 입력해주세요." });
    }
    // comments 테이블에 새로운 댓글 추가
    const sql = "INSERT INTO comments (content, created_at, article_id) VALUES (?, ?, ?)";
    db.run(sql, [content, created_at, article_id], function (err) {
        if (err) {
            return res.status(500).send({ error: "댓글을 추가하는데 문제가 발생했습니다." });
        }

        // 댓글 추가가 성공하면, 추가된 댓글의 id와 함께 성공 응답을 보냄
        res.status(201).send({
            message: "댓글이 성공적으로 추가되었습니다.",
            commentId: this.lastID
        });
    });
});


app.delete("/comments/:id", (req, res) => {
    let comment_id = req.params.id; // URL에서 댓글 ID 받아오기

    // 해당 댓글이 존재하는지 확인하는 쿼리
    const checkSql = "SELECT * FROM comments WHERE id = ?";
    db.get(checkSql, [comment_id], (err, row) => {
        if (err) {
            return res.status(500).send({ error: "댓글을 확인하는데 문제가 발생했습니다." });
        }

        if (!row) {
            return res.status(404).send({ error: "댓글을 찾을 수 없습니다." });
        }

        // 댓글이 존재하면 삭제 쿼리 실행
        const deleteSql = "DELETE FROM comments WHERE id = ?";
        db.run(deleteSql, [comment_id], function (err) {
            if (err) {
                return res.status(500).send({ error: "댓글을 삭제하는데 문제가 발생했습니다." });
            }

            // 삭제가 성공하면 성공 메시지 응답
            res.status(200).send({
                message: "댓글이 성공적으로 삭제되었습니다."
            });
        });
    });
});


app.get("/articles/:id/comments", (req, res) => {
    let article_id = req.params.id; // URL에서 게시물 ID 가져오기

    // 해당 게시물에 대한 댓글들을 조회하는 SQL 쿼리
    const sql = "SELECT * FROM comments WHERE article_id = ?";

    db.all(sql, [article_id], (err, rows) => {
        if (err) {
            return res.status(500).send({ error: "댓글을 조회하는데 문제가 발생했습니다." });
        }

        if (rows.length === 0) {
            return res.status(404).send({ message: "댓글이 없습니다." });
        }

        // 조회된 댓글들을 응답으로 반환
        res.status(200).json({
            message: "댓글 조회 성공",
            comments: rows
        });
    });
});
app.post('/users', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요' });
    }

    try {
        // 비밀번호 해싱
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users (email, password) VALUES (?, ?)`,
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

        // JWT 토큰 생성
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



app.get('/logintest', (req, res) => {

    console.log(req.headers.authorization.split(' ')[1])
    let token = req.headers.authorization.split(' ')[1]

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.send("err")
        }
        return res.send('로그인 성공')
    })


})

app.delete('/users', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '토큰이 없습니다.' });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }

        const userEmail = decoded.email;

        // 데이터베이스에서 사용자 삭제
        db.run('DELETE FROM users WHERE email = ?', [userEmail], function (err) {
            if (err) {
                return res.status(500).json({ error: '계정 삭제 실패', details: err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
            }

            res.json({ message: '계정이 성공적으로 삭제되었습니다.' });
        });
    });
});
