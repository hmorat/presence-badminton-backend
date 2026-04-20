import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;

const app = express();

/* ===== CONFIG ===== */
app.use(cors());
app.use(express.json());

/* ===== DATABASE ===== */
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONN,
  ssl: {
    rejectUnauthorized: false,
  },
});

/* ===== TEST ROOT ===== */
app.get("/", (req, res) => {
  res.send("API Badminton OK");
});

/* ===== ROUTE STATS ===== */
app.get("/api/stats", async (req, res) => {
  try {
    /* ===== JOUEURS ===== */
    const joueurs = await pool.query(`
      SELECT 
        j.licence,
        j.prenom,
        j.nom,
        COUNT(p.id) AS total,
        SUM(CASE WHEN p.present = true THEN 1 ELSE 0 END) AS presents
      FROM joueurs j
      LEFT JOIN presences p ON p.joueur_id = j.id
      GROUP BY j.id
      ORDER BY j.nom
    `);

    /* ===== CRENEAUX ===== */
    const creneaux = await pool.query(`
      SELECT 
        c.code AS creneau_code,
        c.jour,
        c.horaire,
        c.gymnase,
        c.entraineur,
        COUNT(p.id) AS total,
        SUM(CASE WHEN p.present = true THEN 1 ELSE 0 END) AS presents
      FROM creneaux c
      LEFT JOIN presences p ON p.creneau_id = c.id
      GROUP BY c.id
      ORDER BY c.code
    `);

    /* ===== DATES ===== */
    const dates = await pool.query(`
      SELECT 
        date_seance,
        COUNT(*) AS total,
        SUM(CASE WHEN present = true THEN 1 ELSE 0 END) AS presents
      FROM presences
      GROUP BY date_seance
      ORDER BY date_seance DESC
    `);

    res.json({
      joueurs: joueurs.rows,
      creneaux: creneaux.rows,
      dates: dates.rows,
    });
  } catch (err) {
    console.error("Erreur API :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ===== PORT ===== */
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("API running on port " + PORT);
});