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
    /* ===== FILTRE ===== */
    const hasFilter = creneau && creneau !== "ALL";

    const filterClause = hasFilter
      ? "WHERE p.creneau_code = $1"
      : "";

    const params = hasFilter ? [creneau] : [];

    /* ===== JOUEURS ===== */
    const joueursQuery = `
      SELECT 
        j.licence,
        j.nom,
        j.prenom,
        COUNT(p.id) AS total,
        COALESCE(SUM(CASE WHEN p.present = true THEN 1 ELSE 0 END), 0) AS presents
      FROM joueurs j
      LEFT JOIN presences p 
        ON p.licence = j.licence
        ${hasFilter ? "AND p.creneau_code = $1" : ""}
      GROUP BY j.licence, j.nom, j.prenom
      ORDER BY j.nom, j.prenom
    `;

    const joueurs = await pool.query(joueursQuery, params);

    /* ===== CRENEAUX ===== */
    const creneaux = await pool.query(`
      SELECT 
        c.creneau_code AS code,
        c.jour,
        c.horaire,
        c.gymnase,
        c.entraineur,
        COUNT(p.id) AS total,
        COALESCE(SUM(CASE WHEN p.present = true THEN 1 ELSE 0 END), 0) AS presents
      FROM creneaux c
      LEFT JOIN presences p 
        ON p.creneau_code = c.creneau_code
      GROUP BY 
        c.creneau_code, c.jour, c.horaire, c.gymnase, c.entraineur
      ORDER BY c.jour, c.horaire
    `);

    /* ===== DATES ===== */
    const datesQuery = `
      SELECT 
        p.date_seance,
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN p.present = true THEN 1 ELSE 0 END), 0) AS presents
      FROM presences p
      ${filterClause}
      GROUP BY p.date_seance
      ORDER BY p.date_seance DESC
    `;

    const dates = await pool.query(datesQuery, params);

    /* ===== RESPONSE ===== */
    res.json({
      joueurs: joueurs.rows,
      creneaux: creneaux.rows,
      dates: dates.rows,
    });

  } catch (error) {
    console.error("Erreur stats :", error);
    res.status(500).json({
      error: "Erreur serveur",
      details: error.message,
    });
  }
});

export default router;