import express from "express";
import pkg from "pg";

const { Pool } = pkg;
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.SUPABASE_CONN,
  ssl: { rejectUnauthorized: false },
});

router.get("/stats", async (req, res) => {
  const { creneau } = req.query;

  try {
    /* ===== CONDITION FILTRE ===== */
    const filter = creneau && creneau !== "ALL"
      ? `WHERE p.creneau_code = $1`
      : "";

    const params = creneau && creneau !== "ALL" ? [creneau] : [];

    /* ===== JOUEURS ===== */
    const joueurs = await pool.query(`
      SELECT 
        j.licence,
        j.nom,
        j.prenom,
        COUNT(p.id) AS total,
        COALESCE(SUM(CASE WHEN p.present = true THEN 1 ELSE 0 END), 0) AS presents
      FROM joueurs j
      LEFT JOIN presences p 
        ON p.licence = j.licence
      ${filter}
      GROUP BY j.licence, j.nom, j.prenom
      ORDER BY j.nom
    `, params);

    /* ===== CRENEAUX ===== */
    const creneaux = await pool.query(`
  SELECT 
    c.code,
    c.jour,
    c.horaire,
    c.gymnase,
    c.entraineur,
    COUNT(p.id) AS total,
    COALESCE(SUM(CASE WHEN p.present = true THEN 1 ELSE 0 END), 0) AS presents
  FROM creneaux c
  LEFT JOIN presences p ON p.creneau_code = c.code
  GROUP BY c.code, c.jour, c.horaire, c.gymnase, c.entraineur
  ORDER BY c.code
`);

    /* ===== DATES ===== */
    const dates = await pool.query(`
      SELECT 
        date_seance,
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN present = true THEN 1 ELSE 0 END), 0) AS presents
      FROM presences
      ${filter}
      GROUP BY date_seance
      ORDER BY date_seance DESC
    `, params);

    res.json({
      joueurs: joueurs.rows,
      creneaux: creneaux.rows,
      dates: dates.rows,
    });

  } catch (error) {
    console.error("Erreur stats :", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;