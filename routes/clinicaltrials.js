const express = require('express');
const router = express.Router();

// ClinicalTrials.gov v2 API endpoint
// Docs: https://clinicaltrials.gov/api/gui/ref/api_urls

router.get('/', async (req, res) => {
  const drugName = req.query.name;
  if (!drugName) {
    return res.render('home', {
      title: 'Drug and Literature Search',
      error: 'Please enter a drug or intervention name for clinical trials.'
    });
  }

  try {
    // Build the API URL for the new v2 API
    // Example: https://clinicaltrials.gov/api/v2/studies?query=ibrance&fields=NCTId,BriefTitle,Condition,Phase,StartDate,Status,LocationCity,LocationCountry,Interventions,StudyType,EnrollmentCount,LeadSponsorName,LastUpdatePostDate,URL&limit=20
    // Do not encodeURIComponent for query.cond, just use the raw string
    // Use query.term for partial matches (full text search) instead of query.cond
    // This allows for partial and broader matches
    const searchTerm = drugName;
    const apiUrl = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(searchTerm)}&pageSize=50`;
    const response = await fetch(apiUrl);
    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      // If the response is not JSON, show a user-friendly error
      return res.render('home', {
        title: 'Drug and Literature Search',
        error: 'ClinicalTrials.gov API returned an error. Please try a different search term.'
      });
    }

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
      searchTerm: drugName
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
