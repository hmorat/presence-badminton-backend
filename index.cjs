const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 1. Liste des créneaux (Triés par code : F1, F2, F11...)
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM creneaux ORDER BY LENGTH(creneau_code), creneau_code ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Liste des joueurs selon le créneau (Le lien vital)
app.get('/api/joueurs', async (req, res) => {
  const { creneau, date } = req.query;
  try {
    const result = await pool.query(`
      SELECT 
        j.licence, j.nom, j.prenom,
        COALESCE(p.present, false) as present
      FROM joueurs j
      JOIN joueurs_creneaux jc ON jc.licence = j.licence
      LEFT JOIN presences p ON p.licence = j.licence AND p.date_seance = $2
      WHERE jc.creneau_code = $1
      ORDER BY j.nom ASC
    `, [creneau, date]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// 3. Enregistrement des présences
app.post('/api/presences', async (req, res) => {
  const { date, joueurs, creneau } = req.body;
  try {
    for (const j of joueurs) {
      await pool.query(`
        INSERT INTO presences (licence, date_seance, creneau_code, present)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (licence, date_seance) 
        DO UPDATE SET present = EXCLUDED.present
      `, [j.licence, date, creneau, j.present]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 4. Export global de tout l'historique
app.get('/api/export-global', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.date_seance as "Date",
        p.creneau_code as "Créneau",
        j.nom as "Nom",
        j.prenom as "Prénom",
        CASE WHEN p.present THEN 'PRÉSENT' ELSE 'ABSENT' END as "Statut"
      FROM presences p
      JOIN joueurs j ON j.licence = p.licence
      ORDER BY p.date_seance DESC, p.creneau_code ASC, j.nom ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serveur prêt sur port ${PORT}`));