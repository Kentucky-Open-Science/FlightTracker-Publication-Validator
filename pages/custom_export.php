<?php
/** @var \ExternalModules\AbstractExternalModule $module */
$page = "custom-export";
$instruments = REDCap::getInstrumentNames();
$csrf = $module->getCSRFToken();

// Will use this value later for batching requests if max_input is hit
$maxInputVars = ini_get('max_input_vars') ?: 1000;
$completed = $module->getCompleted();
?>
<link rel="stylesheet" href="<?= $module->getUrl('css/modals.css') ?>">

<div>
    <h1>Users Who Completed Validation</h1>
</div>

<div class="selection-btns">
    <div>
        <a id="preview-btn">
            <div class="center-home-sects">
                <span><i class="fas fa-file-export"></i></span>
                <span>Preview & Export CSV</span>
            </div>
        </a>
    </div>
</div>

<table id="user_table" class="dataTable cell-border no-footer">
    <thead>
        <tr>
            <th>Record ID</th>
            <th>LinkBlue</th>
            <th>Name</th>
        </tr>
    </thead>
</table>

<script>
    let builtCSV = ''; // store globally for export

    /* Create the basic modal structure */
    function buildModal() {
        if (document.getElementById('modal-overlay')) {
            return; // Modal already exists
        }

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.id = 'comparison-modal';

        const modalBox = document.createElement('div');
        modalBox.className = 'modal-box';

        return { modalOverlay, modalBox };
    }

    function preview() {
        const completed = <?= json_encode($completed); ?>;

        console.log(completed);

        const rows = [];
        rows.push(['record_id', 'linkblue', 'name', 'year', 'services', 'publication']);

        completed.forEach(record => {
            Object.keys(record).forEach(key => {
                /*if ((key.startsWith('services_req_') && record[key])) {
                    const service_year = key.split('_').pop();
                    if (service_year.startsWith('year')) {

                    }
                }*/

                if (key.startsWith('supported_pubs_') && record[key]) {
                    const year = key.split('_').pop();

                    const pubs = record[key]
                        .split('\t')
                        .map(p => p.trim())
                        .filter(p => p.length > 0);

                    const services = record[`services_req_${year}`] ?? '';

                    pubs.forEach(pub => {
                        rows.push([
                            record.record_id,
                            record.linkblue,
                            record.name,
                            year,
                            services,
                            pub
                        ]);
                    });
                }
            });
        });

        // Convert to CSV string
        builtCSV = rows.map(row =>
            row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        renderPreview(rows);
    }

    function renderPreview(rows) {
        const built = buildModal();
        if (!built) return;

        const { modalOverlay, modalBox } = built;

        let modalContent = `
            <h1>CSV Preview</h1>
            <div id='tableContainer'>
                <table id='preview' class='dataTable cell-border no-footer'>
        `;

        // Header (first row only)
        modalContent += '<thead><tr>';
        rows[0].forEach(cell => {
            modalContent += `<th>${cell}</th>`;
        });
        modalContent += '</tr></thead>';

        // Body
        modalContent += '<tbody>';

        rows.slice(1).forEach((row, rowIndex) => {
            modalContent += `<tr class='${rowIndex % 2 ? 'odd' : 'even'}'>`;

            row.forEach(cell => {
                modalContent += `<td>${cell}</td>`;
            });

            modalContent += '</tr>';
        });

        const closeModal = () => {
            if (modalOverlay && modalOverlay.parentNode) {
                modalOverlay.parentNode.removeChild(modalOverlay);
            }
        };

        modalContent += `
                    </tbody>
                </table>
            </div>
            <div id='modalFooter'>
                <a id='close_btn' class='btns close-btn'>Cancel</a>
                <a id='confirm_btn'  class='btns confirm-btn'>Confirm Export</a>
            </div>
        `;

        modalBox.innerHTML = modalContent;
        modalOverlay.appendChild(modalBox);
        document.body.appendChild(modalOverlay);

        // Close modal on Cancel or background click
        document.getElementById('close_btn').addEventListener('click', (event) => {
            closeModal(false); // close modal but no checkpoint
        });
        document.getElementById('confirm_btn').addEventListener('click', (event) => {
            export_csv(); // close modal but no checkpoint
        });
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) {
                closeModal(false); // close modal but no checkpoint
            }
        });
    }

    function export_csv() {
        if (!builtCSV) {
            alert('No data to export.');
            return;
        }

        const blob = new Blob([builtCSV], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'validation_export.csv';
        link.click();
    }

    function downloadCSV(rows) {
        const csvContent = rows.map(row =>
            row.map(value =>
                `"${String(value).replace(/"/g, '""')}"`
            ).join(',')
        ).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'export.csv';
        link.click();
    }

    document.addEventListener('DOMContentLoaded', () => {
        const userTable = document.getElementById('user_table');
        const completed = <?= json_encode($completed); ?>;

        const body = document.createElement('tbody');
        userTable.appendChild(body);

        // Build the table rows for each suer
        completed.forEach((record, i) => {
            let row = document.createElement('tr');
            row.id = record.record_id;
            row.classList = i % 2 !== 0 ? 'odd' : 'even';
            row.innerHTML = `
                <td>${record.record_id}</td>
                <td>${record.linkblue}</td>
                <td>${record.name}</td>
            `;

            body.appendChild(row);
        });

        userTable.appendChild(body);

        document.getElementById('preview-btn').addEventListener('click', () => {
           preview();
        });

    });
</script>
