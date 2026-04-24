const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

// =============================
// CONNEXION POSTGRES (SUPABASE)
// =============================
const { Pool } = require('pg');

// Cette ligne est CRUCIALE : elle dit "Utilise la variable DATABASE_URL, 
// et si elle n'existe pas (en local), utilise localhost"
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    // Indispensable pour Supabase sur Vercel/Render
    rejectUnauthorized: false 
  }
});

// Petit test au démarrage pour voir si ça marche
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error("Erreur de connexion à la base :", err.message);
  } else {
    console.log("Connecté à Supabase avec succès !");
  }
});

// =============================
// TEST
// =============================
app.get("/", (req, res) => {
  res.send("API Badminton OK");
});

// =============================
// CRENEAUX
// =============================
app.get("/api/creneaux", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT creneau_code, jour, horaire
      FROM creneaux
      ORDER BY creneau_code
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("ERREUR /creneaux:", err);
    res.status(500).json({ error: err.message });
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
      `SELECT j.* FROM joueurs j
       INNER JOIN joueurs_creneaux jc ON j.licence = jc.licence
       WHERE jc.creneau_code = $1
       ORDER BY j.nom, j.prenom`,
      [creneau]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("ERREUR /joueurs:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// PRESENCES (GET)
// =============================
app.get("/api/presences", async (req, res) => {
  try {
    const { creneau, date } = req.query;
    if (!creneau || !date) return res.json([]);

    const result = await pool.query(
      `SELECT licence, present FROM presences
       WHERE creneau_code = $1 AND date_seance = $2`,
      [creneau, date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("ERREUR /presences:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// PRESENCE (POST)
// =============================
app.post("/api/presence", async (req, res) => {
  try {
    const { licence, creneau_code, date_seance, present } = req.body;
    if (!licence || !creneau_code || !date_seance) {
      return res.status(400).json({ error: "Données manquantes" });
    }
    await pool.query(
      `INSERT INTO presences (licence, creneau_code, date_seance, present)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (licence, creneau_code, date_seance)
       DO UPDATE SET present = EXCLUDED.present`,
      [licence, creneau_code, date_seance, present]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("ERREUR POST /presence:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// EXPORT EXCEL (LA ROUTE MANQUANTE)
// =============================
app.get("/api/export/all", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.creneau_code,
        p.date_seance,
        j.licence,
        j.prenom,
        j.nom,
        p.present
      FROM presences p
      JOIN joueurs j ON j.licence = p.licence
      ORDER BY p.date_seance DESC, p.creneau_code ASC, j.nom ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur export :", err);
    res.status(500).json({ error: "Erreur export" });
  }
});

// =============================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Serveur lancé sur port", PORT);
});