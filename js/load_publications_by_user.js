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

    // Add loading overlay
    const loadingOverlay = document.createElement("div");
    loadingOverlay.id = "loading-overlay";
    loadingOverlay.innerHTML = `
        <div style="
            position: fixed; 
            top: 0; left: 0; right: 0; bottom: 0; 
            background: rgba(255,255,255,0.8); 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-size: 1.2em; 
            z-index: 9999;">
            <div class="spinner" style="
                border: 6px solid #f3f3f3; 
                border-top: 6px solid #3498db; 
                border-radius: 50%; 
                width: 40px; 
                height: 40px; 
                animation: spin 1s linear infinite;">
            </div>
            <span style="margin-left: 10px;">Loading citations...</span>
        </div>
    `;
    document.body.appendChild(loadingOverlay);

    // Inject spinner animation
    const spinnerStyle = document.createElement("style");
    spinnerStyle.textContent = `
    @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
    }`;
    document.head.appendChild(spinnerStyle);

    (function addTooltipStyles() {
        if (document.getElementById("custom-tooltip-style")) return;

        const style = document.createElement("style");
        style.id = "custom-tooltip-style";
        style.textContent = `
            .tooltip-wrapper {
                position: relative;
                display: inline-block;
                margin-left: 6px;
            }

            .tooltip-icon {
                display: inline-block;
                color: #007bff;
                font-weight: bold;
                cursor: help;
                border: 1px solid #007bff;
                border-radius: 50%;
                width: 16px;
                height: 16px;
                line-height: 14px;
                text-align: center;
                font-size: 12px;
                background: #f8f9fa;
            }

            .tooltip-text {
                visibility: hidden;
                opacity: 0;
                transition: opacity 0.2s;
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.85);
                color: #fff;
                padding: 6px 10px;
                border-radius: 6px;
                font-size: 0.85em;
                min-width: 200px;
                max-width: 400px;
                white-space: normal;
                z-index: 1000;
            }

            .tooltip-wrapper:hover .tooltip-text {
                visibility: visible;
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    })();

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
                                    <input id="${pmid}" 
                                        type="checkbox" 
                                        onclick="insertChoice(this.id, '${row_id_base}')" 
                                        style="margin-right: 5px;">
                                    <label class="mc" for="${pmid}">
                                        PMID: <a href="https://pubmed.ncbi.nlm.nih.gov/${pmid}" target="_blank">${pmid}</a> (${year})
                                    </label>
                                    <span class="tooltip-wrapper">
                                        <span class="tooltip-icon">?</span>
                                        <span class="tooltip-text">${hoverText}</span>
                                    </span>
                                `;
                                dataCell.appendChild(customElement);
                            });
                        }
                    });
                }
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

            // Remove loading overlay
            const overlay = document.getElementById("loading-overlay");
            if (overlay) overlay.remove();

        } catch (error) {
            console.error('Error fetching data:', error);
        }
});
