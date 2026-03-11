const ExternalModules = window.ExternalModules || {};
ExternalModules.CSRF_TOKEN = '<?= $module->getCSRFToken() ?>';

const all_records = {}; // Stores all citation data grouped by user and year
const selections = {}; // Stores user selections until the end so that they can be saved into the DB as one string with formatting for readability

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
}

function setValues() {
    for (const [key, value] of Object.entries(selections)) {
        let formatted = value.join(' | ');
        document.getElementById(key).value = formatted;
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    const userid_div = document.querySelector('div[data-mlm-type="label"]');
    const userid = userid_div ? userid_div.textContent.trim() : null;

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

    let textAreas = document.getElementsByTagName('textarea');
    for(let i=0; i<textAreas.length; i++) {
        if (textAreas[i].name.includes('supported_pubs')) {
            textAreas[i].classList.add("@HIDDEN");
        }
    }

    // Flat return doesn't work with this data, so let's reconstruct it that way
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
                filterLogic: `[identifier_userid]='${userid}'`
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
                filterLogic: `[identifier_userid]='${userid}'`
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
            const allIdents = await Promise.all(api_keys.map(fetchIdents));
            const allResponses = await Promise.all(api_keys.map(fetchRecords));

            // Process the fetched data
            const grouped_by_year = {};
            allResponses.forEach(response => {
                response.forEach(object => {
                    const date = new Date(object.citation_date);
                    const citationYear = date.getFullYear().toString();
                    const pmid = object.citation_pmid;

                    // Ensure we have a valid year and PMID
                    if (citationYear !== 'NaN' && pmid) {
                        if (!grouped_by_year[citationYear]) {
                            grouped_by_year[citationYear] = [];
                        }

                        // CHECK: Does this PMID already exist in this year's array?
                        const isDuplicate = grouped_by_year[citationYear].some(item => item.citation_pmid === pmid);

                        if (!isDuplicate) {
                            grouped_by_year[citationYear].push(object);
                        } else {
                            // DEBUG
                            // console.log(`Skipped duplicate PMID: ${pmid} for year ${citationYear}`);
                        }
                    }
                });
            });

            // Generate the checkboxes
            document.querySelectorAll('tr[id^="supported_pubs_"]').forEach(row => {
                let row_id_base = row.id.split('-')[0];
                const textarea = document.getElementById(row_id_base);
                if (!textarea) return;

                let row_year = row_id_base.split('_').pop();
                selections[row_id_base] = [];

                const dataCell = row.querySelector('td.data'); // Simplified selector for better compatibility
                if (dataCell) {
                    const addedPmidsInThisRow = new Set(); // Track PMIDs for this specific row

                    let i=0;
                    Object.entries(grouped_by_year).forEach(([year, citations]) => {
                        if (parseInt(year) >= parseInt(row_year)) {
                            citations.forEach(citation => {
                                const pmid = citation.citation_pmid;
                                const fullCitation = citation.citation_full_citation;

                                // Skip if we already added this PMID to this specific row
                                if (addedPmidsInThisRow.has(pmid)) return;
                                addedPmidsInThisRow.add(pmid);

                                const customElement = document.createElement('div');

                                if (i === 0) {
                                    customElement.innerHTML += '<hr>'
                                }
                                // Create a version of the citation text safe for the HTML attribute
                                customElement.innerHTML += `
                                    <input id="${fullCitation}" 
                                        type="checkbox" 
                                        onclick="insertChoice(this.id, '${row_id_base}')" 
                                        style="margin-right: 5px;">
                                    <label class="mc" for="${pmid}">
                                        PMID: <a href="https://pubmed.ncbi.nlm.nih.gov/${pmid}" target="_blank">${pmid}</a> (${year})
                                        <p class="citation" data-full="${fullCitation}">
                                            ${fullCitation.length > 400 ? fullCitation.slice(0, 400) + '...' : fullCitation}
                                            ${fullCitation.length > 400 ? '<span class="toggle" style="z-index:9999;"> more</span>' : ''}
                                        </p>
                                    </label>
                                    <hr>
                                `;
                                dataCell.appendChild(customElement);

                                i++;
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

document.addEventListener("click", function(e) {
    if (!e.target.classList.contains("toggle")) return;

    // STOP the click from bubbling up to the <label> and triggering the checkbox
    e.preventDefault();
    e.stopPropagation();

    const p = e.target.closest(".citation");
    const full = p.dataset.full;

    if (e.target.textContent.trim() === "more") {
        p.innerHTML = `${full} <span class="toggle" style="z-index:9999;"> less</span>`;
    } else {
        p.innerHTML = `${full.slice(0,400)}... <span class="toggle" style="z-index:9999;"> more</span>`;
    }
});
