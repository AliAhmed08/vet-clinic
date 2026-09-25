const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const archiver = require("archiver");

const isElectron = !!process.versions.electron;

let dbPath;
let backupDir;
let uploadsDir;
let inventoryDir;

/* =========================
   Resolve paths
========================= */
if (isElectron) {
  const { app } = require("electron");
  const userData = app.getPath("userData");

  fs.mkdirSync(userData, { recursive: true });

  dbPath = path.join(userData, "database.sqlite");
  backupDir = path.join(userData, "backups");
  uploadsDir = path.join(userData, 'uploads');
  inventoryDir = path.join(userData, 'inventory');
} else {
  dbPath = path.join(process.cwd(), "database.sqlite");
  backupDir = path.join(process.cwd(), "backups");
  uploadsDir = path.join(process.cwd(), "uploads");
  inventoryDir = path.join(process.cwd(), "inventory");
}

/* =========================
   Create directories
========================= */
fs.mkdirSync(backupDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(inventoryDir, { recursive: true });

/* =========================
   Backup functions
========================= */


function autoBackup() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const backupFile = path.join(backupDir, `backup-${today}.zip`);

    if (fs.existsSync(backupFile)) return;
    if (!fs.existsSync(dbPath)) return;

    const output = fs.createWriteStream(backupFile);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`Full backup created (${archive.pointer()} bytes):`, backupFile);
    });

    archive.on("error", (err) => { throw err; });

    archive.pipe(output);

    archive.file(dbPath, { name: "database.sqlite" });

    if (fs.existsSync(uploadsDir)) {
      archive.directory(uploadsDir, "uploads");
    }

    if (fs.existsSync(inventoryDir)) {
      archive.directory(inventoryDir, "inventory");
    }

    archive.finalize();

  } catch (err) {
    console.error("Backup failed:", err);
  }
}

function cleanupOldBackups(days = 30) {
  try {
    const now = Date.now();
    const maxAge = days * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(backupDir);

    files.forEach((file) => {
      if (!file.startsWith("backup-") || !file.endsWith(".zip")) return;

      const dateStr = file.replace("backup-", "").replace(".zip", "");
      const fileDate = new Date(dateStr);

      if (isNaN(fileDate)) return;

      if (now - fileDate.getTime() > maxAge) {
        fs.unlinkSync(path.join(backupDir, file));
        console.log("Old backup removed:", file);
      }
    });
  } catch (err) {
    console.error("Cleanup failed:", err);
  }
}

/* =========================
   SQLite
========================= */

const db =
  new sqlite3.Database(dbPath);

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {

    db.run(sql, params, function (err) {

      if (err)
        return reject(err);

      resolve(this);

    });

  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {

    db.get(sql, params, (err, row) => {

      if (err)
        return reject(err);

      resolve(row);

    });

  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {

    db.all(sql, params, (err, rows) => {

      if (err)
        return reject(err);

      resolve(rows);

    });

  });

/* =========================
   Helpers
========================= */

async function tableExists(name) {

  const row = await get(

    `SELECT name
         FROM sqlite_master
         WHERE type='table'
         AND name=?`,

    [name]

  );

  return !!row;

}

async function columnExists(table, column) {

  const rows =
    await all(
      `PRAGMA table_info(${table})`
    );

  return rows.some(x => x.name === column);

}

async function safeAddColumn(table, column, type) {

  if (await columnExists(table, column))
    return;

  await run(
    `ALTER TABLE ${table}
         ADD COLUMN ${column} ${type}`
  );

}

async function setVersion(version) {

  await run(

    `UPDATE app_meta
         SET value=?
         WHERE key='db_version'`,

    [version]

  );

}

async function getVersion() {

  let row =
    await get(

      `SELECT value
             FROM app_meta
             WHERE key='db_version'`

    );

  if (!row) {

    await run(

      `INSERT INTO app_meta
             VALUES
             ('db_version','0')`

    );

    return 0;

  }

  return Number(row.value);

}
/* =========================
   Init Database
========================= */

async function initDatabase() {

  autoBackup();
  cleanupOldBackups();

  await run(`
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);

  let version = await getVersion();

  console.log("Current database version:", version);
  await run("BEGIN TRANSACTION");

  try {

    /* =====================================================
       MIGRATION V1
   ====================================================== */

    if (version < 1) {

      console.log("Running Migration V1...");

      /* ================= Animals ================= */

      await run(`
            CREATE TABLE IF NOT EXISTS animals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                breed TEXT NOT NULL,
                gender TEXT NOT NULL,
                age TEXT NOT NULL,
                is_spayed INTEGER
                    CHECK(is_spayed IN (0,1))
                    NOT NULL,
                owner TEXT NOT NULL,
                phone TEXT NOT NULL,
                created_at TEXT
                    DEFAULT(datetime('now'))
            )
        `);

      /* ================= Visits ================= */

      await run(`
            CREATE TABLE IF NOT EXISTS visits (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                animal_id INTEGER NOT NULL,

                date TEXT NOT NULL,

                notes TEXT,

                created_at TEXT
                    DEFAULT(datetime('now')),

                FOREIGN KEY(animal_id)
                    REFERENCES animals(id)

            )
        `);

      /* ================= Vaccinations ================= */

      await run(`
            CREATE TABLE IF NOT EXISTS vaccinations (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                animal_id INTEGER NOT NULL,

                vaccine_name TEXT NOT NULL,

                repeat_days INTEGER NOT NULL,

                last_date TEXT NOT NULL,

                next_date TEXT NOT NULL,

                notified INTEGER DEFAULT 0,

                created_at TEXT
                    DEFAULT(datetime('now')),

                FOREIGN KEY(animal_id)
                    REFERENCES animals(id)

            )
        `);

      /* ================= Rooms ================= */

      await run(`
            CREATE TABLE IF NOT EXISTS rooms (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                room_number TEXT UNIQUE NOT NULL

            )
        `);

      const room = await get(`
            SELECT id
            FROM rooms
            LIMIT 1
        `);

      if (!room) {

        await run(`
                INSERT INTO rooms(room_number)
                VALUES(1)
            `);

      }

      /* ================= Boardings ================= */

      await run(`
            CREATE TABLE IF NOT EXISTS boardings (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                animal_id INTEGER NOT NULL,

                room_id INTEGER NOT NULL,

                start_date DATE NOT NULL,

                end_date DATE,

                daily_price REAL,

                FOREIGN KEY(room_id)
                    REFERENCES rooms(id)

            )
        `);

      /* ================= Boarding Notes ================= */

      await run(`
            CREATE TABLE IF NOT EXISTS boarding_notes (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                boarding_id INTEGER NOT NULL,

                note_date DATE NOT NULL,

                note_text TEXT,

                FOREIGN KEY(boarding_id)
                    REFERENCES boardings(id)

            )
        `);

      /* ================= Supplier Invoices ================= */

      await run(`
            CREATE TABLE IF NOT EXISTS supplier_invoices (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                company_name TEXT NOT NULL,

                purchases TEXT NOT NULL,

                total_amount REAL NOT NULL,

                paid_amount REAL DEFAULT 0,

                remaining_amount REAL NOT NULL,

                invoice_date DATE
                    DEFAULT CURRENT_TIMESTAMP

            )
        `);

      /* ================= Vaccine History ================= */

      await run(`
            CREATE TABLE IF NOT EXISTS vaccine_history (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                animal_id INTEGER NOT NULL,

                vaccine_name TEXT NOT NULL,

                date TEXT NOT NULL,

                created_at TEXT
                    DEFAULT(datetime('now'))

            )
        `);

      version = 1;

      await setVersion(version);

      console.log("Migration V1 completed.");

    }
    /* =====================================================
    MIGRATION V2
====================================================== */

    if (version < 2) {

      console.log("Running Migration V2...");

      await safeAddColumn(
        "animals",
        "color",
        "TEXT"
      );

      /* ================= Visits ================= */

      await safeAddColumn(
        "visits",
        "images",
        "TEXT"
      );

      version = 2;

      await setVersion(version);

      console.log("Migration V2 completed.");

    }
    /* =====================================================
    MIGRATION V3
====================================================== */

    if (version < 3) {

      console.log("Running Migration V3...");

      /* ================= Animals ================= */

      await safeAddColumn(
        "animals",
        "weight",
        "REAL"
      );

      /* ================= Visits ================= */

      await safeAddColumn(
        "visits",
        "price",
        "REAL"
      );

      /* ================= Products ================= */

      await run(`

            CREATE TABLE IF NOT EXISTS products (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                name TEXT NOT NULL,

                category TEXT,

                purchase_price REAL DEFAULT 0,

                sale_price REAL DEFAULT 0,

                min_stock INTEGER DEFAULT 0,

                image_url TEXT,

                is_active INTEGER DEFAULT 1,

                created_at TEXT
                    DEFAULT(datetime('now'))

            )

        `);

      /* ================= Inventory Batches ================= */

      await run(`

            CREATE TABLE IF NOT EXISTS inventory_batches (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                product_id INTEGER,

                quantity INTEGER,

                purchase_price REAL,

                sale_price REAL,

                expiry_date TEXT,

                created_at TEXT
                    DEFAULT(datetime('now')),

                FOREIGN KEY(product_id)
                    REFERENCES products(id)

            )

        `);

      /* ================= Inventory Transactions ================= */

      await run(`

            CREATE TABLE IF NOT EXISTS inventory_transactions (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                product_id INTEGER,

                quantity INTEGER,

                transaction_type TEXT,

                reference_type TEXT,

                reference_id INTEGER,

                batch_id INTEGER,

                profit REAL DEFAULT 0,

                created_at TEXT
                    DEFAULT(datetime('now')),

                FOREIGN KEY(product_id)
                    REFERENCES products(id),

                FOREIGN KEY(batch_id)
                    REFERENCES inventory_batches(id)

            )

        `);

      /* ================= Sales ================= */

      await run(`

            CREATE TABLE IF NOT EXISTS sales (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                total_amount REAL DEFAULT 0,

                created_at TEXT
                    DEFAULT(datetime('now'))

            )

        `);

      /* ================= Sale Items ================= */

      await run(`

            CREATE TABLE IF NOT EXISTS sale_items (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                sale_id INTEGER,

                product_id INTEGER,

                quantity INTEGER,

                price REAL,

                FOREIGN KEY(sale_id)
                    REFERENCES sales(id),

                FOREIGN KEY(product_id)
                    REFERENCES products(id)

            )

        `);

      /* ================= Settings ================= */

      await run(`

            CREATE TABLE IF NOT EXISTS clinic_settings (

                id INTEGER PRIMARY KEY CHECK(id=1),

                clinic_name TEXT,

                phone TEXT,

                address TEXT,

                logo TEXT

            )

        `);

      const settings = await get(
        "SELECT * FROM clinic_settings LIMIT 1"
      );

      if (!settings) {

        await run(`
                INSERT INTO clinic_settings(id)
                VALUES(1)
            `);

      }

      version = 3;

      await setVersion(version);

      console.log("Migration V3 completed.");

    }
    /* =====================================================
    MIGRATION V4
    Convert vaccine_name -> product_id
====================================================== */

    if (version < 4) {

      console.log("Running Migration V4...");

      const oldVaccinationTable = await all(`
            PRAGMA table_info(vaccinations)
        `);

      const hasProductId =
        oldVaccinationTable.some(c => c.name === "product_id");

      if (!hasProductId) {

        console.log("Converting vaccinations table...");

        await run(`
                ALTER TABLE vaccinations
                RENAME TO vaccinations_old
            `);

        await run(`
                CREATE TABLE vaccinations (

                    id INTEGER PRIMARY KEY AUTOINCREMENT,

                    animal_id INTEGER NOT NULL,

                    product_id INTEGER NOT NULL,

                    repeat_days INTEGER NOT NULL,

                    last_date TEXT NOT NULL,

                    next_date TEXT NOT NULL,

                    notified INTEGER DEFAULT 0,

                    created_at TEXT DEFAULT(datetime('now')),

                    FOREIGN KEY(animal_id)
                        REFERENCES animals(id),

                    FOREIGN KEY(product_id)
                        REFERENCES products(id)

                )
            `);

        const rows = await all(`
                SELECT *
                FROM vaccinations_old
            `);

        for (const row of rows) {

          let product = await get(

            `SELECT id
                     FROM products
                     WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))`,

            [row.vaccine_name]

          );

          if (!product) {

            const insert = await run(

              `INSERT INTO products
                        (
                            name,
                            category,
                            purchase_price,
                            sale_price,
                            min_stock
                        )

                        VALUES
                        (
                            ?,
                            'vaccine',
                            0,
                            0,
                            0
                        )`,

              [row.vaccine_name]

            );

            product = {
              id: insert.lastID
            };

          }

          await run(

            `INSERT INTO vaccinations(

                        animal_id,

                        product_id,

                        repeat_days,

                        last_date,

                        next_date,

                        notified,

                        created_at

                    )

                    VALUES(?,?,?,?,?,?,?)`,

            [

              row.animal_id,

              product.id,

              row.repeat_days,

              row.last_date,

              row.next_date,

              row.notified,

              row.created_at

            ]

          );

        }

        await run(`
                DROP TABLE vaccinations_old
            `);

        console.log("Vaccinations migrated.");

      }

      /* ==========================================
         Vaccine History
      ========================================== */

      const historyInfo = await all(`
            PRAGMA table_info(vaccine_history)
        `);

      const historyHasProduct =
        historyInfo.some(c => c.name === "product_id");

      if (!historyHasProduct) {

        console.log("Converting vaccine history...");

        await run(`
                ALTER TABLE vaccine_history
                RENAME TO vaccine_history_old
            `);

        await run(`
                CREATE TABLE vaccine_history (

                    id INTEGER PRIMARY KEY AUTOINCREMENT,

                    animal_id INTEGER NOT NULL,

                    product_id INTEGER NOT NULL,

                    date TEXT NOT NULL,

                    created_at TEXT DEFAULT(datetime('now')),

                    FOREIGN KEY(animal_id)
                        REFERENCES animals(id),

                    FOREIGN KEY(product_id)
                        REFERENCES products(id)

                )
            `);

        const history = await all(`
                SELECT *
                FROM vaccine_history_old
            `);

        for (const row of history) {

          let product = await get(

            `SELECT id
                     FROM products
                     WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))`,

            [row.vaccine_name]

          );

          if (!product) {

            const insert = await run(

              `INSERT INTO products
                        (
                            name,
                            category,
                            purchase_price,
                            sale_price,
                            min_stock
                        )

                        VALUES
                        (
                            ?,
                            'vaccine',
                            0,
                            0,
                            0
                        )`,

              [row.vaccine_name]

            );

            product = {
              id: insert.lastID
            };

          }

          await run(

            `INSERT INTO vaccine_history(

                        animal_id,

                        product_id,

                        date,

                        created_at

                    )

                    VALUES(?,?,?,?)`,

            [

              row.animal_id,

              product.id,

              row.date,

              row.created_at

            ]

          );

        }

        await run(`
                DROP TABLE vaccine_history_old
            `);

        console.log("Vaccine history migrated.");

      }

      version = 4;

      await setVersion(version);

      console.log("Migration V4 completed.");

    }

    await run("COMMIT");

  } catch (err) {

    await run("ROLLBACK");

    throw err;

  }
}
module.exports = {
  db,
  initDatabase
};