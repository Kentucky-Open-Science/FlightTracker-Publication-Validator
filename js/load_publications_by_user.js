const ExternalModules = window.ExternalModules || {};
ExternalModules.CSRF_TOKEN = '<?= $module->getCSRFToken() ?>';

const all_records = {}; // Stores all citation data grouped by user and year
const selections = {}; // Stores user selections until the end so that they can be saved into the DB as one string with formatting for readability

console.log('script loaded');

console.log('API Url:' + api_url);

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

    // Flat return doesn't work with this data, so lets reconstruct it that way
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

        // Function to fetch records for a single API key
        const fetchRecords =  async (key) => {
            const records_data = {
                token: key,
                redcap_csrf_token: ExternalModules.CSRF_TOKEN,
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
                        console.log(response)
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

            // Generate the checkboxes
            document.querySelectorAll('tr[id^="supported_pubs_"]').forEach(row => {
                let row_id_base = row.id.split('-')[0];
                const textarea = document.getElementById(row_id_base);
                if (!textarea) return;

                let row_year = row_id_base.split('_').pop();
                selections[row_id_base] = [];

                const dataCell = row.querySelector('td.data'); // Simplified selector for better compatibility
                if (dataCell) {
                    // CHANGED: Corrected variable name from `user_citations` to `grouped_by_year`
                    Object.entries(grouped_by_year).forEach(([year, citations]) => {
                        if (parseInt(year) >= parseInt(row_year)) {
                            citations.forEach(citation => {
                                // CHANGED: Use a unique ID like pmid and the full citation text for the label.
                                const pmid = citation.citation_pmid || `record-${citation.record}-inst-${citation.redcap_repeat_instance}`;
                                const fullCitation = citation.citation_full_citation;

                                const customElement = document.createElement('div');

                                // Create a version of the citation text safe for the HTML attribute
                                const hoverText = fullCitation.replace(/"/g, '&quot;');
                                customElement.innerHTML = `
                                    <input id="${pmid}" type="checkbox" onclick="insertChoice(this.id, '${row_id_base}')" style="margin-right: 5px;">
                                    <label class="mc" for="${pmid}" title="${hoverText}">
                                        PMID: <a href="https://pubmed.ncbi.nlm.nih.gov/${pmid}" target="_blank">${pmid}</a> (${year})
                                    </label>                                `;
                                dataCell.appendChild(customElement);
                            });
                        }
                    });
                }
            });

            // Inject CSS once
            (function addTooltipStyles() {
                if (document.getElementById("custom-tooltip-style")) return; // don’t add twice

                const style = document.createElement("style");
                style.id = "custom-tooltip-style";
                style.textContent = `
                    .tooltip {
                    position: relative;
                    cursor: help;
                    }

                    .tooltip::after {
                    content: attr(data-tooltip);
                    position: absolute;
                    bottom: 125%; /* show above */
                    left: 50%;
                    transform: translateX(-50%);
                    white-space: normal; /* wrap long text */
                    background: rgba(0, 0, 0, 0.85);
                    color: #fff;
                    padding: 6px 10px;
                    border-radius: 6px;
                    font-size: 0.85em;
                    min-width: 200px;
                    max-width: 400px;
                    display: none;
                    z-index: 1000;
                    }

                    .tooltip:hover::after {
                    display: block;
                    }
                `;
                document.head.appendChild(style);
            })();

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
