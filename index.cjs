const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// 1. Liste des créneaux
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM creneaux 
      ORDER BY 
        CASE 
          WHEN jour = 'LUNDI' THEN 1
          WHEN jour = 'MARDI' THEN 2
          WHEN jour = 'MERCREDI' THEN 3
          WHEN jour = 'JEUDI' THEN 4
          WHEN jour = 'VENDREDI' THEN 5
          WHEN jour = 'SAMEDI' THEN 6
          WHEN jour = 'DIMANCHE' THEN 7
        END ASC,
        creneau_code ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// 2. Liste des joueurs (simplifiée avec ta nouvelle clé primaire creneau_code)
app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau } = req.query; 

    if (!creneau) return res.json([]);

    // On cherche directement dans la table 'seances' via 'creneau_code'
    const query = `
      SELECT * FROM seances 
      WHERE creneau_code = $1 
      ORDER BY entraineur ASC
    `;

    const result = await pool.query(query, [creneau]);
    res.json(result.rows || []);
    
  } catch (err) {
    console.error("Erreur SQL détaillée:", err.message);
    res.json([]); // Évite l'écran blanc sur le front
  }
});

// Route par défaut pour tester si le serveur est en vie
app.get('/', (req, res) => {
  res.send('Le serveur Presence Badminton est en ligne !');
});

app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});