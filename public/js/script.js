$(document).ready(function() {
    $('#searchForm').on('submit', function(e) {
        e.preventDefault();
        const drugName = $('#drugName').val();
        window.location.href = `/drug?name=${encodeURIComponent(drugName)}`;
    });

    $(document).on('keydown', function(e) {
        if (e.key === '`' || e.key === '~') {
            e.preventDefault(); // Prevent default behavior of the '~' key
            $('#drugName').focus().select(); // Focus and highlight the input
        }
    });
});