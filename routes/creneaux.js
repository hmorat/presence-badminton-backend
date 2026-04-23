const express = require('express');
const router = express.Router();
const supabase = require('../db');

router.get('/', async (req, res) => {
  try {
    // On demande explicitement les colonnes avec leurs Majuscules
    const { data, error } = await supabase
      .from('creneaux')
      .select('creneau_code, Jour, Horaire, Gymnase, Entraineur'); 

    if (error) {
      console.error("Erreur Supabase:", error);
      return res.status(500).json({ error: error.message });
    }

    // On logue ce qu'on envoie pour vérifier dans les logs Render
    console.log("Données envoyées :", data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;