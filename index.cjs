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

    if (date && date !== "") {
      // CAS A : Historique d'une séance (on ajoute prenom)
      const query = `
        SELECT nom, prenom, licence, presence, date_seance, creneau_code 
        FROM seances 
        WHERE creneau_code = $1 AND date_seance = $2 
        ORDER BY nom ASC, prenom ASC
      `;
      const result = await pool.query(query, [creneau, date]);
      res.json(result.rows);
    } else {
      // CAS B : Liste des inscrits via la table de liaison
      // On récupère 'nom' ET 'prenom' depuis la table joueurs
      const query = `
        SELECT j.nom, j.prenom, j.licence, jc.creneau_code 
        FROM joueurs_creneaux jc
        JOIN joueurs j ON jc.licence = j.licence
        WHERE jc.creneau_code = $1
        ORDER BY j.nom ASC, j.prenom ASC
      `;
      const result = await pool.query(query, [creneau]);
      res.json(result.rows || []);
    }
  } catch (err) {
    console.error("Erreur SQL:", err.message);
    res.json([]);
  }
});


app.listen(port, () => console.log(`Serveur prêt sur le port ${port}`));