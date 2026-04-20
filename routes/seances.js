import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// Créer ou récupérer une séance
router.post("/", async (req, res) => {
  const { creneau_id, date_seance } = req.body;

  try {
    // Séance déjà existante ?
    const existing = await pool.query(
      `SELECT id FROM public.seances
       WHERE creneau_id = $1 AND date_seance = $2`,
      [creneau_id, date_seance]
    );

    if (existing.rows.length > 0) {
      return res.json({ seance_id: existing.rows[0].id });
    }

    // Créer la séance
    const inserted = await pool.query(
      `INSERT INTO public.seances (creneau_id, date_seance)
       VALUES ($1, $2)
       RETURNING id`,
      [creneau_id, date_seance]
    );

    res.json({ seance_id: inserted.rows[0].id });
  } catch (err) {
    console.error("Erreur séance :", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;