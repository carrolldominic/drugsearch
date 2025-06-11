const express = require('express');
const router = express.Router();

// ClinicalTrials.gov v2 API endpoint
// Docs: https://clinicaltrials.gov/api/gui/ref/api_urls

router.get('/', async (req, res) => {
  const drugName = req.query.name;
  const pageToken = req.query.pageToken || '';
  const pageSize = 10;

  if (!drugName) {
    return res.render('home', {
      title: 'Drug and Literature Search',
      error: 'Please enter a drug or intervention name for clinical trials.'
    });
  }

  try {
    let apiUrl = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(drugName)}&pageSize=${pageSize}`;
    if (pageToken) {
      apiUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
    }
    const response = await fetch(apiUrl);
    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      return res.render('home', {
        title: 'Drug and Literature Search',
        error: 'ClinicalTrials.gov API returned an error. Please try a different search term.'
      });
    }

    const nextPageToken = data.nextPageToken || null;
    const trials = (data.studies || []).map(study => {
      const idMod = study.protocolSection?.identificationModule || {};
      const statusMod = study.protocolSection?.statusModule || {};
      const condMod = study.protocolSection?.conditionsModule || {};
      const descMod = study.protocolSection?.descriptionModule || {};
      const designMod = study.protocolSection?.designModule || {};
      const armsMod = study.protocolSection?.armsInterventionsModule || {};
      const outcomesMod = study.protocolSection?.outcomesModule || {};
      const eligibilityMod = study.protocolSection?.eligibilityModule || {};
      const contactsMod = study.protocolSection?.contactsLocationsModule || {};
      // Company/Organization
      const companyName = idMod.organization?.fullName || '';
      // Dates
      const startDate = statusMod.startDateStruct?.date || '';
      const primaryCompletionDate = statusMod.primaryCompletionDateStruct?.date || '';
      const completionDate = statusMod.completionDateStruct?.date || '';
      // Arms/Interventions
      const arms = (armsMod.armGroups || []).map(arm => ({
        label: arm.label,
        type: arm.type,
        description: arm.description,
        interventionNames: arm.interventionNames
      }));
      // Outcomes
      const primaryOutcomes = (outcomesMod.primaryOutcomes || []).map(o => ({
        measure: o.measure,
        description: o.description,
        timeFrame: o.timeFrame
      }));
      const secondaryOutcomes = (outcomesMod.secondaryOutcomes || []).map(o => ({
        measure: o.measure,
        description: o.description,
        timeFrame: o.timeFrame
      }));
      // Trial sites
      const locations = (contactsMod.locations || []).map(loc => ({
        facility: loc.facility,
        city: loc.city,
        state: loc.state,
        country: loc.country,
        status: loc.status,
        contacts: loc.contacts || []
      }));
      return {
        nctId: idMod.nctId || '',
        companyName, // <-- Add this line
        title: idMod.briefTitle || '',
        condition: (condMod.conditions || []).join(', '),
        status: statusMod.overallStatus || '',
        startDate,
        primaryCompletionDate,
        completionDate,
        briefSummary: descMod.briefSummary || '',
        detailedDescription: descMod.detailedDescription || '',
        studyType: designMod.studyType || '',
        phases: (designMod.phases || []).join(', '),
        enrollment: designMod.enrollmentInfo?.count || '',
        arms,
        primaryOutcomes,
        secondaryOutcomes,
        eligibilityCriteria: eligibilityMod.eligibilityCriteria || '',
        locations
      };
    });

    res.render('clinicaltrials', {
      title: `Clinical Trials for ${drugName}`,
      trials,
      searchTerm: drugName,
      nextPageToken,
      prevPageToken: pageToken // Pass current token as prevPageToken for "Back" button
    });
  } catch (error) {
    console.error('Error fetching clinical trials:', error);
    res.render('home', {
      title: 'Drug and Literature Search',
      error: 'Error fetching clinical trials information.'
    });
  }
});

module.exports = router;
