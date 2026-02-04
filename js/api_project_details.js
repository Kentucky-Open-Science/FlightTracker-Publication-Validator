console.log('cohort_sort.js loaded');

addEventListener('load', (event) => {
    // Start fetching the project details as soon as the page loads
    fetchProjectDetailsAndPopulateLabels();
    
    const moduleRow = Array.from(document.querySelectorAll('#external-modules-enabled tr')).find(row => {
        const moduleTitle = row.querySelector('.external-modules-title .module-name');
        return moduleTitle && moduleTitle.textContent.includes('Flight Tracker Publication Validator');
    });

    // Find the "Configure" button within that row
    if (moduleRow) {
        const configureButton = moduleRow.querySelector('.external-modules-configure-button');
        if (configureButton) {
            // Do something with the "Configure" button
            configureButton.setAttribute("onclick", "setLabels()");
        } else {
            console.log('Configure button not found');
        }
    } else {
        console.log('Module not found');
    }
});

// Fetch project details and populate the labels immediately
function fetchProjectDetailsAndPopulateLabels() {
    let api_labels = document.getElementsByClassName('api_label');
    
    // We'll ensure that we don't exceed the bounds of api_labels
    api_keys.forEach((key, index) => {
        const data = {
            token: key,
            content: 'project',
            format: 'json',
            returnFormat: 'json'
        };

        fetch('https://redcap.ai.uky.edu/api/', {
            method: 'POST',
            body: new URLSearchParams(data)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(output => {
            console.log(output)
            // Ensure we don't exceed the array bounds for api_labels
            if (api_labels[index]) {
                console.log(output)
                api_labels[index].innerText = output.project_title;
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });

    console.log(api_labels);
}

function setLabels() {
    // This function can be kept for any further interaction on the configure button
    let labels = document.getElementsByClassName('api_label');
    console.log(labels);
    
    for(let i of labels) {
        console.log(labels[i], api_lables[i]);
        labels[i].innerHTML = api_labels[i];
    }
    console.log("Configure button clicked. Additional logic can be added here.");
}
