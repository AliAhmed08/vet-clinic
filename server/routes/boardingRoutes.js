const express = require("express");
const router = express.Router();
const { db } = require("../db/db");

router.post("/add-room", (req, res) => {
    const { room_number } = req.body;

    const query = `INSERT INTO rooms (room_number) VALUES (?)`;

    db.run(query, [room_number], function (err) {
        if (err) {
            if (err.message.includes("UNIQUE")) {
                return res.status(400).json({ message: "رقم الغرفة موجود بالفعل" });
            }
            return res.status(500).json(err);
        }

        res.json({ message: "Room added", id: this.lastID });
    });
});


router.get("/rooms-status", (req, res) => {
    const query = `
        SELECT 
            r.id AS room_id,
            r.room_number,
            b.id AS boarding_id,
            b.start_date,
            b.daily_price,
            a.name AS animal_name,
            a.type,
            CASE 
                WHEN b.id IS NULL THEN 'empty'
                ELSE 'occupied'
            END AS status,
            CASE 
                WHEN b.start_date IS NOT NULL 
                THEN CAST((julianday('now') - julianday(b.start_date)) AS INTEGER) + 1
                ELSE 0
            END AS days_count
        FROM rooms r
        LEFT JOIN boardings b 
            ON r.id = b.room_id 
            AND b.end_date IS NULL
        LEFT JOIN animals a 
            ON b.animal_id = a.id
        ORDER BY 
            CASE WHEN b.id IS NULL THEN 1 ELSE 0 END;    ;
  `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});


router.post("/start", (req, res) => {
    const { animal_id, room_id, start_date, daily_price } = req.body;

    const checkQuery = `
    SELECT * FROM boardings
    WHERE room_id = ? AND end_date IS NULL
  `;

    db.get(checkQuery, [room_id], (err, existing) => {
        if (err) return res.status(500).json(err);
        if (existing) {
            return res.status(400).json({ message: "Room already occupied" });
        }

        const insertQuery = `
      INSERT INTO boardings (animal_id, room_id, start_date, daily_price)
            VALUES (?, ?, ?, ?)
    `;

        db.run(insertQuery, [animal_id, room_id, start_date, daily_price], function (err) {
            if (err) return res.status(500).json(err);
            res.json({ message: "Boarding started", boarding_id: this.lastID });
        });
    });
});

router.get("/archive", (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = 15;
    const offset = (page - 1) * limit;

    const { search, animal_id, dateFrom, dateTo, room } = req.query;

    // ================= BUILD WHERE =================
    let where = "WHERE b.end_date IS NOT NULL";
    const params = [];

    if (animal_id) {
        where += " AND b.animal_id = ?";
        params.push(animal_id);
    }

    if (search) {
        where += `
            AND (
                a.name LIKE ?
                OR a.owner LIKE ?
                OR a.phone LIKE ?
                OR a.type LIKE ?
            )
        `;
        const q = `%${search}%`;
        params.push(q, q, q, q);
    }

    // ================= DATE =================
    if (dateFrom) {
        where += " AND b.end_date >= ?";
        params.push(dateFrom);
    }

    if (dateTo) {
        where += " AND b.start_date <= ?";
        params.push(dateTo);
    }

    // ================= ROOM FILTER =================
    if (room) {
        where += " AND r.room_number = ?";
        params.push(room);
    }

    // ================= DATA QUERY =================
    const dataSql = `
        SELECT 
            b.id,
            a.id AS animal_id, 
            a.name,
            a.type,
            r.room_number,
            b.start_date,
            b.end_date,
            b.daily_price,
            CAST((julianday(b.end_date) - julianday(b.start_date)) AS INTEGER) + 1 
                AS total_days,
            (
                (CAST((julianday(b.end_date) - julianday(b.start_date)) AS INTEGER) + 1)
                * b.daily_price
            ) AS total_cost
        FROM boardings b
        JOIN animals a ON b.animal_id = a.id
        JOIN rooms r ON b.room_id = r.id
        ${where}
        ORDER BY b.end_date DESC
        LIMIT ? OFFSET ?
    `;

    // ================= COUNT QUERY =================
    const countSql = `
        SELECT COUNT(*) as count
        FROM boardings b
        JOIN animals a ON b.animal_id = a.id
        JOIN rooms r ON b.room_id = r.id
        ${where}
    `;

    db.all(dataSql, [...params, limit, offset], (err, data) => {
        if (err) return res.status(500).json({ error: err.message });

        db.get(countSql, params, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({
                data,
                page,
                totalPages: Math.ceil(result.count / limit),
            });
        });
    });
});

router.put("/end/:id", (req, res) => {
    const boardingId = req.params.id;

    const updateQuery = `
        UPDATE boardings
        SET end_date = DATE('now')
        WHERE id = ? AND end_date IS NULL
    `;

    db.run(updateQuery, [boardingId], function (err) {
        if (err) return res.status(500).json(err);

        if (this.changes === 0) {
            return res.status(400).json({ message: "Boarding not active" });
        }

        const selectQuery = `
            SELECT 
                daily_price,
                start_date,
                end_date,
                CAST((julianday(end_date) - julianday(start_date)) AS INTEGER) + 1 
                    AS total_days,
                (
                    (CAST((julianday(end_date) - julianday(start_date)) AS INTEGER) + 1)
                    * daily_price
                ) AS total_cost
            FROM boardings
            WHERE id = ?
        `;

        db.get(selectQuery, [boardingId], (err, row) => {
            if (err) return res.status(500).json(err);

            res.json({
                message: "Boarding ended",
                ...row
            });
        });
    });
});


router.get("/:id", (req, res) => {
    const boardingId = req.params.id;

    const query = `
    SELECT 
        b.id,
        b.start_date,
        b.end_date,
        a.name,
        a.type,
        a.breed,
        a.color,
        a.age,
        a.weight,
        a.gender,
        a.owner,
        a.phone
    FROM boardings b
    JOIN animals a ON b.animal_id = a.id
    WHERE b.id = ?
  `;

    db.get(query, [boardingId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        res.json(row);
    });
});


router.post("/:id/notes", (req, res) => {
    const boardingId = req.params.id;
    const { note_text } = req.body;

    const query = `
    INSERT INTO boarding_notes (boarding_id, note_date, note_text)
    VALUES (?, DATE('now'), ?)
  `;

    db.run(query, [boardingId, note_text], function (err) {
        if (err) return res.status(500).json(err);
        res.json({ message: "Note added", note_id: this.lastID });
    });
});

router.get("/:id/notes", (req, res) => {
    const boardingId = req.params.id;

    const query = `
    SELECT id, note_date, note_text
    FROM boarding_notes
    WHERE boarding_id = ?
    ORDER BY note_date ASC
  `;

    db.all(query, [boardingId], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});


module.exports = router;