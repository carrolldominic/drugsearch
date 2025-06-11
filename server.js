const express = require('express');
const { create } = require('express-handlebars');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
//test
// Configure Handlebars
const hbs = create({
  extname: '.hbs',
  defaultLayout: 'main',
}); 

app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');
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
app.use('/drug', drugRoute);
app.use('/literature', literatureRoute);
app.use('/clinicaltrials', clinicalTrialsRoute);


// Export for Vercel
module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`DrugSearch listening on port ${port}`));
}