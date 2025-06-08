const express = require('express');

const router = express.Router();
const ExcelJS = require('exceljs');

router.get('/', async (req, res) => {
  const drugName = req.query.name;
  if (!drugName) {
    return res.render('home', {
      title: 'Drug and Literature Search',
      error: 'Please enter a drug name'
    });
  }

  try {
    const searchTerm = encodeURIComponent(drugName);
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${searchTerm}&retmax=50&retmode=json`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.esearchresult || !searchData.esearchresult.idlist || searchData.esearchresult.idlist.length === 0) {
      return res.render('literature', {
        title: `Literature Results for ${drugName}`,
        searchTerm: drugName,
        articles: [],
        error: 'No articles found'
      });
    }

    const pmids = searchData.esearchresult.idlist.join(',');
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids}&retmode=json`;
    const fetchResponse = await fetch(fetchUrl);
    const fetchData = await fetchResponse.json();

    const articles = Object.values(fetchData.result)
      .filter(article => article.uid && article.title)
      .map(article => ({
        title: article.title || 'N/A',
        authors: article.authors?.map(author => author.name).join(', ') || 'N/A',
        journal: article.source || 'N/A',
        pubDate: article.pubdate || 'N/A',
        doi: article.elocationid || 'N/A',
        pmcid: article.articleids?.find(id => id.idtype === 'pmcid')?.value || 'N/A',
        link: `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`
      }));

    res.render('literature', {
      title: `Literature Results for ${drugName}`,
      searchTerm: drugName,
      articles
    });
  } catch (error) {
    console.error('Error fetching PubMed data:', error);
    res.render('literature', {
      title: `Literature Results for ${drugName}`,
      searchTerm: drugName,
      articles: [],
      error: 'Error fetching literature data'
    });
  }
});

// Literature Download Route
router.get('/download', async (req, res) => {
  const drugName = req.query.name;
  if (!drugName) {
    return res.status(400).send('Drug name is required');
  }

  try {
    const searchTerm = encodeURIComponent(drugName);
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${searchTerm}&retmax=20&retmode=json`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.esearchresult || !searchData.esearchresult.idlist || searchData.esearchresult.idlist.length === 0) {
      return res.status(404).send('No articles found');
    }

    const pmids = searchData.esearchresult.idlist.join(',');
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids}&retmode=json`;
    const fetchResponse = await fetch(fetchUrl);
    const fetchData = await fetchResponse.json();

    const articles = Object.values(fetchData.result)
      .filter(article => article.uid && article.title)
      .map(article => ({
        title: article.title || 'N/A',
        authors: article.authors?.map(author => author.name).join(', ') || 'N/A',
        journal: article.source || 'N/A',
        pubDate: article.pubdate || 'N/A',
        doi: article.elocationid || 'N/A',
        pmcid: article.articleids?.find(id => id.idtype === 'pmcid')?.value || 'N/A',
        link: `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`
      }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('PubMed Articles');

    worksheet.columns = [
      { header: 'Title', key: 'title', width: 50 },
      { header: 'Authors', key: 'authors', width: 30 },
      { header: 'Journal', key: 'journal', width: 20 },
      { header: 'Publication Date', key: 'pubDate', width: 15 },
      { header: 'DOI', key: 'doi', width: 20 },
      { header: 'PMCID', key: 'pmcid', width: 15 },
      { header: 'PubMed Link', key: 'link', width: 30 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'D3D3D3' }
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    articles.forEach(article => {
      worksheet.addRow(article);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="PubMed_${drugName}_Articles.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel file:', error);
    res.status(500).send('Error generating Excel file');
  }
});


module.exports = router;