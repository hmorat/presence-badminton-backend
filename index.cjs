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

// ROUTE 1 : Les créneaux triés proprement
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM creneaux 
      ORDER BY 
        CASE 
          WHEN jour = 'LUNDI' THEN 1 WHEN jour = 'MARDI' THEN 2
          WHEN jour = 'MERCREDI' THEN 3 WHEN jour = 'JEUDI' THEN 4
          WHEN jour = 'VENDREDI' THEN 5 WHEN jour = 'SAMEDI' THEN 6
          WHEN jour = 'DIMANCHE' THEN 7
        END ASC, creneau_code ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json([]);
  }
});

// ROUTE 2 : Les joueurs (Liste globale OU par date)
app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau, date } = req.query;
    if (!creneau) return res.json([]);

    let query;
    let params;

    if (date && date !== "") {
      // MODE HISTORIQUE : On récupère les présences avec la licence
      query = `
        SELECT nom, licence, presence, date_seance, creneau_code 
        FROM seances 
        WHERE creneau_code = $1 AND date_seance = $2 
        ORDER BY nom ASC
      `;
      params = [creneau, date];
    } else {
      // MODE INSCRIPTION : On prend la liste unique des joueurs par licence
      query = `
        SELECT DISTINCT ON (licence) nom, licence, creneau_code 
        FROM seances 
        WHERE creneau_code = $1 
        ORDER BY licence, nom ASC
      `;
      params = [creneau];
    }

    const result = await pool.query(query, params);
    res.json(result.rows || []);
  } catch (err) {
    console.error("Erreur SQL:", err.message);
    res.json([]);
  }
});


app.listen(port, () => console.log(`Serveur prêt sur le port ${port}`));