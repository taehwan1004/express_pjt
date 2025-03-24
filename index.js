const express = require('express');
const app = express();

const cors = require('cors')
app.use(cors())




app.use(express.json())
const PORT = 3000;

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');


app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});





app.post('/articles', (req, res) => {
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
