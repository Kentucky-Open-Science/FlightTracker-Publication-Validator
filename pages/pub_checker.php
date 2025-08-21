<!DOCTYPE html>
<html>
<head>
    <title>REDCap Lookup</title>
</head>
<body>

<input type="text" id="linkblueInput" placeholder="Input a linkblue ID.">
<button class='ajax' data-include-csrf-token data-api-url>POST with CSRF token to API URL</button>


<table id="publication_table" border="1">
    <thead>
    <tr><th>Record ID</th><th>LinkBlue</th></tr>
    </thead>
    <tbody></tbody>
</table>

<script>
    function fetchREDCapData() {
        const linkblue = document.getElementById('linkblueInput').value;

        fetch('https://redcap.ai.uky.edu/api/get-citations-by-userid', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'linkblue=' + encodeURIComponent(linkblue)
        })
            .then(response => response.json())
            .then(data => {
                const tbody = document.querySelector('#publication_table tbody');
                tbody.innerHTML = '';
                data.forEach(record => {
                    const row = document.createElement('tr');
                    row.innerHTML = `<td>${record.record_id}</td><td>${record.linkblue}</td>`;
                    tbody.appendChild(row);
                });
            });
    }
</script>

</body>
</html>
