const express = require('express');
const { create } = require('express-handlebars');
const fetch = require('node-fetch');
const path = require('path');

const app = express();

// Configure Handlebars
const hbs = create({
  extname: '.hbs',
  defaultLayout: 'main',
});

app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views')); // Explicitly set views directory
app.use(express.static(path.join(__dirname, 'public'))); // Explicitly set public directory

app.get('/', (req, res) => {
  res.render('home');
});

app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/drug', async (req, res) => {
  const drugName = req.query.name;
  if (!drugName) {
    return res.render('home', { error: 'Please enter a drug name' });
  }

  try {
    const searchTerm = `${encodeURIComponent(drugName)}*`;
    const response = await fetch(
      `https://api.fda.gov/drug/label.json?search=openfda.brand_name:${searchTerm}+openfda.generic_name:${searchTerm}&limit=20`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const drugs = data.results.map(drug => ({
        brandName: drug.openfda?.brand_name?.[0] || 'N/A',
        genericName: drug.openfda?.generic_name?.[0] || 'N/A',
        moa: drug.openfda?.pharm_class_moa?.[0] || 'N/A',
        manufacturer: drug.openfda?.manufacturer_name?.[0] || 'N/A',
        indications: drug.indications_and_usage?.[0] || 'N/A',
        pdfLink: drug.openfda?.spl_set_id?.[0] ? `https://nctr-crs.fda.gov/fdalabel/services/spl/set-ids/${drug.openfda.spl_set_id[0]}/spl-doc` : ''
      }));
      res.render('drug', { drugs, searchTerm: drugName });
    } else {
      res.render('home', { error: 'No drugs found' });
    }
  } catch (error) {
    console.error('Error fetching drug info:', error);
    res.render('home', { error: 'Error fetching drug information' });
  }
});

// Export for Vercel
module.exports = app;

// Run locally if not in serverless
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`DrugSearch listening on port ${port}`));
}