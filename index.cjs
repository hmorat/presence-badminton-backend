const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// 1. Connexion sécurisée à Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(cors());
app.use(express.json());

// 2. Route Créneaux : Triés par JOUR puis par NOM (Ordre alphabétique)
app.get('/api/creneaux', async (req, res) => {
  try {
    // On trie d'abord par jour pour la cohérence, puis par creneau_code alphabétique
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
        END, 
        creneau_code ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Erreur lors du chargement des créneaux" });
  }
});

// 3. Route Joueurs : Correction du lien entre 'seances' et 'creneaux'
app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau } = req.query; // Le code envoyé par le front (ex: PE41:1)

    if (!creneau) {
      return res.status(400).json({ error: "Aucun créneau sélectionné" });
    }

    // On joint les deux tables pour filtrer par 'creneau_code' 
    // qui se trouve dans la table 'creneaux'
    const query = `
      SELECT s.* FROM seances s
      JOIN creneaux c ON s.creneau_id = c.id
      WHERE c.creneau_code = $1
      ORDER BY s.entraineur ASC
    `;

    const result = await pool.query(query, [creneau]);
    
    // On renvoie un tableau vide [] si aucun joueur n'est trouvé 
    // Cela évite l'écran blanc (TypeError: d.map is not a function)
    res.json(result.rows || []);
    
  } catch (err) {
    console.error("Erreur technique joueurs:", err.message);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  }
});

app.listen(port, () => {
  console.log(`Serveur prêt sur le port ${port}`);
});