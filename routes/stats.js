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
    const hasFilter = creneau && creneau !== "ALL";

    /* ===== JOUEURS ===== */
    const joueurs = await pool.query(
      `
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
      ORDER BY j.nom
      `,
      hasFilter ? [creneau] : []
    );

    /* ===== CRENEAUX (FILTRÉS AUSSI) ===== */
    const creneaux = await pool.query(
      `
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
      ${hasFilter ? "WHERE c.creneau_code = $1" : ""}
      GROUP BY 
        c.creneau_code, c.jour, c.horaire, c.gymnase, c.entraineur
      ORDER BY c.jour, c.horaire
      `,
      hasFilter ? [creneau] : []
    );

    res.json({
      joueurs: joueurs.rows,
      creneaux: creneaux.rows,
    });

  } catch (error) {
    console.error("Erreur stats :", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;