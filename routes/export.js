const express = require('express');
const router = express.Router();
const { pool } = require('../db.js'); // Vérifie si ton db est .js ou .cjs

router.get('/all', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.creneau_code,
        p.date_seance,
        j.licence,
        j.prenom,
        j.nom,
        p.present
      FROM presences p
      JOIN joueurs j ON j.licence = p.licence
      ORDER BY p.date_seance DESC, p.creneau_code ASC, j.nom ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur export :", err);
    res.status(500).json({ error: "Erreur export" });
  }
});

module.exports = router;