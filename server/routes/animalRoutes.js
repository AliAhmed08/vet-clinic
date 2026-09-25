const express = require("express");
const router = express.Router();
const { db } = require("../db/db");

// helper
function isEmpty(v) {
    return v === undefined || v === null || v.toString().trim() === "";
}

/* =====================
   CREATE ANIMAL
===================== */
router.post("/", (req, res) => {
    const {
        name,
        type,
        breed,
        gender,
        color,
        age,
        weight,
        is_spayed,
        owner,
        phone
    } = req.body;

    if (
        isEmpty(name) ||
        isEmpty(type) ||
        isEmpty(gender) ||
        isEmpty(owner) ||
        isEmpty(phone)
    ) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const sql = `
        INSERT INTO animals
        (name, type, breed, gender, color, age, weight, is_spayed, owner, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
        sql,
        [
            name.trim(),
            type.trim(),
            breed.trim(),
            gender.trim(),
            color.trim(),
            age.trim(),
            weight.trim(),
            is_spayed ? 1 : 0,
            owner.trim(),
            phone.trim()
        ],
        function (err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Failed to create animal" });
            }
            res.status(201).json({ id: this.lastID });
        }
    );
});

/* =====================
   GET + SEARCH ANIMALS
===================== */
router.get("/", async (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = 15;
    const offset = (page - 1) * limit;

    const { search, animal_id } = req.query;
    const all = req.query.all === "true";

    if (all) {
        db.all(
            `SELECT * FROM animals ORDER BY created_at DESC`,
            [],
            (err, animals) => {
                if (err)
                    return res.status(500).json({ error: err.message });

                return res.json({ data: animals });
            }
        );
        return;
    }


    // ================= BUILD WHERE =================
    let where = "WHERE 1=1";
    const params = [];

    if (search) {
        where += `
      AND (
        animals.name LIKE ?
        OR animals.owner LIKE ?
        OR animals.phone LIKE ?
        OR animals.type LIKE ?
      )
    `;
        const q = `%${search}%`;
        params.push(q, q, q, q);
    }


    // ================= DATA QUERY =================
    const dataSql = `
        SELECT *
        FROM animals
        ${where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `;

    // ================= COUNT QUERY =================
    const countSql = `
        SELECT COUNT(*) as count
        FROM animals
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


/* =====================
   ANIMAL PROFILE
===================== */
router.get("/:id", (req, res) => {
    const animalId = req.params.id;

    db.get(
        `SELECT * FROM animals WHERE id = ?`,
        [animalId],
        (err, animal) => {
            if (err) return res.status(500).json({ error: "DB error" });
            if (!animal) return res.status(404).json({ error: "Animal not found" });

            db.all(
                `
                SELECT
                    id,
                    date,
                    'visit' AS type,
                    notes,
                    images
                FROM visits
                WHERE animal_id = ?

                UNION ALL

                SELECT
                    vh.id,
                    vh.date,
                    'vaccine' AS type,
                    p.name AS notes,
                    NULL AS images
                FROM vaccine_history vh
                LEFT JOIN products p ON p.id = vh.product_id
                WHERE vh.animal_id = ?

                UNION ALL

                SELECT
                    id,
                    start_date AS date,
                    'boarding' AS type,
                    ' دخول إستضافة' AS notes,
                    NULL AS images
                FROM boardings
                WHERE animal_id = ?

                ORDER BY date DESC
                `,
                [animalId, animalId, animalId],
                (err2, visits) => {
                    if (err2) return res.status(500).json({ error: "Failed to fetch visits" });

                    db.all(
                        `
                        SELECT 
                            v.id,
                            v.product_id,
                            p.name AS vaccine_name,
                            v.last_date,
                            v.next_date
                        FROM vaccinations v
                        LEFT JOIN products p ON p.id = v.product_id
                        WHERE v.animal_id = ?
                        ORDER BY v.next_date ASC
                        `,
                        [animalId],
                        (err3, vaccinations) => {
                            if (err3) return res.status(500).json({ error: "Failed to fetch vaccinations" });

                            res.json({
                                animal,
                                visits,
                                vaccinations,
                            });
                        }
                    );
                }
            );
        }
    );
});

/* =====================
   UPDATE ANIMAL
===================== */
router.put("/:id", (req, res) => {
    const animalId = req.params.id;

    const {
        name,
        type,
        breed,
        gender,
        color,
        age,
        weight,
        is_spayed,
        owner,
        phone
    } = req.body;

    // validation
    if (
        isEmpty(name) ||
        isEmpty(type) ||
        isEmpty(gender) ||
        isEmpty(owner) ||
        isEmpty(phone)
    ) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const sql = `
        UPDATE animals
        SET
            name = ?,
            type = ?,
            breed = ?,
            gender = ?,
            color = ?,
            age = ?,
            weight = ?,
            is_spayed = ?,
            owner = ?,
            phone = ?
        WHERE id = ?
    `;

    db.run(
        sql,
        [
            name.trim(),
            type.trim(),
            breed.trim(),
            gender.trim(),
            color.trim(),
            age.trim(),
            weight.trim(),
            is_spayed ? 1 : 0,
            owner.trim(),
            phone.trim(),
            animalId
        ],
        function (err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Failed to update animal" });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: "Animal not found" });
            }

            res.json({ updated: true });
        }
    );
});


/* =====================
   DELETE ANIMAL
===================== */
router.delete("/:id", (req, res) => {
    const animalId = req.params.id;

    db.serialize(() => {
        db.run(
            `DELETE FROM visits WHERE animal_id = ?`,
            [animalId]
        );

        db.run(
            `DELETE FROM vaccinations WHERE animal_id = ?`,
            [animalId]
        );

        db.run(
            `DELETE FROM animals WHERE id = ?`,
            [animalId],
            function (err) {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: "Failed to delete animal" });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: "Animal not found" });
                }

                res.json({ deleted: true });
            }
        );
    });
});

module.exports = router;
