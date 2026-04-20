import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/all", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.date_seance,
        p.creneau_code,
        j.licence,
        j.prenom,
        j.nom,
        p.present
      FROM presences p
      JOIN joueurs j ON j.licence = p.licence
      ORDER BY p.date_seance, p.creneau_code, j.nom
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Erreur export :", err);
    res.status(500).json({ error: "Erreur export" });
  }
});

export default router;