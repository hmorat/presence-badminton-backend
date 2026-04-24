const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// 1. RÉCUPÉRER LES CRÉNEAUX
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM creneaux ORDER BY jour, creneau_code`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json([]);
  }
});

// 2. RÉCUPÉRER LES JOUEURS (Via table de liaison)
app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau, date } = req.query;
    if (!creneau || !date) return res.json([]);

    // Cette requête fait un "pont" entre 3 informations :
    // - La liste des inscrits (joueurs_creneaux)
    // - Leurs noms/prénoms (joueurs)
    // - Leurs présences à cette date (seances)
    const query = `
      SELECT 
        j.nom, 
        j.prenom, 
        j.licence,
        COALESCE(s.presence, false) as presence
      FROM joueurs_creneaux jc
      JOIN joueurs j ON jc.licence = j.licence
      LEFT JOIN seances s ON (
        s.licence = jc.licence 
        AND s.date_seance = $2 
        AND s.creneau_code = $1
      )
      WHERE UPPER(jc.creneau_code) = UPPER($1)
      ORDER BY j.nom ASC, j.prenom ASC
    `;

    const result = await pool.query(query, [creneau.trim(), date]);
    
    // Log pour t'aider à déboguer dans Render
    console.log(`Requête pour ${creneau} le ${date} : ${result.rowCount} joueurs trouvés.`);
    
    res.json(result.rows);
  } catch (err) {
    console.error("ERREUR SQL JOUEURS:", err.message);
    res.json([]);
  }
});

// 3. ENREGISTRER (POST)
app.post('/api/presences', async (req, res) => {
  const { creneau, date, joueurs } = req.body;
  try {
    for (const j of joueurs) {
      await pool.query(`
        INSERT INTO seances (licence, creneau_code, date_seance, presence, nom, prenom)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (licence, date_seance, creneau_code) 
        DO UPDATE SET presence = EXCLUDED.presence
      `, [j.licence, creneau, date, j.presence, j.nom, j.prenom]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`Démarré sur le port ${port}`));