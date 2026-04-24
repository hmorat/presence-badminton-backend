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

// 1. MENU CRÉNEAUX
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM creneaux ORDER BY creneau_code ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json([]);
  }
});

// 2. LISTE DES JOUEURS (Source: joueurs_creneaux + jointure presences)
app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau, date } = req.query;
    if (!creneau || !date) return res.json([]);

    const codeNettoye = creneau.split(':')[0].trim();

    const query = `
      SELECT 
        j.nom, 
        j.prenom, 
        jc.licence,
        COALESCE(p.present, false) AS present
      FROM joueurs_creneaux jc
      JOIN joueurs j ON jc.licence = j.licence
      LEFT JOIN presences p ON (
        p.licence = jc.licence 
        AND p.date_seance = $2 
        AND p.creneau_code = $1
      )
      WHERE jc.creneau_code = $1
      ORDER BY j.nom ASC
    `;

    const result = await pool.query(query, [codeNettoye, date]);
    console.log(`[LOG] ${codeNettoye} : ${result.rowCount} joueurs envoyés`);
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur SQL Joueurs:", err.message);
    res.status(500).json([]);
  }
});

// 3. SAUVEGARDE (Vers la table presences)
app.post('/api/presences', async (req, res) => {
  const { creneau, date, joueurs } = req.body;
  const codeNettoye = creneau.split(':')[0].trim();

  try {
    for (const j of joueurs) {
      const query = `
        INSERT INTO presences (licence, creneau_code, date_seance, present)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (licence, date_seance, creneau_code) 
        DO UPDATE SET present = EXCLUDED.present
      `;
      await pool.query(query, [j.licence, codeNettoye, date, j.present]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur Save:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => console.log(`Serveur sur port ${port}`));