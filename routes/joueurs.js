import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// ✅ Joueurs d’un créneau (par creneau_code)
router.get("/creneau/:creneauCode", async (req, res) => {
  const { creneauCode } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT j.*
       FROM public.joueurs j
       JOIN public.joueurs_creneaux jc
         ON jc.licence = j.licence
       WHERE jc.creneau_code = $1
       ORDER BY j.nom, j.prenom`,
      [creneauCode]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erreur joueurs par créneau :", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;