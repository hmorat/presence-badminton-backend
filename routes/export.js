const express = require('express');
const router = express.Router();
const pool = require('../db'); // Vérifie que le chemin vers db.js est correct

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.creneau_code as "Créneau",
        p.date_seance as "Date",
        COALESCE(j.nom, j."Nom") as "Nom",
        COALESCE(j.prenom, j."Prenom") as "Prénom",
        CASE WHEN p.present THEN 'PRÉSENT' ELSE 'ABSENT' END as "Statut"
      FROM presences p
      LEFT JOIN joueurs j ON TRIM(p.licence::TEXT) = TRIM(COALESCE(j.licence, j."Licence")::TEXT)
      ORDER BY p.date_seance DESC, p.creneau_code ASC, "Nom" ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;