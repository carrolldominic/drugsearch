const express = require('express');
const { create } = require('express-handlebars'); // Import create
const fetch = require('node-fetch');
const app = express();
const port = 3000;

// Configure Handlebars with create()
const hbs = create({
  extname: '.hbs',
  defaultLayout: 'main'
});

app.engine('.hbs', hbs.engine); // Use hbs.engine for the view engine
app.set('view engine', '.hbs');
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.render('home');
});

app.get('/drug', async (req, res) => {
  const drugName = req.query.name;
  if (!drugName) {
    return res.render('home', { error: 'Please enter a drug name' });
  }

  try {
    const response = await fetch(
      `https://api.fda.gov/drug/label.json?search=openfda.brand_name:${encodeURIComponent(drugName)}&limit=1`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const drug = data.results[0];
      const drugInfo = {
        brandName: drug.openfda?.brand_name?.[0] || 'N/A',
        genericName: drug.openfda?.generic_name?.[0] || 'N/A',
        manufacturer: drug.openfda?.manufacturer_name?.[0] || 'N/A',
        indications: drug.indications_and_usage?.[0] || 'N/A',
        pdfLink: drug.labeling?.[0]?.pdf || ''
      };
      res.render('drug', { drug: drugInfo });
    } else {
      res.render('home', { error: 'No drug found' });
    }
  } catch (error) {
    res.render('home', { error: 'Error fetching drug information' });
  }
});

app.listen(port, () => console.log(`DrugSearch listening on port ${port}`));