const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ CONNEXION SUPABASE (IMPORTANT SSL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// =============================
// TEST API
// =============================
app.get("/", (req, res) => {
  res.send("API Badminton OK");
});

// =============================
// CRENEAUX
// =============================
app.get("/api/creneaux", async (req, res) => {
  try {
    console.log("TEST DB CONNECTION...");

    const result = await pool.query("SELECT NOW()");

    res.json(result.rows);

  } catch (err) {
    console.error("ERREUR SQL COMPLETE:", err);

    res.status(500).json({
      error: err.message,
      detail: err,
    });
  }
});

// =============================
// DATES
// =============================
app.get("/api/dates", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT date_seance
      FROM dates
      ORDER BY date_seance DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("ERREUR /dates:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =============================
// JOUEURS PAR CRENEAU
// =============================
app.get("/api/joueurs", async (req, res) => {
  try {
    const { creneau } = req.query;

    if (!creneau) return res.json([]);

    const result = await pool.query(
      `
      SELECT j.*
      FROM joueurs j
      WHERE j.licence IN (
        SELECT licence
        FROM joueurs_creneaux
        WHERE creneau_code = $1
      )
      ORDER BY j.nom, j.prenom
      `,
      [creneau]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("ERREUR /joueurs:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =============================
// PRESENCES GET
// =============================
app.get("/api/presences", async (req, res) => {
  try {
    const { creneau, date } = req.query;

    const result = await pool.query(
      `
      SELECT licence, present
      FROM presences
      WHERE creneau_code = $1
      AND date_seance = $2
      `,
      [creneau, date]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("ERREUR /presences:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =============================
// PRESENCE POST
// =============================
app.post("/api/presence", async (req, res) => {
  try {
    const { licence, creneau_code, date_seance, present } = req.body;

    await pool.query(
      `
      INSERT INTO presences (licence, creneau_code, date_seance, present)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (licence, creneau_code, date_seance)
      DO UPDATE SET present = EXCLUDED.present
      `,
      [licence, creneau_code, date_seance, present]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("ERREUR POST /presence:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =============================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Serveur lancé sur port", PORT);
});