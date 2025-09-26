const all_records = {}; // Stores all citation data grouped by user and year
const selections = {}; // Stores user selections until the end so that they can be saved into the DB as one string with formatting for readability

console.log('script loaded');

function insertChoice(element_id, textarea_id) {
    const selected = selections[textarea_id];

    // If selected.length is greater than 0, we need to make sure we don't have duplicate elements
    if (selected.length > 0) {
        const index = selected.findIndex(id => id === element_id); // find index, returns -1 if not in the array

        // If -1, then the element is not there, if it is g.t. we want to remove the element at that index
        if (index > -1) {
            selected.splice(index, 1);
        }
        else {
            selected.push(element_id);
        }
    }
    else {
        selected.push(element_id);
    }

    selections[textarea_id] = selected;
    //console.log(selections[textarea_id]);
}

function setValues() {
    for (const [key, value] of Object.entries(selections)) {
        let formatted = value.join(' | ');
        document.getElementById(key).value = formatted;
    }
}

let got_idents = false;

document.addEventListener('DOMContentLoaded', async function () {
    const linkblue_div = document.querySelector('div[data-mlm-type="label"]');
    const linkblue = linkblue_div ? linkblue_div.textContent.trim() : null;

    console.log('Linkblue:', linkblue); // Debug: ensure linkblue is captured correctly'

    let textAreas = document.getElementsByTagName('textarea');
    for(let i=0; i<textAreas.length; i++) {
        if (textAreas[i].name.includes('supported_pubs')) {
            textAreas[i].classList.add("@HIDDEN");
        }
    }

    /// Flat return doesn't work with this data, so lets reconstruct it that way
        const flatten = (rows) => {
            const flattened = [];

            rows.forEach(({ record, redcap_repeat_instrument, redcap_repeat_instance, field_name, value }) => {
                let exists = flattened.some(obj => obj['redcap_repeat_instance'] === redcap_repeat_instance); // we're checking to see if this value is in list already
                if (exists) {
                    /* The repeat instance already exists, so we just add the new field to that record */
                    let match = flattened.find(obj => obj['redcap_repeat_instance'] === redcap_repeat_instance);
                    match[field_name] = value;
                }
                else { 
                    /* Add a whole new record to the list based on repeat instance */
                    flattened.push({
                        'record': record,
                        'redcap_repeat_instrument': redcap_repeat_instrument,
                        'redcap_repeat_instance': redcap_repeat_instance,
                        [field_name]: value
                    });
                }
            });

            return Object.values(flattened);
        };
        
        // Separate request to get the user data for the currently requested user
        const fetchIdents = (key) => {
            const idents_data = {
                token: key,
                content: 'record',
                action: 'export',
                format: 'json',
                type: 'flat',
                csvDelimiter: '',
                fields: [
                    'record_id',
                    'identifier_userid',
                    'identifier_first_name',
                    'identifier_last_name',
                ],
                rawOrLabel: 'label', // we don't want numeric representations if we get multiple choice answers
                rawOrLabelHeaders: 'raw',
                exportCheckboxLabel: 'false',
                exportSurveyFields: 'false',
                exportDataAccessGroups: 'false',
                returnFormat: 'json',
                filterLogic: `[identifier_userid]='${linkblue}'`
            };

            return new Promise((resolve, reject) => {
                $.post(api_url, idents_data)
                    .done(response => {
                        resolve(response);
                    })
                    .fail((jqXHR, textStatus, errorThrown) => reject(new Error(`Request failed: ${textStatus} ${errorThrown}`)));
            });
        };

        // Function to fetch records for a single API key
        const fetchRecords =  async (key) => {
            if (!got_idents) {
                const idents = await fetchIdents(key);
                got_idents = true;
            }

            const records_data = {
                token: key,
                content: 'record',
                action: 'export',
                format: 'json',
                type: 'eav',
                csvDelimiter: '',
                fields: [
                    'citation_pmid',
                    'citation_full_citation',
                    'citation_date'
                ],
                rawOrLabel: 'label', // we don't want numeric representations if we get multiple choice answers
                rawOrLabelHeaders: 'raw',
                exportCheckboxLabel: 'false',
                exportSurveyFields: 'false',
                exportDataAccessGroups: 'false',
                returnFormat: 'json',
                filterLogic: `[identifier_userid]='${linkblue}'`
            };

            return new Promise((resolve, reject) => {
                $.post(api_url, records_data)
                    .done(response => {
                        const flattened = flatten(response); // spit out data reconstituted into a "flat" style
                        resolve(flattened);
                    })
                    .fail((jqXHR, textStatus, errorThrown) => reject(new Error(`Request failed: ${textStatus} ${errorThrown}`)));
            });
        };

        try {
            // Fetch data from all API keys
            const allResponses = await Promise.all(api_keys.map(fetchRecords));

            console.log('All Responses:', allResponses); // Debug: ensure data is fetched correctly

            // Process the fetched data
            const grouped_by_year = {};
            allResponses.forEach(response => {
                response.forEach(object => {
                    const date = new Date(object.citation_date);
                    const citationYear = date.getFullYear().toString();

                    if (citationYear !== '') {
                        console.log('Citation Year:', citationYear); // Debug: check citation year extraction
                        if (grouped_by_year[citationYear]) {
                            grouped_by_year[citationYear].push(object);
                        }
                        else {
                            grouped_by_year[citationYear] = []
                            grouped_by_year[citationYear].push(object);
                        }
                    }
                });
            });

            console.log('User Citations:', grouped_by_year); // Debug: ensure citations are filtered correctly

            // Update the survey rows with user citations
            document.querySelectorAll('tr[id^="supported_pubs_"]').forEach(row => {
                let row_id = row.id;
                row_id = row_id.split('-')[0];
                const textarea = document.getElementById(row_id);
                //textarea.classList.add('@HIDDEN');
                //console.log(row_id);
                let row_year = row_id.split('_').pop();

                selections[row_id] = []; // we want each row_id as a key in the object
                console.log(selections);

                const dataCell = row.querySelector('td.data.col-5');
                if (dataCell) {
                    // Loop through available citations for the user
                    Object.entries(user_citations).forEach(([year, citations]) => {
                        if (year >= row_year) {
                            citations.forEach(citation => {
                                const customElement = document.createElement('div');
                                // Update below to get an ID from somewhere that shows you the correct table.
                                console.log(row_id);
                                customElement.innerHTML = `
                                <input id="${citation}" type="checkbox" onclick="insertChoice(this.id, '${row_id}')">
                                <label class="mc" for="${citation}">${citation} (${year})</label>
                            `;
                                dataCell.appendChild(customElement);
                            });
                        }
                    });
                }

                const submit_row = document.querySelector('tr[class="surveysubmit"]');
                const testButton = document.createElement('div');
                //testButton.innerHTML = `<input  type="button" id="test_button" onclick="setValues()">Test</input>`
                dataCell.appendChild(testButton);
            });



            // Select the button using its attributes (e.g., `name` or `class`)
            const submitButton = document.querySelector('button[name="submit-btn-saverecord"]');

            if (submitButton) {
                // Add extra functionality without overwriting the existing `onclick`
                const existingOnclick = submitButton.getAttribute('onclick');
                const newOnclick = `
            setValues();
        ` + existingOnclick;
                //submitButton.onclick = 'setValues();$(this).button("disable");dataEntrySubmit(this);return false;';
                submitButton.setAttribute('onclick', newOnclick);
            }

        } catch (error) {
            console.error('Error fetching data:', error);
        }
});
