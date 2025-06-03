$(document).ready(function() {
    $('#searchForm').on('submit', function(e) {
      e.preventDefault();
      const drugName = $('#drugName').val();
      window.location.href = `/drug?name=${encodeURIComponent(drugName)}`;
    });
  });