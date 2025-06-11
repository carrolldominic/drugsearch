const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const hbs = require('express-handlebars');

const app = express();

// Configure Handlebars
app.engine('hbs', hbs.engine({
  extname: 'hbs',
  helpers: {
    increment: v => v + 1,
    decrement: v => v - 1,
    eq: (a, b) => a === b,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b,
    pagination: function(current, total, options) {
      let start = Math.max(1, current - 2);
      let end = Math.min(total, current + 2);
      let pages = [];
      for (let i = start; i <= end; i++) pages.push(i);
      return pages;
    }
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views')); 
app.use(express.static(path.join(__dirname, 'public'))); 

// Home Route
app.get('/', (req, res) => {
  res.render('home', {
    title: 'PharmExplore - Drug and Literature Search',
    error: null
  });
});

app.get('/about', (req, res) => {
  res.render('about', {
    title: 'About PharmExplore - speed up your pharma diligence',
    error: null
  });
});



const drugRoute = require('./routes/drug');
const literatureRoute = require('./routes/literature');
const clinicalTrialsRoute = require('./routes/clinicaltrials');
const compoundRoute = require('./routes/compound'); // Add this line
const patentRoute = require('./routes/patent');

app.use('/drug', drugRoute);
app.use('/literature', literatureRoute);
app.use('/clinicaltrials', clinicalTrialsRoute);
app.use('/compound', compoundRoute); // Add this line
app.use('/patent', patentRoute);

// Export for Vercel
module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`DrugSearch listening on port ${port}`));
}