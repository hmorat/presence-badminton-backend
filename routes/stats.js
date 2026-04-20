import express from "express";
import pkg from "pg";

const { Pool } = pkg;
const router = express.Router();

/* ===== DATABASE ===== */
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONN,
  ssl: {
    rejectUnauthorized: false,
  },
});

/* ===== ROUTE STATS ===== */
router.get("/stats", async (req, res) => {
  try {
    /* ===== JOUEURS ===== */
    const joueurs = await pool.query(`
      SELECT 
        j.licence,
        j.nom,
        j.prenom,
        COUNT(p.id) AS total,
        COALESCE(SUM(CASE WHEN p.present = true THEN 1 ELSE 0 END), 0) AS presents
      FROM joueurs j
      LEFT JOIN presences p ON p.licence = j.licence
      GROUP BY j.licence, j.nom, j.prenom
      ORDER BY j.nom
    `);

    /* ===== CRENEAUX ===== */
    const creneaux = await pool.query(`
      SELECT 
        p.creneau_code AS code,
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN p.present = true THEN 1 ELSE 0 END), 0) AS presents
      FROM presences p
      GROUP BY p.creneau_code
      ORDER BY p.creneau_code
    `);

    /* ===== DATES ===== */
    const dates = await pool.query(`
      SELECT 
        date_seance,
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN present = true THEN 1 ELSE 0 END), 0) AS presents
      FROM presences
      GROUP BY date_seance
      ORDER BY date_seance DESC
    `);

    res.json({
      joueurs: joueurs.rows,
      creneaux: creneaux.rows,
      dates: dates.rows,
    });

  } catch (error) {
    console.error("Erreur stats :", error.message);

    res.status(500).json({
      error: error.message,
    });
  }
});

/* ===== EXPORT ===== */
export default router;