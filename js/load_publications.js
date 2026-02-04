const all_records = {}; // Stores all citation data grouped by user and year

document.addEventListener('DOMContentLoaded', function() {
    let buttonRow = document.getElementsByClassName('mb-3')[0];

    if (buttonRow) {
        let popButton = document.createElement('button');
        popButton.className = 'btn btn-xs btn-primary fs13';
        popButton.type = 'button';
        popButton.id = 'populate-pubs';
        popButton.textContent = 'Load Pubs into Validator';
        popButton.style.marginRight = '4px';
        popButton.onclick = function() {
            console.log('Data is being retrieved from the API sources you provided. This will take some time.');
            api_keys.forEach(key => {
                const records_data = {
                    token: key,
                    content: 'record',
                    action: 'export',
                    format: 'json',
                    type: 'flat',
                    csvDelimiter: '',
                    'fields[0]': 'record_id',
                    'fields[1]': 'identifier_first_name',
                    'fields[2]': 'identifier_middle',
                    'fields[3]': 'identifier_last_name',
                    'fields[4]': 'identifier_userid',
                    'fields[5]': 'citation_full_citation',
                    'fields[6]': 'citation_date',
                    rawOrLabel: 'raw',
                    rawOrLabelHeaders: 'raw',
                    exportCheckboxLabel: 'false',
                    exportSurveyFields: 'false',
                    exportDataAccessGroups: 'false',
                    returnFormat: 'json-array'
                };

                $.post(api_url, records_data)
                .done(response => {
                    response.forEach(object => {
                        const {
                            record_id,
                            identifier_userid: user_id,
                            identifier_first_name: first_name,
                            identifier_last_name: last_name,
                            citation_full_citation: citation,
                            citation_date
                        } = object;

                        const citationYear = citation_date.split("-")[0];
                        const key = record_id;

                        // Check if user already exists in all_records
                        if (!all_records[key]) {
                            all_records[key] = {
                                record_id,
                                user_id,
                                first_name,
                                last_name,
                                citations: {}
                            };
                        }

                        if (citationYear !== '') {
                            // Ensure the year key exists in the user's citations object
                            if (!all_records[key].citations[citationYear]) {
                                all_records[key].citations[citationYear] = [];
                            }

                            // Add the citation to the array for the correct year, if it’s not empty
                            if (citation) {
                                all_records[key].citations[citationYear].push(citation);
                            }
                        }
                    });

                    console.log(all_records); // Log final all_records object with merged citations by year
                })
                .fail((jqXHR, textStatus, errorThrown) => {
                    console.error('Request failed: ' + textStatus, errorThrown);
                });
            });
 
        };

        buttonRow.appendChild(popButton);
    }
});
