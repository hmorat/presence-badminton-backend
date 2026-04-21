import express from "express";
import { pool } from "../db.js";

const router = express.Router();

app.get("/api/stats", async (req, res) => {
  try {
    const { creneau, date } = req.query;

    const result = await pool.query(
      `
      SELECT 
        j.licence,
        j.nom,
        j.prenom,
        COUNT(p.id) AS total,
        COUNT(CASE WHEN p.present = true THEN 1 END) AS presents
      FROM joueurs j
      LEFT JOIN presences p 
        ON j.licence::text = p.licence::text
        AND ($1::text IS NULL OR p.creneau_code = $1)
        AND ($2::date IS NULL OR p.date_seance = $2)
      GROUP BY j.licence, j.nom, j.prenom
      ORDER BY j.nom ASC
      `,
      [
        creneau || null,
        date || null
      ]
    );

    res.json({ joueurs: result.rows });
  } catch (err) {
    console.error("ERREUR /stats :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;