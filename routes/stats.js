import express from "express";
import pkg from "pg";

const router = express.Router();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_CONN,
  ssl: { rejectUnauthorized: false },
});

/* =========================================================
   GET /api/stats
========================================================= */
router.get("/stats", async (req, res) => {
  try {
    /* ===== JOUEURS ===== */
    const joueurs = await pool.query(`
      SELECT 
        j.licence,
        j.prenom,
        j.nom,

        COALESCE(
          ARRAY_AGG(DISTINCT p.creneau_code)
          FILTER (WHERE p.creneau_code IS NOT NULL),
          '{}'
        ) AS creneaux,

        COUNT(p.present) FILTER (WHERE p.present = true) AS presents,
        COUNT(p.present) AS total

      FROM joueurs j
      LEFT JOIN presences p ON j.licence = p.licence

      GROUP BY j.licence, j.prenom, j.nom
      ORDER BY j.nom, j.prenom
    `);

    /* ===== CRENEAUX (AVEC INFOS COMPLETES) ===== */
    const creneaux = await pool.query(`
      SELECT 
        c.creneau_code,
        c.jour,
        c.horaire,
        c.gymnase,
        c.entraineur,

        COUNT(p.present) FILTER (WHERE p.present = true) AS presents,
        COUNT(p.present) AS total

      FROM creneaux c
      LEFT JOIN presences p ON c.creneau_code = p.creneau_code

      GROUP BY 
        c.creneau_code,
        c.jour,
        c.horaire,
        c.gymnase,
        c.entraineur

      ORDER BY c.creneau_code
    `);

    /* ===== DATES ===== */
    const dates = await pool.query(`
      SELECT 
        date_seance,
        COUNT(present) FILTER (WHERE present = true) AS presents,
        COUNT(*) AS total

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
    console.error("❌ ERREUR STATS :", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;