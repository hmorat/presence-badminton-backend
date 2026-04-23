const express = require('express');
const router = express.Router();
const supabase = require('../db');

router.get('/', async (req, res) => {
  try {
    // On demande précisément les colonnes telles qu'elles sont dans Supabase
    const { data, error } = await supabase
      .from('creneaux')
      .select('creneau_code, Jour, Horaire, Gymnase, Entraineur'); 

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;